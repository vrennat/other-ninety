import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Board, Entry, Kind, Status } from '../../types'
import { classify, clean, exitWhy, isTyped } from './classify'
import { KIND_NAME, clockSvg, contextTone, elapsed, faultWord, isFault, sections, trimHistory } from './rows'

/**
 * The o90 activity map: a pane beside the chat that says what the agent is
 * doing now, what failed since the person last typed, what left this machine,
 * and what it did before that. It only observes: every hook passes its event on and returns what the
 * rest of the chain returned, and a fault in the map is swallowed. It makes no
 * network request, reads no file, runs no process and adds nothing to the
 * conversation or the system prompt (spec: docs/specs/2026-11-11-activity-map-design.md).
 */
const PANE = 'o90-map'
const TITLE = 'Activity map'
const KEEP = 80

// Change the tag when a field of Board or Entry changes: it declines what an earlier version stored.
const EMPTY: Board = { entries: [], since: 0 }
const board = atom({ plugin: 'other-ninety', key: 'board' } as const, EMPTY, { shape: 'map-board-2' })

/**
 * What the pane draws: `board` as it stood at the last publish. Every event writes `board`, and a
 * single tool call writes it two or three times, so drawing straight from it redrew the pane in
 * bursts. Writes schedule one publish PUBLISH_MS later; the writes in between fold into it.
 */
const view = atom({ plugin: 'other-ninety', key: 'view' } as const, EMPTY, { shape: 'map-board-2' })
const PUBLISH_MS = 750
/**
 * A publish still pending this long after it was scheduled is taken as lost. A timer a hook
 * refuses or the host drops never calls back, and nothing reports it, so without this the
 * pane would stop updating for the rest of the session.
 */
const PUBLISH_STALE_MS = 3_000
// Module variables on purpose: a reload drops them with the timer they guard, and the next write schedules again.
let publishPending = false
let publishScheduledAt = 0
let writes = 0

async function publishSoon($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  if (publishPending && now - publishScheduledAt < PUBLISH_STALE_MS) return
  publishPending = true
  publishScheduledAt = now
  const mine = now
  $.clock.after(PUBLISH_MS, () => {
    void quietly(async () => {
      const seen = writes
      await quietly(async () => {
        const latest = await read($, board)
        await update($, view, () => latest)
        // A call still open when the pane is drawn needs its time to move: start the tick.
        if (latest.entries.some(needsTime)) void quietly(() => keepTicking($))
      })
      // A publish that went stale and was replaced leaves the flag to its replacement.
      if (publishScheduledAt !== mine) return
      publishPending = false
      // A write that landed while this publish read the board gets a publish of its own.
      if (writes !== seen) await publishSoon($)
    })
  })
}

/**
 * While a call runs, the pane's "running 40 s" must move without new events: a tick every
 * TICK_MS redraws it, and stops when nothing is running. A tick the host drops is taken as lost
 * after TICK_STALE_MS, as a lost publish is, so the time never freezes for the session.
 */
const tick = atom({ plugin: 'other-ninety', key: 'tick' } as const, 0)
const TICK_MS = 5_000
const TICK_STALE_MS = 15_000
let tickScheduledAt = 0

/** A call whose running time the pane shows: not a model step, not the app's own bookkeeping. */
const needsTime = (e: Entry): boolean => e.status === 'run' && e.kind !== 'model' && e.kind !== 'app'

/** Subagent states in which its loop may still finish a call. */
const ALIVE = new Set(['pending', 'running', 'waiting', 'idle'])

/**
 * A subagent's calls close when its own run ends. One that was killed, or ended without a
 * `turn.complete` the map heard, would otherwise run on the pane for the session: each tick asks
 * the engine which subagents are still alive and closes the rest as stopped.
 */
async function closeEndedAgents($: EngineInterface, b: Board): Promise<void> {
  if (!b.entries.some(e => e.status === 'run' && e.agent !== undefined)) return
  const alive = new Set((await $.agent.list()).filter(a => ALIVE.has(a.status)).map(a => a.id))
  const ended = (e: Entry) => e.status === 'run' && e.agent !== undefined && !alive.has(e.agent)
  if (!b.entries.some(ended)) return
  const now = await $.clock.now()
  await updateBoard($, x => ({ ...x, entries: x.entries.map(e => (ended(e) ? { ...e, status: 'err', endedAt: now, why: 'stopped' } : e)) }))
}

async function keepTicking($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  if (tickScheduledAt !== 0 && now - tickScheduledAt < TICK_STALE_MS) return
  tickScheduledAt = now
  const mine = now
  $.clock.after(TICK_MS, () => {
    void quietly(async () => {
      if (tickScheduledAt !== mine) return
      tickScheduledAt = 0
      // A timer that fires early (or at once, as in a test) does not start another: no busy loop.
      if ((await $.clock.now()) - mine < TICK_MS / 2) return
      const b = await read($, view)
      if (!b.entries.some(needsTime)) return
      await closeEndedAgents($, b)
      await update($, tick, t => t + 1)
      await keepTicking($)
    })
  })
}

/** Writes the board and schedules the pane's next publish. */
async function updateBoard($: EngineInterface, change: (b: Board) => Board): Promise<void> {
  await update($, board, change)
  writes++
  void quietly(() => publishSoon($))
}

/** Whether the map pane is up: while it is not, a button beside the spinner offers to open it. */
const isMapOpen = atom({ plugin: 'other-ninety', key: 'isMapOpen' } as const, false)

/** Whatever goes wrong on the map must never reach a tool call or a turn. */
async function quietly<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work()
  } catch {
    return undefined
  }
}

const newId = (now: number): string => `${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`
type Begin = Pick<Entry, 'kind' | 'label'> & Partial<Pick<Entry, 'agent' | 'via' | 'gate' | 'status'>>

async function begin($: EngineInterface, start: Begin): Promise<string | undefined> {
  return quietly(async () => {
    const now = await $.clock.now()
    const status = start.status ?? 'run'
    const entry: Entry = {
      id: newId(now),
      kind: start.kind,
      label: clean(start.label),
      startedAt: now,
      status,
      ...(status !== 'run' ? { endedAt: now } : {}),
      ...(start.agent ? { agent: start.agent } : {}),
      ...(start.via ? { via: clean(start.via) } : {}),
      ...(start.gate ? { gate: start.gate } : {}),
    }
    await updateBoard($, b => ({ ...b, entries: trimHistory([...b.entries, entry], KEEP, b.since) }))
    return entry.id
  })
}

/**
 * Closes the entry `begin` opened. Takes begin's promise, not its id: the hooks below start
 * `begin` and call `next` without waiting for the write, so a slow or hung state store never
 * holds up a tool call or a turn. The end time is read first; the write waits for begin's own,
 * so a call that finishes before its start is recorded still closes its entry.
 */
async function finish($: EngineInterface, started: Promise<string | undefined>, status: Exclude<Status, 'run'>, why?: string): Promise<void> {
  await quietly(async () => {
    const now = await $.clock.now()
    const id = await started
    if (id === undefined) return
    await updateBoard($, b => {
      const open = b.entries.find(e => e.id === id)
      if (!open || open.status !== 'run') return b
      return { ...b, entries: b.entries.map(e => (e.id === id ? { ...e, status, endedAt: now, ...(why ? { why } : {}) } : e)) }
    })
  })
}

async function openPane($: EngineInterface): Promise<void> {
  await quietly(async () => {
    // A pane the engine could not place yet waits undrawn: only a placed one counts as open,
    // so the button beside the spinner stays until the map is really on screen.
    const { isPlaced } = await $.ui.open({ id: PANE, title: TITLE })
    await update($, isMapOpen, () => isPlaced)
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await quietly(() => $.command.register({ name: 'map', description: 'Show the o90 activity map beside the chat' }))
    // A pane in the terminal takes columns from the transcript: there it opens on /map only.
    // A reload may name no surface; opening there is harmless (nothing places it) and keeps
    // the pane up in the desktop app when the plugin reloads mid-session.
    if (e.surface !== 'terminal') void openPane($)
    return next(e)
  })

  // The desktop app and VS Code attach after the session starts: open the map when one does.
  on('session.attach', async ($, e, next) => {
    if (e.surface !== 'terminal') void openPane($)
    return next(e)
  })

  // A turn that ends closes its own loop's calls still open: the main loop's turn closes the
  // main loop's, a subagent's run closes that subagent's. A background subagent keeps working
  // after the main turn ends, and its calls stay running until its own run ends.
  on('turn.complete', async ($, e, next) => {
    const loop = 'agentId' in e && e.agentId ? e.agentId : undefined
    const answered = e.reason === 'answer'
    void quietly(async () => {
      const now = await $.clock.now()
      const mine = (x: Entry) => x.status === 'run' && x.agent === loop
      await updateBoard($, b =>
        b.entries.some(mine)
          ? { ...b, entries: b.entries.map(x => (mine(x) ? { ...x, status: answered ? 'ok' : 'err', endedAt: now, ...(answered ? {} : { why: 'stopped' }) } : x)) }
          : b,
      )
    })
    return next(e)
  })

  on('command.run', { command: 'map' }, async $ => {
    await openPane($)
    return { text: 'Activity map opened.' }
  })

  // Closed by the person, by the plugin or by a reload: the button above the prompt comes back.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) void quietly(() => update($, isMapOpen, () => false))
    return next(e)
  })

  // While Claude works and the map is closed, a button sits beside Claude Code's own spinner.
  // The mod API offers no sidebar or toolbar entry; /map opens the map when Claude is idle.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface === 'terminal' || (await read($, isMapOpen))) return next(e)
    const { Box, Button } = $.ui.resolve(e)
    const spinner = await next(e)
    return (
      <Box flexDirection="row" gap={1}>
        {spinner}
        <Button key="o90-map-open" label="Show map" onPress={() => openPane($)} />
      </Box>
    )
  })

  // A message the person typed (not a background task's notice, another session's message or
  // a scheduled prompt): a row for You, and the Failed list starts over from here.
  on('prompt.submit', async ($, e, next) => {
    if (isTyped(e)) {
      void quietly(async () => {
        const now = await $.clock.now()
        await updateBoard($, b => ({ ...b, since: now }))
        await begin($, { kind: 'you', label: 'typed a message', status: 'ok' })
      })
    }
    return next(e)
  })

  // A model request streams: forward every chunk untouched and mark its start and end.
  on('turn.step', async function* ($, e, next) {
    const id = begin($, { kind: 'model', label: clean(e.model), ...(e.agentId ? { agent: e.agentId } : {}) })
    try {
      const out = yield* next(e)
      void finish($, id, 'ok')
      return out
    } catch (err) {
      void finish($, id, 'err')
      throw err
    }
  })

  on('tool.call', async ($, e, next) => {
    const seen = await quietly(async () => classify(e as unknown as { tool: string }))
    // Started, not awaited: the tool runs whatever the state store is doing.
    const id = seen ? begin($, { ...seen, ...(e.agentId ? { agent: e.agentId } : {}) }) : Promise.resolve(undefined)
    // The engine's own error passes through untouched; the map only records it.
    const out = await next(e).catch((err: unknown) => {
      void finish($, id, 'err')
      throw err
    })
    // A hook's refusal arrives as `deny`; a tool that answers an error (the app declining to
    // archive a busy session, a command that exits non-zero) arrives as `isError`. Only an exit
    // code is taken from the error's text: the rest of it is content and may hold anything.
    if ('deny' in out && out.deny !== undefined) void finish($, id, 'block', 'blocked')
    else if (out.isError) void finish($, id, 'err', seen?.kind === 'shell' ? exitWhy(out.text) : undefined)
    else void finish($, id, 'ok')
    return out
  })

  on('session.measure', async ($, e, next) => {
    const pct = e.context.percent
    if (pct !== undefined) void quietly(() => updateBoard($, b => (b.context === pct ? b : { ...b, context: pct })))
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const id = begin($, { kind: 'model', label: 'compaction' })
    const out = await next(e).catch((err: unknown) => {
      void finish($, id, 'err')
      throw err
    })
    void finish($, id, 'ok')
    return out
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    // The terminal's table has no Svg: there the running line goes without its clock.
    const DrawSvg = 'Svg' in ui ? ui.Svg : undefined
    const b = await read($, view)
    // Read so the pane redraws on each tick while a call runs.
    await read($, tick)
    const now = await $.clock.now()
    const s = sections(b)
    const tone = contextTone(b.context)

    // Colours are the app's own theme keys, so light and dark follow the app. One meaning each:
    // claude = running now, error = failed, warning = context past 70%, merged = a gated pattern.
    const context =
      b.context === undefined ? null : (
        <Text dimColor={tone === 'ok'} color={tone === 'high' ? 'error' : tone === 'warn' ? 'warning' : undefined}>
          {`context ${b.context}%`}
        </Text>
      )
    const head = s.now ? (
      <Box key="o90-now" flexDirection="row" gap={1} alignItems="flex-start">
        {DrawSvg ? <DrawSvg source={clockSvg((now - s.now.startedAt) / 1000)} alt="Running" width={22} height={22} /> : null}
        <Box flexDirection="column" flexShrink={1}>
          <Text size="heading" weight="semibold">
            <Text dimColor>{KIND_NAME[s.now.kind]}</Text> {s.now.label}
          </Text>
          <Text size="footnote">
            <Text color="claude">running {elapsed(now - s.now.startedAt)}</Text>
            {context ? <Text dimColor> · </Text> : null}
            {context}
          </Text>
        </Box>
      </Box>
    ) : (
      // Nothing running: a quiet line, so the screen has no lead when nothing happens.
      <Box key="o90-now" flexDirection="row">
        <Text size="footnote">
          <Text dimColor>{s.thinking ? 'Thinking' : 'Idle'}</Text>
          {context ? <Text dimColor> · </Text> : null}
          {context}
        </Text>
      </Box>
    )

    // A row: the kind as a quiet first word, the label, and one fact at the end.
    // A row: the kind as a quiet first word, the label, and its facts at the end: what took it
    // off the machine, a gate in violet (or a wrapper it could not read, in grey), why it failed
    // in red, or how many times it repeated.
    const row = (x: Entry, times = 1) => {
      const facts: Array<{ text: string; color?: string; dim?: boolean }> = []
      if (x.via) facts.push({ text: x.via, dim: true })
      if (x.gate) facts.push(x.gate.startsWith('wrapped') ? { text: 'not read', dim: true } : { text: x.gate, color: 'merged' })
      if (isFault(x)) facts.push({ text: faultWord(x), color: 'error' })
      if (times > 1) facts.push({ text: `${times} times`, dim: true })
      return (
        <Box key={`o90-row-${x.id}`} flexDirection="row" gap={1}>
          {isFault(x) ? <Text color="error" weight="bold">✕</Text> : null}
          {/* The kind sits in a column of its own, so a wrapped label lines up under itself. */}
          <Box flexShrink={0}>
            <Text dimColor>{KIND_NAME[x.kind as Kind]}</Text>
          </Box>
          <Box flexGrow={1} flexShrink={1}>
            <Text>{x.label}</Text>
          </Box>
          {/* The facts never shrink: a narrow pane wraps the label, not "gh". */}
          {facts.length > 0 ? (
            <Box flexShrink={0}>
              <Text>
                {facts.map((f, i) => (
                  <Text key={`f${i}`} color={f.color} dimColor={f.dim}>
                    {i > 0 ? ` · ${f.text}` : f.text}
                  </Text>
                ))}
              </Text>
            </Box>
          ) : null}
        </Box>
      )
    }
    const heading = (text: string) => (
      <Box key={`o90-h-${text}`} marginTop={1}>
        <Text size="caption" weight="semibold" dimColor>{text}</Text>
      </Box>
    )

    return (
      <Box flexDirection="column">
        {head}
        {s.failed.length > 0 && heading('Failed since your last message')}
        {s.failed.map(x => row(x))}
        {/* What the map recognised as reaching out, not every call that did: the name says so. */}
        {s.outside.length > 0 && heading('Seen using the internet')}
        {s.outside.map(x => row(x))}
        {s.recent.length > 0 && heading('Recent')}
        {s.recent.map(r => row(r.entry, r.times))}
        {b.entries.length === 0 ? <Text dimColor>No calls yet.</Text> : null}
      </Box>
    )
  })
}

export type { Kind }
