import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Board, Entry, StationId, Status } from '../../types'
import { classify, clean } from './classify'
import { describeNow, drawMap, feedRows, trimHistory } from './draw'

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
    await update($, board, b => ({
      ...b,
      entries: trimHistory([...b.entries, entry], KEEP),
      counts: { ...b.counts, [entry.station]: (b.counts[entry.station] ?? 0) + 1 },
      faults: isFault(status) ? { ...b.faults, [entry.station]: (b.faults[entry.station] ?? 0) + 1 } : b.faults,
    }))
    return entry.id
  })
}

async function finish($: EngineInterface, id: string | undefined, status: Exclude<Status, 'run'>): Promise<void> {
  if (id === undefined) return
  await quietly(async () => {
    const now = await $.clock.now()
    await update($, board, b => {
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
  await quietly(() => $.ui.open({ id: PANE, title: TITLE }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await quietly(() => $.command.register({ name: 'map', description: 'Show the o90 activity map beside the chat' }))
    // A pane in the terminal takes columns from the transcript: there it opens on /map only.
    if (e.surface !== null && e.surface !== 'terminal') void openPane($)
    return next(e)
  })

  on('command.run', { command: 'map' }, async $ => {
    await openPane($)
    return { text: 'Activity map opened.' }
  })

  // The person's own message: a pulse on You, and the fault counts start over.
  on('turn.start', async ($, e, next) => {
    await quietly(() => update($, board, b => ({ ...b, faults: {} })))
    await begin($, { station: 'you', label: 'message', status: 'ok' })
    return next(e)
  })

  // A model request streams: forward every chunk untouched and mark its start and end.
  on('turn.step', async function* ($, e, next) {
    const id = await begin($, { station: 'model', label: clean(e.model), from: e.agentId ? 'agents' : 'core' })
    try {
      const out = yield* next(e)
      await finish($, id, 'ok')
      return out
    } catch (err) {
      await finish($, id, 'err')
      throw err
    }
  })

  on('tool.call', async ($, e, next) => {
    const seen = await quietly(async () => classify(e as unknown as { tool: string }))
    const id = seen ? await begin($, { ...seen, from: e.agentId ? 'agents' : 'core' }) : undefined
    // The engine's own error passes through untouched; the map only records it.
    const out = await next(e).catch(async (err: unknown) => {
      await finish($, id, 'err')
      throw err
    })
    if ('deny' in out && out.deny !== undefined) {
      await finish($, id, 'block')
      await begin($, { station: 'hooks', label: `refused · ${e.tool.startsWith('mcp__') ? 'MCP tool' : e.tool}`, status: 'block' })
    } else {
      await finish($, id, out.isError ? 'err' : 'ok')
    }
    return out
  })

  on('session.measure', async ($, e, next) => {
    const pct = e.context.percent
    if (pct !== undefined) await quietly(() => update($, board, b => (b.context === pct ? b : { ...b, context: pct })))
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const id = await begin($, { station: 'model', label: 'compaction' })
    const out = await next(e).catch(async (err: unknown) => {
      await finish($, id, 'err')
      throw err
    })
    await finish($, id, 'ok')
    return out
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    // The terminal's table has no Svg: it gets the text version.
    const DrawSvg = 'Svg' in ui ? ui.Svg : undefined
    const b = await read($, board)
    const now = await $.clock.now()
    const rows = feedRows(b, 16)
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
            isInteractive
          />
        ) : (
          <Text dimColor>{counts || 'No activity yet.'}</Text>
        )}
        <Text>{describeNow(b)}</Text>
        {rows.length === 0 ? <Text dimColor>No calls yet.</Text> : feed}
      </Box>
    )
  })
}

export type { StationId }
