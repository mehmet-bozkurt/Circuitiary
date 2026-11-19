import { describe, expect, it } from 'vitest'
import { defaultConfig, illustrativeCircuit } from './model/circuit'
import { simulate, stimulusValue } from './model/simulation'
import { dtChoices } from './shareState'
import {
  NOISE_HOLD_MS, exportedStimulusModel, hasCustomInput, inputWaveform, nextNoiseSeed, protocolStimulus, resolveProtocol,
  stimulusDefaults, stimulusRanges, stimulusShapes,
} from './stimulusProtocol'

const base = { ...defaultConfig.stimulus }

describe('protocolStimulus', () => {
  it('passes exactly the plain stimulus object for the default protocol: no extra keys', () => {
    const stimulus = protocolStimulus(base, stimulusDefaults)
    expect(stimulus).toEqual(base)
    expect(Object.keys(stimulus)).toEqual(['target', 'onsetMs', 'durationMs', 'amplitude'])
    expect(JSON.stringify(stimulus)).toBe(JSON.stringify(base))
    // A period or a seed kept from earlier use does not leak into the pulse.
    expect(Object.keys(protocolStimulus(base, { ...stimulusDefaults, sinePeriod: 250, noiseSeed: 42 }))).toEqual(['target', 'onsetMs', 'durationMs', 'amplitude'])
    // So the engine records the settings it always recorded.
    const result = simulate(illustrativeCircuit, { ...defaultConfig, stimulus })
    expect(result.settings).toEqual(defaultConfig)
    expect(JSON.stringify(result.settings)).toBe(JSON.stringify(defaultConfig))
  })

  it('writes only what differs from the plain pulse', () => {
    expect(protocolStimulus(base, { ...stimulusDefaults, stimulusShape: 'ramp', sinePeriod: 250 })).toEqual({ ...base, shape: 'ramp' })
    expect(protocolStimulus(base, { ...stimulusDefaults, stimulusShape: 'sine', sinePeriod: 250 })).toEqual({ ...base, shape: 'sine', periodMs: 250 })
    expect(protocolStimulus(base, { ...stimulusDefaults, noiseAmplitude: 0.15, noiseSeed: 7 }))
      .toEqual({ ...base, noise: { amplitude: 0.15, seed: 7, holdMs: NOISE_HOLD_MS } })
    expect(protocolStimulus(base, { stimulusShape: 'sine', sinePeriod: 50, noiseAmplitude: 0.3, noiseSeed: 9999 }))
      .toEqual({ ...base, shape: 'sine', periodMs: 50, noise: { amplitude: 0.3, seed: 9999, holdMs: NOISE_HOLD_MS } })
  })

  it('gives a configuration the engine accepts at every corner of the controls', () => {
    for (const stimulusShape of stimulusShapes) for (const sinePeriod of [stimulusRanges.sinePeriod.min, stimulusRanges.sinePeriod.max]) {
      for (const noiseAmplitude of [stimulusRanges.noiseAmplitude.min, stimulusRanges.noiseAmplitude.max]) for (const noiseSeed of [stimulusRanges.noiseSeed.min, stimulusRanges.noiseSeed.max]) {
        const stimulus = protocolStimulus(base, { stimulusShape, sinePeriod, noiseAmplitude, noiseSeed })
        expect(() => simulate(illustrativeCircuit, { ...defaultConfig, stimulus })).not.toThrow()
      }
    }
  })
})

describe('protocol defaults and ranges', () => {
  it('has the documented defaults, on the sliders\' own grids', () => {
    expect(stimulusDefaults).toEqual({ stimulusShape: 'pulse', sinePeriod: 100, noiseAmplitude: 0, noiseSeed: 1 })
    expect(stimulusShapes).toEqual(['pulse', 'ramp', 'sine'])
    expect(stimulusRanges.sinePeriod).toEqual({ min: 50, max: 400, step: 10 })
    expect(stimulusRanges.noiseAmplitude).toEqual({ min: 0, max: 0.3, step: 0.05 })
    expect(Object.isFrozen(stimulusDefaults)).toBe(true)
  })

  it('fills absent fields with the defaults and keeps given ones', () => {
    expect(resolveProtocol({})).toEqual(stimulusDefaults)
    expect(resolveProtocol({ stimulusShape: 'sine', noiseSeed: 12 })).toEqual({ stimulusShape: 'sine', sinePeriod: 100, noiseAmplitude: 0, noiseSeed: 12 })
  })

  it('walks the seeds one by one and wraps after the last', () => {
    expect(nextNoiseSeed(1)).toBe(2)
    expect(nextNoiseSeed(41)).toBe(42)
    expect(nextNoiseSeed(9999)).toBe(1)
    expect(nextNoiseSeed(0)).toBe(1)
  })

  it('holds the noise over a whole number of steps for every time step the page offers', () => {
    for (const dt of dtChoices) {
      expect(Number.isInteger(NOISE_HOLD_MS / dt), String(dt)).toBe(true)
      expect(Number.isInteger(defaultConfig.stimulus.onsetMs / dt), String(dt)).toBe(true)
    }
  })
})

describe('the input drawn on the chart', () => {
  it('is drawn only when the input is not the plain pulse', () => {
    expect(hasCustomInput(base)).toBe(false)
    expect(hasCustomInput({ ...base, shape: 'pulse' })).toBe(false)
    expect(hasCustomInput({ ...base, shape: 'ramp' })).toBe(true)
    expect(hasCustomInput({ ...base, shape: 'sine', periodMs: 100 })).toBe(true)
    expect(hasCustomInput({ ...base, noise: { amplitude: 0.1, seed: 1, holdMs: NOISE_HOLD_MS } })).toBe(true)
    expect(hasCustomInput(protocolStimulus(base, stimulusDefaults))).toBe(false)
  })

  it('is I(t) at the recorded times: what the engine reads at the start of each step', () => {
    const stimulus = protocolStimulus(base, { stimulusShape: 'sine', sinePeriod: 100, noiseAmplitude: 0.1, noiseSeed: 3 })
    const result = simulate(illustrativeCircuit, { ...defaultConfig, stimulus })
    const waveform = inputWaveform(stimulus, result.timesMs)
    expect(waveform).toHaveLength(result.timesMs.length)
    result.timesMs.forEach((time, index) => expect(waveform[index]).toBe(stimulusValue(stimulus, time)))
    expect(waveform[0]).toBe(0)
    expect(waveform[99]).toBe(0)
    expect(waveform[300]).toBe(0)
    expect(waveform.slice(100, 300).some(value => value !== 0)).toBe(true)
  })
})

describe('the model description in the experiment record', () => {
  it('is what the record always said for the plain pulse', () => {
    expect(exportedStimulusModel(base)).toEqual({ stimulusWindow: '[onsetMs, onsetMs + durationMs)', noise: false })
    expect(JSON.stringify({ a: 1, ...exportedStimulusModel(protocolStimulus(base, stimulusDefaults)), b: 2 }))
      .toBe('{"a":1,"stimulusWindow":"[onsetMs, onsetMs + durationMs)","noise":false,"b":2}')
  })

  it('names the shape and its formula when one is used', () => {
    const ramp = exportedStimulusModel({ ...base, shape: 'ramp' })
    expect(ramp.stimulusWindow).toContain('[onsetMs, onsetMs + durationMs)')
    expect(ramp.stimulusWindow).toContain('I(t) = amplitude * (t - onsetMs) / durationMs (ramp)')
    expect(ramp.noise).toBe(false)
    expect(exportedStimulusModel({ ...base, shape: 'sine', periodMs: 100 }).stimulusWindow).toContain('I(t) = amplitude * (1 - cos(2 * pi * (t - onsetMs) / periodMs)) / 2 (sine)')
  })

  it('describes the pseudo-random addition instead of claiming there is none, and says what it is not', () => {
    const { stimulusWindow, noise } = exportedStimulusModel({ ...base, noise: { amplitude: 0.15, seed: 7, holdMs: NOISE_HOLD_MS } })
    expect(stimulusWindow).toBe('[onsetMs, onsetMs + durationMs)')
    expect(noise).toMatchObject({ amplitude: 0.15, seed: 7, holdMs: NOISE_HOLD_MS })
    expect((noise as { kind: string }).kind).toContain('pseudo-random')
    expect((noise as { kind: string }).kind).toContain('not a model of biological noise')
  })
})
