import type { Board, Entry, StationId } from '../../types'

/** Stations clockwise from the top. The person sits at the top, the network across from the model. */
export const STATIONS: ReadonlyArray<{ id: StationId; name: string }> = [
  { id: 'you', name: 'You' },
  { id: 'model', name: 'Model' },
  { id: 'memory', name: 'Memory' },
  { id: 'files', name: 'Files' },
  { id: 'shell', name: 'Shell' },
  { id: 'network', name: 'Network' },
  { id: 'browser', name: 'Browser' },
  { id: 'agents', name: 'Agents' },
  { id: 'skills', name: 'Skills' },
  { id: 'hooks', name: 'Hooks' },
]

const SIZE = 400
const INTRINSIC = 1200
const C = SIZE / 2
const ORBIT = 148
const NODE_R = 17
const RING_R = 44
/** A leg of the route stays this long, then fades over ROUTE_FADE_S. */
const ROUTE_HOLD_S = 40
const ROUTE_FADE_S = 20
/** A pulse plays when its entry started or ended this recently before the draw. */
const PULSE_WINDOW_MS = 2_500
const PULSE_S = 0.7

export function stationXY(id: StationId): [number, number] {
  const i = STATIONS.findIndex(s => s.id === id)
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / STATIONS.length
  return [C + ORBIT * Math.cos(a), C + ORBIT * Math.sin(a)]
}

export function xml(text: string): string {
  return text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`)
}

const n = (v: number): string => (Math.round(v * 10) / 10).toString()

export function contextTone(percent: number | undefined): 'ok' | 'warn' | 'high' {
  if (percent === undefined || percent < 70) return 'ok'
  return percent < 90 ? 'warn' : 'high'
}

const isFault = (e: Entry): boolean => e.status === 'err' || e.status === 'block'

/** Light and dark through the frame's own colour scheme: the SVG cannot read the host's CSS. */
const STYLE = `
.bg{fill:#fbfaf7}.node{fill:#ffffff;stroke:#c9c6bd}.spoke{stroke:#b4b2a9}.text{fill:#2c2c2a}.label{fill:#5f5e5a}.faint{fill:#888780}
.accent{stroke:#378add}.accentf{fill:#378add}.mem{stroke:#7f77dd}.memf{fill:#7f77dd}.err{fill:#e24b4a}.gate{fill:#ba7517}
.route{stroke:#378add}.track{stroke:#e4e2da}
@media (prefers-color-scheme: dark){
.bg{fill:#1f1f1d}.node{fill:#2c2c2a;stroke:#5f5e5a}.spoke{stroke:#5f5e5a}.text{fill:#f1efe8}.label{fill:#b4b2a9}.faint{fill:#888780}
.track{stroke:#3a3a37}}
.node.accent{stroke:#378add}.node.mem{stroke:#7f77dd}
text{font-family:-apple-system,system-ui,sans-serif}`

export function drawMap(board: Board, now: number): string {
  const out: string[] = []
  const push = (s: string) => out.push(s)
  // A large intrinsic size: the pane caps the drawing at its own width, so the map fills it.
  push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${INTRINSIC}" height="${INTRINSIC}">`)
  push(`<style>${STYLE}</style><rect class="bg" width="${SIZE}" height="${SIZE}" rx="12"/>`)

  // Spokes, worn by use.
  const max = Math.max(1, ...Object.values(board.counts).map(c => c ?? 0))
  for (const { id } of STATIONS) {
    const [x, y] = stationXY(id)
    const used = (board.counts[id] ?? 0) / max
    const cls = id === 'memory' ? 'mem' : 'spoke'
    push(`<line class="${cls}" x1="${C}" y1="${C}" x2="${n(x)}" y2="${n(y)}" stroke-width="${n(0.6 + used * 4)}" stroke-opacity="${n(0.35 + used * 0.55)}"/>`)
  }

  // Route: the last few stations the main loop went through, model steps left out.
  const legs = board.entries.filter(e => e.from === 'core' && e.station !== 'model' && now - e.startedAt < (ROUTE_HOLD_S + ROUTE_FADE_S) * 1000).slice(-5)
  for (let i = 1; i < legs.length; i++) {
    const a = legs[i - 1]!
    const b = legs[i]!
    if (a.station === b.station) continue
    const [x1, y1] = stationXY(a.station)
    const [x2, y2] = stationXY(b.station)
    const age = (now - b.startedAt) / 1000
    const fadeIn = Math.max(0, ROUTE_HOLD_S - age)
    const left = Math.max(0.1, ROUTE_FADE_S - Math.max(0, age - ROUTE_HOLD_S))
    const start = age > ROUTE_HOLD_S ? 0.7 * (left / ROUTE_FADE_S) : 0.7
    push(`<line class="route" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke-width="1.2" stroke-dasharray="3 4" stroke-opacity="${n(start)}">`)
    push(`<animate attributeName="stroke-opacity" from="${n(start)}" to="0" begin="${n(fadeIn)}s" dur="${n(left)}s" fill="freeze"/></line>`)
  }

  // Stations.
  for (const { id, name } of STATIONS) {
    const [x, y] = stationXY(id)
    const running = board.entries.filter(e => e.station === id && e.status === 'run')
    const ring = running.length > 0 ? 'accent' : id === 'memory' ? 'mem' : ''
    push(`<circle class="node ${ring}" cx="${n(x)}" cy="${n(y)}" r="${NODE_R}" stroke-width="${running.length ? 2 : 0.8}"/>`)
    const oldest = running[0]
    if (oldest) {
      // Clock hands: the long one laps in a minute, the short one in ten.
      const elapsed = Math.max(0, (now - oldest.startedAt) / 1000)
      for (const [len, lap, w] of [[12, 60, 1.4], [7, 600, 2.4]] as const) {
        push(`<line class="accent" x1="${n(x)}" y1="${n(y)}" x2="${n(x)}" y2="${n(y - len)}" stroke-width="${w}" stroke-linecap="round">`)
        push(`<animateTransform attributeName="transform" type="rotate" from="0 ${n(x)} ${n(y)}" to="360 ${n(x)} ${n(y)}" dur="${lap}s" begin="-${n(elapsed)}s" repeatCount="indefinite"/></line>`)
      }
    }
    const count = board.counts[id]
    const labelCls = running.length ? 'text' : 'label'
    push(`<text class="${labelCls}" x="${n(x)}" y="${n(y + NODE_R + 14)}" font-size="12" text-anchor="middle">${name}${count ? ` <tspan class="faint">${count}</tspan>` : ''}</text>`)
    if (running.length > 1) push(`<text class="text" x="${n(x + NODE_R + 4)}" y="${n(y - NODE_R + 4)}" font-size="11">×${running.length}</text>`)
    const faults = board.faults[id]
    if (faults) {
      push(`<circle class="err" cx="${n(x + NODE_R - 3)}" cy="${n(y - NODE_R + 3)}" r="7"/>`)
      push(`<text x="${n(x + NODE_R - 3)}" y="${n(y - NODE_R + 7)}" font-size="10" text-anchor="middle" fill="#ffffff">${faults}</text>`)
    }
    const gated = board.entries.some(e => e.station === id && e.gate && (e.status === 'run' || now - (e.endedAt ?? e.startedAt) < 30_000))
    if (gated) push(`<path class="gate" d="M${n(x - NODE_R + 2)} ${n(y - NODE_R - 6)} l6 6 l-6 6 l-6 -6z"/>`)
  }

  // Pulses: out on a start, back on an end.
  for (const e of board.entries) {
    const [sx, sy] = stationXY(e.station)
    const [ox, oy] = e.from === 'agents' ? stationXY('agents') : [C, C]
    const cls = isFault(e) ? 'err' : e.station === 'memory' ? 'memf' : 'accentf'
    // Each draw is a fresh document, so a pulse plays once, from the draw.
    const pulse = (from: [number, number], to: [number, number]) => {
      push(`<circle class="${cls}" r="4" cx="${n(from[0])}" cy="${n(from[1])}" opacity="0">`)
      push(`<animate attributeName="cx" from="${n(from[0])}" to="${n(to[0])}" dur="${PULSE_S}s" fill="freeze"/>`)
      push(`<animate attributeName="cy" from="${n(from[1])}" to="${n(to[1])}" dur="${PULSE_S}s" fill="freeze"/>`)
      push(`<animate attributeName="opacity" values="1;1;0" dur="${PULSE_S}s" fill="freeze"/></circle>`)
    }
    if (now - e.startedAt < PULSE_WINDOW_MS && e.status === 'run') pulse([ox, oy], [sx, sy])
    if (e.endedAt !== undefined && now - e.endedAt < PULSE_WINDOW_MS) pulse([sx, sy], [ox, oy])
  }

  // Centre and the context ring.
  const pct = board.context
  const tone = contextTone(pct)
  const ringColour = tone === 'high' ? '#e24b4a' : tone === 'warn' ? '#ba7517' : '#378add'
  const circ = 2 * Math.PI * RING_R
  push(`<circle class="track" cx="${C}" cy="${C}" r="${RING_R}" fill="none" stroke-width="5"/>`)
  if (pct !== undefined) {
    push(`<circle cx="${C}" cy="${C}" r="${RING_R}" fill="none" stroke="${ringColour}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${n((circ * Math.min(100, pct)) / 100)} ${n(circ)}" transform="rotate(-90 ${C} ${C})"/>`)
  }
  push(`<circle class="node" cx="${C}" cy="${C}" r="${RING_R - 7}" stroke-width="0.5"/>`)
  push(`<text class="text" x="${C}" y="${C - 1}" font-size="15" font-weight="500" text-anchor="middle">o90</text>`)
  push(`<text class="label" x="${C}" y="${C + 15}" font-size="11" text-anchor="middle">${pct === undefined ? 'context –' : `${pct}% context`}</text>`)
  push('</svg>')
  return out.join('')
}

export type FeedRow = { mark: '●' | '·' | '✕' | '◆'; station: StationId; label: string; more: number; note?: string; programs?: string[] }

/** The newest rows first. Finished calls in a row at one station fold into one. */
export function feedRows(board: Board, limit = 16, only: StationId | null = null): FeedRow[] {
  const rows: FeedRow[] = []
  for (const e of [...board.entries].reverse()) {
    if (only !== null && e.station !== only) continue
    // Model steps sit between every tool call; on the map they pulse, in the feed they are noise.
    if (e.station === 'model' && e.status !== 'err') continue
    const mark: FeedRow['mark'] = e.status === 'run' ? '●' : isFault(e) ? '✕' : e.gate ? '◆' : '·'
    const note = e.status === 'block' ? 'refused' : e.gate ? e.gate : undefined
    const prev = rows[rows.length - 1]
    if (prev && mark === '·' && prev.mark === '·' && prev.station === e.station) {
      prev.more++
      continue
    }
    rows.push({ mark, station: e.station, label: e.label, more: 0, ...(note ? { note } : {}), ...(e.programs?.length ? { programs: e.programs } : {}) })
    if (rows.length >= limit) break
  }
  return rows
}

export function describeNow(board: Board): string {
  const running = board.entries.filter(e => e.status === 'run')
  const tool = running.filter(e => e.station !== 'model').at(-1)
  const ctx = board.context === undefined ? '' : ` · ${board.context}% context`
  // A tool at work says what it is; an open model request alone is the model thinking.
  if (tool) return `${tool.station}: ${tool.label}${ctx}`
  return running.length > 0 ? `thinking${ctx}` : `idle${ctx}`
}

/**
 * Keeps at most `keep` entries, dropping the oldest finished ones first. A call
 * still running is never dropped, however many entries came after it: a long
 * subagent would otherwise lose its clock hands and its final status.
 */
export function trimHistory(entries: Entry[], keep: number): Entry[] {
  let excess = entries.length - keep
  if (excess <= 0) return entries
  return entries.filter(e => {
    if (excess > 0 && e.status !== 'run') {
      excess--
      return false
    }
    return true
  })
}
