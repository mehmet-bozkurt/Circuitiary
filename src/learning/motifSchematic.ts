import { defineMessages, pick } from '../i18n'
import { cellIds, linkLabel, type BuilderDraft, type CellId, type LinkType } from './circuitBuilder'

/**
 * A small picture of a builder circuit, computed from its cells and connections alone: a new motif gets its
 * schematic without anyone drawing it. Cells sit on an ellipse; the connection type is told by the shape of
 * the line's end (arrowhead, bar) or by a double line (gap), never by color.
 */
export const SCHEMATIC = { width: 160, height: 112, radius: 12, ring: 3.5 } as const
const CENTER = { x: SCHEMATIC.width / 2, y: SCHEMATIC.height / 2 }
const SPREAD = { x: 56, y: 36 }

export interface SchematicNode { id: CellId; x: number; y: number; stimulated: boolean }
export interface SchematicEdge {
  key: string
  type: LinkType
  /** A chemical connection from a cell to itself, drawn as a loop. */
  self: boolean
  /** Path data of the line or lines: one for a chemical connection, two parallel ones for a gap. */
  lines: string[]
  /** Path data of the end mark: a closed arrowhead (excitatory) or a bar across the end (inhibitory); null for a gap. */
  mark: string | null
}
export interface Schematic { nodes: SchematicNode[]; edges: SchematicEdge[]; order: CellId[] }

type Point = { x: number; y: number }
const f = (value: number): string => String(Math.round(value * 10) / 10)
const p = (point: Point): string => `${f(point.x)} ${f(point.y)}`
const add = (a: Point, b: Point, scale = 1): Point => ({ x: a.x + b.x * scale, y: a.y + b.y * scale })
const turn = (v: Point, degrees: number): Point => {
  const angle = degrees * Math.PI / 180
  return { x: v.x * Math.cos(angle) - v.y * Math.sin(angle), y: v.x * Math.sin(angle) + v.y * Math.cos(angle) }
}

/** How many pairs of connections would cross when the cells sit around a circle in this order. */
export function crossings(order: readonly number[], pairs: ReadonlyArray<readonly [number, number]>): number {
  const at = new Map(order.map((cell, position) => [cell, position]))
  const between = (position: number, from: number, to: number) => from < to ? position > from && position < to : position > from || position < to
  let count = 0
  for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) {
    const [a, b, c, d] = [at.get(pairs[i]![0])!, at.get(pairs[i]![1])!, at.get(pairs[j]![0])!, at.get(pairs[j]![1])!]
    if (new Set([a, b, c, d]).size === 4 && between(c, a, b) !== between(d, a, b)) count++
  }
  return count
}

/**
 * The order of the cells around the ellipse. The first cell stays on the left; the rest are arranged so that
 * as few connections as possible cross, then so that connected cells sit close, then alphabetically.
 */
function cellOrder(count: number, pairs: ReadonlyArray<readonly [number, number]>): number[] {
  let best: number[] = []
  let bestCost = Infinity
  const visit = (order: number[], rest: number[]) => {
    if (!rest.length) {
      const at = new Map(order.map((cell, position) => [cell, position]))
      const span = pairs.reduce((sum, [a, b]) => { const gap = Math.abs(at.get(a)! - at.get(b)!); return sum + Math.min(gap, count - gap) }, 0)
      const cost = crossings(order, pairs) * 1000 + span
      if (cost < bestCost) { best = order; bestCost = cost }
      return
    }
    rest.forEach((cell, index) => visit([...order, cell], [...rest.slice(0, index), ...rest.slice(index + 1)]))
  }
  visit([0], Array.from({ length: count - 1 }, (_, index) => index + 1))
  return best
}

export function layoutSchematic(draft: Pick<BuilderDraft, 'cellCount' | 'links' | 'stimulus'>): Schematic {
  const ids = cellIds(draft.cellCount)
  const index = (id: CellId) => ids.indexOf(id)
  const drawn = draft.links.filter(link => index(link.source) >= 0 && index(link.target) >= 0)
  const pairKey = (a: CellId, b: CellId) => [a, b].sort().join('')
  const pairs = [...new Set(drawn.filter(link => link.source !== link.target).map(link => pairKey(link.source, link.target)))]
    .map(key => [index(key[0] as CellId), index(key[1] as CellId)] as const)
  const order = cellOrder(ids.length, pairs)

  const place = new Map<CellId, Point>()
  order.forEach((cell, position) => {
    const angle = Math.PI + 2 * Math.PI * position / ids.length
    place.set(ids[cell]!, { x: CENTER.x + SPREAD.x * Math.cos(angle), y: CENTER.y + SPREAD.y * Math.sin(angle) })
  })
  const nodes: SchematicNode[] = ids.map(id => ({ id, x: Number(f(place.get(id)!.x)), y: Number(f(place.get(id)!.y)), stimulated: id === draft.stimulus.target }))
  const edgeRadius = (id: CellId) => SCHEMATIC.radius + (id === draft.stimulus.target ? SCHEMATIC.ring : 0)
  const arrow = (tip: Point, along: Point, across: Point) => `M${p(tip)} L${p(add(add(tip, along, -7), across, 3.6))} L${p(add(add(tip, along, -7), across, -3.6))} Z`
  const bar = (tip: Point, across: Point) => `M${p(add(tip, across, 5.5))} L${p(add(tip, across, -5.5))}`

  const edges: SchematicEdge[] = drawn.map((link, position) => {
    const key = `${position}-${link.source}${link.target}`
    const from = place.get(link.source)!
    const to = place.get(link.target)!
    if (link.source === link.target) {
      // A loop on the side of the cell that faces away from the middle of the picture.
      const away = { x: from.x - CENTER.x, y: from.y - CENTER.y }
      const size = Math.hypot(away.x, away.y)
      const out = size > 1 ? { x: away.x / size, y: away.y / size } : { x: 0, y: -1 }
      const [leave, arrive] = [turn(out, -40), turn(out, 40)]
      const start = add(from, leave, edgeRadius(link.source) + 1.5)
      const tip = add(from, arrive, edgeRadius(link.source) + 2.5)
      const inward = { x: -arrive.x, y: -arrive.y }
      const across = { x: -inward.y, y: inward.x }
      return {
        key, type: link.type, self: true,
        lines: [`M${p(start)} A9 9 0 1 1 ${p(link.type === 'excitatory' ? add(tip, inward, -5) : tip)}`],
        mark: link.type === 'excitatory' ? arrow(tip, inward, across) : link.type === 'inhibitory' ? bar(tip, across) : null,
      }
    }
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const along = { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
    const across = { x: -along.y, y: along.x }
    if (link.type === 'gap') {
      const [start, end] = [add(from, along, edgeRadius(link.source) + 1.5), add(to, along, -(edgeRadius(link.target) + 1.5))]
      return { key, type: link.type, self: false, lines: [1.8, -1.8].map(shift => `M${p(add(start, across, shift))} L${p(add(end, across, shift))}`), mark: null }
    }
    // Two connections between the same two cells (A→B with B→A, or beside a gap) are drawn side by side.
    const shared = drawn.some((other, at) => at !== position && pairKey(other.source, other.target) === pairKey(link.source, link.target))
    const shift = shared ? 5 : 0
    const start = add(add(from, along, edgeRadius(link.source) + 1.5), across, shift)
    const tip = add(add(to, along, -(edgeRadius(link.target) + 2.5)), across, shift)
    return link.type === 'excitatory'
      ? { key, type: link.type, self: false, lines: [`M${p(start)} L${p(add(tip, along, -6))}`], mark: arrow(tip, along, across) }
      : { key, type: link.type, self: false, lines: [`M${p(start)} L${p(tip)}`], mark: bar(tip, across) }
  })
  return { nodes, edges, order: order.map(cell => ids[cell]!) }
}

const text = defineMessages({
  tr: {
    label: (count: number, first: string, last: string, links: string, target: string) => `Şema: ${count} hücre (${first}–${last}). ${links} Uyarılan hücre: ${target}.`,
    links: (list: string) => `Bağlantılar: ${list}.`,
    noLinks: 'Bağlantı yok.',
  },
  en: {
    label: (count: number, first: string, last: string, links: string, target: string) => `Schematic: ${count} cells (${first}–${last}). ${links} Stimulated cell: ${target}.`,
    links: (list: string) => `Connections: ${list}.`,
    noLinks: 'No connections.',
  },
})

/** The picture in words, in the interface language: its accessible name. Call it while rendering. */
export function schematicLabel(draft: Pick<BuilderDraft, 'cellCount' | 'links' | 'stimulus'>): string {
  const t = pick(text)
  const ids = cellIds(draft.cellCount)
  const links = draft.links.length ? t.links(draft.links.map(link => linkLabel(link)).join('; ')) : t.noLinks
  return t.label(ids.length, ids[0]!, ids.at(-1)!, links, draft.stimulus.target)
}
