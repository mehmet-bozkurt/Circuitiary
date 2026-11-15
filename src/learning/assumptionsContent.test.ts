import { describe, expect, it } from 'vitest'
import {
  assumptionCopy, assumptionCopyEn, assumptionSources, assumptionSourcesEn, assumptionVariables, assumptionVariablesEn,
  sweepPrediction, sweepPredictionEn,
} from './assumptionsContent'
import { messages as runMessages } from './assumptionExperiments.messages'

const turkishLetters = /[ğşıİçöüĞŞÇÖÜ]/
/** Every text of a content value, however deeply nested. */
const texts = (value: unknown): string[] => typeof value === 'string' ? [value] : value !== null && typeof value === 'object' ? Object.values(value).flatMap(texts) : []

describe('English twins of the assumptions lesson content', () => {
  it('keeps the sources in the same order with the same addresses', () => {
    expect(assumptionSourcesEn).toHaveLength(assumptionSources.length)
    expect(assumptionSourcesEn.map(source => source.url)).toEqual(assumptionSources.map(source => source.url))
  })

  it('keeps every variable id, range and default; only the text differs', () => {
    expect(assumptionVariablesEn).toHaveLength(assumptionVariables.length)
    const numbers = (option: (typeof assumptionVariables)[number] | (typeof assumptionVariablesEn)[number]) =>
      ({ id: option.id, baseline: option.baseline, initial: option.initial, min: option.min, max: option.max, step: option.step })
    expect(assumptionVariablesEn.map(numbers)).toEqual(assumptionVariables.map(numbers))
    expect(assumptionVariablesEn.map(option => Object.keys(option))).toEqual(assumptionVariables.map(option => Object.keys(option)))
    assumptionVariables.forEach((option, index) => {
      expect(assumptionVariablesEn[index]!.label).not.toBe(option.label)
      expect(assumptionVariablesEn[index]!.explanation).not.toBe(option.explanation)
    })
  })

  it('has the same paragraphs', () => {
    expect(Object.keys(assumptionCopyEn)).toEqual(Object.keys(assumptionCopy))
    for (const key of Object.keys(assumptionCopy) as (keyof typeof assumptionCopy)[]) expect(assumptionCopyEn[key]).not.toBe(assumptionCopy[key])
  })

  it('offers the same prediction options under the same ids', () => {
    expect(Object.keys(sweepPredictionEn)).toEqual(Object.keys(sweepPrediction))
    expect(sweepPredictionEn.options.map(option => option.id)).toEqual(sweepPrediction.options.map(option => option.id))
  })

  it('leaves no Turkish text in the English twins', () => {
    for (const text of [assumptionSourcesEn, assumptionVariablesEn, assumptionCopyEn, sweepPredictionEn].flatMap(texts)) expect(text).not.toMatch(turkishLetters)
  })

  it('keeps the caveats of the Turkish text', () => {
    expect(assumptionVariablesEn[0].explanation).toContain('not a biological finding')
    expect(assumptionCopyEn.signs).toContain('assumes that every chemical sign is positive')
    expect(assumptionCopyEn.dynamics).toContain('not derived from this anatomy file as measured physiology')
    expect(assumptionCopyEn.boundary).toContain('not deleted or fixed at zero in biology')
    expect(assumptionCopyEn.validation).toContain('does not validate the biology of the animal')
    expect(assumptionCopyEn.sweep).toContain('not a measured biological threshold or finding')
  })
})

describe('run record text in both languages', () => {
  it('lists the same number of assumptions', () => {
    const turkish = runMessages.tr.assumptions('Title', '1', 'unit')
    const english = runMessages.en.assumptions('Title', '1', 'unit')
    expect(english).toHaveLength(turkish.length)
    for (const text of english) expect(text).not.toMatch(turkishLetters)
  })
})
