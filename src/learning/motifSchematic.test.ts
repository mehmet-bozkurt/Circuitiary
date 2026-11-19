import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, locale } from '../i18n'
import { blankDraft, cellIds, motifs, presetById, type BuilderDraft, type CellId } from './circuitBuilder'
import { SCHEMATIC, crossings, layoutSchematic, schematicLabel } from './motifSchematic'

afterEach(() => { locale.value = DEFAULT_LOCALE })

/** Every number written into a path. */
const numbers = (path: string) => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
const pairsOf = (draft: BuilderDraft) => draft.links.filter(link => link.source !== link.target)
  .map(link => [cellIds(draft.cellCount).indexOf(link.source), cellIds(draft.cellCount).indexOf(link.target)] as const)

describe('schematic of a circuit', () => {
  it('draws every cell and every connection of every motif, from the motif’s own data', () => {
    for (const motif of motifs) {
      const picture = layoutSchematic(motif.draft)
      expect(picture.nodes.map(node => node.id), motif.id).toEqual(cellIds(motif.draft.cellCount))
      expect(picture.edges.map(edge => edge.type), motif.id).toEqual(motif.draft.links.map(link => link.type))
      expect(picture.nodes.filter(node => node.stimulated).map(node => node.id)).toEqual([motif.draft.stimulus.target])
      expect(new Set(picture.edges.map(edge => edge.key)).size).toBe(picture.edges.length)
    }
  })

  it('tells the connection type by shape: arrowhead, bar, or a double line with no end mark', () => {
    for (const motif of motifs) for (const edge of layoutSchematic(motif.draft).edges) {
      if (edge.type === 'gap') {
        expect(edge.lines).toHaveLength(2)
        expect(edge.mark).toBeNull()
        expect(edge.lines[0]).not.toBe(edge.lines[1])
      } else {
        expect(edge.lines).toHaveLength(1)
        // A closed three-point head for excitatory, an open two-point bar for inhibitory.
        expect(edge.mark!.endsWith('Z')).toBe(edge.type === 'excitatory')
        expect(numbers(edge.mark!)).toHaveLength(edge.type === 'excitatory' ? 6 : 4)
      }
    }
  })

  it('keeps everything inside the picture and the cells apart', () => {
    const all: BuilderDraft[] = [...motifs.map(motif => motif.draft), ...[2, 3, 4, 5, 6].map(cellCount => ({ ...blankDraft(), cellCount }))]
    for (const draft of all) {
      const picture = layoutSchematic(draft)
      const reach = SCHEMATIC.radius + SCHEMATIC.ring
      for (const node of picture.nodes) {
        expect(node.x - reach).toBeGreaterThanOrEqual(0)
        expect(node.x + reach).toBeLessThanOrEqual(SCHEMATIC.width)
        expect(node.y - reach).toBeGreaterThanOrEqual(0)
        expect(node.y + reach).toBeLessThanOrEqual(SCHEMATIC.height)
      }
      picture.nodes.forEach((a, i) => picture.nodes.slice(i + 1).forEach(b => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * reach + 6)))
      for (const edge of picture.edges) for (const path of [...edge.lines, ...(edge.mark ? [edge.mark] : [])]) {
        const values = numbers(path)
        expect(values.every(Number.isFinite)).toBe(true)
        values.forEach((value, index) => expect(value).toBeLessThanOrEqual(index % 2 ? SCHEMATIC.height : SCHEMATIC.width))
        values.forEach(value => expect(value).toBeGreaterThanOrEqual(0))
      }
    }
  })

  it('a line ends outside the circles of both of its cells', () => {
    for (const motif of motifs) {
      const picture = layoutSchematic(motif.draft)
      const place = new Map(picture.nodes.map(node => [node.id, node]))
      picture.edges.forEach((edge, index) => {
        const link = motif.draft.links[index]!
        for (const path of edge.lines) {
          const [x1, y1, x2, y2] = numbers(path) as [number, number, number, number]
          const [from, to] = [place.get(link.source)!, place.get(link.target)!]
          expect(Math.hypot(x1 - from.x, y1 - from.y)).toBeGreaterThan(SCHEMATIC.radius)
          expect(Math.hypot(x2 - to.x, y2 - to.y)).toBeGreaterThan(SCHEMATIC.radius)
        }
      })
    }
  })

  it('draws the two directions between the same pair side by side, not on top of each other', () => {
    for (const id of ['mutual-inhibition', 'feedback-inhibition'] as const) {
      const picture = layoutSchematic(presetById(id).draft)
      const draft = presetById(id).draft
      const pairIndex = (a: CellId, b: CellId) => draft.links.findIndex(link => link.source === a && link.target === b)
      const [there, back] = id === 'mutual-inhibition' ? [pairIndex('B', 'C'), pairIndex('C', 'B')] : [pairIndex('A', 'B'), pairIndex('B', 'A')]
      const [a, b] = [numbers(picture.edges[there]!.lines[0]!), numbers(picture.edges[back]!.lines[0]!)]
      // The start of one is at least 8 units from the end of the other: they run 10 apart.
      expect(Math.hypot(a[0]! - b[2]!, a[1]! - b[3]!)).toBeGreaterThan(8)
    }
  })

  it('arranges the cells so that no connections of a motif cross, with the first cell on the left', () => {
    for (const motif of motifs) {
      const picture = layoutSchematic(motif.draft)
      const ids = cellIds(motif.draft.cellCount)
      expect(picture.order[0]).toBe('A')
      expect([...picture.order].sort()).toEqual(ids)
      expect(crossings(picture.order.map(id => ids.indexOf(id)), pairsOf(motif.draft)), motif.id).toBe(0)
      expect(Math.min(...picture.nodes.map(node => node.x))).toBe(picture.nodes[0]!.x)
    }
    // In alphabetical order the two paths of the convergence motif would cross; the layout avoids it.
    const convergence = presetById('convergence').draft
    expect(crossings([0, 1, 2, 3], pairsOf(convergence))).toBe(1)
    expect(layoutSchematic(convergence).order).toEqual(['A', 'B', 'D', 'C'])
    // Without a reason to reorder, the cells stay alphabetical.
    expect(layoutSchematic({ ...blankDraft(), cellCount: 6 }).order).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('draws a connection from a cell to itself as a loop and skips connections to cells that are not there', () => {
    const draft: BuilderDraft = {
      cellCount: 2,
      links: [
        { id: '1', source: 'A', target: 'A', type: 'excitatory', strength: 1 },
        { id: '2', source: 'B', target: 'B', type: 'inhibitory', strength: 1 },
        { id: '3', source: 'A', target: 'D', type: 'excitatory', strength: 1 },
      ],
      stimulus: { ...blankDraft().stimulus, target: 'B' },
    }
    const picture = layoutSchematic(draft)
    expect(picture.edges.map(edge => [edge.type, edge.self])).toEqual([['excitatory', true], ['inhibitory', true]])
    for (const edge of picture.edges) {
      expect(edge.lines[0]).toMatch(/^M[\d. ]+ A9 9 0 1 1 [\d. ]+$/)
      expect(edge.mark).not.toBeNull()
    }
  })
})

describe('schematic in words', () => {
  it('names the cells, every connection with its type, and the stimulated cell', () => {
    expect(schematicLabel(presetById('excitation-inhibition').draft)).toBe('Şema: 3 hücre (A–C). Bağlantılar: A → B uyarıcı; A → C uyarıcı; B → C baskılayıcı. Uyarılan hücre: A.')
    expect(schematicLabel(presetById('electrical-pair').draft)).toBe('Şema: 2 hücre (A–B). Bağlantılar: A ↔ B elektriksel. Uyarılan hücre: A.')
    expect(schematicLabel(blankDraft())).toBe('Şema: 3 hücre (A–C). Bağlantı yok. Uyarılan hücre: A.')
  })

  it('follows the interface language', () => {
    locale.value = 'en'
    expect(schematicLabel(presetById('excitation-inhibition').draft)).toBe('Schematic: 3 cells (A–C). Connections: A → B excitatory; A → C excitatory; B → C inhibitory. Stimulated cell: A.')
    expect(schematicLabel(blankDraft())).toBe('Schematic: 3 cells (A–C). No connections. Stimulated cell: A.')
    for (const motif of motifs) expect(schematicLabel(motif.draft)).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
  })
})
