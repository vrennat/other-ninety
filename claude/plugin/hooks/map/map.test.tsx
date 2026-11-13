import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import type { Entry } from '../../types'
import { classify, exitWhy, isTyped, looksSecret, reachesOut } from './classify'
import recorded from './fixtures/conductor-2026-11-13'
import { GATES, bareCommand, gateForCommand, gateForMcp } from './gate'
import { clockSvg, contextTone, elapsed, sections, trimHistory } from './rows'

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

// The pane draws from a snapshot published after the calls; let that publish land before reading the pane.
// The test runner provides setTimeout; the mod's own environment has no timers of that kind, so it is declared here only.
declare const setTimeout: (run: () => void, ms: number) => unknown
const settle = () => new Promise<void>(resolve => setTimeout(() => resolve(), 20))

// Assembled at runtime so the repository's leak scanner does not read a fixture as a secret.
const FAKE_TOKEN = ['ghp', 'FAKEtoken0123456789abcdefABCDEF'].join('_')
const USERINFO_URL = `https://user:pw${'@'}docs.example.com/a?q=1`

type Call = { tool: string; error?: string; [arg: string]: unknown }

/**
 * The engine beneath the plugin, answering the calls the map makes. A call carrying `error`
 * answers as a tool error with that text; one named `hang` never answers.
 */
type Opts = { now?: () => number; after?: () => unknown; tool?: (c: Call) => unknown }
function engine(on: On, opts: Opts = {}) {
  const now = opts.now ?? (() => 1_000_000)
  on('clock.now', () => ({ value: now() }))
  // Timers fire at once here unless a test holds them, so the pane shows each call as it is made.
  on('clock.after', () => (opts.after ? opts.after() : { value: undefined }) as never)
  on('session.measure', () => ({ changed: [] }) as never)
  on('command.register', () => ({ value: { command: 'map' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('turn.complete', (_, e) => e as never)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('prompt.submit', (_, e) => e as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', (_, e) => {
    const c = e as unknown as Call
    if (opts.tool) return opts.tool(c) as never
    if (c.tool === 'hang') return new Promise<never>(() => {})
    if (c.deny) return { deny: String(c.deny) } as never
    return (c.error !== undefined ? { isError: true, result: c.error, text: c.error } : { result: {} }) as never
  })
}

// The engine a test body gets.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- only to pick the body out of test()'s overloads
type T$ = Parameters<Extract<Parameters<typeof test>[1], (...args: any[]) => unknown>>[0]
const start = ($: T$, surface: 'desktop' | 'terminal' = 'desktop') =>
  $.session.start({ cwd: '/', surface, isInteractive: true })
const typed = { text: 'go', origin: { kind: 'composer' } } as never
const peer = { text: 'Another Claude session sent a message', origin: { kind: 'peer' }, isMeta: true } as never
const notice = { text: '<task-notification>', origin: { kind: 'task-notification' } } as never

/** The pane as lines: the running line, section headings and rows, in order, each its whole text. */
async function paneLines($: T$, surface: 'desktop' | 'terminal' = 'desktop'): Promise<string[]> {
  await settle()
  const ui = await $.ui.mount({ ...PANE, surface })
  const boxes = await ui.findAll({ type: 'Box' })
  await ui.unmount()
  return boxes.filter(b => b.key !== undefined && /^o90-(now|h-|row-)/.test(b.key)).map(b => (b.key!.startsWith('o90-h-') ? `# ${b.text}` : b.text))
}

test('kinds: the app is not the internet, and a row names what left the machine', async () => {
  const cases: Array<[Call, string, string | undefined]> = [
    [{ tool: 'Read', file_path: '/repo/src/app.ts' }, 'files', undefined],
    [{ tool: 'Edit', file_path: '/srv/agent/.claude/projects/-srv-agent/memory/MEMORY.md' }, 'memory', undefined],
    [{ tool: 'Bash', command: 'curl -s https://example.com' }, 'shell', 'curl'],
    [{ tool: 'Bash', command: 'git -C /r push origin main' }, 'shell', 'git push'],
    // The program that reached out is named even when it is the fifth one.
    [{ tool: 'Bash', command: 'cd /r && git status && git log -5 && ls docs | tail && wc -l a.md && gh pr list' }, 'shell', 'gh'],
    [{ tool: 'Bash', command: 'git status && head -3 a.md && ls' }, 'shell', undefined],
    [{ tool: 'Bash', command: 'bunx -p typescript tsc -p .' }, 'shell', undefined],
    [{ tool: 'Bash', command: 'cd /r && echo $(curl -s x.io)' }, 'shell', 'curl'],
    [{ tool: 'WebFetch', url: USERINFO_URL }, 'web', 'docs.example.com'],
    [{ tool: 'WebSearch', query: 'x' }, 'web', 'web search'],
    [{ tool: 'mcp__reddit__reddit_post' }, 'web', 'reddit'],
    [{ tool: 'mcp__ccd_turn__wrap_up' }, 'app', undefined],
    [{ tool: 'mcp__ccd_turn__update_plan' }, 'app', undefined],
    [{ tool: 'mcp__ccd_session_mgmt__send_message' }, 'session', undefined],
    [{ tool: 'mcp__ccd_session_mgmt__archive_session' }, 'session', undefined],
    [{ tool: 'mcp__ccd_session__start_session' }, 'session', undefined],
    [{ tool: 'mcp__ccd_session_mgmt__list_events' }, 'app', undefined],
    [{ tool: 'mcp__terminal__read_terminal' }, 'tool', undefined],
    [{ tool: 'SendMessage', to: 'x', message: FAKE_TOKEN }, 'session', undefined],
    [{ tool: 'SendUserFile', files: ['a'] }, 'app', undefined],
    [{ tool: 'ToolSearch', query: 'x' }, 'app', undefined],
    [{ tool: 'Agent', description: 'Survey specs' }, 'agent', undefined],
    [{ tool: 'Skill', skill: 'magpie' }, 'skill', undefined],
    [{ tool: 'mcp__playwright__browser_click' }, 'browser', undefined],
    [{ tool: 'mcp__claude-in-chrome__navigate', url: `https://example.com/a?token=${FAKE_TOKEN}` }, 'browser', 'example.com'],
    [{ tool: 'mcp__playwright__browser_navigate', url: 'http://localhost:5173' }, 'browser', undefined],
    [{ tool: 'mcp__claude-in-chrome__tabs_create_mcp' }, 'browser', 'browser'],
    [{ tool: 'WebFetch', url: 'http://localhost:3000/a' }, 'web', undefined],
    [{ tool: 'mcp__Claude_Preview__preview_start' }, 'tool', undefined],
    [{ tool: 'SomeNewTool' }, 'tool', undefined],
  ]
  for (const [call, kind, via] of cases) {
    const c = classify(call as never)
    expect([call.tool, c.kind, c.via]).toEqual([call.tool, kind, via])
  }
  expect(classify({ tool: 'Read', file_path: '/a/b/c/d.ts' } as never).label).toBe('Read c/d.ts')
  expect(classify({ tool: 'Write', file_path: '/a/b/c/d.ts' } as never).label).toBe('Wrote c/d.ts')
  expect(classify({ tool: 'mcp__ccd_session_mgmt__archive_session' } as never).label).toBe('Archived a session')
  // Opening a tab is not a remote change.
  expect(classify({ tool: 'mcp__claude-in-chrome__tabs_create_mcp' } as never).gate).toBe(undefined)
})

test('reaching out: prefixes, separators, runners and more programs hide nothing; loopback stays local', async () => {
  const out: Array<[string, string]> = [
    ['env A=1 curl x.io', 'curl'],
    ['timeout 5 curl x.io', 'curl'],
    ['nohup curl x.io &', 'curl'],
    ['xargs curl', 'curl'],
    ['cat urls | xargs -n1 curl', 'curl'],
    ['sleep 1 & curl x.io', 'curl'],
    ['(curl x.io)', 'curl'],
    ['echo `curl x.io`', 'curl'],
    ['command curl x.io', 'curl'],
    ['nice -n 5 curl x.io', 'curl'],
    ['sudo -u bob curl x.io', 'curl'],
    ['git -c core.x=y push', 'git push'],
    ['git --no-pager fetch', 'git fetch'],
    ['git -C /r pull', 'git pull'],
    ['bunx wrangler deploy', 'wrangler'],
    ['npx wrangler d1 list', 'wrangler'],
    ['npm exec -- wrangler deploy', 'wrangler'],
    ['uv add httpx', 'uv add'],
    ['cargo install ripgrep', 'cargo install'],
    ['go get example.com/x', 'go get'],
    ['aws s3 ls', 'aws'],
    ['gcloud run deploy', 'gcloud'],
    ['kubectl get pods', 'kubectl'],
    ['docker run alpine', 'docker run'],
    [`sftp me${'@'}box`, 'sftp'],
    [`psql postgres://u${'@'}db.example.com/x`, 'psql'],
    ['mysql -h db.example.com', 'mysql'],
    ['claude -p hi', 'claude'],
    ['open https://example.com', 'open'],
    ['ssh host uptime', 'ssh'],
  ]
  for (const [command, via] of out) expect([command, reachesOut(bareCommand(command))]).toEqual([command, via])
  const local = ['curl localhost:5173', 'curl -s http://127.0.0.1:8787/x', 'curl http://[::1]:3000', `psql postgres://u${'@'}localhost/db`, 'open http://app.localhost:5173', 'open README.md', 'git status', 'bun test', 'docker ps', 'echo curl']
  for (const command of local) expect([command, reachesOut(bareCommand(command))]).toEqual([command, undefined])
  // A loopback address beside a remote one is not local.
  expect(reachesOut(bareCommand('curl localhost:1 https://x.io'))).toBe('curl')
})

test('a description that holds a credential-shaped word is never a label', async () => {
  const shell = classify({ tool: 'Bash', command: 'curl https://api.x.io', description: `Call API with Bearer ${FAKE_TOKEN}` } as never)
  expect(JSON.stringify(shell)).not.toContain(FAKE_TOKEN)
  expect(shell.label).toBe('curl')
  const agent = classify({ tool: 'Agent', description: `use token=${'abc'}123`, subagent_type: 'Explore' } as never)
  expect(agent.label).toBe('Explore')
  expect(classify({ tool: 'Bash', command: 'ls', description: 'List the files' } as never).label).toBe('List the files')
})

test("typed by the person: the engine's own test, composer, bridge or person; not sdk, Slack, notices or peers", async () => {
  for (const kind of ['composer', 'bridge', 'person']) expect([kind, isTyped({ origin: { kind } })]).toEqual([kind, true])
  for (const kind of ['sdk', 'slack-ping', 'task-notification', 'peer', 'peer-send-message', 'scheduled-trigger', 'channel', 'coordinator', 'auto-continuation', 'unclassified', 'projects-relay', 'observer'])
    expect([kind, isTyped({ origin: { kind } })]).toEqual([kind, false])
  expect(isTyped({ origin: { kind: 'composer' }, isMeta: true })).toBe(false)
  expect(isTyped({})).toBe(false)
  expect(isTyped({ origin: null })).toBe(false)
})

// Recorded from the conductor session of 2026-11-13, its first 30 prompts: typed messages, task
// notifications and other sessions' messages. Tool names, programs and prompt origins only; paths,
// descriptions and command arguments were dropped. The transcript stores a desktop-typed prompt as
// origin `human`, which the engine hands to `prompt.submit` as `composer` (2.1.323), so that is
// what is recorded here.
type Prompt = { kind: string; isMeta?: true }
type Recorded = Call | { prompt: Prompt }
const RECORDED = recorded as unknown as Recorded[]
const asPrompt = (e: Recorded): Prompt | undefined => ('tool' in e ? undefined : (e.prompt as Prompt))
const recordedCalls = RECORDED.filter((e): e is Call => 'tool' in e)
const recordedPrompts: Prompt[] = RECORDED.flatMap(e => asPrompt(e) ?? [])

test('recorded session: 19 calls seen reaching out, not 63, and 12 of 30 prompts were typed', async () => {
  // The map before this change counted 63 of these calls as Network and 36 as You (30 turn
  // starts plus one per subagent run). See the baseline in the pull request.
  expect(recordedCalls.length).toBe(132)
  const vias = recordedCalls.map(c => classify(c as never).via).filter(Boolean)
  expect(vias.length).toBe(19)
  expect([...new Set(vias)].sort()).toEqual(['browser', 'connector', 'gh', 'git fetch', 'ssh'])
  expect(recordedCalls.filter(c => c.tool.startsWith('mcp__ccd_') && classify(c as never).via).length).toBe(0)
  expect(recordedPrompts.length).toBe(30)
  expect(recordedPrompts.filter(p => isTyped({ origin: p, ...(p.isMeta ? { isMeta: true } : {}) })).length).toBe(12)
})

test('recorded session through the hooks: You counts typed messages only, and the app stays off the list', async ($, on) => {
  engine(on)
  await start($)
  let n = 0
  for (const e of RECORDED) {
    const p = asPrompt(e)
    if (p) {
      await $.prompt.submit({ text: 'x', origin: p, ...(p.isMeta ? { isMeta: true } : {}) } as never)
      await $.turn.start({ text: 'x', turnId: `t${++n}` } as never)
      await settle()
    } else {
      await $.tool.call(e as never)
      // Each subagent's run starts a turn of its own, which the old map counted as You.
      if ('tool' in e && e.tool === 'Agent') await $.turn.start({ text: 'x', turnId: `a${n}`, agentId: `sub${n}` } as never)
    }
  }
  const lines = await paneLines($)
  expect(lines.some(l => /App|wrap_up|update_plan/.test(l))).toBe(false)
  const outside = lines.slice(lines.indexOf('# Seen using the internet') + 1, lines.indexOf('# Recent'))
  expect(outside.length).toBe(4)
  for (const l of outside) expect(l).toMatch(/(gh|git fetch|ssh|browser|connector)( · .*)?$/)

  // Prompts alone: twelve typed messages fold into one You row; notices and peers add nothing.
  for (const p of recordedPrompts) {
    await $.prompt.submit({ text: 'x', origin: p, ...(p.isMeta ? { isMeta: true } : {}) } as never)
    await settle()
  }
  expect((await paneLines($)).find(l => l.startsWith('You'))).toBe('Youtyped a message12 times')
})

test('a failed row says why when the hook has a safe reason, and only that', async ($, on) => {
  engine(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'git status', description: 'Read the repo state', error: `Exit code 2\n${FAKE_TOKEN}` } as never)
  await $.tool.call({ tool: 'mcp__ccd_session_mgmt__archive_session', error: 'Session x was not archived: it still has live work' } as never)
  const out = await $.tool.call({ tool: 'Bash', command: 'rm -rf /tmp/x', description: 'Remove a folder', deny: 'blocked by a hook' } as never)
  expect(out).toEqual({ deny: 'blocked by a hook' })
  // A failed call that reached out still names what did.
  await $.tool.call({ tool: 'Bash', command: 'curl -f -d @f https://x.io', description: 'Upload the report', error: 'Exit code 22' } as never)
  const lines = await paneLines($)
  expect(lines.slice(1, 6)).toEqual(['# Failed since your last message', '✕ShellUpload the reportcurl · exit 22', '✕ShellRemove a folderblocked', '✕SessionArchived a sessionfailed', '✕ShellRead the repo stateexit 2'])
  expect(JSON.stringify(lines)).not.toContain(FAKE_TOKEN)
  expect(JSON.stringify(lines)).not.toContain('live work')
  expect(exitWhy('Exit code 127\nnot found')).toBe('exit 127')
  expect(exitWhy('exit code 1')).toBe(undefined)
  expect(exitWhy(undefined)).toBe(undefined)
})

test('failures stay listed until the person types, not until the next turn starts', async ($, on) => {
  let t = 1_000_000
  engine(on, { now: () => (t += 10) })
  await start($)
  await $.prompt.submit(typed)
  await settle()
  await $.tool.call({ tool: 'Bash', command: 'false', description: 'Run a failing check', error: 'Exit code 1' } as never)
  await $.prompt.submit(notice)
  await $.turn.start({ text: 'x', turnId: 't2' } as never)
  await $.prompt.submit(peer)
  await $.turn.start({ text: 'x', turnId: 't3', agentId: 'sub1' } as never)
  expect((await paneLines($)).slice(1, 3)).toEqual(['# Failed since your last message', '✕ShellRun a failing checkexit 1'])
  await $.prompt.submit(typed)
  await settle()
  const after = await paneLines($)
  expect(after.includes('# Failed since your last message')).toBe(false)
  // Still in Recent, still red, below the new message.
  expect(after.slice(after.indexOf('# Recent') + 1, after.indexOf('# Recent') + 3)).toEqual(['Youtyped a message', '✕ShellRun a failing checkexit 1'])
})

test("a turn's end closes its own loop's calls: a background subagent keeps running", async ($, on) => {
  engine(on)
  await start($)
  void $.tool.call({ tool: 'hang', agentId: 'sub1' } as never)
  void $.tool.call({ tool: 'hang' } as never)
  await settle()
  await $.turn.complete({ turnId: 't1', reason: 'aborted', text: '', category: null } as never)
  let lines = await paneLines($)
  expect(lines[0]).toMatch(/^Tool hangrunning/)
  expect(lines).toContain('✕Toolhangstopped')
  await $.turn.complete({ turnId: 's1', reason: 'answer', text: '', category: null, agentId: 'sub1' } as never)
  lines = await paneLines($)
  expect(lines[0]).toBe('Idle')
})

test('the running line: kind, label, how long, and the clock; the terminal gets it without the clock', async ($, on) => {
  let now = 1_000_000
  engine(on, { now: () => now })
  await start($)
  void $.tool.call({ tool: 'hang', description: 'x' } as never)
  await settle()
  now += 75_000
  await $.session.measure({ context: { percent: 75 } } as never)
  await settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'o90-now' }))?.text).toBe('Tool hangrunning 1 min · context 75%')
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('begin="-75s"')
  const ctx = (await ui.findAll({ type: 'Text' })).find(t => t.text === 'context 75%')
  expect(ctx?.props.color).toBe('warning')
  await ui.unmount()
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await term.find({ type: 'Svg' })).toBe(undefined)
  expect((await term.find({ key: 'o90-now' }))?.text).toBe('Tool hangrunning 1 min · context 75%')
  await term.unmount()
})

test('elapsed time, context tone and the clock', async () => {
  expect([elapsed(8_400), elapsed(75_000), elapsed(3_900_000)]).toEqual(['8 s', '1 min', '1 h 5 min'])
  expect([contextTone(undefined), contextTone(69), contextTone(70), contextTone(89), contextTone(90)]).toEqual(['ok', 'ok', 'warn', 'warn', 'high'])
  const svg = clockSvg(75)
  expect(svg).toContain('dur="60s" begin="-75s"')
  expect(svg).toContain('dur="600s" begin="-75s"')
  expect(svg).toContain('prefers-reduced-motion')
})

const e = (id: string, over: Partial<Entry> = {}): Entry => ({ id, kind: 'shell', label: id, startedAt: 10, status: 'ok', ...over })

test('sections: a call shows in one section only, repeats fold, model and app stay off', async () => {
  const s = sections({
    since: 5,
    entries: [
      e('old-fail', { status: 'err', startedAt: 1 }),
      e('a'),
      e('a'),
      e('fetch', { via: 'gh' }),
      e('push-fail', { via: 'git push', status: 'err' }),
      e('m', { kind: 'model' }),
      e('plan', { kind: 'app' }),
      e('busy', { status: 'run' }),
    ],
  })
  expect(s.now?.id).toBe('busy')
  expect(s.failed.map(x => x.id)).toEqual(['push-fail'])
  expect(s.outside.map(x => x.id)).toEqual(['fetch'])
  expect(s.recent.map(r => [r.entry.id, r.times])).toEqual([['a', 2], ['old-fail', 1]])
  expect(sections({ since: 0, entries: [e('m', { kind: 'model', status: 'run' })] })).toMatchObject({ now: undefined, thinking: true })
})

test('a failure counts as new by when it ended; a gated call never folds under an ungated one', async () => {
  // Started before the message at 5, failed after it.
  const late = e('late', { status: 'err', startedAt: 1, endedAt: 9 })
  const model = e('model-fail', { kind: 'model', status: 'err', startedAt: 1, endedAt: 9 })
  const s = sections({ since: 5, entries: [late, model] })
  expect(s.failed.map(x => x.id)).toEqual(['model-fail', 'late'])
  // An older failed model step still shows, in Recent.
  expect(sections({ since: 50, entries: [model] }).recent.map(r => r.entry.id)).toEqual(['model-fail'])
  // Trimming keeps it as a listed failure.
  const many = [late, ...Array.from({ length: 10 }, (_, i) => e(`n${i}`, { startedAt: 20 + i }))]
  expect(trimHistory(many, 5, 5).map(x => x.id)[0]).toBe('late')
  const folded = sections({ since: 0, entries: [e('reset', { label: 'git', gate: 'hard reset' }), e('status', { label: 'git' })] })
  expect(folded.recent.map(r => [r.entry.id, r.times])).toEqual([['status', 1], ['reset', 1]])
})

test('history trim keeps running calls and listed failures, dropping the oldest finished first', async () => {
  const entries = [e('run', { status: 'run', startedAt: 0 }), e('fail', { status: 'err', startedAt: 50 }), ...Array.from({ length: 100 }, (_, i) => e(String(i), { startedAt: i }))]
  const kept = trimHistory(entries, 80, 40)
  expect(kept.length).toBe(80)
  expect(kept.map(x => x.id).slice(0, 2)).toEqual(['run', 'fail'])
  expect(kept.at(-1)!.id).toBe('99')
  expect(trimHistory(entries.slice(0, 10), 80, 0).length).toBe(10)
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
    ['global install', 'npm install -g typescript', 'npm install typescript'],
  ]
  for (const [name, hit, miss] of rows) {
    expect([hit, gateForCommand(hit)]).toEqual([hit, name])
    expect([miss, gateForCommand(miss) === name]).toEqual([miss, false])
  }
  expect(GATES.length).toBeGreaterThan(0)
})

test('a gated call names its gate on its row, in the gate colour', async ($, on) => {
  engine(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'git push origin feat/x', description: 'Push the branch' })
  await $.tool.call({ tool: 'Bash', command: 'git reset --hard HEAD~1', description: 'Drop the last commit' })
  await $.tool.call({ tool: 'Bash', command: 'ssh host "make"', description: 'Build on the box' })
  await settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const lines = (await ui.findAll({ type: 'Box' })).filter(b => b.key?.startsWith('o90-row-')).map(b => b.text)
  expect(lines).toEqual(['ShellBuild on the boxssh · not read', 'ShellPush the branchgit push · git push', 'ShellDrop the last commithard reset'])
  expect((await ui.findAll({ type: 'Text' })).find(t => t.text === ' · git push')?.props.color).toBe('merged')
  await ui.unmount()
})

test('names, never content: a token in a command line reaches no label, row or state write', async ($, on) => {
  engine(on)
  const writes: string[] = []
  on('state.set', ($$, ev, next) => {
    writes.push(JSON.stringify(ev))
    return next(ev)
  })
  await start($)
  await $.tool.call({ tool: 'Bash', command: `curl -H "Authorization: Bearer ${FAKE_TOKEN}" https://api.example.com` })
  await $.tool.call({ tool: 'WebFetch', url: `https://api.example.com/x?token=${FAKE_TOKEN}`, prompt: FAKE_TOKEN })
  await $.tool.call({ tool: 'Write', file_path: '/tmp/out.txt', content: FAKE_TOKEN })
  await $.tool.call({ tool: 'Bash', command: 'false', error: `Exit code 1\n${FAKE_TOKEN}` } as never)
  const lines = await paneLines($)
  expect(JSON.stringify(lines)).not.toContain(FAKE_TOKEN)
  expect(writes.length > 0).toBe(true)
  expect(writes.join('\n')).not.toContain(FAKE_TOKEN)
  expect(writes.join('\n')).toContain('api.example.com')
})

test('a map fault never reaches the tool call', async ($, on) => {
  engine(on, { tool: () => ({ result: { stdout: 'ok' } }) })
  on('state.set', () => {
    throw new Error('state store down')
  })
  await start($)
  const out = await $.tool.call({ tool: 'Bash', command: 'ls', description: 'List' })
  expect(out).toEqual({ result: { stdout: 'ok' } })
})

test('a value an earlier version stored is declined', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('state.get', () => ({ value: { value: { entries: [], counts: {}, faults: {} }, version: 1, shape: 'map-board-1' } }))
  await settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /No calls yet/ }))?.text).toBe('No calls yet.')
  await ui.unmount()
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

test('a pane the engine could not place leaves the button up', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'not placed in this test' } }))
  const spin = await $.ui.mount({ ...SPINNER, surface: 'desktop' })
  await spin.press({ key: 'o90-map-open' })
  expect((await spin.find({ type: 'Button' }))?.text).toBe('Show map')
  await spin.unmount()
})

// The push command is assembled so that tools reading this file's command lines do not take it for a push.
const PUSH = ['git', 'push'].join(' ')

test('quoted text and heredoc bodies are data, not commands', async () => {
  expect(gateForCommand(`grep -n "${PUSH}" notes.md`)).toBe(undefined)
  expect(gateForCommand(`git commit -m 'before ${PUSH} --force'`)).toBe(undefined)
  expect(gateForCommand(`cat > t.ts <<'EOF'\nlabel: '${PUSH}'\nEOF\nbun run t.ts`)).toBe(undefined)
  expect(gateForCommand(`cd /r && ${PUSH} -u origin x`)).toBe('git push')
  expect(gateForCommand(`python3 - <<'EOF'\nprint(1)\nEOF\n${PUSH}`)).toBe('git push')
  // A quoted URL is data too: it does not make a command reach out.
  expect(classify({ tool: 'Bash', command: 'echo "curl https://x.io"' } as never).via).toBe(undefined)
})

test('labels: shell keywords and cd are skipped, long labels cut at a word break', async () => {
  expect(classify({ tool: 'Bash', command: 'cd /r && bun test && git status' } as never).label).toBe('bun')
  expect(classify({ tool: 'Bash', command: 'for f in *.ts; do cat $f; done' } as never).label).toBe('cat')
  expect(classify({ tool: 'Bash', command: 'cd /r' } as never).label).toBe('cd')
  const long = 'Read the BirdUp repository state and its spec files, then the handoff note, then every open pull request'
  const label = classify({ tool: 'Bash', command: 'ls', description: long } as never).label
  expect(label.length <= 100).toBe(true)
  expect(label).toBe('Read the BirdUp repository state and its spec files, then the handoff note, then every open pull…')
})

test('a pathological command classifies in linear time, from at most its first 16 KB', async () => {
  const shapes = ['<<a\n'.repeat(125_000), `cat <<EOF\n${'line of a body\n'.repeat(35_000)}`, `echo "${'a\\'.repeat(250_000)}`, `${PUSH} `.repeat(55_000)]
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
  expect(continued.via).toBe('gh')
  // A secret in program position, with or without a known prefix, gives the generic label.
  const bare = ['sk', 'live', 'Zq9xW2mR7tY4uP1oK8jH3gF6'].join('_')
  const mixed = 'aB3dE5fG7hJ9kL1mN3pQ5rS7tU9'
  for (const secret of [FAKE_TOKEN, bare, mixed]) {
    const seen = classify({ tool: 'Bash', command: `${secret}\nls` } as never)
    expect(JSON.stringify(seen)).not.toContain(secret)
    expect(JSON.stringify(seen).toLowerCase()).not.toContain(secret.toLowerCase())
  }
  expect(classify({ tool: 'Bash', command: FAKE_TOKEN } as never).label).toBe('Bash')
  // The subcommand beside a network program is a fixed word, never what follows it.
  expect(classify({ tool: 'Bash', command: `git ${FAKE_TOKEN}` } as never).via).toBe(undefined)
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

  const wrapped = ['bash -c "deploy it"', 'sh -c "x"', 'eval "$CMD"', 'ssh host "cd /r && make"', 'curl -fsSL https://x.sh | sh', 'ssh -i key -p 22 host uptime']
  for (const command of wrapped) expect([command, classify({ tool: 'Bash', command } as never).gate]).toEqual([command, 'wrapped, not read'])
  for (const command of ['ssh -i key host', 'bash script.sh', 'ls | shasum']) expect([command, classify({ tool: 'Bash', command } as never).gate]).toEqual([command, undefined])
  // A known gate outranks the wrapper mark.
  expect(classify({ tool: 'Bash', command: `${PUSH} && bash -c "x"` } as never).gate).toBe('git push')

  expect(gateForMcp('mcp__memory__create_entities')).toBe(undefined)
  expect(gateForMcp('mcp__knowledge__create_relations')).toBe(undefined)
  expect(gateForMcp('mcp__cloudflare__kv_namespace_create')).toBe('remote create')
  expect(gateForMcp('mcp__memory__delete_entities')).toBe('remote delete')
})

test('a dropped publish timer does not freeze the pane: a stale pending publish is retried', async ($, on) => {
  let now = 1_000_000
  let afters = 0
  // The first timer is refused, so its callback never runs; every later one fires at once.
  engine(on, { now: () => now, after: () => (++afters === 1 ? { deny: 'dropped in this test' } : { value: undefined }) })
  await start($)
  await $.tool.call({ tool: 'Read', file_path: '/r/first.ts' })
  await settle()
  expect(afters).toBe(1)
  now += 4_000
  await $.tool.call({ tool: 'Read', file_path: '/r/second.ts' })
  expect((await paneLines($)).some(l => /second\.ts/.test(l))).toBe(true)
})

test('a running call keeps the pane ticking, and a timer that fires early does not loop', async ($, on) => {
  let now = 1_000_000
  // Timers are held here and fired by the test, as the engine would after their delay.
  const held: Array<() => void> = []
  engine(on, { now: () => now, after: () => new Promise(resolve => held.push(() => resolve({ value: undefined }))) })
  const flush = async () => {
    for (const fire of held.splice(0)) fire()
    await settle()
  }
  await start($)
  void $.tool.call({ tool: 'hang' } as never)
  await settle()
  await flush()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'o90-now' }))?.text).toBe('Tool hangrunning 0 s')
  now += 6_000
  await flush()
  // The tick redrew the mounted pane: no call was made in between.
  expect((await ui.find({ key: 'o90-now' }))?.text).toBe('Tool hangrunning 6 s')
  // A timer that fires before its time starts no new one.
  await flush()
  await flush()
  expect(held.length).toBe(0)
  await ui.unmount()
})

test("a subagent that ended without its turn's end being heard is closed as stopped", async ($, on) => {
  let now = 1_000_000
  const held: Array<() => void> = []
  let alive = [{ id: 'sub1', status: 'running', description: 'x', type: 'Explore' }]
  engine(on, { now: () => now, after: () => new Promise(resolve => held.push(() => resolve({ value: undefined }))) })
  let asked = 0
  on('agent.list', () => {
    asked++
    return { value: alive } as never
  })
  const flush = async () => {
    for (const fire of held.splice(0)) fire()
    await settle()
  }
  await start($)
  void $.tool.call({ tool: 'hang', agentId: 'sub1' } as never)
  await settle()
  await flush()
  now += 6_000
  await flush()
  expect((await paneLines($))[0]).toMatch(/running/)
  expect(asked > 0).toBe(true)
  alive = [{ id: 'sub1', status: 'killed', description: 'x', type: 'Explore' }]
  now += 6_000
  // The tick closes the call; the next publish draws it.
  await flush()
  await flush()
  const lines = await paneLines($)
  expect(lines[0]).toBe('Idle')
  expect(lines).toContain('✕Toolhangstopped')
})

test("the app's own long waits do not keep the pane ticking", async ($, on) => {
  const held: Array<() => void> = []
  engine(on, { tool: () => new Promise(() => {}), after: () => new Promise(resolve => held.push(() => resolve({ value: undefined }))) })
  await start($)
  void $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never)
  await settle()
  // One timer: the publish. No tick follows it for an app call.
  expect(held.length).toBe(1)
  held.splice(0).forEach(f => f())
  await settle()
  expect(held.length).toBe(0)
})

test('a state store that never answers cannot hold up a tool call', async ($, on) => {
  let called = false
  engine(on, {
    tool: () => {
      called = true
      return { result: { stdout: 'ok' } }
    },
  })
  on('state.set', () => new Promise<never>(() => {}))
  await start($)
  const late = new Promise(resolve => setTimeout(() => resolve('still waiting'), 300))
  const out = await Promise.race([$.tool.call({ tool: 'Bash', command: 'ls', description: 'List' }), late])
  expect(called).toBe(true)
  expect(out).toEqual({ result: { stdout: 'ok' } })
})

test('a call that ends before its start is recorded still closes its entry', async ($, on) => {
  engine(on)
  // Every write lands 40 ms late, so the tool returns before `begin` has stored its entry.
  on('state.set', async ($$, ev, next) => {
    await new Promise<void>(resolve => setTimeout(() => resolve(), 40))
    return next(ev)
  })
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'bun test', description: 'Run tests' })
  await new Promise<void>(resolve => setTimeout(() => resolve(), 400))
  const lines = await paneLines($)
  expect(lines[0]).toBe('Idle')
  expect(lines).toContain('ShellRun tests')
})

test('gates: runners, prefixes and their options do not hide a deploy', async () => {
  const deploys = [
    'bunx --bun wrangler deploy',
    'npx --yes wrangler deploy',
    'npm exec wrangler deploy',
    'npm exec -- wrangler deploy',
    'bunx wrangler@latest deploy',
    'pnpm dlx wrangler deploy',
    'sudo -E wrangler deploy',
    'sudo -u deploy wrangler deploy',
    'env -i PATH=/bin wrangler deploy',
    'time -p wrangler deploy',
    'xargs -n1 wrangler deploy',
    'xargs -n 1 wrangler deploy',
    'timeout 60 wrangler deploy',
    'timeout -s KILL 5m wrangler deploy',
    'nice wrangler deploy',
    'nice -n 10 wrangler deploy',
    'command -p wrangler deploy',
    'caffeinate -i wrangler deploy',
    'sudo -E timeout 60 nice -n 5 wrangler deploy',
  ]
  for (const command of deploys) expect([command, gateForCommand(command)]).toEqual([command, 'deploy'])
  expect(gateForCommand('git branch -Dq old')).toBe('branch delete')
  expect(gateForCommand('git branch -dq merged')).toBe(undefined)
  expect(gateForCommand('timeout 60 wrangler dev')).toBe(undefined)
  // Still linear: a long run of prefix words and options.
  const t = Date.now()
  gateForCommand('sudo -u x timeout 9 nice -n 1 '.repeat(20_000))
  expect(Date.now() - t < 50).toBe(true)
})

test('only a word shaped like a command is shown as a program', async () => {
  const hex = 'deadbeef'.repeat(8)
  const hexLine = classify({ tool: 'Bash', command: `${hex} && ls` } as never)
  expect(JSON.stringify(hexLine)).not.toContain(hex)
  expect(hexLine.label).toBe('ls')
  expect(looksSecret('a1b2c3d4'.repeat(4))).toBe(true)
  const short = classify({ tool: 'Bash', command: 'Q8xk2Lm9Pz' } as never)
  expect(JSON.stringify(short).toLowerCase()).not.toContain('q8xk2lm9pz')
  expect(short.label).toBe('Bash')
  expect(classify({ tool: 'Bash', command: '/usr/local/bin/python3.12 -m x && wrangler-dev_2 x' } as never).label).toBe('python3.12')
})
