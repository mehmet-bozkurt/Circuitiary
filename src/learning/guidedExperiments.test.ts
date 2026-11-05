import { describe, expect, it } from 'vitest'
import { defaultConfig, illustrativeCircuit } from '../model/circuit'
import { simulate } from '../model/simulation'
import type { SimulationConfig } from '../model/types'
import {
  GUIDED_REPORTING_LEVEL, runGuidedExperiment,
  type GuidedExperimentId, type GuidedRunOptions,
} from './guidedExperiments'

function originalConfig(): SimulationConfig {
  return structuredClone(defaultConfig)
}

describe('guided comparisons use the original engine and only one changed variable', () => {
  it.each<{
    id: GuidedExperimentId; options: GuidedRunOptions; expectedPath: string;
    baseline: (config: SimulationConfig) => void;
    comparison: (config: SimulationConfig) => void;
  }>([
    { id: 'stimulus', options: {}, expectedPath: 'stimulus.amplitude',
      baseline: config => { config.stimulus.amplitude = 0.4 },
      comparison: config => { config.stimulus.amplitude = 0.8 } },
    { id: 'connection', options: {}, expectedPath: 'silencedConnectionId',
      baseline: () => {}, comparison: config => { config.silencedConnectionId = 'I3-O1' } },
    { id: 'connection', options: { connectionId: 'I4-O1' }, expectedPath: 'silencedConnectionId',
      baseline: () => {}, comparison: config => { config.silencedConnectionId = 'I4-O1' } },
    { id: 'tau', options: {}, expectedPath: 'tauOverrides.O1',
      baseline: () => {}, comparison: config => { config.tauOverrides = { O1: 90 } } },
    { id: 'tau', options: { comparisonTauMs: 180 }, expectedPath: 'tauOverrides.O1',
      baseline: () => {}, comparison: config => { config.tauOverrides = { O1: 180 } } },
  ])('matches both independent full-trace simulations for $id / $options', testCase => {
    const snapshot = runGuidedExperiment(testCase.id, 3, testCase.options)
    const baseline = originalConfig()
    const comparison = originalConfig()
    testCase.baseline(baseline)
    testCase.comparison(comparison)
    expect(snapshot.circuit).toEqual(illustrativeCircuit)
    expect(snapshot.circuit).not.toBe(illustrativeCircuit)
    expect(snapshot.baseline.result).toEqual(simulate(illustrativeCircuit, baseline))
    expect(snapshot.comparison.result).toEqual(simulate(illustrativeCircuit, comparison))
    expect(snapshot.controlledVariable.configPath).toBe(testCase.expectedPath)
    expect(snapshot.baseline.result.timesMs).toEqual(snapshot.comparison.result.timesMs)
    expect(Object.keys(snapshot.baseline.result.activity)).toEqual(illustrativeCircuit.neurons.map(neuron => neuron.id))
    const normalizedComparison = structuredClone(snapshot.comparison.result.settings) as SimulationConfig
    if (testCase.id === 'stimulus') normalizedComparison.stimulus.amplitude = baseline.stimulus.amplitude
    if (testCase.id === 'connection') delete normalizedComparison.silencedConnectionId
    if (testCase.id === 'tau') delete normalizedComparison.tauOverrides
    expect(normalizedComparison).toEqual(baseline)
  })

  it('doubles unsaturated traces with the stimulus, while preserving the actual peak time', () => {
    const run = runGuidedExperiment('stimulus', 1)
    for (const neuron of illustrativeCircuit.neurons) {
      const before = run.baseline.result.activity[neuron.id]!
      const after = run.comparison.result.activity[neuron.id]!
      for (let index = 0; index < before.length; index += 1) expect(after[index]).toBeCloseTo(2 * before[index]!, 12)
    }
    expect(run.comparison.metrics.peak).toBeGreaterThan(run.baseline.metrics.peak)
    expect(run.comparison.metrics.peakTimeMs).toBe(run.baseline.metrics.peakTimeMs)
    expect(run.delta.peakDelayMs).toBe(0)
    expect(run.comparison.metrics.responseDelayMs).toBeLessThan(run.baseline.metrics.responseDelayMs!)
  })

  it('removes the excitatory edge without silencing I3 or changing any other cell', () => {
    const run = runGuidedExperiment('connection', 1)
    expect(run.comparison.result.activity.O1!.every(value => value === 0)).toBe(true)
    for (const neuron of illustrativeCircuit.neurons.filter(neuron => neuron.id !== 'O1')) {
      expect(run.comparison.result.activity[neuron.id]).toEqual(run.baseline.result.activity[neuron.id])
    }
    expect(Math.max(...run.comparison.result.activity.I3!)).toBeGreaterThan(0)
    expect(run.comparison.metrics).toMatchObject({ peak: 0, peakTimeMs: null, peakDelayMs: null, responseTimeMs: null, responseDelayMs: null })
    expect(run.delta.responseDelayMs).toBeNull()
    expect(run.delta.peakDelayMs).toBeNull()
    expect(run.circuit.connections.find(edge => edge.id === 'I3-O1')!.weight).toBe(1)
  })

  it('removes the inhibitory edge contribution while leaving its source and O2 unchanged', () => {
    const run = runGuidedExperiment('connection', 1, { connectionId: 'I4-O1' })
    expect(run.comparison.metrics.peak).toBeGreaterThan(run.baseline.metrics.peak)
    expect(run.controlledVariable.baselineValue).toBe(-0.3)
    expect(run.controlledVariable.comparisonValue).toBe(0)
    expect(Math.max(...run.comparison.result.activity.I4!)).toBeGreaterThan(0)
    for (const neuron of illustrativeCircuit.neurons.filter(neuron => neuron.id !== 'O1')) {
      expect(run.comparison.result.activity[neuron.id]).toEqual(run.baseline.result.activity[neuron.id])
    }
  })

  it('changes O1 rise and relaxation with tau, preserving every other full trace', () => {
    const run = runGuidedExperiment('tau', 1)
    for (const neuron of illustrativeCircuit.neurons.filter(neuron => neuron.id !== 'O1')) {
      expect(run.comparison.result.activity[neuron.id]).toEqual(run.baseline.result.activity[neuron.id])
    }
    expect(run.comparison.result.activity.O1![250]).toBeLessThan(run.baseline.result.activity.O1![250]!)
    expect(run.comparison.result.activity.O1![600]).toBeGreaterThan(run.baseline.result.activity.O1![600]!)
    expect(run.comparison.metrics.peak).toBeLessThan(run.baseline.metrics.peak)
    expect(run.comparison.metrics.peakTimeMs).toBeGreaterThan(run.baseline.metrics.peakTimeMs!)
    expect(run.comparison.metrics.responseDelayMs).toBeGreaterThan(run.baseline.metrics.responseDelayMs!)
  })
})

describe('recorded metrics and completed run snapshots', () => {
  it.each<GuidedExperimentId>(['stimulus', 'connection', 'tau'])('derives every reported metric from recorded samples for %s', id => {
    const run = runGuidedExperiment(id, 2)
    for (const condition of [run.baseline, run.comparison]) {
      const trace = condition.result.activity.O1!
      const times = condition.result.timesMs
      const peak = Math.max(...trace)
      const firstAtLevel = trace.findIndex(value => value >= GUIDED_REPORTING_LEVEL)
      const firstAtPeak = peak > 0 ? trace.indexOf(peak) : -1
      expect(condition.metrics.peak).toBe(peak)
      expect(condition.metrics.reportingLevel).toBe(0.1)
      expect(condition.metrics.peakTimeMs).toBe(firstAtPeak < 0 ? null : times[firstAtPeak])
      expect(condition.metrics.responseTimeMs).toBe(firstAtLevel < 0 ? null : times[firstAtLevel])
      expect(condition.metrics.responseDelayMs).toBe(firstAtLevel < 0 ? null : times[firstAtLevel]! - condition.result.settings.stimulus.onsetMs)
      expect(condition.metrics.peakDelayMs).toBe(firstAtPeak < 0 ? null : times[firstAtPeak]! - condition.result.settings.stimulus.onsetMs)
      if (firstAtLevel > 0) expect(trace[firstAtLevel - 1]).toBeLessThan(0.1)
      expect(trace.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true)
      expect(trace).toHaveLength(701)
    }
    expect(run.delta.peak).toBe(run.comparison.metrics.peak - run.baseline.metrics.peak)
  })

  it('records a small positive peak but no level crossing instead of inventing a latency', () => {
    const run = runGuidedExperiment('tau', 1, { comparisonTauMs: 10_000 })
    expect(run.comparison.metrics.peak).toBeGreaterThan(0)
    expect(run.comparison.metrics.peak).toBeLessThan(0.1)
    expect(run.comparison.metrics.peakTimeMs).not.toBeNull()
    expect(run.comparison.metrics.responseTimeMs).toBeNull()
    expect(run.comparison.metrics.responseDelayMs).toBeNull()
    expect(run.delta.responseDelayMs).toBeNull()
  })

  it('is deterministic and changing a run number does not change the simulation', () => {
    const first = runGuidedExperiment('tau', 1)
    expect(runGuidedExperiment('tau', 1)).toEqual(first)
    const second = runGuidedExperiment('tau', 2)
    expect(second.runNumber).toBe(2)
    expect(second.baseline).toEqual(first.baseline)
    expect(second.comparison).toEqual(first.comparison)
  })

  it('preserves source settings and freezes saved input, circuit and all traces', () => {
    const beforeConfig = structuredClone(defaultConfig)
    const beforeCircuit = structuredClone(illustrativeCircuit)
    const draft = { comparisonTauMs: 90 }
    const run = runGuidedExperiment('tau', 1, draft)
    draft.comparisonTauMs = 180
    expect(run.comparison.result.settings.tauOverrides?.O1).toBe(90)
    expect(defaultConfig).toEqual(beforeConfig)
    expect(illustrativeCircuit).toEqual(beforeCircuit)
    expect(Object.isFrozen(run)).toBe(true)
    expect(Object.isFrozen(run.comparison.result.settings.stimulus)).toBe(true)
    expect(Object.isFrozen(run.comparison.result.activity.O1)).toBe(true)
    expect(Object.isFrozen(run.circuit.connections[0])).toBe(true)
    expect(() => { (run.comparison.result.activity.O1 as unknown as number[])[1] = 9 }).toThrow(TypeError)
    expect(() => { (run.circuit.connections[0] as unknown as { weight: number }).weight = 9 }).toThrow(TypeError)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])('rejects invalid run numbers %s', value => {
    expect(() => runGuidedExperiment('stimulus', value)).toThrow(RangeError)
  })

  it.each([30, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects a tau comparison that is not finite and larger than the baseline: %s', value => {
    expect(() => runGuidedExperiment('tau', 1, { comparisonTauMs: value })).toThrow(RangeError)
  })

  it('rejects unknown experiments, connections and ignored options', () => {
    expect(() => runGuidedExperiment('unknown' as GuidedExperimentId, 1)).toThrow(RangeError)
    expect(() => runGuidedExperiment('connection', 1, { connectionId: 'S1-I1' as 'I3-O1' })).toThrow(RangeError)
    expect(() => runGuidedExperiment('stimulus', 1, { comparisonTauMs: 90 })).toThrow(RangeError)
    expect(() => runGuidedExperiment('tau', 1, { connectionId: 'I3-O1' })).toThrow(RangeError)
    expect(() => runGuidedExperiment('stimulus', 1, { extra: true } as GuidedRunOptions)).toThrow(RangeError)
    expect(() => runGuidedExperiment('stimulus', 1, null as unknown as GuidedRunOptions)).toThrow(RangeError)
  })
})
