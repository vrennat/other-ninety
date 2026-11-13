import type { Board, Entry, StationId } from '../../types'
import { WRAPPED } from './gate'

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
const RING_R = 42
/** Station tile side, and half of it: badges and tags hang off its corners. */
const T = 30
const HALF = T / 2
/** A pulse plays when its entry started or ended this recently before the draw. */
const PULSE_WINDOW_MS = 2_500
const PULSE_S = 0.7

/**
 * Station glyphs on a 16-unit square, stroked like the app's own sidebar icons. Inline paths
 * only: the frame loads nothing. Each names the kind of work, never the call.
 */
const ICONS: Record<StationId, string> = {
  you: '<circle cx="8" cy="5" r="2.8"/><path d="M2.8 14c.6-2.9 2.7-4.4 5.2-4.4s4.6 1.5 5.2 4.4"/>',
  model: '<path d="M8 1.5c.5 3.3 1.7 5.6 6.5 6.5-4.8.9-6 3.2-6.5 6.5-.5-3.3-1.7-5.6-6.5-6.5 4.8-.9 6-3.2 6.5-6.5z"/>',
  memory: '<path d="M4 2h8v12l-4-3-4 3z"/>',
  files: '<path d="M4 1.8h5l3 3v9.4H4z M9 1.8v3h3"/>',
  shell: '<path d="M2.5 4l4 4-4 4 M8 12.5h5.5"/>',
  network: '<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4 M8 1.8c-2 2-2.6 4-2.6 6.2s.6 4.2 2.6 6.2 M8 1.8c2 2 2.6 4 2.6 6.2s-.6 4.2-2.6 6.2"/>',
  browser: '<rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.2"/><path d="M1.8 6h12.4"/>',
  agents: '<circle cx="8" cy="3.6" r="1.8"/><circle cx="3.6" cy="12" r="1.8"/><circle cx="12.4" cy="12" r="1.8"/><path d="M7.1 5.2 4.5 10.3 M8.9 5.2l2.6 5.1 M5.4 12h5.2"/>',
  skills: '<path d="M9 1.5 3.5 9h4l-1 5.5L12.5 7h-4z"/>',
  hooks: '<circle cx="10" cy="2.8" r="1.3"/><path d="M10 4.1v6a3.6 3.6 0 1 1-7.2 0V8.6l2.2 2"/>',
}

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

/**
 * Clay, native: the map has no ground of its own and takes the pane's, like the chat beside
 * it. Greys are sampled from the Code tab (dark: pane #181818, text #f3f3f3, muted #9d9d9d,
 * raised surface #323232). Each colour has one meaning and the legend names all of them:
 *   clay    Claude at work: a running call's clock, its pulses. The app uses clay the same way.
 *   red     a fault (error or refusal), and context past 90%.
 *   yellow  context past 70%. Yellow, not amber, so it never reads as clay.
 *   violet  a call matching a known gated pattern (push, deploy, migrate...). Blue is left to
 *           the app's links. No tag does not mean not gated.
 *   grey    a tag on a call whose payload sits in a wrapper (`bash -c`, `ssh host "..."`) the
 *           map does not read.
 * Light mode values are chosen, not sampled: no light screenshot of the Code tab was available.
 */
const STYLE = `
.tile{fill:#f1f1ef}.spoke{stroke:#8a8a86}.ink{fill:#1f1f1e}.label{fill:#6b6b68}.faint{fill:#9a9a96}.glyph{stroke:#5f5f5c}
.live{stroke:#c6613f}.livef{fill:#c6613f}.livet{fill:#c6613f}.err{fill:#d13d3d}.errt{fill:#ffffff}
.gate{fill:#6d4fd1}.gates{stroke:#6d4fd1}.wrapt{fill:#6b6b68}.wraps{stroke:#8a8a86}.track{stroke:#e8e8e5}.ring{stroke:#6b6b68}.ring.warn{stroke:#d19e00}.ring.high{stroke:#d13d3d}.warnt{fill:#8f6a00}
@media (prefers-color-scheme: dark){
.tile{fill:#262626}.spoke{stroke:#9d9d9d}.ink{fill:#f3f3f3}.label{fill:#9d9d9d}.faint{fill:#6e6e6e}.glyph{stroke:#b4b4b4}
.live{stroke:#d97757}.livef{fill:#d97757}.livet{fill:#d97757}.err{fill:#ef6461}
.gate{fill:#b4a0ff}.gates{stroke:#b4a0ff}.wrapt{fill:#b4b4b4}.wraps{stroke:#6e6e6e}.track{stroke:#2a2a2a}.ring{stroke:#9d9d9d}.ring.warn{stroke:#e3b341}.ring.high{stroke:#ef6461}.warnt{fill:#e3b341}}
text{font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif}
@media (prefers-reduced-motion: reduce){animate,animateTransform{display:none}}`

/**
 * A gate names itself: the gate's short name on a tag beside its station's label (above the
 * tile in the top half), off the spoke so it reads as that station's, not the centre's.
 */
function gateTag(push: (s: string) => void, x: number, y: number, gate: string, labelChars: number): void {
  // A wrapped call is told apart from a gate: grey and dashed, and shorter on the map.
  const wrapped = gate === WRAPPED
  const name = wrapped ? 'not read' : gate
  const w = name.length * 6.4 + 12
  let cx = x
  let cy = y - HALF - 11
  if (y >= C) {
    // Bottom half: on the label's row, to its right unless that leaves the drawing.
    const half = (labelChars * 6.2) / 2
    cy = y + HALF + 10
    cx = x + half + 6 + w < SIZE - 4 ? x + half + 6 + w / 2 : x - half - 6 - w / 2
  }
  // Outlined, not filled: a gate is worth noticing but is quieter than the context ring.
  push(`<rect class="${wrapped ? 'wraps' : 'gates'}" x="${n(cx - w / 2)}" y="${n(cy - 7.5)}" width="${n(w)}" height="15" rx="4" fill="none" stroke-width="1.2"${wrapped ? ' stroke-dasharray="3 2"' : ''}/>`)
  push(`<text class="${wrapped ? 'wrapt' : 'gate'}" x="${n(cx)}" y="${n(cy + 4)}" font-size="11" font-weight="600" text-anchor="middle">${xml(name)}</text>`)
}

/** Errors and refusals: a red pill that says what it counts. */
function faultBadge(push: (s: string) => void, x: number, y: number, count: number): void {
  const w = 14 + String(count).length * 7
  push(`<rect class="err" x="${n(x - w / 2)}" y="${n(y - 7.5)}" width="${n(w)}" height="15" rx="7.5"/>`)
  push(`<text class="errt" x="${n(x)}" y="${n(y + 4)}" font-size="11" font-weight="600" text-anchor="middle">✕${count}</text>`)
}

/**
 * The legend sits in the two top corners, the only space the ring of stations leaves free.
 * Every colour on the map is named here, drawn in that colour; a first look needs no hover.
 */
function legend(push: (s: string) => void): void {
  const l = 10
  const r = SIZE - 10
  // Left: what a station can be doing.
  push(`<circle class="live" cx="${l + 6}" cy="12" r="5.5" fill="none" stroke-width="1.4"/><path class="live" d="M${l + 6} 12V8.2M${l + 6} 12h2.8" stroke-width="1.4" stroke-linecap="round" fill="none"/>`)
  push(`<text class="label" x="${l + 17}" y="16" font-size="11"><tspan class="livet">clay</tspan> = running, hands = time</text>`)
  push(`<rect class="err" x="${l}" y="${32 - 11.5}" width="21" height="15" rx="7.5"/><text class="errt" x="${l + 10.5}" y="32" font-size="11" font-weight="600" text-anchor="middle">✕1</text>`)
  push(`<text class="label" x="${l + 26}" y="32" font-size="11">errors</text>`)
  push(`<line class="spoke" x1="${l}" y1="44" x2="${l + 9}" y2="44" stroke-width="1" stroke-opacity="0.5"/><line class="spoke" x1="${l + 12}" y1="44" x2="${l + 21}" y2="44" stroke-width="4" stroke-opacity="0.8"/>`)
  push(`<text class="label" x="${l + 26}" y="48" font-size="11">wider = more calls</text>`)
  // Right: what a tag does and does not say, and the context warning.
  // A tag is a match against known patterns, not a verdict: the second line says so.
  push(`<text class="label" x="${r}" y="16" font-size="11" text-anchor="end"><tspan class="gate" font-weight="600">violet</tspan> = known gated patterns</text>`)
  push(`<text class="label" x="${r}" y="32" font-size="11" text-anchor="end">no tag ≠ not gated · <tspan class="wrapt" font-weight="600">grey</tspan> = not read</text>`)
  push(`<text class="label" x="${r}" y="48" font-size="11" text-anchor="end">context <tspan class="warnt">yellow 70%</tspan>, <tspan class="err">red 90%</tspan></text>`)
}


export function drawMap(board: Board, now: number): string {
  const out: string[] = []
  const push = (s: string) => out.push(s)
  // A large intrinsic size: the pane caps the drawing at its own width, so the map fills it.
  // No background rect: the pane's own colour shows through.
  push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${INTRINSIC}" height="${INTRINSIC}">`)
  push(`<style>${STYLE}</style>`)
  legend(push)

  // Spokes, worn by use: wider and stronger with the station's share of calls.
  const max = Math.max(1, ...Object.values(board.counts).map(c => c ?? 0))
  for (const { id } of STATIONS) {
    const [x, y] = stationXY(id)
    const used = (board.counts[id] ?? 0) / max
    // Spokes stop short of the glyph so they never cross it.
    const k = (ORBIT - HALF - 3) / ORBIT
    push(`<line class="spoke" x1="${C}" y1="${C}" x2="${n(C + (x - C) * k)}" y2="${n(C + (y - C) * k)}" stroke-width="${n(0.8 + used * 4)}" stroke-opacity="${n(0.25 + used * 0.55)}" stroke-linecap="round"/>`)
  }

  // Stations: the kind's glyph; a running station becomes a clay clock face.
  // Names in sentence case, like the app's own labels.
  for (const { id, name } of STATIONS) {
    const [x, y] = stationXY(id)
    const running = board.entries.filter(e => e.station === id && e.status === 'run')
    // Idle stations are bare glyphs, as in the app's sidebar; only running work gets a frame.
    if (running.length) push(`<rect class="live" x="${n(x - HALF)}" y="${n(y - HALF)}" width="${T}" height="${T}" rx="8" fill="none" stroke-width="1.6"/>`)
    const oldest = running[0]
    if (oldest) {
      // The long hand laps in a minute, the short one in ten.
      const elapsed = Math.max(0, (now - oldest.startedAt) / 1000)
      for (const [len, lap, w] of [[10.5, 60, 1.6], [6, 600, 2.6]] as const) {
        push(`<line class="live" x1="${n(x)}" y1="${n(y)}" x2="${n(x)}" y2="${n(y - len)}" stroke-width="${w}" stroke-linecap="round">`)
        push(`<animateTransform attributeName="transform" type="rotate" from="0 ${n(x)} ${n(y)}" to="360 ${n(x)} ${n(y)}" dur="${lap}s" begin="-${n(elapsed)}s" repeatCount="indefinite"/></line>`)
      }
    } else {
      const s = 1.1
      push(`<g class="glyph" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${board.counts[id] ? 1 : 0.5}" transform="translate(${n(x - 8 * s)} ${n(y - 8 * s)}) scale(${s})">${ICONS[id]}</g>`)
    }
    const count = board.counts[id]
    push(`<text class="${running.length ? 'ink' : 'label'}" x="${n(x)}" y="${n(y + HALF + 14)}" font-size="12" text-anchor="middle"${running.length ? ' font-weight="600"' : ''}>${name}${count ? `<tspan class="faint" font-weight="400"> ${count}</tspan>` : ''}</text>`)
    if (running.length > 1) push(`<text class="livet" x="${n(x + HALF + 4)}" y="${n(y + 4)}" font-size="11">${running.length} running</text>`)
    const faults = board.faults[id]
    if (faults) faultBadge(push, x + HALF, y - HALF + 2, faults)
    const gated = [...board.entries].reverse().find(e => e.station === id && e.gate && (e.status === 'run' || now - (e.endedAt ?? e.startedAt) < 30_000))
    if (gated?.gate) gateTag(push, x, y, gated.gate, name.length + (count ? 1 + String(count).length : 0))
  }

  // Pulses: out on a start, back on an end.
  for (const e of board.entries) {
    const [sx, sy] = stationXY(e.station)
    const [ox, oy] = e.from === 'agents' ? stationXY('agents') : [C, C]
    const cls = isFault(e) ? 'err' : 'livef'
    // Each draw is a fresh document, so a pulse plays once, from the draw.
    const pulse = (from: [number, number], to: [number, number]) => {
      push(`<circle class="${cls}" r="3.5" cx="${n(from[0])}" cy="${n(from[1])}" opacity="0">`)
      push(`<animate attributeName="cx" from="${n(from[0])}" to="${n(to[0])}" dur="${PULSE_S}s" fill="freeze"/>`)
      push(`<animate attributeName="cy" from="${n(from[1])}" to="${n(to[1])}" dur="${PULSE_S}s" fill="freeze"/>`)
      push(`<animate attributeName="opacity" values="1;1;0" dur="${PULSE_S}s" fill="freeze"/></circle>`)
    }
    if (now - e.startedAt < PULSE_WINDOW_MS && e.status === 'run') pulse([ox, oy], [sx, sy])
    if (e.endedAt !== undefined && now - e.endedAt < PULSE_WINDOW_MS) pulse([sx, sy], [ox, oy])
  }

  // Centre: the ring stays grey until it has a warning to give.
  const pct = board.context
  const tone = contextTone(pct)
  const circ = 2 * Math.PI * RING_R
  push(`<circle class="tile" cx="${C}" cy="${C}" r="${RING_R + 7}"/>`)
  push(`<circle class="track" cx="${C}" cy="${C}" r="${RING_R}" fill="none" stroke-width="5"/>`)
  if (pct !== undefined) {
    push(`<circle class="ring${tone === 'ok' ? '' : ` ${tone}`}" cx="${C}" cy="${C}" r="${RING_R}" fill="none" stroke-width="5" stroke-linecap="round" stroke-dasharray="${n((circ * Math.min(100, pct)) / 100)} ${n(circ)}" transform="rotate(-90 ${C} ${C})"/>`)
  }
  push(`<text class="ink" x="${C}" y="${C + 1}" font-size="16" font-weight="600" text-anchor="middle">o90</text>`)
  push(`<text class="label" x="${C}" y="${C + 16}" font-size="11" text-anchor="middle">${pct === undefined ? 'context –' : `${pct}% context`}</text>`)
  push('</svg>')
  return out.join('')
}

export type FeedRow = { mark: '●' | '·' | '✕' | '◆' | '◇'; station: StationId; label: string; more: number; note?: string; programs?: string[] }

/** The newest rows first. Finished calls in a row at one station fold into one. */
export function feedRows(board: Board, limit = 16, only: StationId | null = null): FeedRow[] {
  const rows: FeedRow[] = []
  for (const e of [...board.entries].reverse()) {
    if (only !== null && e.station !== only) continue
    // Model steps sit between every tool call; on the map they pulse, in the feed they are noise.
    if (e.station === 'model' && e.status !== 'err') continue
    const mark: FeedRow['mark'] = e.status === 'run' ? '●' : isFault(e) ? '✕' : e.gate === WRAPPED ? '◇' : e.gate ? '◆' : '·'
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
