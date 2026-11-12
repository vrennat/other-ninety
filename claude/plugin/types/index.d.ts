/** The kinds of work the map draws a station for. */
export type StationId =
  | 'you'
  | 'model'
  | 'memory'
  | 'files'
  | 'shell'
  | 'network'
  | 'browser'
  | 'agents'
  | 'skills'
  | 'hooks'

/** `run` while a call is open; `err` the tool failed; `block` a hook or a permission refused it. */
export type Status = 'run' | 'ok' | 'err' | 'block'

/** One pulse on the map and one row in the feed. Labels hold names, never content. */
export type Entry = {
  id: string
  station: StationId
  label: string
  /** Where the pulse starts: the centre, or the Agents station for a subagent's own calls. */
  from: 'core' | 'agents'
  startedAt: number
  endedAt?: number
  status: Status
  /** Set when the call matches one of o90's gated actions: the gate's short name. */
  gate?: string
}

export type Board = {
  entries: Entry[]
  counts: Partial<Record<StationId, number>>
  /** Errors and refusals per station since the person's last message. */
  faults: Partial<Record<StationId, number>>
  /** Context window fill, 0-100, from the last measurement. */
  context?: number
}

declare module 'claude-code' {
  interface PluginState {
    'other-ninety': { board: Shaped<Board> }
  }
}
