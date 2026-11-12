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
const FAKE_TOKEN = ['ghp', 'FAKEtoken0123456789abcdefABCDEF'].join('_')
const USERINFO_URL = `https://user:pw${'@'}docs.example.com/a?q=1`

// The engine beneath the plugin, answering the calls the map makes.
function engine(on: On, answer: Record<string, unknown> = { result: {} }) {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('command.register', () => ({ value: { command: 'map' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
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
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Svg' })).toBe(undefined)
  expect((await ui.find({ type: 'Text', text: /r\/a\.ts/ }))?.text).toMatch(/^· files/)
  await ui.unmount()
})

test('a value an earlier version stored is declined', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('state.get', () => ({ value: { value: [{ tool: 'Bash' }], version: 1 } }))
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
  expect(drawMap({ ...base, context: 75 }, 0)).toContain('#ba7517')
  expect(drawMap({ ...base, context: 92 }, 0)).toContain('#e24b4a')
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

const BAND = {
  plugin: 'other-ninety',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 4, bodyColumns: 80, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const

test('a button above the prompt opens the map and then gets out of the way', async ($, on) => {
  engine(on)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await band.find({ type: 'Button' }))?.text).toBe('Show activity map')
  await band.press({ key: 'o90-map-open' })
  expect(await band.find({ type: 'Button' })).toBe(undefined)
  // Its return after a close rides on the ui.close hook, which this harness cannot raise: checked live.
  await band.unmount()

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Button' })).toBe(undefined)
  await term.unmount()
})
