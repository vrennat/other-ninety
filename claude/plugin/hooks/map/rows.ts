import type { Board, Entry, Kind } from '../../types'

/** Each kind's word at the start of its row. */
export const KIND_NAME: Record<Kind, string> = {
  you: 'You',
  model: 'Model',
  files: 'Files',
  memory: 'Memory',
  shell: 'Shell',
  web: 'Web',
  browser: 'Browser',
  agent: 'Agent',
  skill: 'Skill',
  session: 'Session',
  tool: 'Tool',
  app: 'App',
}

export const isFault = (e: Entry): boolean => e.status === 'err' || e.status === 'block'

/** What a failed row says at its end: the safe reason when there is one. */
export const faultWord = (e: Entry): string => e.why ?? (e.status === 'block' ? 'blocked' : 'failed')

export type Row = { entry: Entry; times: number }

export type Sections = {
  /** The newest call still running, outside model steps; undefined when none is. */
  now?: Entry
  /** Whether a model request is open: with no call running, the agent is thinking. */
  thinking: boolean
  /** Calls that failed since the person's last typed message, newest first. */
  failed: Entry[]
  /** The newest calls that left this machine and did not fail, newest first. */
  outside: Entry[]
  /** Everything else, newest first; repeats of one call in a row fold into one. */
  recent: Row[]
}

/** App bookkeeping and model steps are not rows: they say nothing about the work. */
const isRow = (e: Entry): boolean => e.kind !== 'app' && e.kind !== 'model'

/**
 * The pane's four sections from the board. A call appears in one section only: a failure under
 * Failed, a call that left the machine under its own section, the rest under Recent.
 */
export function sections(board: Board, limits = { outside: 4, recent: 12 }): Sections {
  const newestFirst = [...board.entries].reverse()
  const now = newestFirst.find(e => e.status === 'run' && e.kind !== 'model' && e.kind !== 'app')
  const thinking = newestFirst.some(e => e.status === 'run' && e.kind === 'model')
  // A model step that fails is a failure worth seeing; other model steps stay off the list.
  const failed = newestFirst.filter(e => isFault(e) && e.kind !== 'app' && e.startedAt >= board.since)
  const outside = newestFirst.filter(e => isRow(e) && e.via !== undefined && e.status === 'ok').slice(0, limits.outside)
  const shown = new Set<Entry>([...failed, ...outside])
  const recent: Row[] = []
  for (const e of newestFirst) {
    if (!isRow(e) || e.status === 'run' || shown.has(e)) continue
    const prev = recent.at(-1)
    if (prev && prev.entry.kind === e.kind && prev.entry.label === e.label && prev.entry.status === e.status) {
      prev.times++
      continue
    }
    recent.push({ entry: e, times: 1 })
    if (recent.length >= limits.recent) break
  }
  return { now, thinking, failed, outside, recent }
}

/** How long a call has run, in the words a glance wants: `8 s`, `4 min`, `1 h 5 min`. */
export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

export function contextTone(percent: number | undefined): 'ok' | 'warn' | 'high' {
  if (percent === undefined || percent < 70) return 'ok'
  return percent < 90 ? 'warn' : 'high'
}

/**
 * The running call's clock: a minute hand that laps in a minute and an hour-ish hand that laps
 * in ten, started at the call's age so a long call reads as long. Clay, the app's own colour for
 * Claude at work, and nothing else on the pane is clay.
 */
export function clockSvg(ageSeconds: number): string {
  const a = Math.round(Math.max(0, ageSeconds) * 10) / 10
  const hand = (len: number, width: number, lap: number) =>
    `<line x1="11" y1="11" x2="11" y2="${11 - len}" stroke-width="${width}" stroke-linecap="round">` +
    `<animateTransform attributeName="transform" type="rotate" from="0 11 11" to="360 11 11" dur="${lap}s" begin="-${a}s" repeatCount="indefinite"/></line>`
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" width="22" height="22">' +
    // Light and dark clay, as the app draws it; motion off when the person asks for less of it.
    '<style>g{stroke:#c6613f}@media (prefers-color-scheme: dark){g{stroke:#d97757}}@media (prefers-reduced-motion: reduce){animateTransform{display:none}}</style>' +
    `<g fill="none"><circle cx="11" cy="11" r="9" stroke-width="1.6"/>${hand(6.5, 1.6, 60)}${hand(4, 2.4, 600)}</g></svg>`
  )
}

/**
 * Keeps at most `keep` entries. Dropped first: finished calls that are not failures since the
 * person's last message, oldest first. A call still running is never dropped, so a long subagent
 * keeps its clock and its final status; a listed failure goes only if nothing else is left to drop.
 */
export function trimHistory(entries: Entry[], keep: number, since: number): Entry[] {
  let excess = entries.length - keep
  if (excess <= 0) return entries
  const listed = (e: Entry) => e.status === 'run' || (isFault(e) && e.startedAt >= since)
  const drop = new Set<Entry>()
  for (const e of entries) {
    if (excess <= 0) break
    if (!listed(e)) {
      drop.add(e)
      excess--
    }
  }
  for (const e of entries) {
    if (excess <= 0) break
    if (e.status !== 'run' && !drop.has(e)) {
      drop.add(e)
      excess--
    }
  }
  return entries.filter(e => !drop.has(e))
}
