import { describe, expect, it } from 'vitest'
import { guidedPrinciples, guidedPrinciplesEn, guidedSteps, guidedStepsEn } from './guidedContent'

const turkishLetters = /[ğşıİçöüĞŞÇÖÜ]/

describe('guided content in both languages', () => {
  it('has the same steps, in the same order, with the same fields', () => {
    expect(guidedStepsEn.map(step => step.id)).toEqual(guidedSteps.map(step => step.id))
    guidedSteps.forEach((step, index) => {
      expect(Object.keys(guidedStepsEn[index]!)).toEqual(Object.keys(step))
    })
  })

  it('offers the same prediction ids in the same order for every step', () => {
    guidedSteps.forEach((step, index) => {
      expect(guidedStepsEn[index]!.predictionOptions.map(option => option.id)).toEqual(step.predictionOptions.map(option => option.id))
      expect(step.predictionOptions.map(option => option.id).sort()).toEqual(['decrease', 'increase', 'similar', 'unsure'])
    })
  })

  it('gives the same prediction the same English label in every step', () => {
    const labels = new Map<string, Set<string>>()
    for (const step of guidedStepsEn) for (const option of step.predictionOptions) labels.set(option.id, (labels.get(option.id) ?? new Set()).add(option.label))
    for (const set of labels.values()) expect(set.size).toBe(1)
  })

  it('has as many English principles as Turkish ones', () => {
    expect(guidedPrinciplesEn).toHaveLength(guidedPrinciples.length)
  })

  it('leaves no text empty and no Turkish text in the English twin', () => {
    const texts = [...guidedPrinciplesEn, ...guidedStepsEn.flatMap(step => [step.title, step.short, step.question, step.introduction, step.changed, step.held, step.predictionPrompt, step.observe, step.boundary, ...step.predictionOptions.map(option => option.label)])]
    for (const text of texts) {
      expect(text.trim()).not.toBe('')
      expect(text).not.toMatch(turkishLetters)
    }
  })

  it('keeps the limits of the model in English', () => {
    const boundaries = guidedStepsEn.map(step => step.boundary).join(' ')
    expect(boundaries).toContain('dimensionless model variable')
    expect(boundaries).toContain('does not represent all the side effects')
    expect(boundaries).toContain('not presented as the measured membrane time constant')
    expect(guidedPrinciplesEn.at(-1)).toContain('independent validation')
  })
})
