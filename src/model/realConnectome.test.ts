import { describe, expect, it } from 'vitest'
import {
  buildRealCircuit, chemicalNormalizationFormula, defaultRealModelParameters,
  gapNormalizationFormula, parseRealConnectome, realDefaultConfig, realDefaultReadout,
} from './realConnectome'
import { simulate } from './simulation'
import type { RealConnectome } from './types'

// Entirely invented three-cell anatomy; no published dataset is redistributed.
const stats = () => ({ chemicalIncomingCount: 0, chemicalOutgoingCount: 0, gapCount: 0,
  chemicalIncomingWeight: 0, chemicalOutgoingWeight: 0, gapWeight: 0 })
const ref = (row: number, column: number) => ({ sheet: 'Synthetic', row, column, cell: `${String.fromCharCode(64 + column)}${row}` })
function fixture(): RealConnectome {
  return {
    schemaVersion: 1,
    dataset: {
      id: 'synthetic-three-cell', title: 'Synthetic test anatomy', version: '1', doi: 'synthetic-test-only',
      sources: [{ name: 'Invented fixture', url: 'https://example.org/synthetic', sha256: '0'.repeat(64), downloadedAtUtc: '2026-10-03T00:00:00Z', byteLength: 123 }],
      license: { status: 'unverified-local-only', note: 'Test metadata only.' },
      anatomicalWeightUnit: 'invented contact units', orientation: 'chemical source→target; gap canonical unordered pairs',
      provenanceNotes: ['Synthetic test fixture; no real anatomy.'],
    },
    neurons: [
      { id: 'A', label: 'A', cellType: 'sensory', sourceRef: ref(2, 1) },
      { id: 'B', label: 'B', cellType: 'motorneuron', sourceRef: ref(3, 1) },
      { id: 'C', label: 'C', cellType: 'neuron', sourceRef: ref(4, 1) },
    ],
    chemicalEdges: [
      { id: 'chemical:A:B', source: 'A', target: 'B', rawWeight: 6, sourceRef: ref(2, 3) },
      { id: 'chemical:C:B', source: 'C', target: 'B', rawWeight: 2, sourceRef: ref(4, 3) },
      { id: 'chemical:B:B', source: 'B', target: 'B', rawWeight: 2, sourceRef: ref(3, 3) },
      { id: 'chemical:B:A', source: 'B', target: 'A', rawWeight: 1, sourceRef: ref(3, 2) },
    ],
    gapEdges: [
      { id: 'gap:A:B', a: 'A', b: 'B', rawWeight: 4, sourceRef: ref(2, 3), reciprocalSourceRef: ref(3, 2) },
      { id: 'gap:B:C', a: 'B', b: 'C', rawWeight: 2, sourceRef: ref(3, 4), reciprocalSourceRef: ref(4, 3) },
    ],
    selection: {
      algorithm: 'Synthetic candidates in explicit rank order', seeds: ['A', 'B'], limit: 3,
      neuronIds: ['A', 'B', 'C'],
      ranking: [
        { neuronId: 'C', chemicalSeedWeight: 2, gapSeedWeight: 2, rank: 1, selected: true },
        { neuronId: 'D', chemicalSeedWeight: 1, gapSeedWeight: 1, rank: 2, selected: false },
      ],
      omittedExternal: stats(), omittedByNeuron: ['A', 'B', 'C'].map((neuronId) => ({ neuronId, ...stats() })),
      excludedGapSelfEntries: [
        { neuronId: 'C', rawWeight: 3, sourceRef: ref(4, 4), selected: true },
        { neuronId: 'Z', rawWeight: 1, sourceRef: ref(5, 5), selected: false },
      ],
    },
    sourceValidation: { diagonalCount: 2, note: 'Retained unknown JSON metadata.' },
  }
}

describe('validated real anatomical data and assumed model builder', () => {
  it('defensively copies and recursively freezes all raw anatomy and extra metadata', () => {
    const raw = fixture()
    const validated = parseRealConnectome(raw)
    raw.chemicalEdges[0]!.rawWeight = 600
    raw.dataset.sources[0]!.sha256 = 'changed'
    expect(validated.chemicalEdges[0]!.rawWeight).toBe(6)
    expect(validated.dataset.sources[0]!.byteLength).toBe(123)
    expect(validated.sourceValidation).toEqual({ diagonalCount: 2, note: 'Retained unknown JSON metadata.' })
    expect(Object.isFrozen(validated)).toBe(true)
    expect(Object.isFrozen(validated.chemicalEdges[0]!.sourceRef)).toBe(true)
    expect(Object.isFrozen(validated.sourceValidation)).toBe(true)
    expect(() => { (validated.chemicalEdges[0] as { rawWeight: number }).rawWeight = 9 }).toThrow()
  })

  it('normalizes incoming chemical anatomy while labeling every sign as assumed positive', () => {
    const validated = parseRealConnectome(fixture())
    const circuit = buildRealCircuit(validated)
    const weights = Object.fromEntries(circuit.connections.map((edge) => [edge.id, edge.weight]))
    expect(weights['chemical:A:B']).toBeCloseTo(0.48, 12)
    expect(weights['chemical:C:B']).toBeCloseTo(0.16, 12)
    expect(weights['chemical:B:B']).toBeCloseTo(0.16, 12)
    expect(weights['chemical:B:A']).toBeCloseTo(0.8, 12)
    expect(circuit.realData!.normalization.chemicalIncomingRawWeight).toEqual({ A: 1, B: 10, C: 0 })
    expect(circuit.realData!.normalization.chemicalDenominatorByTarget).toEqual({ A: 1, B: 10, C: 1 })
    expect(circuit.realData!.normalization.chemicalFormula).toBe(chemicalNormalizationFormula)
    expect(circuit.realData!.modelAssumptions.chemicalSign).toBe('unknown-assumed-positive')
    expect(circuit.connections.every((edge) => edge.evidence === 'anatomy-with-assumed-dynamics')).toBe(true)
    expect(circuit.neurons.every((neuron) => neuron.role === 'unspecified')).toBe(true)
    expect(circuit.neurons[1]!.cellType).toBe('motorneuron')
    expect(validated.chemicalEdges[0]!.rawWeight).toBe(6)
  })

  it('normalizes each physical gap once using both incident totals, preserving its two source refs', () => {
    const circuit = buildRealCircuit(parseRealConnectome(fixture()))
    const gaps = circuit.connections.filter((edge) => edge.kind === 'gap')
    expect(gaps).toHaveLength(2)
    expect(gaps[0]!.weight).toBeCloseTo(0.2 * 4 / 6, 12)
    expect(gaps[1]!.weight).toBeCloseTo(0.2 * 2 / 6, 12)
    expect(gaps[0]!.rawWeight).toBe(4)
    expect(gaps[0]!.reciprocalSourceRef).toEqual(ref(3, 2))
    expect(circuit.realData!.normalization.gapIncidentRawWeight).toEqual({ A: 4, B: 6, C: 2 })
    expect(circuit.realData!.normalization.gapDenominatorByConnection).toEqual({ 'gap:A:B': 6, 'gap:B:C': 6 })
    expect(circuit.realData!.normalization.gapFormula).toBe(gapNormalizationFormula)
    for (const neuron of circuit.neurons) {
      const sum = gaps.filter((edge) => edge.source === neuron.id || edge.target === neuron.id).reduce((total, edge) => total + edge.weight, 0)
      expect(sum).toBeLessThanOrEqual(defaultRealModelParameters.gapGain)
    }
  })

  it('keeps source diagonal records as metadata and uses a cut boundary without exterior gap sinks', () => {
    const raw = fixture()
    raw.selection.omittedExternal.gapCount = 100
    raw.selection.omittedExternal.gapWeight = 1000
    raw.selection.omittedByNeuron[0]!.gapCount = 100
    raw.selection.omittedByNeuron[0]!.gapWeight = 1000
    const circuit = buildRealCircuit(parseRealConnectome(raw))
    expect(circuit.realData!.selection.excludedGapSelfEntries).toHaveLength(2)
    expect(circuit.connections.filter((edge) => edge.kind === 'gap').every((edge) => edge.source !== edge.target)).toBe(true)
    expect(circuit.realData!.modelAssumptions).toMatchObject({ boundary: 'isolated-induced-subgraph', externalChemicalInput: 'zero', externalGapConnections: 'removed', diagonalGapEntries: 'reported-not-simulated' })
    expect(circuit.realData!.normalization.gapIncidentRawWeight).toEqual({ A: 4, B: 6, C: 2 })
  })

  it('retains directed chemical self-edges and applies source to target synchronously', () => {
    const raw = fixture()
    raw.chemicalEdges = [raw.chemicalEdges[0]!]
    raw.gapEdges = []
    const circuit = buildRealCircuit(parseRealConnectome(raw))
    const config = { durationMs: 1, dtMs: 1, tauMs: 30, stimulus: { target: 'A', onsetMs: 0, durationMs: 0, amplitude: 0 }, initialState: { A: 1 } }
    const result = simulate(circuit, config)
    expect(result.activity.B![1]).toBeCloseTo(0.8 / 30, 12)
    const reversed = simulate(circuit, { ...config, initialState: { B: 1 } })
    expect(reversed.activity.A![1]).toBe(0)
    expect(buildRealCircuit(parseRealConnectome(fixture())).connections.find((edge) => edge.id === 'chemical:B:B')!.kind).toBe('chemical')
  })

  it('keeps gain interventions separate from immutable anatomy and supports zero gains', () => {
    const validated = parseRealConnectome(fixture())
    const before = JSON.stringify(validated)
    const parameters = { chemicalGain: 0, gapGain: 0 }
    const circuit = buildRealCircuit(validated, parameters)
    parameters.chemicalGain = 9
    expect(circuit.connections.every((edge) => edge.weight === 0)).toBe(true)
    expect(circuit.realData!.parameters).toEqual({ chemicalGain: 0, gapGain: 0 })
    expect(Object.isFrozen(circuit.realData!.normalization.gapIncidentRawWeight)).toBe(true)
    expect(JSON.stringify(validated)).toBe(before)
    for (const gains of [{ chemicalGain: -1, gapGain: 0 }, { chemicalGain: 0, gapGain: Infinity }, { chemicalGain: NaN, gapGain: 0 }]) {
      expect(() => buildRealCircuit(validated, gains)).toThrow()
    }
  })

  it('builds deterministic bounded simulation traces from validated synthetic anatomy', () => {
    const circuit = buildRealCircuit(parseRealConnectome(fixture()))
    const config = { ...realDefaultConfig, stimulus: { ...realDefaultConfig.stimulus, target: 'A' } }
    const result = simulate(circuit, config)
    expect(simulate(circuit, config)).toEqual(result)
    for (const trace of Object.values(result.activity)) for (const value of trace) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
    expect(realDefaultConfig.stimulus.target).toBe('AVER')
    expect(realDefaultReadout).toBe('AVAR')
  })

  it('uses max(1, raw total) for sub-unit anatomical weights without inventing scale', () => {
    const raw = fixture()
    raw.chemicalEdges = [{ ...raw.chemicalEdges[0]!, rawWeight: 0.5 }]
    raw.gapEdges = [{ ...raw.gapEdges[0]!, rawWeight: 0.25 }]
    const circuit = buildRealCircuit(parseRealConnectome(raw))
    expect(circuit.connections[0]!.weight).toBe(0.4)
    expect(circuit.connections[1]!.weight).toBe(0.05)
  })
})

type Mutation = (value: RealConnectome) => void
const malformed: Array<[string, Mutation]> = [
  ['unknown schema', (value) => { (value as { schemaVersion: number }).schemaVersion = 2 }],
  ['duplicate cell ID', (value) => { value.neurons[1]!.id = 'A' }],
  ['unknown exact chemical cell ID', (value) => { value.chemicalEdges[0]!.target = 'b' }],
  ['unknown physical gap cell', (value) => { value.gapEdges[0]!.b = 'D' }],
  ['nonfinite raw weight', (value) => { value.chemicalEdges[0]!.rawWeight = Infinity }],
  ['zero raw edge', (value) => { value.gapEdges[0]!.rawWeight = 0 }],
  ['duplicate edge ID', (value) => { value.gapEdges[0]!.id = value.chemicalEdges[0]!.id }],
  ['duplicate ordered chemical pair', (value) => { value.chemicalEdges.push({ ...value.chemicalEdges[0]!, id: 'another' }) }],
  ['duplicate physical gap', (value) => { value.gapEdges.push({ ...value.gapEdges[0]!, id: 'another' }) }],
  ['reversed physical gap', (value) => { value.gapEdges[0]!.a = 'B'; value.gapEdges[0]!.b = 'A' }],
  ['physical gap diagonal', (value) => { value.gapEdges[0]!.b = 'A' }],
  ['source coordinate mismatch', (value) => { value.neurons[0]!.sourceRef.column = 2 }],
  ['zero source row', (value) => { value.neurons[0]!.sourceRef.row = 0 }],
  ['missing reciprocal source reference', (value) => { delete (value.gapEdges[0] as unknown as Record<string, unknown>).reciprocalSourceRef }],
  ['unknown cell type', (value) => { (value.neurons[0] as unknown as Record<string, unknown>).cellType = 'inhibitory' }],
  ['changed neuron order', (value) => { value.selection.neuronIds.reverse() }],
  ['missing seed', (value) => { value.selection.seeds[0] = 'D' }],
  ['duplicate seed', (value) => { value.selection.seeds[1] = 'A' }],
  ['seed in candidate ranking', (value) => { value.selection.ranking[0]!.neuronId = 'A' }],
  ['noncontiguous rank', (value) => { value.selection.ranking[1]!.rank = 3 }],
  ['inconsistent candidate selected flag', (value) => { value.selection.ranking[1]!.selected = true }],
  ['impossible limit', (value) => { value.selection.limit = 2 }],
  ['oversized subset', (value) => { value.selection.limit = 31 }],
  ['unordered ranking scores', (value) => { value.selection.ranking[1]!.chemicalSeedWeight = 3 }],
  ['unordered gap tie break', (value) => { value.selection.ranking[1]!.chemicalSeedWeight = 2; value.selection.ranking[1]!.gapSeedWeight = 3 }],
  ['unordered exact-name tie break', (value) => { value.selection.ranking[1]!.chemicalSeedWeight = 2; value.selection.ranking[1]!.gapSeedWeight = 2; value.selection.ranking[1]!.neuronId = 'AA' }],
  ['zero candidate scores', (value) => { value.selection.ranking[1]!.chemicalSeedWeight = 0; value.selection.ranking[1]!.gapSeedWeight = 0 }],
  ['inconsistent aggregate omitted statistics', (value) => { value.selection.omittedByNeuron[0]!.gapCount = 1 }],
  ['missing omitted-cell statistics', (value) => { value.selection.omittedByNeuron.pop() }],
  ['negative omitted anatomical weight', (value) => { value.selection.omittedExternal.gapWeight = -1 }],
  ['noninteger omitted count', (value) => { value.selection.omittedExternal.gapCount = 0.5 }],
  ['diagonal selected mismatch', (value) => { value.selection.excludedGapSelfEntries[0]!.selected = false }],
  ['duplicate source diagonal cell', (value) => { value.selection.excludedGapSelfEntries.push(value.selection.excludedGapSelfEntries[0]!) }],
  ['invalid SHA digest', (value) => { value.dataset.sources[0]!.sha256 = 'unknown' }],
  ['non-HTTP source URL', (value) => { value.dataset.sources[0]!.url = 'file:///local' }],
  ['non-UTC download time', (value) => { value.dataset.sources[0]!.downloadedAtUtc = '2026-10-03T00:00:00' }],
  ['unexpected licensing status', (value) => { (value.dataset.license as Record<string, unknown>).status = 'public-domain' }],
  ['non-JSON extra metadata', (value) => { value.extra = () => 0 }],
]

describe('runtime anatomical schema rejection', () => {
  it.each(malformed)('rejects %s', (_label, mutate) => {
    const raw = fixture()
    mutate(raw)
    expect(() => parseRealConnectome(raw)).toThrow()
  })
  it('rejects absent fields, cyclic data, primitive roots, and nonplain objects', () => {
    const missing = fixture()
    delete (missing.selection as unknown as Record<string, unknown>).excludedGapSelfEntries
    const cyclic = fixture()
    cyclic.extra = cyclic
    for (const value of [missing, cyclic, null, 'text', new Date()]) expect(() => parseRealConnectome(value)).toThrow()
  })
})
