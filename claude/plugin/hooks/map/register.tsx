import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Board, Entry, StationId, Status } from '../../types'
import { classify, clean } from './classify'
import { STATIONS, describeNow, drawMap, feedRows, trimHistory } from './draw'

/**
 * The o90 activity map: a pane beside the chat that draws where the work
 * goes. It only observes: every hook passes its event on and returns what the
 * rest of the chain returned, and a fault in the map is swallowed. It makes no
 * network request, reads no file, runs no process and adds nothing to the
 * conversation or the system prompt (spec: docs/specs/2026-11-11-activity-map-design.md).
 */
const PANE = 'o90-map'
const TITLE = 'Activity map'
const KEEP = 80

// Change the tag when a field of Board or Entry changes: it declines what an earlier version stored.
const board = atom({ plugin: 'other-ninety', key: 'board' } as const, { entries: [], counts: {}, faults: {} } as Board, {
  shape: 'map-board-1',
})

/**
 * What the pane draws: `board` as it stood at the last publish. Every event writes `board`, and a
 * single tool call writes it two or three times, so drawing straight from it redrew the pane in
 * bursts. Writes schedule one publish PUBLISH_MS later; the writes in between fold into it.
 */
const view = atom({ plugin: 'other-ninety', key: 'view' } as const, { entries: [], counts: {}, faults: {} } as Board, {
  shape: 'map-board-1',
})
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
      })
      // A publish that went stale and was replaced leaves the flag to its replacement.
      if (publishScheduledAt !== mine) return
      publishPending = false
      // A write that landed while this publish read the board gets a publish of its own.
      if (writes !== seen) await publishSoon($)
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

/** The station the feed is narrowed to, or null for every station. */
const filter = atom({ plugin: 'other-ninety', key: 'filter' } as const, null as StationId | null)

/** Whatever goes wrong on the map must never reach a tool call or a turn. */
async function quietly<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work()
  } catch {
    return undefined
  }
}

const newId = (now: number): string => `${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`
const isFault = (s: Status): boolean => s === 'err' || s === 'block'

type Begin = Pick<Entry, 'station' | 'label'> & Partial<Pick<Entry, 'from' | 'gate' | 'status'>>

async function begin($: EngineInterface, start: Begin): Promise<string | undefined> {
  return quietly(async () => {
    const now = await $.clock.now()
    const status = start.status ?? 'run'
    const entry: Entry = {
      id: newId(now),
      station: start.station,
      label: clean(start.label),
      from: start.from ?? 'core',
      startedAt: now,
      status,
      ...(status !== 'run' ? { endedAt: now } : {}),
      ...(start.gate ? { gate: start.gate } : {}),
    }
    await updateBoard($, b => ({
      ...b,
      entries: trimHistory([...b.entries, entry], KEEP),
      counts: { ...b.counts, [entry.station]: (b.counts[entry.station] ?? 0) + 1 },
      faults: isFault(status) ? { ...b.faults, [entry.station]: (b.faults[entry.station] ?? 0) + 1 } : b.faults,
    }))
    return entry.id
  })
}

/**
 * Closes the entry `begin` opened. Takes begin's promise, not its id: the hooks below start
 * `begin` and call `next` without waiting for the write, so a slow or hung state store never
 * holds up a tool call or a turn. The end time is read first; the write waits for begin's own,
 * so a call that finishes before its start is recorded still closes its entry.
 */
async function finish($: EngineInterface, started: Promise<string | undefined>, status: Exclude<Status, 'run'>): Promise<void> {
  await quietly(async () => {
    const now = await $.clock.now()
    const id = await started
    if (id === undefined) return
    await updateBoard($, b => {
      const open = b.entries.find(e => e.id === id)
      if (!open || open.status !== 'run') return b
      return {
        ...b,
        entries: b.entries.map(e => (e.id === id ? { ...e, status, endedAt: now } : e)),
        faults: isFault(status) ? { ...b.faults, [open.station]: (b.faults[open.station] ?? 0) + 1 } : b.faults,
      }
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

  // A turn that ends (stopped, failed or answered) leaves nothing running on the map.
  on('turn.complete', async ($, e, next) => {
    if (!('agentId' in e && e.agentId)) {
      const status: Status = e.reason === 'answer' ? 'ok' : 'err'
      void quietly(async () => {
        const now = await $.clock.now()
        await updateBoard($, b =>
          b.entries.some(x => x.status === 'run')
            ? { ...b, entries: b.entries.map(x => (x.status === 'run' ? { ...x, status, endedAt: now } : x)) }
            : b,
        )
      })
    }
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

  // The person's own message: a pulse on You, and the fault counts start over.
  on('turn.start', async ($, e, next) => {
    void quietly(async () => {
      await updateBoard($, b => ({ ...b, faults: {} }))
      await begin($, { station: 'you', label: 'message', status: 'ok' })
    })
    return next(e)
  })

  // A model request streams: forward every chunk untouched and mark its start and end.
  on('turn.step', async function* ($, e, next) {
    const id = begin($, { station: 'model', label: clean(e.model), from: e.agentId ? 'agents' : 'core' })
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
    const id = seen ? begin($, { ...seen, from: e.agentId ? 'agents' : 'core' }) : Promise.resolve(undefined)
    // The engine's own error passes through untouched; the map only records it.
    const out = await next(e).catch((err: unknown) => {
      void finish($, id, 'err')
      throw err
    })
    if ('deny' in out && out.deny !== undefined) {
      void finish($, id, 'block').then(() =>
        begin($, { station: 'hooks', label: `refused · ${e.tool.startsWith('mcp__') ? 'MCP tool' : e.tool}`, status: 'block' }),
      )
    } else {
      void finish($, id, out.isError ? 'err' : 'ok')
    }
    return out
  })

  on('session.measure', async ($, e, next) => {
    const pct = e.context.percent
    if (pct !== undefined) void quietly(() => updateBoard($, b => (b.context === pct ? b : { ...b, context: pct })))
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const id = begin($, { station: 'model', label: 'compaction' })
    const out = await next(e).catch((err: unknown) => {
      void finish($, id, 'err')
      throw err
    })
    void finish($, id, 'ok')
    return out
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    // The terminal's table has no Svg: it gets the text version.
    const DrawSvg = 'Svg' in ui ? ui.Svg : undefined
    const b = await read($, view)
    const only = await read($, filter)
    const now = await $.clock.now()
    const rows = feedRows(b, 16, only)
    // One chip per station that has done work; pressing one narrows the feed, pressing it again clears.
    const used = STATIONS.filter(st => (b.counts[st.id] ?? 0) > 0)
    const chips = used.map(st => (
      <Button
        key={`o90-map-chip-${st.id}`}
        label={`${st.name} ${b.counts[st.id] ?? 0}`}
        dimColor={only !== null && only !== st.id}
        onPress={() => update($, filter, cur => (cur === st.id ? null : st.id))}
      />
    ))
    // The desktop draws an Svg at the size it is given, not at the slot: size it to the pane.
    // About 9.2 px per column, measured in the desktop Code tab on 2026-11-12 (46 columns); 9 stays inside.
    const side = Math.max(240, Math.min(900, Math.round((e.props.bodyColumns ?? 48) * 9)))
    const feed = rows.map(r => (
      <Text dimColor={r.mark === '·'}>
        {r.mark} {r.station.padEnd(8)} {r.label}
        {r.more ? ` +${r.more}` : ''}
        {r.note ? ` (${r.note})` : ''}
      </Text>
    ))
    const counts = Object.entries(b.counts)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ')

    return (
      <Box flexDirection="column">
        {DrawSvg ? (
          <DrawSvg
            source={drawMap(b, now)}
            alt={`Activity map: ${describeNow(b)}`}
            width={side}
            height={side}
          />
        ) : (
          <Text dimColor>{counts || 'No activity yet.'}</Text>
        )}
        {chips.length > 0 && (
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {chips}
          </Box>
        )}
        <Text>{only === null ? describeNow(b) : `${describeNow(b)} · showing ${only} only`}</Text>
        {rows.length === 0 ? <Text dimColor>No calls yet.</Text> : feed}
      </Box>
    )
  })
}

export type { StationId }
