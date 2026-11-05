import { buildRealCircuit, defaultRealModelParameters, realDefaultConfig, realDefaultReadout } from '../model/realConnectome'
import { simulate } from '../model/simulation'
import type { ReadonlyRealConnectome } from '../model/types'
import { outputMetrics } from './assumptionExperiments'

/** Chemical multiplier at which the incoming model weights of every cell sum to exactly 1. A property of the row-normalised model, not of biology. */
export const thresholdGain = 1

/** 0,2 to 1,6 in 15 steps of 0,1, built from tenths so every value (including 1) is the exact decimal literal. */
export const sweepGrid: readonly number[] = Object.freeze(Array.from({ length: 15 }, (_, index) => (index + 2) / 10))

export type SweepPoint =
  | { gain: number; ok: true; peak: number; peakTimeMs: number | null; endValue: number }
  | { gain: number; ok: false }
export type CompletedPoint = Extract<SweepPoint, { ok: true }>

export interface ThresholdSweep {
  /** One entry per requested multiplier, in the requested order; a failed run keeps its place. */
  points: readonly SweepPoint[]
  completed: number
  failed: number
  /** Everything except the chemical multiplier stays at the lesson's baseline. */
  fixed: { gapGain: number; tauMs: number; outputId: 'AVAR'; stimulusTarget: string; amplitude: number; onsetMs: number; stimulusDurationMs: number; durationMs: number }
}

/**
 * Runs the lesson's AVER pulse once per chemical multiplier with the existing
 * builder and engine; nothing else changes. A multiplier whose run throws is
 * recorded as failed and the sweep continues, so one bad point never hides the rest.
 */
export function runThresholdSweep(data: ReadonlyRealConnectome, gains: readonly number[] = sweepGrid): ThresholdSweep {
  const points: SweepPoint[] = gains.map((gain): SweepPoint => {
    try {
      const result = simulate(buildRealCircuit(data, { ...defaultRealModelParameters, chemicalGain: gain }), structuredClone(realDefaultConfig))
      const { peak, peakTimeMs, endValue } = outputMetrics(result)
      return { gain, ok: true, peak, peakTimeMs, endValue }
    } catch {
      return { gain, ok: false }
    }
  })
  const completed = points.filter(point => point.ok).length
  const { stimulus } = realDefaultConfig
  return Object.freeze({
    points: Object.freeze(points), completed, failed: points.length - completed,
    fixed: { gapGain: defaultRealModelParameters.gapGain, tauMs: realDefaultConfig.tauMs, outputId: realDefaultReadout, stimulusTarget: stimulus.target,
      amplitude: stimulus.amplitude, onsetMs: stimulus.onsetMs, stimulusDurationMs: stimulus.durationMs, durationMs: realDefaultConfig.durationMs },
  }) as ThresholdSweep
}

export type CrossingTrend = 'steep' | 'proportional' | 'flat' | 'falling'

export interface ThresholdCrossing {
  /** Completed point with the largest multiplier below the threshold, and the one with the smallest above it. */
  below: CompletedPoint
  above: CompletedPoint
  /** above − below, end-of-window activity. */
  rise: number
  /** above / below; null when the lower value is exactly 0. */
  factor: number | null
  /** aboveGain / belowGain: how much the multiplier itself grew. */
  gainFactor: number
  trend: CrossingTrend
}

/** End-value changes smaller than this are called flat. */
export const flatEndChange = .005
/** A rise counts as steeper than the multiplier only when it exceeds the multiplier's own growth by this factor. */
export const steepMargin = 1.5

/**
 * How the end-of-window value changes between the nearest completed multipliers
 * on either side of the threshold; null while one side has no completed run.
 */
export function thresholdCrossing(sweep: ThresholdSweep): ThresholdCrossing | null {
  const done = sweep.points.filter((point): point is CompletedPoint => point.ok)
  const lower = done.filter(point => point.gain < thresholdGain)
  const upper = done.filter(point => point.gain > thresholdGain)
  if (!lower.length || !upper.length) return null
  const below = lower.reduce((best, point) => point.gain > best.gain ? point : best)
  const above = upper.reduce((best, point) => point.gain < best.gain ? point : best)
  const rise = above.endValue - below.endValue
  const factor = below.endValue === 0 ? null : above.endValue / below.endValue
  const gainFactor = above.gain / below.gain
  const trend: CrossingTrend = Math.abs(rise) < flatEndChange ? 'flat' : rise < 0 ? 'falling' : factor === null || factor > gainFactor * steepMargin ? 'steep' : 'proportional'
  return { below, above, rise, factor, gainFactor, trend }
}
