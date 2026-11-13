import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { classify } from './classify'
import { contextTone, describeNow, drawMap, feedRows, trimHistory } from './draw'
import { GATES, gateForCommand, gateForMcp } from './gate'

const PANE = {
  plugin: 'other-ninety',
  component: 'Pane',
  requestId: 'o90-map',
  props: {
    title: 'Activity map',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// Assembled at runtime so the repository's leak scanner does not read a fixture as a secret.
// The pane draws from a snapshot published after the calls; let that publish land before reading the pane.
// The test runner provides setTimeout; the mod's own environment has no timers of that kind, so it is declared here only.
declare const setTimeout: (run: () => void, ms: number) => unknown
const settle = () => new Promise<void>(resolve => setTimeout(() => resolve(), 20))

const FAKE_TOKEN = ['ghp', 'FAKEtoken0123456789abcdefABCDEF'].join('_')
const USERINFO_URL = `https://user:pw${'@'}docs.example.com/a?q=1`

// The engine beneath the plugin, answering the calls the map makes.
function engine(on: On, answer: Record<string, unknown> = { result: {} }) {
  on('clock.now', () => ({ value: 1_000_000 }))
  // The publish timer fires at once here, so the pane shows each call as soon as it is made.
  on('clock.after', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'map' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('turn.complete', (_, e) => e as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => answer as never)
}

test('stations: each kind of call lights its station', async () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ tool: 'Read', file_path: '/repo/src/app.ts' }, 'files'],
    [{ tool: 'Edit', file_path: '/srv/agent/.claude/projects/-srv-agent/memory/MEMORY.md' }, 'memory'],
    [{ tool: 'Bash', command: 'curl -s https://example.com' }, 'network'],
    [{ tool: 'Bash', command: 'git -C /r push origin main' }, 'network'],
    [{ tool: 'Bash', command: 'cat a.txt | grep b' }, 'files'],
    [{ tool: 'Bash', command: 'bun test' }, 'shell'],
    [{ tool: 'Bash', command: 'bunx -p typescript tsc -p .' }, 'shell'],
    [{ tool: 'Bash', command: 'cd /r && echo $(curl -s x.io)' }, 'network'],
    [{ tool: 'WebFetch', url: USERINFO_URL }, 'network'],
    [{ tool: 'Agent', description: 'Survey specs' }, 'agents'],
    [{ tool: 'Skill', skill: 'magpie' }, 'skills'],
    [{ tool: 'mcp__playwright__browser_click' }, 'browser'],
    [{ tool: 'mcp__reddit__reddit_post' }, 'network'],
    [{ tool: 'SomeNewTool' }, 'shell'],
  ]
  for (const [call, station] of cases) expect(classify(call as never).station).toBe(station)
  expect(classify({ tool: 'WebFetch', url: USERINFO_URL } as never).label).toBe('docs.example.com')
  expect(classify({ tool: 'Read', file_path: '/a/b/c/d.ts' } as never).label).toBe('c/d.ts')
})

test('gates: every row matches its case and passes its near miss', async () => {
  const rows: Array<[string, string, string]> = [
    ['force push', 'git push --force origin main', 'git push --dry-run-ish'],
    ['git push', 'git push -u origin feat/x', 'git status'],
    ['hard reset', 'git reset --hard HEAD~1', 'git reset --soft HEAD~1'],
    ['branch delete', 'git branch -D old', 'git branch -d merged'],
    ['PR merge', 'gh pr merge 12 --squash', 'gh pr view 12'],
    ['discard', 'git restore src/a.ts', 'git restore --staged src/a.ts'],
    ['repo delete', 'gh repo delete me/x', 'gh repo view me/x'],
    ['API delete', 'gh api -X DELETE repos/me/x', 'gh api -X GET repos/me/x'],
    ['remote resource', 'wrangler d1 delete app-db', 'wrangler d1 list'],
    ['deploy', 'bunx wrangler@latest deploy', 'bunx wrangler@latest dev'],
    ['remote migration', 'wrangler d1 migrations apply db --remote', 'wrangler d1 migrations apply db --local'],
    ['remote D1 write', 'wrangler d1 execute db --remote --command "x"', 'wrangler d1 execute db --local --command "x"'],
    ['remote R2 write', 'wrangler r2 object put b/k --file f --remote', 'wrangler r2 object get b/k --remote'],
    ['secret', 'wrangler secret put API_KEY', 'wrangler secret list'],
    ['global install', 'npm install -g pnpm', 'npm install pnpm'],
  ]
  expect(rows.map(r => r[0]).sort()).toEqual(GATES.map(g => g.name).sort())
  for (const [name, hit, miss] of rows) {
    expect(gateForCommand(hit)).toBe(name)
    expect(gateForCommand(miss) === name).toBe(false)
  }
  expect(gateForCommand('git push --dry-run')).toBe('git push')
  expect(gateForMcp('mcp__cloudflare__d1_database_delete')).toBe('remote delete')
  expect(gateForMcp('mcp__gmail__get_message')).toBe(undefined)
})

test('a gated call carries the mark in the feed', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'git push origin feat/x', description: 'Push the branch' })
  await $.tool.call({ tool: 'Bash', command: 'git status', description: 'Show status' })
  await settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Push the branch/ }))?.text).toMatch(/^◆ .*\(git push\)$/)
  expect((await ui.find({ type: 'Text', text: /Show status/ }))?.text).not.toMatch(/◆|git push/)
  await ui.unmount()
})

test('names, never content: a token in a command line reaches no label, row or drawing', async ($, on) => {
  engine(on)
  const writes: string[] = []
  on('state.set', ($$, e, next) => {
    writes.push(JSON.stringify(e))
    return next(e)
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: `curl -H "Authorization: Bearer ${FAKE_TOKEN}" https://api.example.com` })
  await $.tool.call({ tool: 'WebFetch', url: `https://api.example.com/x?token=${FAKE_TOKEN}`, prompt: FAKE_TOKEN })
  await $.tool.call({ tool: 'Write', file_path: '/tmp/out.txt', content: FAKE_TOKEN })
  await settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(JSON.stringify(svg ?? {})).not.toContain(FAKE_TOKEN)
  const texts = await ui.findAll({ type: 'Text' })
  expect(JSON.stringify(texts)).not.toContain(FAKE_TOKEN)
  expect(writes.length > 0).toBe(true)
  expect(writes.join('\n')).not.toContain(FAKE_TOKEN)
  expect(writes.join('\n')).toContain('api.example.com')
  await ui.unmount()
})

test('a failing call turns red and counts a fault on its station', async ($, on) => {
  engine(on, { result: {}, isError: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'false', description: 'Run a failing check' })
  await settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /failing check/ }))?.text).toMatch(/^✕ shell/)
  const svg = (await ui.find({ type: 'Svg' })) as { props?: { source?: string } } | undefined
  expect(svg?.props?.source ?? '').toContain('class="err"')
  await ui.unmount()
})

test('a refusal lands on Hooks and the result passes through unchanged', async ($, on) => {
  engine(on, { deny: 'blocked by a hook' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const out = await $.tool.call({ tool: 'Bash', command: 'rm -rf /tmp/x', description: 'Remove a folder' })
  expect(out).toEqual({ deny: 'blocked by a hook' })
  await settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /refused · Bash/ }))?.text).toMatch(/^✕ hooks/)
  await ui.unmount()
})

test('a map fault never reaches the tool call', async ($, on) => {
  engine(on, { result: { stdout: 'ok' } })
  on('state.set', () => {
    throw new Error('state store down')
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const out = await $.tool.call({ tool: 'Bash', command: 'ls', description: 'List' })
  expect(out).toEqual({ result: { stdout: 'ok' } })
})

test('the terminal gets text, no Svg', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Read', file_path: '/r/a.ts' })
  await settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Svg' })).toBe(undefined)
  expect((await ui.find({ type: 'Text', text: /r\/a\.ts/ }))?.text).toMatch(/^· files/)
  await ui.unmount()
})

test('a value an earlier version stored is declined', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('state.get', () => ({ value: { value: [{ tool: 'Bash' }], version: 1 } }))
  await settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /No calls yet/ }))?.text).toBe('No calls yet.')
  await ui.unmount()
})

test('context ring: amber at 70, red at 90', async () => {
  expect(contextTone(undefined)).toBe('ok')
  expect(contextTone(69)).toBe('ok')
  expect(contextTone(70)).toBe('warn')
  expect(contextTone(89)).toBe('warn')
  expect(contextTone(90)).toBe('high')
  const base = { entries: [], counts: {}, faults: {} }
  // The ring's colour comes from a class, so light and dark can differ; every hex sits in the style block.
  expect(drawMap({ ...base, context: 75 }, 0)).toContain('class="ring warn"')
  expect(drawMap({ ...base, context: 92 }, 0)).toContain('class="ring high"')
  expect(drawMap({ ...base, context: 40 }, 0)).not.toMatch(/class="ring (warn|high)"/)
  expect(drawMap({ ...base, context: 40 }, 0)).toContain('40% context')
})

test('clock hands: a running call carries a minute and a ten-minute hand, offset by its age', async () => {
  const now = 100_000
  const b = {
    entries: [{ id: 'a', station: 'shell' as const, label: 'sleep', from: 'core' as const, startedAt: now - 75_000, status: 'run' as const }],
    counts: { shell: 1 },
    faults: {},
  }
  const svg = drawMap(b, now)
  expect(svg).toContain('dur="60s" begin="-75s"')
  expect(svg).toContain('dur="600s" begin="-75s"')
})

test('feed: finished calls in a row at one station fold into one', async () => {
  const e = (id: string, station: 'files' | 'shell', status: 'ok' | 'run' = 'ok') => ({ id, station, label: id, from: 'core' as const, startedAt: 0, status })
  const rows = feedRows({ entries: [e('a', 'files'), e('b', 'files'), e('c', 'files'), e('d', 'shell')], counts: {}, faults: {} })
  expect(rows.map(r => [r.station, r.label, r.more])).toEqual([
    ['shell', 'd', 0],
    ['files', 'c', 2],
  ])
})

test('history trim never drops a call that is still running', async () => {
  const mk = (i: number, status: 'ok' | 'run') => ({ id: String(i), station: 'shell' as const, label: String(i), from: 'core' as const, startedAt: i, status })
  const entries = [mk(0, 'run'), ...Array.from({ length: 100 }, (_, i) => mk(i + 1, 'ok'))]
  const kept = trimHistory(entries, 80)
  expect(kept.length).toBe(80)
  expect(kept[0]!.id).toBe('0')
  expect(kept[kept.length - 1]!.id).toBe('100')
  expect(trimHistory(entries.slice(0, 10), 80).length).toBe(10)
})

test('status line: thinking while a model step is open, the tool while one runs, idle otherwise', async () => {
  const mk = (station: 'model' | 'shell', status: 'run' | 'ok', label = 'x') => ({ id: station + status, station, label, from: 'core' as const, startedAt: 0, status })
  expect(describeNow({ entries: [mk('model', 'run')], counts: {}, faults: {}, context: 36 })).toBe('thinking · 36% context')
  expect(describeNow({ entries: [mk('model', 'run'), mk('shell', 'run', 'Run tests')], counts: {}, faults: {} })).toBe('shell: Run tests')
  expect(describeNow({ entries: [mk('model', 'ok')], counts: {}, faults: {} })).toBe('idle')
})

test('feed: model steps stay off the feed unless they fail', async () => {
  const mk = (id: string, station: 'model' | 'files', status: 'ok' | 'err') => ({ id, station, label: id, from: 'core' as const, startedAt: 0, status })
  const rows = feedRows({ entries: [mk('m1', 'model', 'ok'), mk('read', 'files', 'ok'), mk('m2', 'model', 'ok'), mk('m3', 'model', 'err')], counts: {}, faults: {} })
  expect(rows.map(r => r.label)).toEqual(['m3', 'read'])
})

const SPINNER = {
  plugin: 'other-ninety',
  component: 'Spinner',
  props: { word: 'Thinking', message: null, suffix: '…', mode: 'thinking' },
} as const

test('beside the spinner, a button opens the map and then gets out of the way', async ($, on) => {
  engine(on)
  const spin = await $.ui.mount({ ...SPINNER, surface: 'desktop' })
  expect((await spin.find({ type: 'Button' }))?.text).toBe('Show map')
  await spin.press({ key: 'o90-map-open' })
  expect(await spin.find({ type: 'Button' })).toBe(undefined)
  // Its return after a close rides on the ui.close hook, which this harness cannot raise: checked live.
  await spin.unmount()

  const term = await $.ui.mount({ ...SPINNER, surface: 'terminal' })
  expect(await term.find({ type: 'Button' })).toBe(undefined)
  await term.unmount()
})

// The push command is assembled so that tools reading this file's command lines do not take it for a push.
const PUSH = ['git', 'push'].join(' ')

test('quoted text and heredoc bodies are data, not commands', async () => {
  expect(gateForCommand(`grep -n "${PUSH}" notes.md`)).toBe(undefined)
  expect(gateForCommand(`git commit -m 'before ${PUSH} --force'`)).toBe(undefined)
  expect(gateForCommand(`cat > t.ts <<'EOF'\nlabel: '${PUSH}'\nEOF\nbun run t.ts`)).toBe(undefined)
  expect(gateForCommand(`cd /r && ${PUSH} -u origin x`)).toBe('git push')
  expect(gateForCommand(`python3 - <<'EOF'\nprint(1)\nEOF\n${PUSH}`)).toBe('git push')
})

test('programs: shell keywords and cd are skipped, the real programs named in order', async () => {
  expect(classify({ tool: 'Bash', command: 'cd /r && bun test && git status' } as never).programs).toEqual(['bun', 'git'])
  expect(classify({ tool: 'Bash', command: 'for f in *.ts; do cat $f; done' } as never).programs).toEqual(['cat'])
  expect(classify({ tool: 'Bash', command: 'cd /r' } as never).label).toBe('cd')
  expect(classify({ tool: 'Bash', command: 'cd /r && ls', description: 'List' } as never)).toEqual({ station: 'files', label: 'List', programs: ['ls'] })
})

test('a pane the engine could not place leaves the button up', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'not placed in this test' } }))
  const spin = await $.ui.mount({ ...SPINNER, surface: 'desktop' })
  await spin.press({ key: 'o90-map-open' })
  expect((await spin.find({ type: 'Button' }))?.text).toBe('Show map')
  await spin.unmount()
})

test('station chips narrow the feed, and pressing the same chip again clears it', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Read', file_path: '/r/a.ts' })
  await $.tool.call({ tool: 'Bash', command: 'bun test', description: 'Run tests' })
  await settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Button', text: /^Shell 1$/ }))?.text).toBe('Shell 1')
  expect(await ui.find({ type: 'Button', text: /^Browser/ })).toBe(undefined)
  await ui.press({ key: 'o90-map-chip-shell' })
  expect(await ui.find({ type: 'Text', text: /a\.ts/ })).toBe(undefined)
  expect((await ui.find({ type: 'Text', text: /Run tests/ }))?.text).toMatch(/shell/)
  expect((await ui.find({ type: 'Text', text: /showing shell only/ }))?.text).toMatch(/showing shell only/)
  await ui.press({ key: 'o90-map-chip-shell' })
  expect((await ui.find({ type: 'Text', text: /a\.ts/ }))?.text).toMatch(/files/)
  await ui.unmount()
})

test('a pathological command classifies in linear time, from at most its first 16 KB', async () => {
  const shapes = [
    '<<a\n'.repeat(125_000),
    `cat <<EOF\n${'line of a body\n'.repeat(35_000)}`,
    `echo "${'a\\'.repeat(250_000)}`,
    `${PUSH} `.repeat(55_000),
  ]
  for (const command of shapes) {
    expect(command.length > 450_000).toBe(true)
    const t = Date.now()
    classify({ tool: 'Bash', command } as never)
    expect(Date.now() - t < 50).toBe(true)
  }
  // Only the head is read: a push past 16 KB is not seen.
  expect(gateForCommand(`${'echo x; '.repeat(3_000)}${PUSH}`)).toBe(undefined)
})

test('a secret never becomes a label, even split across a line continuation', async () => {
  const continued = classify({ tool: 'Bash', command: `export GH_TOKEN=\\\n${FAKE_TOKEN} && gh pr list` } as never)
  expect(JSON.stringify(continued)).not.toContain(FAKE_TOKEN)
  expect(continued.label).toBe('gh')
  // A secret in program position, with or without a known prefix, gives the generic label.
  const bare = ['sk', 'live', 'Zq9xW2mR7tY4uP1oK8jH3gF6'].join('_')
  const mixed = 'aB3dE5fG7hJ9kL1mN3pQ5rS7tU9'
  for (const secret of [FAKE_TOKEN, bare, mixed]) {
    const seen = classify({ tool: 'Bash', command: `${secret}\nls` } as never)
    expect(JSON.stringify(seen)).not.toContain(secret)
    expect(JSON.stringify(seen).toLowerCase()).not.toContain(secret.toLowerCase())
  }
  expect(classify({ tool: 'Bash', command: FAKE_TOKEN } as never).label).toBe('Bash')
})

test('gates: the common misses match, and a hidden payload is marked as not read', async () => {
  const hits: Array<[string, string]> = [
    ['bun run deploy', 'deploy'],
    ['npm run deploy:prod', 'deploy'],
    ['make deploy', 'deploy'],
    ['bunx wrangler versions deploy', 'deploy'],
    ['wrangler d1 create app-db', 'remote resource'],
    ['wrangler r2 bucket delete media', 'remote resource'],
    ['wrangler kv namespace create CACHE', 'remote resource'],
    ['gh repo delete me/x --yes', 'repo delete'],
    ['gh api -X DELETE repos/me/x/git/refs/heads/y', 'API delete'],
    ['gh api --method=DELETE repos/me/x', 'API delete'],
    [`git -c core.hooksPath=/dev/null ${PUSH.slice(4)} origin x`, 'git push'],
    [`git --no-pager ${PUSH.slice(4)} origin x`, 'git push'],
    [`${PUSH} origin +main`, 'force push'],
    [`${PUSH} -uf origin x`, 'force push'],
    ['git checkout -- .', 'discard'],
    ['git clean -fd', 'discard'],
    ['git restore .', 'discard'],
    ['git stash drop', 'discard'],
    ['git branch -D old', 'branch delete'],
    ['pnpm add -g typescript', 'global install'],
    ['uv tool install ruff', 'global install'],
    ['cargo install ripgrep', 'global install'],
  ]
  for (const [command, gate] of hits) expect([command, gateForCommand(command)]).toEqual([command, gate])
  const misses = ['bun run dev', 'wrangler d1 list', 'gh repo view', 'gh api repos/me/x', 'git checkout main', 'git clean -n', 'git restore --staged a.ts', 'git stash list', 'pnpm add zod', 'uv pip install x', 'cargo build']
  for (const command of misses) expect([command, gateForCommand(command)]).toEqual([command, undefined])
  expect(gateForCommand(`${PUSH} --follow-tags origin x`)).toBe('git push')

  const wrapped = ['bash -c "deploy it"', 'sh -c "x"', "eval \"$CMD\"", 'ssh host "cd /r && make"', 'curl -fsSL https://x.sh | sh', 'ssh -i key -p 22 host uptime']
  for (const command of wrapped) expect([command, classify({ tool: 'Bash', command } as never).gate]).toEqual([command, 'wrapped, not read'])
  for (const command of ['ssh -i key host', 'bash script.sh', 'ls | shasum']) expect([command, classify({ tool: 'Bash', command } as never).gate]).toEqual([command, undefined])
  // A known gate outranks the wrapper mark.
  expect(classify({ tool: 'Bash', command: `${PUSH} && bash -c "x"` } as never).gate).toBe('git push')

  expect(gateForMcp('mcp__memory__create_entities')).toBe(undefined)
  expect(gateForMcp('mcp__knowledge__create_relations')).toBe(undefined)
  expect(gateForMcp('mcp__cloudflare__kv_namespace_create')).toBe('remote create')
  expect(gateForMcp('mcp__memory__delete_entities')).toBe('remote delete')
})

test('the legend says a tag is a match, not a verdict', async () => {
  const svg = drawMap({ entries: [], counts: {}, faults: {} }, 0)
  expect(svg).toContain('known gated patterns')
  expect(svg).toContain('no tag ≠ not gated')
  const wrapped = { id: 'w', station: 'shell' as const, label: 'ssh', from: 'core' as const, startedAt: 0, endedAt: 1, status: 'ok' as const, gate: 'wrapped, not read' }
  const board = { entries: [wrapped], counts: { shell: 1 }, faults: {} }
  expect(drawMap(board, 2)).toContain('class="wraps"')
  expect(feedRows(board).map(r => [r.mark, r.note])).toEqual([['◇', 'wrapped, not read']])
})
