import { describe, expect, it } from 'vitest'
import { glossaryAlphabetical, glossaryTerms, termAnchorId } from './glossary'
import { foldTurkish, resultsMessage, searchGlossary, termIdFromHash } from './glossarySearch'

const ids = (query: string) => searchGlossary(glossaryAlphabetical, query).map(term => term.id)

describe('glossary order', () => {
  it('lists every term once, in Turkish alphabetical order', () => {
    expect(glossaryAlphabetical.map(term => term.id).sort()).toEqual(glossaryTerms.map(term => term.id).sort())
    const collator = new Intl.Collator('tr')
    for (let i = 1; i < glossaryAlphabetical.length; i++) {
      expect(collator.compare(glossaryAlphabetical[i - 1]!.title, glossaryAlphabetical[i]!.title), glossaryAlphabetical[i]!.title).toBeLessThan(0)
    }
    const order = glossaryAlphabetical.map(term => term.id)
    expect(order.indexOf('ganglion')).toBeLessThan(order.indexOf('gap-junction'))
  })
})

describe('Turkish-aware folding', () => {
  it('lower-cases İ and I by Turkish rules and folds accents', () => {
    expect(foldTurkish('HERMAFRODİT')).toBe('hermafrodit')
    expect(foldTurkish('SINAPS')).toBe('sinaps')
    expect(foldTurkish('Işık')).toBe('isik')
    expect(foldTurkish('ŞĞÜÖÇ şğüöç')).toBe('sguoc sguoc')
    expect(foldTurkish('  Gap   junction ')).toBe('gap junction')
    // A lower-case i with a separate combining dot (from a non-Turkish lower-casing) folds the same way.
    expect(foldTurkish('i̇')).toBe('i')
  })
})

describe('glossary search', () => {
  it('returns every term, unchanged, for an empty or blank query', () => {
    expect(ids('')).toEqual(glossaryAlphabetical.map(term => term.id))
    expect(ids('   ')).toEqual(glossaryAlphabetical.map(term => term.id))
  })
  it('finds a term by its title with any Turkish spelling of the letters', () => {
    for (const query of ['nöron', 'NÖRON', 'noron', 'Noron', 'NORON']) expect(ids(query), query).toContain('noron')
    for (const query of ['hermafrodit', 'HERMAFRODİT', 'HERMAFRODIT', 'Hermafrodİt']) expect(ids(query), query).toEqual(['hermafrodit'])
    for (const query of ['reseptör', 'RESEPTÖR', 'reseptor']) expect(ids(query), query).toEqual(['reseptor'])
    expect(ids('SİNAPS')).toEqual(ids('sinaps'))
    expect(ids('SINAPS')).toContain('sinaps')
  })
  it('finds a term by an alias that is not its title', () => {
    expect(ids('connectome')).toEqual(['konnektom'])
    expect(ids('sinaptik')).toContain('sinaps')
    expect(ids('gangliyon')).toEqual(['ganglion'])
  })
  it('finds a term by words in its meaning, but not by its origin or sources', () => {
    expect(ids('karın tarafına')).toEqual(['ventral'])
    expect(ids('sırt')).toContain('dorsal')
    expect(ids('Hermes')).toEqual([])
    expect(ids('Merriam')).toEqual([])
  })
  it('requires every word of the query, in any order', () => {
    expect(ids('gap junction')).toEqual(['gap-junction'])
    expect(ids('junction gap')).toEqual(['gap-junction'])
    expect(ids('gap xyz')).toEqual([])
  })
  it('keeps the alphabetical order and returns nothing for a nonsense query', () => {
    const found = ids('nöron')
    expect(found).toEqual(glossaryAlphabetical.map(term => term.id).filter(id => found.includes(id)))
    expect(found.length).toBeGreaterThan(1)
    expect(ids('zzzz')).toEqual([])
  })
})

describe('results message', () => {
  it('names the count, the empty result and the full list', () => {
    expect(resultsMessage('', 15, 15)).toBe('15 sözcüğün tamamı listeleniyor.')
    expect(resultsMessage('  ', 15, 15)).toBe('15 sözcüğün tamamı listeleniyor.')
    expect(resultsMessage('nöron', 6, 15)).toBe('“nöron” için 15 sözcükten 6 tanesi bulundu.')
    expect(resultsMessage('  gap   junction ', 1, 15)).toBe('“gap junction” için 15 sözcükten 1 tanesi bulundu.')
    expect(resultsMessage('zzzz', 0, 15)).toBe('“zzzz” ile eşleşen sözcük bulunamadı.')
  })
})

describe('deep link fragments', () => {
  it('resolves a term fragment and rejects every other one', () => {
    expect(termIdFromHash('#term-noron')).toBe('noron')
    expect(termIdFromHash('#term-gap-junction')).toBe('gap-junction')
    expect(termIdFromHash(`#${termAnchorId('akson')}`)).toBe('akson')
    expect(termIdFromHash('#term-yok')).toBeNull()
    expect(termIdFromHash('#noron')).toBeNull()
    expect(termIdFromHash('')).toBeNull()
    expect(termIdFromHash('#term-%E0%A4%A')).toBeNull()
  })
})
