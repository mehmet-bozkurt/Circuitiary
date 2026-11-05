import type {
  AnatomicalChemicalEdge, AnatomicalGapEdge, AnatomicalNeuron, ConnectomeDataset,
  ConnectomeSelection, DeepReadonly, ReadonlyRealConnectome, SourceReference,
} from '../model/types'

export type ReadingMode = 'chemical' | 'gap' | 'mixed'

/** A structural traversal, not a measured direction or strength of neural activity. */
export interface ReadingHop {
  readonly edgeId: string
  readonly kind: 'chemical' | 'gap'
  readonly from: string
  readonly to: string
  readonly rawWeight: number
  /** Gap references keep the canonical physical record's original orientation. */
  readonly sourceRef: DeepReadonly<SourceReference>
  readonly reciprocalSourceRef?: DeepReadonly<SourceReference>
}

export interface ReadingGraph {
  readonly neurons: readonly DeepReadonly<AnatomicalNeuron>[]
  /** Original parsed order, independent of the deterministic route tie-break. */
  readonly neuronIds: readonly string[]
  readonly chemicalEdges: readonly DeepReadonly<AnatomicalChemicalEdge>[]
  /** Each physical pair occurs once, although routes can traverse either way. */
  readonly gapEdges: readonly DeepReadonly<AnatomicalGapEdge>[]
  readonly dataset: DeepReadonly<ConnectomeDataset>
  readonly selection: DeepReadonly<ConnectomeSelection>
}

export interface NeighborSummary {
  readonly neuron: DeepReadonly<AnatomicalNeuron>
  readonly incomingChemical: readonly ReadingHop[]
  readonly outgoingChemical: readonly ReadingHop[]
  /** One hop from this neuron to each physical gap neighbour. */
  readonly gaps: readonly ReadingHop[]
  /** Chemical diagonals are excluded from both neighbour lists and route searches. */
  readonly selfLoops: readonly ReadingHop[]
  readonly omittedExternal: DeepReadonly<ConnectomeSelection['omittedByNeuron'][number]>
  /** Source gap diagonals remain metadata; they are not physical gap edges. */
  readonly excludedGapSelfEntries: readonly DeepReadonly<ConnectomeSelection['excludedGapSelfEntries'][number]>[]
}

export interface ReadingRoute {
  readonly status: 'found' | 'unreachable' | 'same-cell'
  readonly nodes: readonly string[]
  readonly hops: readonly ReadingHop[]
  /** Distinct discovered cells, including the source and a discovered target. */
  readonly visitedCount: number
}

export interface ReadingCycle {
  /** Only the origin repeats, once at the end to close the cycle. */
  readonly nodes: readonly string[]
  readonly hops: readonly ReadingHop[]
}

function freezeTree<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeTree)
    Object.freeze(value)
  }
  return value as DeepReadonly<T>
}

function exactId(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function unique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new RangeError(`Duplicate ${label}.`)
}

/** Accept already parsed anatomy, take an independent copy, and retain its source metadata. */
export function createReadingGraph(data: ReadonlyRealConnectome): ReadingGraph {
  const copy = structuredClone(data)
  const ids = copy.neurons.map(neuron => neuron.id)
  if (!ids.length || ids.some(id => !exactId(id))) throw new RangeError('Reading graph requires exact neuron IDs.')
  unique(ids, 'neuron IDs')
  const known = new Set(ids)
  const edges = [...copy.chemicalEdges, ...copy.gapEdges]
  unique(edges.map(edge => edge.id), 'edge IDs')
  if (edges.some(edge => !exactId(edge.id) || !Number.isFinite(edge.rawWeight) || edge.rawWeight <= 0)) {
    throw new RangeError('Reading edges require exact IDs and positive finite raw weights.')
  }
  for (const edge of copy.chemicalEdges) {
    if (!known.has(edge.source) || !known.has(edge.target)) throw new RangeError('Chemical edge endpoint is outside the selected graph.')
  }
  for (const edge of copy.gapEdges) {
    if (!known.has(edge.a) || !known.has(edge.b) || edge.a >= edge.b) throw new RangeError('Gap edges must be selected canonical non-self pairs.')
  }
  unique(copy.chemicalEdges.map(edge => JSON.stringify([edge.source, edge.target])), 'directed chemical pairs')
  unique(copy.gapEdges.map(edge => JSON.stringify([edge.a, edge.b])), 'physical gap pairs')
  const omittedIds = copy.selection.omittedByNeuron.map(entry => entry.neuronId)
  unique(omittedIds, 'per-cell omission records')
  if (omittedIds.length !== ids.length || omittedIds.some(id => !known.has(id))) throw new RangeError('Every selected neuron must have one omission record.')
  return freezeTree({
    neurons: copy.neurons, neuronIds: ids, chemicalEdges: copy.chemicalEdges,
    gapEdges: copy.gapEdges, dataset: copy.dataset, selection: copy.selection,
  })
}

function requireNeuron(graph: ReadingGraph, id: string): DeepReadonly<AnatomicalNeuron> {
  const neuron = graph.neurons.find(candidate => candidate.id === id)
  if (!neuron) throw new RangeError(`Unknown selected neuron ID: ${String(id)}.`)
  return neuron
}

function requireMode(mode: ReadingMode): void {
  if (mode !== 'chemical' && mode !== 'gap' && mode !== 'mixed') throw new RangeError(`Unknown route mode: ${String(mode)}.`)
}

const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

function compareHops(a: ReadingHop, b: ReadingHop): number {
  return lexical(a.to, b.to) || (a.kind === b.kind ? 0 : a.kind === 'chemical' ? -1 : 1) || lexical(a.edgeId, b.edgeId)
}

function chemicalHop(edge: DeepReadonly<AnatomicalChemicalEdge>): ReadingHop {
  return { edgeId: edge.id, kind: 'chemical', from: edge.source, to: edge.target, rawWeight: edge.rawWeight, sourceRef: edge.sourceRef }
}

function gapHop(edge: DeepReadonly<AnatomicalGapEdge>, from: string): ReadingHop {
  return { edgeId: edge.id, kind: 'gap', from, to: edge.a === from ? edge.b : edge.a, rawWeight: edge.rawWeight, sourceRef: edge.sourceRef, reciprocalSourceRef: edge.reciprocalSourceRef }
}

export function inspectNeuron(graph: ReadingGraph, id: string): NeighborSummary {
  const neuron = requireNeuron(graph, id)
  return freezeTree({
    neuron,
    incomingChemical: graph.chemicalEdges.filter(edge => edge.target === id && edge.source !== id).map(chemicalHop).sort((a, b) => lexical(a.from, b.from) || lexical(a.edgeId, b.edgeId)),
    outgoingChemical: graph.chemicalEdges.filter(edge => edge.source === id && edge.target !== id).map(chemicalHop).sort(compareHops),
    gaps: graph.gapEdges.filter(edge => edge.a === id || edge.b === id).map(edge => gapHop(edge, id)).sort(compareHops),
    selfLoops: graph.chemicalEdges.filter(edge => edge.source === id && edge.target === id).map(chemicalHop).sort(compareHops),
    omittedExternal: graph.selection.omittedByNeuron.find(entry => entry.neuronId === id)!,
    excludedGapSelfEntries: graph.selection.excludedGapSelfEntries.filter(entry => entry.neuronId === id),
  })
}

function outgoing(graph: ReadingGraph, id: string, mode: ReadingMode): ReadingHop[] {
  const hops: ReadingHop[] = []
  if (mode !== 'gap') {
    for (const edge of graph.chemicalEdges) if (edge.source === id && edge.target !== id) hops.push(chemicalHop(edge))
  }
  if (mode !== 'chemical') {
    for (const edge of graph.gapEdges) if (edge.a === id || edge.b === id) hops.push(gapHop(edge, id))
  }
  return hops.sort(compareHops)
}

function reconstruct(from: string, to: string, parents: ReadonlyMap<string, ReadingHop>): { nodes: string[]; hops: ReadingHop[] } {
  const reversed: ReadingHop[] = []
  for (let current = to; current !== from;) {
    const hop = parents.get(current)
    if (!hop) throw new Error('Reading route has no recorded predecessor.')
    reversed.push(hop)
    current = hop.from
  }
  const hops = reversed.reverse()
  return { nodes: [from, ...hops.map(hop => hop.to)], hops }
}

/** Minimum-hop BFS. Raw anatomical weights never rank routes or imply propagation. */
export function findShortestRoute(graph: ReadingGraph, from: string, to: string, mode: ReadingMode): ReadingRoute {
  requireMode(mode)
  requireNeuron(graph, from)
  requireNeuron(graph, to)
  if (from === to) return freezeTree({ status: 'same-cell' as const, nodes: [from], hops: [], visitedCount: 1 })
  const queue = [from]
  const seen = new Set([from])
  const parents = new Map<string, ReadingHop>()
  for (let index = 0; index < queue.length; index += 1) {
    for (const hop of outgoing(graph, queue[index]!, mode)) {
      if (seen.has(hop.to)) continue
      seen.add(hop.to)
      parents.set(hop.to, hop)
      if (hop.to === to) return freezeTree({ status: 'found' as const, ...reconstruct(from, to, parents), visitedCount: seen.size })
      queue.push(hop.to)
    }
  }
  return freezeTree({ status: 'unreachable' as const, nodes: [], hops: [], visitedCount: seen.size })
}

/** Shortest non-self directed chemical cycle through this cell; gaps are excluded. */
export function findChemicalCycle(graph: ReadingGraph, id: string): ReadingCycle | null {
  requireNeuron(graph, id)
  const queue = [id]
  const seen = new Set([id])
  const parents = new Map<string, ReadingHop>()
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!
    for (const hop of outgoing(graph, current, 'chemical')) {
      if (hop.to === id && current !== id) {
        const prefix = reconstruct(id, current, parents)
        return freezeTree({ nodes: [...prefix.nodes, id], hops: [...prefix.hops, hop] })
      }
      if (seen.has(hop.to)) continue
      seen.add(hop.to)
      parents.set(hop.to, hop)
      queue.push(hop.to)
    }
  }
  return null
}
