import { describe, expect, it } from 'vitest'
import { glossaryTerms, splitTerms } from './glossary'

describe('term explanations', () => {
  it('preserves the original text exactly, including Turkish case and punctuation', () => {
    for (const text of ['Hermafrodit, NÖRONLARINDA ve dendritlerin.', 'Nöronun aksonuyla soma; sinaptik reseptörler.', 'Gap junction ile larva; C. elegans’ın ventral sinir kordonu.', '<script>nöron</script> & "sinaps"', 'Somali, sinapsis, aksonometri; sinaps.']) {
      expect(splitTerms(text).map(segment => segment.text).join('')).toBe(text)
    }
  })
  it('recognizes Turkish case, suffixes and distinct aliases without matching unrelated words', () => {
    const ids = (text: string) => splitTerms(text).flatMap(segment => segment.term ? [segment.term.id] : [])
    expect(ids('HERMAFRODİT nöronlarında dendritlerin aksonuyla sinaptik reseptörler')).toEqual(['hermafrodit', 'noron', 'dendrit', 'akson', 'sinaps', 'reseptor'])
    expect(ids('Somali sinapsis aksonometri')).toEqual([])
    expect(ids('Gap junctions ve konnektomun')).toEqual(['gap-junction', 'konnektom'])
  })
  it('annotates only the first use of each term in a text block', () => {
    const text = 'Nöronlar başka nöronlarla sinaps kurar; sinaptik etki değişebilir.'
    expect(splitTerms(text).filter(segment => segment.term).map(segment => segment.term!.id)).toEqual(['noron', 'sinaps'])
    expect(splitTerms(text).map(segment => segment.text).join('')).toBe(text)
  })
  it('requires unique term ids and aliases, with a meaning, origin and HTTPS sources', () => {
    expect(new Set(glossaryTerms.map(term => term.id)).size).toBe(glossaryTerms.length)
    const aliases = glossaryTerms.flatMap(term => term.aliases)
    expect(new Set(aliases).size).toBe(aliases.length)
    for (const term of glossaryTerms) {
      expect(term.meaning.length).toBeGreaterThan(10)
      expect(term.origin.length).toBeGreaterThan(10)
      expect(term.sources.length).toBeGreaterThan(0)
      for (const source of term.sources) expect(new URL(source.url).protocol).toBe('https:')
    }
  })
})
