import { describe, expect, it } from 'vitest'
import { chemicalLesson, gapLesson, smallCircuitLesson, thresholdLesson } from './lessonMath'

describe('threshold lesson', () => {
  it('has the same single-event response above threshold regardless of input strength', () => {
    const justReached = thresholdLesson(0.4, 0.4)
    const stronger = thresholdLesson(1, 0.4)
    expect(justReached.fired).toBe(true)
    expect(stronger.fired).toBe(true)
    expect(justReached.peak).toBe(1)
    expect(stronger.trace).toEqual(justReached.trace)
    const peaks = stronger.trace.values.filter(value => value === 1)
    expect(peaks).toHaveLength(1)
    expect(stronger.trace.times[0]).toBe(0)
    expect(stronger.trace.times.at(-1)).toBe(3)
    expect(stronger.trace.values[0]).toBe(0)
    expect(stronger.trace.values.at(-1)).toBe(0)
  })

  it('keeps subthreshold responses below threshold and preserves zero input', () => {
    const low = thresholdLesson(0.2, 0.4)
    expect(low.fired).toBe(false)
    expect(Math.max(...low.trace.values)).toBeCloseTo(0.2, 12)
    expect(low.trace.values.every(value => value >= 0 && value < 0.4)).toBe(true)
    const zero = thresholdLesson(0, 0)
    expect(zero.fired).toBe(false)
    expect(zero.peak).toBe(0)
    expect(zero.trace.values.every(value => value === 0)).toBe(true)
    expect(thresholdLesson(0.01, 0).fired).toBe(true)
    expect(thresholdLesson(1, 1).fired).toBe(true)
  })
})

describe('chemical lesson', () => {
  it('distinguishes positive drive, cancellation, and negative drive', () => {
    expect(chemicalLesson(1, 0)).toEqual({ drive: 1, activity: 1 })
    expect(chemicalLesson(0.4, 0.4)).toEqual({ drive: 0, activity: 0 })
    const inhibited = chemicalLesson(0.2, 0.8)
    expect(inhibited.drive).toBeLessThan(0)
    expect(inhibited.activity).toBe(0)
    expect(chemicalLesson(0.8, 0.2).activity).toBeCloseTo(0.6, 12)
  })
})

describe('gap lesson', () => {
  it('leaves isolated cells unchanged at zero coupling', () => {
    const result = gapLesson(0)
    expect(result.a.every(value => value === 1)).toBe(true)
    expect(result.b.every(value => value === 0)).toBe(true)
    expect(result.finalA).toBe(1)
    expect(result.finalB).toBe(0)
  })

  it('conserves total activity, equalizes monotonically, and approaches the midpoint', () => {
    const result = gapLesson(1)
    expect(result.a[0]).toBe(1)
    expect(result.b[0]).toBe(0)
    expect(result.times.at(-1)).toBe(5)
    result.times.forEach((_, index) => {
      expect(result.a[index]! + result.b[index]!).toBeCloseTo(1, 12)
      expect(result.a[index]).toBeGreaterThanOrEqual(0.5)
      expect(result.b[index]).toBeLessThanOrEqual(0.5)
      if (index > 0) {
        expect(result.a[index]).toBeLessThan(result.a[index - 1]!)
        expect(result.b[index]).toBeGreaterThan(result.b[index - 1]!)
      }
    })
    expect(result.finalA).toBeCloseTo(0.5, 4)
    expect(result.finalB).toBeCloseTo(0.5, 4)
    expect(gapLesson(0.2).finalB).toBeLessThan(result.finalB)
  })
})

describe('three-cell lesson', () => {
  it('holds the tonic output baseline without input', () => {
    for (const inhibitory of [false, true]) {
      const result = smallCircuitLesson({ stimulus: 0, inhibitory, ablated: false })
      expect(result.a.every(value => value === 0)).toBe(true)
      expect(result.b.every(value => value === 0)).toBe(true)
      expect(result.c.every(value => value === 0.35)).toBe(true)
      expect(result.deltaAtPulseEnd).toBe(0)
    }
  })

  it('separates excitation, inhibition, and edge ablation without changing upstream cells', () => {
    const excitation = smallCircuitLesson({ stimulus: 1, inhibitory: false, ablated: false })
    const inhibition = smallCircuitLesson({ stimulus: 1, inhibitory: true, ablated: false })
    const ablation = smallCircuitLesson({ stimulus: 1, inhibitory: true, ablated: true })
    expect(excitation.outputMaximum).toBeGreaterThan(0.8)
    expect(excitation.outputMinimum).toBe(0.35)
    expect(excitation.deltaAtPulseEnd).toBeGreaterThan(0)
    expect(inhibition.outputMinimum).toBeLessThan(0.1)
    expect(inhibition.outputMaximum).toBe(0.35)
    expect(inhibition.deltaAtPulseEnd).toBeLessThan(0)
    expect(ablation.c.every(value => value === 0.35)).toBe(true)
    expect(ablation.deltaAtPulseEnd).toBe(0)
    expect(excitation.a).toEqual(inhibition.a)
    expect(excitation.b).toEqual(inhibition.b)
    expect(ablation.a).toEqual(inhibition.a)
    expect(ablation.b).toEqual(inhibition.b)
    expect(excitation.peakOutput).toBe(excitation.outputMaximum)
  })

  it('responds causally after the pulse and returns toward baseline after it ends', () => {
    const result = smallCircuitLesson({ stimulus: 0.8, inhibitory: false, ablated: false })
    result.times.forEach((time, index) => {
      if (time <= 1) {
        expect(result.a[index]).toBe(0)
        expect(result.b[index]).toBe(0)
        expect(result.c[index]).toBe(0.35)
      }
    })
    expect(result.a[51]).toBeGreaterThan(0)
    expect(result.b[51]).toBe(0)
    expect(result.c[51]).toBe(0.35)
    expect(result.b[52]).toBeGreaterThan(0)
    expect(result.c[52]).toBe(0.35)
    expect(result.c[53]).toBeGreaterThan(0.35)
    expect(result.a.at(-1)).toBeLessThan(0.001)
    expect(result.b.at(-1)).toBeLessThan(0.005)
    // A finite recording approaches equilibrium; it does not reach it exactly.
    expect(Math.abs(result.c.at(-1)! - 0.35)).toBeLessThan(0.01)
    expect(result.c.at(-1)).toBeLessThan(result.c[200]!)
  })

  it('is deterministic, aligned, finite, bounded, and does not mutate its config', () => {
    const config = Object.freeze({ stimulus: 0.6, inhibitory: true, ablated: false })
    const result = smallCircuitLesson(config)
    expect(smallCircuitLesson(config)).toEqual(result)
    expect(result.times).toHaveLength(301)
    expect(result.times.at(-1)).toBe(6)
    for (const trace of [result.a, result.b, result.c]) {
      expect(trace).toHaveLength(result.times.length)
      expect(trace.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true)
    }
    expect(config).toEqual({ stimulus: 0.6, inhibitory: true, ablated: false })
  })
})

describe('lesson input contracts', () => {
  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid normalized input %s across all numeric arguments',
    value => {
      expect(() => thresholdLesson(value, 0.5)).toThrow(RangeError)
      expect(() => thresholdLesson(0.5, value)).toThrow(RangeError)
      expect(() => chemicalLesson(value, 0.5)).toThrow(RangeError)
      expect(() => chemicalLesson(0.5, value)).toThrow(RangeError)
      expect(() => gapLesson(value)).toThrow(RangeError)
      expect(() => smallCircuitLesson({ stimulus: value, inhibitory: false, ablated: false })).toThrow(RangeError)
    },
  )

  it('rejects malformed polarity and ablation controls instead of coercing them', () => {
    expect(() => smallCircuitLesson({ stimulus: 1, inhibitory: 'false' as unknown as boolean, ablated: false })).toThrow(RangeError)
    expect(() => smallCircuitLesson({ stimulus: 1, inhibitory: false, ablated: 0 as unknown as boolean })).toThrow(RangeError)
  })
})
