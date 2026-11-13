/**
 * What a row is about, shown as its first word. `app` covers the desktop app's own tools
 * (plans, chapters, notifications): kept on the board, never drawn as a row.
 */
export type Kind =
  | 'you'
  | 'model'
  | 'files'
  | 'memory'
  | 'shell'
  | 'web'
  | 'browser'
  | 'agent'
  | 'skill'
  | 'session'
  | 'tool'
  | 'app'

/** `run` while a call is open; `err` the tool failed; `block` a hook refused it. */
export type Status = 'run' | 'ok' | 'err' | 'block'

/** One call, one row. Labels hold names, never content. */
export type Entry = {
  id: string
  kind: Kind
  label: string
  /** The subagent loop the call ran in; absent on the main loop. A turn's end closes only its own loop's calls. */
  agent?: string
  startedAt: number
  endedAt?: number
  status: Status
  /**
   * The program or host that took the call off this machine (`gh`, `git push`, `docs.example.com`).
   * Absent when the call stayed local, as far as the map can tell.
   */
  via?: string
  /**
   * Set when the call matches a known pattern of o90's gated actions: the gate's short name; or
   * `wrapped, not read` when its payload sits in a wrapper the map does not read. Unset does not
   * mean the call was not gated.
   */
  gate?: string
  /** Why a call failed, from a closed set of safe facts (`exit 1`, `blocked`); never the tool's own text. */
  why?: string
}

export type Board = {
  entries: Entry[]
  /** When the person last typed a message; failures since then stay listed. */
  since: number
  /** Context window fill, 0-100, from the last measurement. */
  context?: number
}

declare module 'claude-code' {
  interface PluginState {
    'other-ninety': { board: Shaped<Board>; view: Shaped<Board>; tick: number; isMapOpen: boolean }
  }
}
