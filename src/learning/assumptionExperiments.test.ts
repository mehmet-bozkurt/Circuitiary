import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildRealCircuit, defaultRealModelParameters, parseRealConnectome, realDefaultConfig,
} from '../model/realConnectome'
import { simulate } from '../model/simulation'
import type { Circuit, RealConnectome, SimulationConfig, SimulationResult } from '../model/types'
import { runAssumptionExperiment, type AssumptionRunOptions, type AssumptionVariable } from './assumptionExperiments'

const stats = () => ({ chemicalIncomingCount: 0, chemicalOutgoingCount: 0, gapCount: 0,
  chemicalIncomingWeight: 0, chemicalOutgoingWeight: 0, gapWeight: 0 })
const ref = (row: number, column: number) => ({ sheet: 'Invented anatomy', row, column, cell: `${String.fromCharCode(64 + column)}${row}` })

/** Invented source records exercise the existing real-data builder without redistribution. */
function fixture(): RealConnectome {
  const ids = ['AVAR', 'AVER', 'X']
  return {
    schemaVersion: 1,
    dataset: {
      id: 'assumptions-invented-fixture', title: 'Invented anatomy fixture', version: '1', doi: 'synthetic-test-only',
      sources: [{ name: 'Invented source', url: 'https://example.org/invented', sha256: '0'.repeat(64), downloadedAtUtc: '2026-10-03T00:00:00Z', extra: { note: 'Preserved source metadata' } }],
      license: { status: 'unverified-local-only', note: 'Invented test metadata.' },
      anatomicalWeightUnit: 'invented contact units', orientation: 'source rows; target columns; physical gaps once',
      provenanceNotes: ['Synthetic test graph; no biological function asserted.'],
    },
    neurons: ids.map((id, index) => ({ id, label: id, cellType: 'neuron', sourceRef: ref(index + 2, 1) })),
    chemicalEdges: [
      { id: 'chemical:AVER:AVAR', source: 'AVER', target: 'AVAR', rawWeight: 6, sourceRef: ref(3, 2) },
      { id: 'chemical:X:AVAR', source: 'X', target: 'AVAR', rawWeight: 2, sourceRef: ref(4, 2) },
      { id: 'chemical:AVAR:AVER', source: 'AVAR', target: 'AVER', rawWeight: 1, sourceRef: ref(2, 3) },
      { id: 'chemical:AVAR:AVAR', source: 'AVAR', target: 'AVAR', rawWeight: 3, sourceRef: ref(2, 2) },
    ],
    gapEdges: [
      { id: 'gap:AVAR:AVER', a: 'AVAR', b: 'AVER', rawWeight: 4, sourceRef: ref(2, 3), reciprocalSourceRef: ref(3, 2) },
      { id: 'gap:AVAR:X', a: 'AVAR', b: 'X', rawWeight: 2, sourceRef: ref(2, 4), reciprocalSourceRef: ref(4, 2) },
    ],
    selection: {
      algorithm: 'Invented cells in fixture order', seeds: [...ids], limit: 3, neuronIds: [...ids], ranking: [],
      omittedExternal: { ...stats(), gapCount: 1, gapWeight: 8 },
      omittedByNeuron: ids.map(neuronId => ({ neuronId, ...stats(), ...(neuronId === 'X' ? { gapCount: 1, gapWeight: 8 } : {}) })),
      excludedGapSelfEntries: [{ neuronId: 'X', rawWeight: 3, sourceRef: ref(4, 4), selected: true }],
    },
  }
}

function reference(data: ReturnType<typeof parseRealConnectome>, options: AssumptionRunOptions) {
  const baselineParameters = { chemicalGain: .8, gapGain: .2 }
  const comparisonParameters = { chemicalGain: .8, gapGain: .2 }
  const baselineConfig: SimulationConfig = { durationMs: 700, dtMs: 1, tauMs: 30,
    stimulus: { target: 'AVER', onsetMs: 100, durationMs: 200, amplitude: .8 } }
  const comparisonConfig = structuredClone(baselineConfig)
  if (options.variable === 'chemical-gain') comparisonParameters.chemicalGain = options.comparisonValue
  if (options.variable === 'gap-gain') comparisonParameters.gapGain = options.comparisonValue
  if (options.variable === 'time-constant') comparisonConfig.tauMs = options.comparisonValue
  const baselineCircuit = buildRealCircuit(data, baselineParameters)
  const comparisonCircuit = buildRealCircuit(data, comparisonParameters)
  return {
    baseline: { parameters: baselineParameters, circuit: baselineCircuit, config: baselineConfig, result: simulate(baselineCircuit, baselineConfig) },
    comparison: { parameters: comparisonParameters, circuit: comparisonCircuit, config: comparisonConfig, result: simulate(comparisonCircuit, comparisonConfig) },
  }
}

function actualMetrics(result: SimulationResult) {
  const values = result.activity.AVAR!
  const peak = Math.max(...values)
  return { outputId: 'AVAR', peak, peakTimeMs: peak > 0 ? result.timesMs[values.indexOf(peak)]! : null, endValue: values.at(-1)! }
}

function anatomicalProjection(circuit: Circuit) {
  return circuit.connections.map(({ id, source, target, kind, rawWeight, sourceRef, reciprocalSourceRef }) => ({ id, source, target, kind, rawWeight, sourceRef, reciprocalSourceRef }))
}

const boundaryCases: AssumptionRunOptions[] = [
  { variable: 'chemical-gain', comparisonValue: 0 }, { variable: 'chemical-gain', comparisonValue: .35 }, { variable: 'chemical-gain', comparisonValue: 1.5 },
  { variable: 'gap-gain', comparisonValue: 0 }, { variable: 'gap-gain', comparisonValue: .6 }, { variable: 'gap-gain', comparisonValue: 1 },
  { variable: 'time-constant', comparisonValue: 15 }, { variable: 'time-constant', comparisonValue: 60 }, { variable: 'time-constant', comparisonValue: 120 },
]

describe('fixed anatomy with one changed dynamical assumption', () => {
  it.each(boundaryCases)('matches every independent engine trace and changes only $variable=$comparisonValue', options => {
    const data = parseRealConnectome(fixture())
    const expected = reference(data, options)
    const run = runAssumptionExperiment(data, 2, options)
    expect(run.runNumber).toBe(2)
    expect(run.sourceData).toEqual(data)
    expect(run.sourceData).not.toBe(data)
    for (const condition of ['baseline', 'comparison'] as const) {
      expect(run[condition].parameters).toEqual(expected[condition].parameters)
      expect(run[condition].circuit).toEqual(expected[condition].circuit)
      expect(run[condition].config).toEqual(expected[condition].config)
      expect(run[condition].result).toEqual(expected[condition].result)
      expect(run[condition].metrics).toEqual(actualMetrics(expected[condition].result))
      expect(run[condition].result.timesMs).toHaveLength(701)
      expect(run[condition].config.tauOverrides).toBeUndefined()
    }
    expect(run.baseline.circuit).not.toBe(run.comparison.circuit)
    expect(anatomicalProjection(structuredClone(run.baseline.circuit) as Circuit)).toEqual(anatomicalProjection(structuredClone(run.comparison.circuit) as Circuit))
    expect(run.anatomyCounts).toEqual({ neurons: 3, chemicalEdges: 4, physicalGapPairs: 2, chemicalSelfLoops: 1 })
    expect(run.fixed).toEqual({ stimulusTarget: 'AVER', outputId: 'AVAR', amplitude: .8, onsetMs: 100, stimulusDurationMs: 200, durationMs: 700, dtMs: 1 })
    expect(run.controlledVariable).toEqual({ variable: options.variable,
      baselineValue: options.variable === 'chemical-gain' ? .8 : options.variable === 'gap-gain' ? .2 : 30,
      comparisonValue: options.comparisonValue, unit: options.variable === 'time-constant' ? 'ms' : 'dimensionless',
      scope: options.variable === 'chemical-gain' ? 'chemical-edges' : options.variable === 'gap-gain' ? 'physical-gap-pairs' : 'all-neurons' })
    const normalizedParameters = { ...run.comparison.parameters }
    const normalizedConfig = structuredClone(run.comparison.config) as SimulationConfig
    if (options.variable === 'chemical-gain') normalizedParameters.chemicalGain = .8
    if (options.variable === 'gap-gain') normalizedParameters.gapGain = .2
    if (options.variable === 'time-constant') normalizedConfig.tauMs = 30
    expect(normalizedParameters).toEqual(run.baseline.parameters)
    expect(normalizedConfig).toEqual(run.baseline.config)
  })

  it.each<AssumptionRunOptions>([
    { variable: 'chemical-gain', comparisonValue: .8 }, { variable: 'gap-gain', comparisonValue: .2 }, { variable: 'time-constant', comparisonValue: 30 },
  ])('reproduces identical conditions when $variable equals its baseline', options => {
    const run = runAssumptionExperiment(parseRealConnectome(fixture()), 1, options)
    expect(run.comparison.circuit).toEqual(run.baseline.circuit)
    expect(run.comparison.config).toEqual(run.baseline.config)
    expect(run.comparison.result).toEqual(run.baseline.result)
    expect(run.comparison.metrics).toEqual(run.baseline.metrics)
    expect(run.delta).toEqual({ peak: 0, endValue: 0, maxAbsTraceDifference: 0 })
  })

  it.each<AssumptionVariable>(['chemical-gain', 'gap-gain'])('keeps raw records and the other model coupling when %s is zero', variable => {
    const run = runAssumptionExperiment(parseRealConnectome(fixture()), 1, { variable, comparisonValue: 0 })
    const selectedKind = variable === 'chemical-gain' ? 'chemical' : 'gap'
    expect(run.comparison.circuit.connections).toHaveLength(6)
    expect(run.sourceData.chemicalEdges).toHaveLength(4)
    expect(run.sourceData.gapEdges).toHaveLength(2)
    expect(run.comparison.circuit.connections.filter(edge => edge.kind === selectedKind).every(edge => edge.weight === 0 && edge.rawWeight! > 0)).toBe(true)
    expect(run.comparison.circuit.connections.filter(edge => edge.kind !== selectedKind)).toEqual(run.baseline.circuit.connections.filter(edge => edge.kind !== selectedKind))
    // A remaining anatomical/model route can produce activity; zeroing one
    // coupling type does not logically imply that the observed cell is silent.
    expect(run.comparison.metrics.peak).toBeGreaterThan(0)
    expect(run.sourceData.selection.excludedGapSelfEntries).toHaveLength(1)
    expect(run.comparison.circuit.connections.some(edge => edge.kind === 'gap' && edge.source === edge.target)).toBe(false)
  })

  it('reports no peak time for an all-zero output rather than a fabricated zero latency', () => {
    const raw = fixture()
    raw.gapEdges = []
    const run = runAssumptionExperiment(parseRealConnectome(raw), 1, { variable: 'chemical-gain', comparisonValue: 0 })
    expect(run.comparison.result.activity.AVAR!.every(value => value === 0)).toBe(true)
    expect(run.comparison.metrics).toEqual({ outputId: 'AVAR', peak: 0, peakTimeMs: null, endValue: 0 })
    expect(run.comparison.result.activity.AVER!.some(value => value > 0)).toBe(true)
  })

  it('derives peak/end deltas from AVAR and maximum trace difference from all selected cells', () => {
    const run = runAssumptionExperiment(parseRealConnectome(fixture()), 1, { variable: 'time-constant', comparisonValue: 120 })
    const differences = Object.keys(run.baseline.result.activity).flatMap(id => run.baseline.result.activity[id]!.map((value, index) => Math.abs(run.comparison.result.activity[id]![index]! - value)))
    expect(run.delta.maxAbsTraceDifference).toBe(Math.max(...differences))
    expect(run.delta.peak).toBe(run.comparison.metrics.peak - run.baseline.metrics.peak)
    expect(run.delta.endValue).toBe(run.comparison.metrics.endValue - run.baseline.metrics.endValue)
    const avarDifference = Math.max(...run.baseline.result.activity.AVAR!.map((value, index) => Math.abs(run.comparison.result.activity.AVAR![index]! - value)))
    expect(run.delta.maxAbsTraceDifference).toBeGreaterThan(avarDifference)
    expect(run.assumptions.join(' ')).toContain('bütün seçilmiş hücre')
    expect(run.assumptions.join(' ')).toContain('bütün hücrelere')
    expect(run.assumptions.join(' ')).toContain('kalibre edilmemiştir')
  })
})

describe('defensive immutable experiment snapshots and invalid requests', () => {
  it('copies and freezes source, separate circuits/configs/results while leaving inputs and existing defaults untouched', () => {
    const raw = fixture()
    const before = structuredClone(raw)
    const savedConfig = structuredClone(realDefaultConfig)
    const savedParameters = { ...defaultRealModelParameters }
    const options: AssumptionRunOptions = { variable: 'gap-gain', comparisonValue: .6 }
    const run = runAssumptionExperiment(raw, 1, options)
    expect(raw).toEqual(before)
    expect(Object.isFrozen(raw)).toBe(false)
    options.comparisonValue = 1
    raw.chemicalEdges[0]!.rawWeight = 999
    raw.dataset.sources[0]!.sha256 = 'caller changed'
    expect(run.sourceData).toEqual(before)
    expect(run.comparison.parameters.gapGain).toBe(.6)
    expect(run.controlledVariable.comparisonValue).toBe(.6)
    expect(realDefaultConfig).toEqual(savedConfig)
    expect(defaultRealModelParameters).toEqual(savedParameters)
    expect(run.sourceData).not.toBe(raw)
    expect(run.baseline.circuit.realData!.dataset).not.toBe(run.sourceData.dataset)
    expect(run.comparison.circuit.realData!.dataset).not.toBe(run.baseline.circuit.realData!.dataset)
    for (const value of [run, run.sourceData, run.sourceData.dataset.sources[0]!.extra, run.sourceData.chemicalEdges[0]!.sourceRef,
      run.baseline.circuit.connections[0], run.comparison.circuit.connections[0], run.comparison.config.stimulus,
      run.comparison.result.settings, run.comparison.result.activity.AVAR, run.comparison.metrics, run.delta, run.assumptions]) expect(Object.isFrozen(value)).toBe(true)
    expect(() => { (run.sourceData.chemicalEdges[0] as { rawWeight: number }).rawWeight = 5 }).toThrow(TypeError)
    expect(() => { (run.comparison.result.activity.AVAR as unknown as number[])[200] = 9 }).toThrow(TypeError)
  })

  it('is deterministic, with run numbers affecting only the record identity', () => {
    const data = parseRealConnectome(fixture())
    const options: AssumptionRunOptions = { variable: 'chemical-gain', comparisonValue: 1.2 }
    const first = runAssumptionExperiment(data, 1, options)
    expect(runAssumptionExperiment(data, 1, options)).toEqual(first)
    const second = runAssumptionExperiment(data, 2, options)
    expect({ ...second, runNumber: 1 }).toEqual(first)
  })

  it('rejects unknown variables, nonfinite or out-of-range values, malformed options and invalid run numbers', () => {
    const data = parseRealConnectome(fixture())
    for (const runNumber of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => runAssumptionExperiment(data, runNumber, { variable: 'gap-gain', comparisonValue: .6 })).toThrow(RangeError)
    }
    for (const variable of ['chemical-gain', 'gap-gain', 'time-constant'] as const) {
      for (const value of [NaN, Infinity, -Infinity]) expect(() => runAssumptionExperiment(data, 1, { variable, comparisonValue: value })).toThrow(RangeError)
    }
    const invalid: unknown[] = [null, [], {}, { variable: 'sign', comparisonValue: 1 },
      { variable: 'chemical-gain', comparisonValue: -.01 }, { variable: 'chemical-gain', comparisonValue: 1.5001 },
      { variable: 'gap-gain', comparisonValue: -.01 }, { variable: 'gap-gain', comparisonValue: 1.0001 },
      { variable: 'time-constant', comparisonValue: 14.99 }, { variable: 'time-constant', comparisonValue: 120.01 },
      { variable: 'gap-gain', comparisonValue: '0.6' }, { variable: 'gap-gain', comparisonValue: .6, tauOverrides: { AVAR: 90 } }]
    for (const options of invalid) expect(() => runAssumptionExperiment(data, 1, options as AssumptionRunOptions)).toThrow(RangeError)
    const missingReadout = fixture()
    missingReadout.neurons = missingReadout.neurons.filter(neuron => neuron.id !== 'AVAR')
    missingReadout.chemicalEdges = []
    missingReadout.gapEdges = []
    missingReadout.selection.seeds = missingReadout.neurons.map(neuron => neuron.id)
    missingReadout.selection.neuronIds = [...missingReadout.selection.seeds]
    missingReadout.selection.omittedByNeuron = missingReadout.selection.omittedByNeuron.filter(entry => entry.neuronId !== 'AVAR')
    expect(() => runAssumptionExperiment(parseRealConnectome(missingReadout), 1, { variable: 'gap-gain', comparisonValue: .6 })).toThrow(RangeError)
  })
})

const localDatasetPath = process.env.CIRCUITIARY_ASSUMPTIONS_DATA ?? resolve(process.cwd(), 'data/local/cook-subset.json')
describe('locally available pinned Cook2019 anatomy (not redistributed)', () => {
  it.skipIf(!existsSync(localDatasetPath))('matches all 30 traces against the existing builder/engine for all variables and boundary values', () => {
    const data = parseRealConnectome(JSON.parse(readFileSync(localDatasetPath, 'utf8')))
    expect(data.dataset.sources.map(source => source.sha256)).toEqual([
      '1f4fdbf84746b69b49a8da0816f52787860ce349b638dce37924ba80f90c70c9',
      'f5c524407e196ba8045cfb86fb996d41730e4b899a7c24b0c525a4d2ad0a7376',
    ])
    const before = JSON.stringify(data)
    for (const options of [...boundaryCases, { variable: 'chemical-gain' as const, comparisonValue: 1.2 }, { variable: 'time-constant' as const, comparisonValue: 90 }]) {
      const run = runAssumptionExperiment(data, 1, options)
      const expected = reference(data, options)
      expect(run.anatomyCounts).toEqual({ neurons: 30, chemicalEdges: 196, physicalGapPairs: 50, chemicalSelfLoops: 5 })
      expect(run.sourceData).toEqual(data)
      expect(run.baseline.result).toEqual(expected.baseline.result)
      expect(run.comparison.result).toEqual(expected.comparison.result)
      expect(Object.keys(run.comparison.result.activity)).toEqual(data.neurons.map(neuron => neuron.id))
      expect(run.comparison.circuit.connections.map(edge => [edge.id, edge.rawWeight, edge.sourceRef, edge.reciprocalSourceRef])).toEqual(run.baseline.circuit.connections.map(edge => [edge.id, edge.rawWeight, edge.sourceRef, edge.reciprocalSourceRef]))
      expect(run.baseline.metrics).toEqual(actualMetrics(expected.baseline.result))
      expect(run.comparison.metrics).toEqual(actualMetrics(expected.comparison.result))
      expect(run.sourceData.dataset.license.status).toBe('unverified-local-only')
    }
    expect(JSON.stringify(data)).toBe(before)
  })
})
