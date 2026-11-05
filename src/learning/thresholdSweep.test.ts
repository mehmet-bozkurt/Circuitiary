import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildRealCircuit, defaultRealModelParameters, parseRealConnectome, realDefaultConfig } from '../model/realConnectome'
import { simulate } from '../model/simulation'
import type { RealConnectome } from '../model/types'
import { runAssumptionExperiment } from './assumptionExperiments'
import {
  flatEndChange, runThresholdSweep, steepMargin, sweepGrid, thresholdCrossing, thresholdGain,
  type CompletedPoint, type SweepPoint, type ThresholdSweep,
} from './thresholdSweep'

const stats = () => ({ chemicalIncomingCount: 0, chemicalOutgoingCount: 0, gapCount: 0, chemicalIncomingWeight: 0, chemicalOutgoingWeight: 0, gapWeight: 0 })
const ref = (row: number, column: number) => ({ sheet: 'Invented anatomy', row, column, cell: `${String.fromCharCode(64 + column)}${row}` })

/** Invented source records exercise the existing real-data builder without redistribution. */
function fixture(ids = ['AVAR', 'AVER', 'X']): RealConnectome {
  const [a, b, c] = ids as [string, string, string]
  return {
    schemaVersion: 1,
    dataset: {
      id: 'sweep-invented-fixture', title: 'Invented anatomy fixture', version: '1', doi: 'synthetic-test-only',
      sources: [{ name: 'Invented source', url: 'https://example.org/invented', sha256: '0'.repeat(64), downloadedAtUtc: '2026-10-03T00:00:00Z', extra: { note: 'Preserved source metadata' } }],
      license: { status: 'unverified-local-only', note: 'Invented test metadata.' },
      anatomicalWeightUnit: 'invented contact units', orientation: 'source rows; target columns; physical gaps once',
      provenanceNotes: ['Synthetic test graph; no biological function asserted.'],
    },
    neurons: ids.map((id, index) => ({ id, label: id, cellType: 'neuron', sourceRef: ref(index + 2, 1) })),
    chemicalEdges: [
      { id: `chemical:${b}:${a}`, source: b, target: a, rawWeight: 6, sourceRef: ref(3, 2) },
      { id: `chemical:${c}:${a}`, source: c, target: a, rawWeight: 2, sourceRef: ref(4, 2) },
      { id: `chemical:${a}:${b}`, source: a, target: b, rawWeight: 1, sourceRef: ref(2, 3) },
      { id: `chemical:${a}:${a}`, source: a, target: a, rawWeight: 3, sourceRef: ref(2, 2) },
    ],
    gapEdges: [{ id: `gap:${a}:${b}`, a, b, rawWeight: 4, sourceRef: ref(2, 3), reciprocalSourceRef: ref(3, 2) }],
    selection: {
      algorithm: 'Invented cells in fixture order', seeds: [...ids], limit: 3, neuronIds: [...ids], ranking: [],
      omittedExternal: stats(), omittedByNeuron: ids.map(neuronId => ({ neuronId, ...stats() })), excludedGapSelfEntries: [],
    },
  }
}

const done = (gain: number, endValue: number, peak = endValue): CompletedPoint => ({ gain, ok: true, peak, peakTimeMs: 700, endValue })
const sweepOf = (points: SweepPoint[]): ThresholdSweep => ({ points, completed: points.filter(point => point.ok).length, failed: points.filter(point => !point.ok).length, fixed: runThresholdSweep(parseRealConnectome(fixture()), []).fixed })

describe('threshold sweep grid', () => {
  it('is 15 strictly increasing multipliers from 0,2 to 1,6 in steps of 0,1 and contains the threshold exactly', () => {
    expect(sweepGrid).toHaveLength(15)
    // Exact decimal literals, so a grid built by accumulating .1 (0,30000000000000004 and the like) fails.
    expect(sweepGrid).toEqual([.2, .3, .4, .5, .6, .7, .8, .9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6])
    expect(sweepGrid[0]).toBe(.2)
    expect(sweepGrid.at(-1)).toBe(1.6)
    for (let index = 1; index < sweepGrid.length; index += 1) {
      expect(sweepGrid[index]!).toBeGreaterThan(sweepGrid[index - 1]!)
      expect(sweepGrid[index]! - sweepGrid[index - 1]!).toBeCloseTo(.1, 12)
    }
    expect(sweepGrid).toContain(thresholdGain)
    expect(thresholdGain).toBe(1)
    expect(sweepGrid.filter(gain => gain < thresholdGain)).toHaveLength(8)
    expect(sweepGrid.filter(gain => gain > thresholdGain)).toHaveLength(6)
  })
})

describe('running the sweep on invented anatomy', () => {
  const data = parseRealConnectome(fixture())

  it('returns one completed point per multiplier, in grid order, matching an independent engine run', () => {
    const sweep = runThresholdSweep(data)
    expect(sweep.points.map(point => point.gain)).toEqual([...sweepGrid])
    expect(sweep.completed).toBe(15)
    expect(sweep.failed).toBe(0)
    for (const point of sweep.points) {
      expect(point.ok).toBe(true)
      const trace = simulate(buildRealCircuit(data, { ...defaultRealModelParameters, chemicalGain: point.gain }), realDefaultConfig).activity.AVAR!
      const peak = Math.max(...trace)
      expect(point).toMatchObject({ peak, endValue: trace.at(-1) })
      expect((point as CompletedPoint).peakTimeMs).toBe(peak > 0 ? trace.indexOf(peak) : null)
    }
    expect(sweep.fixed).toEqual({ gapGain: .2, tauMs: 30, outputId: 'AVAR', stimulusTarget: 'AVER', amplitude: .8, onsetMs: 100, stimulusDurationMs: 200, durationMs: 700 })
  })

  it('is deterministic and leaves the source data and shared defaults untouched', () => {
    const before = JSON.stringify(data)
    const configBefore = JSON.stringify(realDefaultConfig)
    const first = runThresholdSweep(data)
    const second = runThresholdSweep(data)
    expect(second).toEqual(first)
    expect(JSON.stringify(data)).toBe(before)
    expect(JSON.stringify(realDefaultConfig)).toBe(configBefore)
    expect(Object.isFrozen(first.points)).toBe(true)
  })

  it('accepts a custom grid and keeps the requested order and length', () => {
    const sweep = runThresholdSweep(data, [1.2, .4, 1])
    expect(sweep.points.map(point => point.gain)).toEqual([1.2, .4, 1])
    expect(runThresholdSweep(data, []).points).toEqual([])
  })

  it('marks a multiplier whose run fails and keeps every other point', () => {
    const sweep = runThresholdSweep(data, [.5, -1, Number.NaN, 1.2])
    expect(sweep.points.map(point => point.ok)).toEqual([true, false, false, true])
    expect(sweep.points[1]).toEqual({ gain: -1, ok: false })
    expect(sweep.completed).toBe(2)
    expect(sweep.failed).toBe(2)
    expect(sweep.points[0]).toEqual(runThresholdSweep(data, [.5]).points[0])
  })

  it('marks every point failed, without throwing, when the observed cell AVAR is missing from the data', () => {
    const noAvar = parseRealConnectome(fixture(['AVEL', 'AVER', 'X']))
    const sweep = runThresholdSweep(noAvar)
    expect(sweep.completed).toBe(0)
    expect(sweep.failed).toBe(15)
    expect(sweep.points.every(point => !point.ok)).toBe(true)
    expect(thresholdCrossing(sweep)).toBeNull()
  })

  it('marks every point failed when the stimulus cell AVER is missing', () => {
    const noAver = parseRealConnectome(fixture(['AVAR', 'AVEL', 'X']))
    expect(runThresholdSweep(noAver).failed).toBe(15)
  })
})

describe('end-value change across the threshold', () => {
  it('compares the nearest completed multipliers on each side and calls a large rise steep', () => {
    const crossing = thresholdCrossing(sweepOf([done(.9, .0087), done(1, .0438), done(1.1, .2273)]))!
    expect(crossing.below.gain).toBe(.9)
    expect(crossing.above.gain).toBe(1.1)
    expect(crossing.rise).toBeCloseTo(.2186, 12)
    expect(crossing.factor).toBeCloseTo(.2273 / .0087, 9)
    expect(crossing.gainFactor).toBeCloseTo(1.1 / .9, 12)
    expect(crossing.trend).toBe('steep')
  })

  it('skips a failed neighbour and uses the next completed multiplier', () => {
    const crossing = thresholdCrossing(sweepOf([done(.8, .0018), { gain: .9, ok: false }, done(1, .04), { gain: 1.1, ok: false }, done(1.2, .9776)]))!
    expect([crossing.below.gain, crossing.above.gain]).toEqual([.8, 1.2])
    expect(crossing.trend).toBe('steep')
  })

  it('ignores the order of the points and the threshold point itself', () => {
    const crossing = thresholdCrossing(sweepOf([done(1.2, .9), done(1, .5), done(.8, .1), done(1.1, .3), done(.9, .2)]))!
    expect([crossing.below.gain, crossing.above.gain]).toEqual([.9, 1.1])
  })

  it('needs a completed point on both sides', () => {
    expect(thresholdCrossing(sweepOf([done(.8, .1), done(.9, .2)]))).toBeNull()
    expect(thresholdCrossing(sweepOf([done(1.1, .1), done(1.2, .2)]))).toBeNull()
    expect(thresholdCrossing(sweepOf([done(1, .1)]))).toBeNull()
    expect(thresholdCrossing(sweepOf([]))).toBeNull()
  })

  it('tells a steep rise from a proportional one, a flat one and a fall', () => {
    const trend = (below: number, above: number) => thresholdCrossing(sweepOf([done(.9, below), done(1.1, above)]))!.trend
    expect(trend(.3, .3 * (1.1 / .9) * 1.2)).toBe('proportional')
    expect(trend(.3, .3 * (1.1 / .9) * steepMargin * 1.05)).toBe('steep')
    expect(trend(.3, .3 + flatEndChange / 2)).toBe('flat')
    expect(trend(.3, .3 - flatEndChange / 2)).toBe('flat')
    expect(trend(.3, .1)).toBe('falling')
  })

  it('has no ratio when the lower end value is exactly 0, and calls a rise from 0 steep', () => {
    const crossing = thresholdCrossing(sweepOf([done(.9, 0), done(1.1, .4)]))!
    expect(crossing.factor).toBeNull()
    expect(crossing.trend).toBe('steep')
    expect(thresholdCrossing(sweepOf([done(.9, 0), done(1.1, 0)]))!.trend).toBe('flat')
  })
})

const localDatasetPath = process.env.CIRCUITIARY_ASSUMPTIONS_DATA ?? fileURLToPath(new URL('../../data/local/cook-subset.json', import.meta.url))
describe('locally available pinned Cook2019 anatomy (not redistributed)', () => {
  const load = () => parseRealConnectome(JSON.parse(readFileSync(localDatasetPath, 'utf8')))

  it.skipIf(!existsSync(localDatasetPath))('agrees with the lesson comparison at several multipliers', () => {
    const data = load()
    const sweep = runThresholdSweep(data)
    expect(sweep.completed).toBe(15)
    for (const gain of [.2, .6, 1, 1.2, 1.5]) {
      const point = sweep.points.find(candidate => candidate.gain === gain) as CompletedPoint
      const { metrics } = runAssumptionExperiment(data, 1, { variable: 'chemical-gain', comparisonValue: gain }).comparison
      expect({ peak: point.peak, peakTimeMs: point.peakTimeMs, endValue: point.endValue }).toEqual({ peak: metrics.peak, peakTimeMs: metrics.peakTimeMs, endValue: metrics.endValue })
    }
  })

  it.skipIf(!existsSync(localDatasetPath))('the end value stays small below the threshold and jumps across it, as the lesson explains', () => {
    const sweep = runThresholdSweep(load())
    const end = (gain: number) => (sweep.points.find(point => point.gain === gain) as CompletedPoint).endValue
    for (const gain of sweepGrid.filter(value => value < thresholdGain)) expect(end(gain), `end value at ${gain}`).toBeLessThan(.01)
    for (const gain of sweepGrid.filter(value => value >= 1.2)) expect(end(gain), `end value at ${gain}`).toBeGreaterThan(.9)
    expect(end(1.1)).toBeGreaterThan(.1)
    const crossing = thresholdCrossing(sweep)!
    expect([crossing.below.gain, crossing.above.gain]).toEqual([.9, 1.1])
    expect(crossing.trend).toBe('steep')
    expect(crossing.rise).toBeGreaterThan(.1)
    expect(crossing.factor!).toBeGreaterThan(10)
  })

  it.skipIf(!existsSync(localDatasetPath))('the peak never decreases as the multiplier grows', () => {
    const peaks = runThresholdSweep(load()).points.map(point => (point as CompletedPoint).peak)
    for (let index = 1; index < peaks.length; index += 1) expect(peaks[index]!).toBeGreaterThanOrEqual(peaks[index - 1]!)
  })
})
