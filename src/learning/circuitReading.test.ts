import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseRealConnectome } from '../model/realConnectome'
import type { RealConnectome, SourceReference } from '../model/types'
import {
  createReadingGraph, findChemicalCycle, findShortestRoute, inspectNeuron,
  type ReadingGraph, type ReadingHop, type ReadingMode,
} from './circuitReading'

type Pair = readonly [string, string, number?]
const stats = () => ({ chemicalIncomingCount: 0, chemicalOutgoingCount: 0, gapCount: 0,
  chemicalIncomingWeight: 0, chemicalOutgoingWeight: 0, gapWeight: 0 })
function ref(row: number, column: number): SourceReference {
  let letters = ''
  for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + (n - 1) % 26) + letters
  return { sheet: 'Invented anatomy', row, column, cell: `${letters}${row}`, annotation: 'Fixture provenance' }
}

/** Invented graph; no published anatomical records are copied into this test. */
function fixture(ids: string[], chemical: Pair[] = [], gaps: Pair[] = []): RealConnectome {
  const index = (id: string) => ids.indexOf(id) + 2
  return {
    schemaVersion: 1,
    dataset: {
      id: 'reading-invented-fixture', title: 'Invented graph fixture', version: '1', doi: 'synthetic-test-only',
      sources: [{ name: 'Invented source', url: 'https://example.org/invented', sha256: '0'.repeat(64), downloadedAtUtc: '2026-10-03T00:00:00Z' }],
      license: { status: 'unverified-local-only', note: 'Invented test metadata.' },
      anatomicalWeightUnit: 'invented units', orientation: 'source rows; target columns; gaps canonical',
      provenanceNotes: ['Synthetic graph; no biological function is asserted.'],
    },
    neurons: ids.map(id => ({ id, label: `Cell ${id}`, cellType: 'neuron', sourceRef: ref(index(id), 1) })),
    chemicalEdges: chemical.map(([source, target, rawWeight = 1]) => ({ id: `chemical:${source}:${target}`, source, target, rawWeight, sourceRef: ref(index(source), index(target)) })),
    gapEdges: gaps.map(([first, second, rawWeight = 1]) => {
      const [a, b] = first < second ? [first, second] : [second, first]
      return { id: `gap:${a}:${b}`, a: a!, b: b!, rawWeight, sourceRef: ref(index(a!), index(b!)), reciprocalSourceRef: ref(index(b!), index(a!)) }
    }),
    selection: {
      algorithm: 'Invented selected cells in fixture order', seeds: [...ids], limit: ids.length,
      neuronIds: [...ids], ranking: [], omittedExternal: stats(),
      omittedByNeuron: ids.map(neuronId => ({ neuronId, ...stats() })), excludedGapSelfEntries: [],
    },
  }
}

const graphOf = (ids: string[], chemical: Pair[] = [], gaps: Pair[] = []) => createReadingGraph(parseRealConnectome(fixture(ids, chemical, gaps)))

function assertHops(graph: ReadingGraph, nodes: readonly string[], hops: readonly ReadingHop[]) {
  expect(nodes).toHaveLength(hops.length + 1)
  for (let index = 0; index < hops.length; index += 1) {
    const hop = hops[index]!
    expect(hop.from).toBe(nodes[index])
    expect(hop.to).toBe(nodes[index + 1])
    if (hop.kind === 'chemical') {
      const edge = graph.chemicalEdges.find(candidate => candidate.id === hop.edgeId)!
      expect(edge).toBeDefined()
      expect([hop.from, hop.to, hop.rawWeight, hop.sourceRef]).toEqual([edge.source, edge.target, edge.rawWeight, edge.sourceRef])
      expect(hop.reciprocalSourceRef).toBeUndefined()
    } else {
      const edge = graph.gapEdges.find(candidate => candidate.id === hop.edgeId)!
      expect(edge).toBeDefined()
      expect([hop.from, hop.to].sort()).toEqual([edge.a, edge.b])
      expect([hop.rawWeight, hop.sourceRef, hop.reciprocalSourceRef]).toEqual([edge.rawWeight, edge.sourceRef, edge.reciprocalSourceRef])
    }
  }
}

/** Independent all-pairs Floyd–Warshall oracle, not the implementation's BFS. */
function distances(graph: ReadingGraph, mode: ReadingMode): Map<string, Map<string, number>> {
  const result = new Map(graph.neuronIds.map(from => [from, new Map(graph.neuronIds.map(to => [to, from === to ? 0 : Infinity]))]))
  const set = (from: string, to: string) => { if (from !== to) result.get(from)!.set(to, 1) }
  if (mode !== 'gap') graph.chemicalEdges.forEach(edge => set(edge.source, edge.target))
  if (mode !== 'chemical') graph.gapEdges.forEach(edge => { set(edge.a, edge.b); set(edge.b, edge.a) })
  for (const via of graph.neuronIds) for (const from of graph.neuronIds) for (const to of graph.neuronIds) {
    result.get(from)!.set(to, Math.min(result.get(from)!.get(to)!, result.get(from)!.get(via)! + result.get(via)!.get(to)!))
  }
  return result
}

describe('anatomical graph inspection', () => {
  it('preserves parsed neuron order and provenance while freezing an independent copy', () => {
    const raw = fixture(['B', 'A', 'C'], [['A', 'B', 7]], [['B', 'C', 4]])
    raw.dataset.extra = { note: 'Preserved extra source metadata' }
    const before = structuredClone(raw)
    const graph = createReadingGraph(raw)
    expect(raw).toEqual(before)
    expect(Object.isFrozen(raw)).toBe(false)
    expect(graph.neuronIds).toEqual(['B', 'A', 'C'])
    expect(graph.neurons.map(neuron => neuron.id)).toEqual(['B', 'A', 'C'])
    expect(graph.dataset.extra).toEqual({ note: 'Preserved extra source metadata' })
    expect(graph.dataset).not.toBe(raw.dataset)
    expect(graph.chemicalEdges[0]).not.toBe(raw.chemicalEdges[0])
    raw.chemicalEdges[0]!.rawWeight = 999
    raw.chemicalEdges[0]!.sourceRef.annotation = 'Changed caller metadata'
    raw.dataset.provenanceNotes.push('Changed caller')
    expect(graph.chemicalEdges[0]!.rawWeight).toBe(7)
    expect(graph.chemicalEdges[0]!.sourceRef.annotation).toBe('Fixture provenance')
    expect(graph.dataset.provenanceNotes).toHaveLength(1)
    expect(Object.isFrozen(graph)).toBe(true)
    expect(Object.isFrozen(graph.neuronIds)).toBe(true)
    expect(Object.isFrozen(graph.chemicalEdges[0]!.sourceRef)).toBe(true)
    expect(Object.isFrozen(graph.dataset.extra)).toBe(true)
    expect(() => { (graph.chemicalEdges[0] as { rawWeight: number }).rawWeight = 2 }).toThrow()
  })

  it('separates directed reciprocal neighbours, one physical gap and self records, with per-cell omission metadata', () => {
    const raw = fixture(['A', 'B', 'C'], [['A', 'B', 6], ['B', 'A', 2], ['C', 'B', 3], ['B', 'B', 9]], [['A', 'B', 4], ['B', 'C', 8]])
    Object.assign(raw.selection.omittedByNeuron[1]!, { chemicalIncomingCount: 2, chemicalIncomingWeight: 17, chemicalOutgoingCount: 1, chemicalOutgoingWeight: 5, gapCount: 3, gapWeight: 11, note: 'Outside selected graph' })
    Object.assign(raw.selection.omittedExternal, raw.selection.omittedByNeuron[1])
    raw.selection.excludedGapSelfEntries = [{ neuronId: 'B', rawWeight: 5, sourceRef: ref(3, 3), selected: true }]
    const graph = createReadingGraph(parseRealConnectome(raw))
    const summary = inspectNeuron(graph, 'B')
    expect(summary.incomingChemical.map(hop => [hop.from, hop.to])).toEqual([['A', 'B'], ['C', 'B']])
    expect(summary.outgoingChemical.map(hop => [hop.from, hop.to])).toEqual([['B', 'A']])
    expect(summary.gaps.map(hop => [hop.from, hop.to, hop.edgeId])).toEqual([['B', 'A', 'gap:A:B'], ['B', 'C', 'gap:B:C']])
    expect(summary.selfLoops.map(hop => [hop.from, hop.to, hop.rawWeight])).toEqual([['B', 'B', 9]])
    expect(summary.omittedExternal).toEqual(raw.selection.omittedByNeuron[1])
    expect(summary.excludedGapSelfEntries).toEqual(raw.selection.excludedGapSelfEntries)
    expect(summary.neuron.sourceRef).toEqual(raw.neurons[1]!.sourceRef)
    expect(summary.gaps[0]!.sourceRef).toEqual(raw.gapEdges[0]!.sourceRef)
    expect(summary.gaps[0]!.reciprocalSourceRef).toEqual(raw.gapEdges[0]!.reciprocalSourceRef)
    expect(graph.gapEdges).toHaveLength(2)
    expect(Object.isFrozen(summary)).toBe(true)
    expect(Object.isFrozen(summary.gaps[0])).toBe(true)
  })

  it('rejects unknown exact IDs and modes, including invalid modes for same-cell requests', () => {
    const graph = graphOf(['A', 'B'], [['A', 'B']])
    for (const id of ['X', 'a', ' A']) {
      expect(() => inspectNeuron(graph, id)).toThrow(RangeError)
      expect(() => findChemicalCycle(graph, id)).toThrow(RangeError)
      expect(() => findShortestRoute(graph, id, 'B', 'mixed')).toThrow(RangeError)
      expect(() => findShortestRoute(graph, 'A', id, 'mixed')).toThrow(RangeError)
    }
    expect(() => findShortestRoute(graph, 'A', 'A', 'weighted' as ReadingMode)).toThrow(RangeError)
  })

  it('rejects noncanonical or repeated physical pairs, invalid edges and incomplete omission records', () => {
    const invalid = (change: (raw: RealConnectome) => void) => {
      const raw = fixture(['A', 'B'], [['A', 'B']], [['A', 'B']])
      change(raw)
      expect(() => createReadingGraph(raw)).toThrow(RangeError)
    }
    invalid(raw => { raw.neurons[1]!.id = 'A' })
    invalid(raw => { raw.chemicalEdges[0]!.target = 'Outside' })
    invalid(raw => { raw.chemicalEdges[0]!.rawWeight = NaN })
    invalid(raw => { raw.gapEdges[0]!.b = 'A' })
    invalid(raw => { raw.gapEdges[0]!.a = 'B'; raw.gapEdges[0]!.b = 'A' })
    invalid(raw => { raw.gapEdges[0]!.id = raw.chemicalEdges[0]!.id })
    invalid(raw => { raw.gapEdges.push({ ...raw.gapEdges[0]!, id: 'Duplicate-pair' }) })
    invalid(raw => { raw.chemicalEdges.push({ ...raw.chemicalEdges[0]!, id: 'Duplicate-direction' }) })
    invalid(raw => { raw.selection.omittedByNeuron.pop() })
  })
})

describe('minimum-hop structural routes', () => {
  it('follows chemicals only forward and traverses a gap in either direction with one physical identity', () => {
    const graph = graphOf(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']], [['A', 'B']])
    expect(findShortestRoute(graph, 'A', 'C', 'chemical').nodes).toEqual(['A', 'B', 'C'])
    expect(findShortestRoute(graph, 'B', 'A', 'chemical').status).toBe('unreachable')
    for (const [from, to] of [['A', 'B'], ['B', 'A']] as const) {
      const route = findShortestRoute(graph, from, to, 'gap')
      expect(route.nodes).toEqual([from, to])
      expect(route.hops.map(hop => hop.edgeId)).toEqual(['gap:A:B'])
      assertHops(graph, route.nodes, route.hops)
    }
    expect(findShortestRoute(graph, 'A', 'C', 'gap').status).toBe('unreachable')
  })

  it('combines a forward chemical and reverse physical gap without inventing reverse chemicals', () => {
    const graph = graphOf(['A', 'B', 'C'], [['A', 'B']], [['B', 'C']])
    const forward = findShortestRoute(graph, 'A', 'C', 'mixed')
    expect(forward.nodes).toEqual(['A', 'B', 'C'])
    expect(forward.hops.map(hop => hop.kind)).toEqual(['chemical', 'gap'])
    assertHops(graph, forward.nodes, forward.hops)
    expect(findShortestRoute(graph, 'C', 'A', 'mixed').status).toBe('unreachable')
    const reverseChemical = graphOf(['A', 'B', 'C'], [['B', 'A']], [['B', 'C']])
    const reverse = findShortestRoute(reverseChemical, 'C', 'A', 'mixed')
    expect(reverse.nodes).toEqual(['C', 'B', 'A'])
    expect(reverse.hops.map(hop => hop.kind)).toEqual(['gap', 'chemical'])
    assertHops(reverseChemical, reverse.nodes, reverse.hops)
  })

  it('chooses minimum hops rather than the strongest weights and never repeats a cell', () => {
    const raw = fixture(['A', 'B', 'C', 'D', 'T'], [['A', 'B', 999], ['B', 'C', 999], ['C', 'T', 999], ['C', 'A', 999], ['A', 'D', 1], ['D', 'T', 1]])
    const route = findShortestRoute(createReadingGraph(raw), 'A', 'T', 'chemical')
    expect(route.nodes).toEqual(['A', 'D', 'T'])
    expect(new Set(route.nodes).size).toBe(route.nodes.length)
    raw.chemicalEdges.forEach((edge, index) => { edge.rawWeight = index % 2 ? .01 : 1_000_000 })
    const changed = findShortestRoute(createReadingGraph(raw), 'A', 'T', 'chemical')
    expect(changed.nodes).toEqual(route.nodes)
    expect(changed.hops.map(hop => hop.edgeId)).toEqual(route.hops.map(hop => hop.edgeId))
  })

  it('breaks equal-length ties by exact neighbour ID, then chemical before gap, regardless of input order', () => {
    const raw = fixture(['T', 'B2', 'A', 'B10'], [['A', 'B2'], ['B2', 'T'], ['A', 'B10'], ['B10', 'T']], [['A', 'B10']])
    const graph = createReadingGraph(raw)
    const route = findShortestRoute(graph, 'A', 'T', 'mixed')
    expect(route.nodes).toEqual(['A', 'B10', 'T'])
    expect(route.hops[0]!.kind).toBe('chemical')
    const before = JSON.stringify(graph)
    raw.neurons.reverse()
    raw.selection.neuronIds = raw.neurons.map(neuron => neuron.id)
    raw.selection.seeds = [...raw.selection.neuronIds]
    raw.chemicalEdges.reverse()
    raw.gapEdges.reverse()
    expect(findShortestRoute(createReadingGraph(raw), 'A', 'T', 'mixed')).toEqual(route)
    expect(findShortestRoute(graph, 'A', 'T', 'mixed')).toEqual(route)
    expect(JSON.stringify(graph)).toBe(before)
    expect(Object.isFrozen(route.nodes)).toBe(true)
    expect(Object.isFrozen(route.hops[0])).toBe(true)
  })

  it('distinguishes a zero-edge same-cell request from unreachable cells and counts distinct discovered cells', () => {
    const graph = graphOf(['A', 'B', 'C', 'Z'], [['A', 'A'], ['A', 'B'], ['B', 'A'], ['B', 'C']])
    expect(findShortestRoute(graph, 'A', 'A', 'chemical')).toEqual({ status: 'same-cell', nodes: ['A'], hops: [], visitedCount: 1 })
    expect(findShortestRoute(graph, 'A', 'B', 'chemical').visitedCount).toBe(2)
    expect(findShortestRoute(graph, 'A', 'Z', 'chemical')).toEqual({ status: 'unreachable', nodes: [], hops: [], visitedCount: 3 })
    expect(findShortestRoute(graph, 'Z', 'A', 'mixed').visitedCount).toBe(1)
  })
})

describe('shortest non-self directed chemical cycles', () => {
  it('finds the globally shortest cycle even when a longer branch is lexically first, and leaves self-loops separate', () => {
    const graph = graphOf(['A', 'B', 'C', 'D'], [['A', 'A', 5], ['A', 'B'], ['B', 'C'], ['C', 'A'], ['A', 'D'], ['D', 'A']], [['A', 'B']])
    const cycle = findChemicalCycle(graph, 'A')!
    expect(cycle.nodes).toEqual(['A', 'D', 'A'])
    expect(cycle.hops).toHaveLength(2)
    expect(cycle.hops.every(hop => hop.kind === 'chemical')).toBe(true)
    expect(new Set(cycle.nodes.slice(0, -1)).size).toBe(cycle.hops.length)
    assertHops(graph, cycle.nodes, cycle.hops)
    expect(inspectNeuron(graph, 'A').selfLoops).toHaveLength(1)
    expect(findShortestRoute(graph, 'A', 'A', 'chemical').hops).toHaveLength(0)
  })

  it('chooses a deterministic shortest reciprocal chemical cycle and freezes the result', () => {
    const raw = fixture(['C', 'A', 'B'], [['A', 'C'], ['C', 'A'], ['A', 'B'], ['B', 'A']])
    const graph = createReadingGraph(raw)
    const cycle = findChemicalCycle(graph, 'A')!
    expect(cycle.nodes).toEqual(['A', 'B', 'A'])
    raw.chemicalEdges.reverse()
    raw.neurons.reverse()
    raw.selection.neuronIds = raw.neurons.map(neuron => neuron.id)
    raw.selection.seeds = [...raw.selection.neuronIds]
    expect(findChemicalCycle(createReadingGraph(raw), 'A')).toEqual(cycle)
    expect(Object.isFrozen(cycle)).toBe(true)
    expect(Object.isFrozen(cycle.hops[0])).toBe(true)
  })

  it('does not turn self-loops, gap reversals or an undirected gap triangle into chemical cycles', () => {
    const graph = graphOf(['A', 'B', 'C', 'Z'], [['A', 'A'], ['A', 'B']], [['A', 'B'], ['B', 'C'], ['C', 'A']])
    for (const id of graph.neuronIds) expect(findChemicalCycle(graph, id)).toBeNull()
    expect(findShortestRoute(graph, 'B', 'A', 'gap').status).toBe('found')
    expect(findShortestRoute(graph, 'A', 'B', 'chemical').status).toBe('found')
  })
})

const localDatasetPath = process.env.CIRCUITIARY_READING_DATA ?? fileURLToPath(new URL('../../data/local/cook-subset.json', import.meta.url))
describe('locally available pinned Cook2019 subset (never redistributed by these tests)', () => {
  it.skipIf(!existsSync(localDatasetPath))('preserves pinned source references and verifies real examples, all route lengths and shortest cycles independently', () => {
    const data = parseRealConnectome(JSON.parse(readFileSync(localDatasetPath, 'utf8')))
    const graph = createReadingGraph(data)
    expect(graph.dataset.sources.map(source => source.sha256)).toEqual([
      '1f4fdbf84746b69b49a8da0816f52787860ce349b638dce37924ba80f90c70c9',
      'f5c524407e196ba8045cfb86fb996d41730e4b899a7c24b0c525a4d2ad0a7376',
    ])
    expect([graph.neurons.length, graph.chemicalEdges.length, graph.gapEdges.length]).toEqual([30, 196, 50])
    expect(graph.neuronIds).toEqual(data.selection.neuronIds)
    expect(graph.dataset.anatomicalWeightUnit).toContain('EM sections')
    const before = JSON.stringify(data)
    const examples: Array<[string, string, ReadingMode, string[] | null]> = [
      ['RICL', 'AVBR', 'chemical', ['RICL', 'AVAR', 'AVBR']],
      ['AVBR', 'RICL', 'chemical', null],
      ['OLLL', 'DA08', 'chemical', ['OLLL', 'AVER', 'AVAL', 'DA08']],
      ['AVER', 'AVBR', 'gap', ['AVER', 'AVAR', 'AVBL', 'AVBR']],
      ['AVAR', 'AIZL', 'gap', null],
    ]
    for (const [from, to, mode, nodes] of examples) {
      const route = findShortestRoute(graph, from, to, mode)
      expect(route.status).toBe(nodes ? 'found' : 'unreachable')
      expect(route.nodes).toEqual(nodes ?? [])
      if (nodes) assertHops(graph, route.nodes, route.hops)
    }
    expect(inspectNeuron(graph, 'OLLL').selfLoops.map(hop => hop.rawWeight)).toEqual([4])
    expect(inspectNeuron(graph, 'AIZL').omittedExternal).toMatchObject({ gapCount: 8, gapWeight: 32 })
    expect(findChemicalCycle(graph, 'OLLL')!.nodes).toEqual(['OLLL', 'AVER', 'OLLL'])
    for (const mode of ['chemical', 'gap', 'mixed'] as const) {
      const expected = distances(graph, mode)
      for (const from of graph.neuronIds) for (const to of graph.neuronIds) {
        const route = findShortestRoute(graph, from, to, mode)
        const minimum = expected.get(from)!.get(to)!
        expect(route.status).toBe(from === to ? 'same-cell' : Number.isFinite(minimum) ? 'found' : 'unreachable')
        expect(route.hops.length).toBe(Number.isFinite(minimum) ? minimum : 0)
        expect(new Set(route.nodes).size).toBe(route.nodes.length)
        if (route.status === 'found') assertHops(graph, route.nodes, route.hops)
      }
      if (mode === 'chemical') for (const id of graph.neuronIds) {
        const minimum = Math.min(...graph.chemicalEdges.filter(edge => edge.source === id && edge.target !== id).map(edge => 1 + expected.get(edge.target)!.get(id)!))
        const cycle = findChemicalCycle(graph, id)
        if (Number.isFinite(minimum)) {
          expect(cycle).not.toBeNull()
          expect(cycle!.hops.length).toBe(minimum)
          expect(cycle!.nodes[0]).toBe(id)
          expect(cycle!.nodes.at(-1)).toBe(id)
          expect(new Set(cycle!.nodes.slice(0, -1)).size).toBe(cycle!.hops.length)
          assertHops(graph, cycle!.nodes, cycle!.hops)
        } else expect(cycle).toBeNull()
      }
    }
    expect(JSON.stringify(data)).toBe(before)
    expect(Object.isFrozen(graph.dataset.sources[0])).toBe(true)
  })
})
