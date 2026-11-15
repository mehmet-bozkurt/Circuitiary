import { afterEach, describe, expect, it } from 'vitest'
import { L, locale } from '../i18n'
import { readingNotes, readingNotesEn, readingPrompts, readingPromptsEn, readingSources, readingSourcesEn } from './readingContent'

afterEach(() => { locale.value = 'tr' })

const turkishLetters = /[ğĞşŞıİçÇöÖüÜ]/

describe('reading content in two languages', () => {
  it('keeps the same source ids, order and addresses in English', () => {
    expect(readingSourcesEn).toHaveLength(readingSources.length)
    expect(readingSourcesEn.map(source => source.id)).toEqual(readingSources.map(source => source.id))
    expect(readingSourcesEn.map(source => source.url)).toEqual(readingSources.map(source => source.url))
  })

  it('has an English note for every Turkish note, in the same order', () => {
    expect(Object.keys(readingNotesEn)).toEqual(Object.keys(readingNotes))
  })

  it('has as many English prompts as Turkish ones', () => {
    expect(readingPromptsEn).toHaveLength(readingPrompts.length)
  })

  it('leaves no English text empty, untranslated or Turkish', () => {
    const pairs: [string, string][] = [
      ...readingSources.map((source, index): [string, string] => [source.title, readingSourcesEn[index]!.title]),
      ...Object.keys(readingNotes).map((key): [string, string] => [readingNotes[key as keyof typeof readingNotes], readingNotesEn[key as keyof typeof readingNotes]]),
      ...readingPrompts.map((prompt, index): [string, string] => [prompt, readingPromptsEn[index]!]),
    ]
    for (const [tr, en] of pairs) {
      expect(en.trim()).toBe(en)
      expect(en.length).toBeGreaterThan(0)
      expect(en).not.toBe(tr)
      expect(en).not.toMatch(turkishLetters)
    }
  })

  it('keeps the limits of the anatomy in English', () => {
    // Dataset names, the local address, the 30-cell size and the worked numbers are the same in both languages.
    for (const key of Object.keys(readingNotes) as (keyof typeof readingNotes)[]) {
      const kept = (text: string) => text.match(/C\. elegans|SI[45]|\/api\/local-connectome|\b\d+\b|A→B→A|A→A/g) ?? []
      expect(kept(readingNotesEn[key]).sort()).toEqual(kept(readingNotes[key]).sort())
    }
    expect(readingNotesEn.weight).toContain('does not directly mean 12 synapses or a measured functional strength')
    expect(readingNotesEn.route).toContain('not the strongest, the fastest, the only possible or a causal path')
    expect(readingNotesEn.cycle).toContain('does not prove')
    expect(readingNotesEn.function).toContain('does not prove')
    expect(readingNotesEn.local).toContain('has not been verified')
  })

  it('is chosen by the language at the moment it is read', () => {
    const anatomy = () => L<string>(readingNotes.anatomy, readingNotesEn.anatomy)
    expect(anatomy()).toBe(readingNotes.anatomy)
    locale.value = 'en'
    expect(anatomy()).toBe(readingNotesEn.anatomy)
    expect(L<readonly string[]>(readingPrompts, readingPromptsEn)).toBe(readingPromptsEn)
    locale.value = 'tr'
    expect(anatomy()).toBe(readingNotes.anatomy)
  })
})
