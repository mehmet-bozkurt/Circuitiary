import { stimulusValue } from './model/simulation'
import type { StimulusConfig, StimulusShape } from './model/types'

/**
 * Stimulus protocols of the main experiment page: the shape of the input inside the stimulus window
 * and an optional reproducible pseudo-random addition. The formulas live in the engine
 * (`stimulusValue` in model/simulation.ts); this module holds what the page adds: the controls'
 * defaults and ranges, the engine configuration built from them, the waveform drawn on the chart
 * and the description written into the experiment record.
 */
export interface StimulusProtocol {
  stimulusShape: StimulusShape
  /** Period of the sine shape, in ms; kept while another shape is chosen. */
  sinePeriod: number
  /** Largest absolute value of the pseudo-random addition; 0 switches it off. */
  noiseAmplitude: number
  /** Which pseudo-random sequence is used; kept while the addition is off. */
  noiseSeed: number
}

/** The options of the shape select, in order. */
export const stimulusShapes: readonly StimulusShape[] = ['pulse', 'ramp', 'sine']

/** The page's state before the learner touches the stimulus protocol: exactly the experiment as it was before protocols existed. */
export const stimulusDefaults: Readonly<StimulusProtocol> = Object.freeze({ stimulusShape: 'pulse', sinePeriod: 100, noiseAmplitude: 0, noiseSeed: 1 })

/** Slider ranges of the two new controls, and the seeds the "new sample" button walks through. */
export const stimulusRanges = {
  sinePeriod: { min: 50, max: 400, step: 10 },
  noiseAmplitude: { min: 0, max: 0.3, step: 0.05 },
  noiseSeed: { min: 1, max: 9999, step: 1 },
} as const

/**
 * The noise value is held for this long, counted from the stimulus onset. It is a multiple of every time
 * step the page offers (0.0625 to 2 ms) and the onset is too, so every step starts inside one interval
 * and no step straddles a change of value. It is a choice of this page, not a parameter of anything biological.
 */
export const NOISE_HOLD_MS = 10

/** Settings read from a draft, a link or a pinned record may lack the protocol fields: those mean the defaults. */
export function resolveProtocol(partial: Partial<StimulusProtocol>): StimulusProtocol {
  return {
    stimulusShape: partial.stimulusShape ?? stimulusDefaults.stimulusShape,
    sinePeriod: partial.sinePeriod ?? stimulusDefaults.sinePeriod,
    noiseAmplitude: partial.noiseAmplitude ?? stimulusDefaults.noiseAmplitude,
    noiseSeed: partial.noiseSeed ?? stimulusDefaults.noiseSeed,
  }
}

/** The next sequence for the "new sample" button; after the last seed it starts again at the first. */
export function nextNoiseSeed(seed: number): number {
  const { min, max } = stimulusRanges.noiseSeed
  return seed >= max || seed < min ? min : seed + 1
}

/**
 * The engine's stimulus for a protocol. Only what differs from the plain pulse is written: with the
 * defaults the result has exactly the keys of `base`, so the engine computes, and records in
 * `result.settings`, what it did before protocols existed. The period is passed only for the sine and
 * the noise only when its amplitude is above zero.
 */
export function protocolStimulus(base: StimulusConfig, protocol: StimulusProtocol): StimulusConfig {
  return {
    ...base,
    ...(protocol.stimulusShape === 'pulse' ? {} : { shape: protocol.stimulusShape }),
    ...(protocol.stimulusShape === 'sine' ? { periodMs: protocol.sinePeriod } : {}),
    ...(protocol.noiseAmplitude > 0 ? { noise: { amplitude: protocol.noiseAmplitude, seed: protocol.noiseSeed, holdMs: NOISE_HOLD_MS } } : {}),
  }
}

/** The input is drawn on the chart only when it is something other than the plain pulse the yellow band already shows. */
export function hasCustomInput(stimulus: StimulusConfig): boolean {
  return (stimulus.shape !== undefined && stimulus.shape !== 'pulse') || stimulus.noise !== undefined
}

/** I(t) at the recorded times: the values the engine reads at the left endpoint of each step. */
export function inputWaveform(stimulus: StimulusConfig, timesMs: readonly number[]): number[] {
  return timesMs.map(time => stimulusValue(stimulus, time))
}

const WINDOW = '[onsetMs, onsetMs + durationMs)'
const SHAPE_FORMULA: Record<Exclude<StimulusShape, 'pulse'>, string> = {
  ramp: 'I(t) = amplitude * (t - onsetMs) / durationMs',
  sine: 'I(t) = amplitude * (1 - cos(2 * pi * (t - onsetMs) / periodMs)) / 2',
}

/**
 * The `stimulusWindow` and `noise` entries of the experiment record's model description. For the plain
 * pulse they are what the record always said; a shape or the pseudo-random addition is described, so
 * the record never claims a rectangular, noise-free input that was not used.
 */
export function exportedStimulusModel(stimulus: StimulusConfig): { stimulusWindow: string; noise: false | Record<string, unknown> } {
  const shape = stimulus.shape ?? 'pulse'
  return {
    stimulusWindow: shape === 'pulse' ? WINDOW : `${WINDOW}; inside it ${SHAPE_FORMULA[shape]} (${shape}), zero outside; evaluated at the left endpoint of each step`,
    noise: stimulus.noise === undefined ? false : {
      kind: 'seeded pseudo-random addition to the stimulated cell\'s input inside the stimulus window; reproducible; not a model of biological noise',
      formula: 'amplitude * u(seed, floor((t - onsetMs) / holdMs)), u in [-1, 1], constant over each hold interval',
      amplitude: stimulus.noise.amplitude, seed: stimulus.noise.seed, holdMs: stimulus.noise.holdMs,
    },
  }
}
