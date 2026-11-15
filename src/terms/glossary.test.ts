import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, locale } from '../i18n'
import { glossary as lessonGlossary } from '../learning/lessonContent'
import { glossaryTerms, glossaryTermsEn, splitTerms } from './glossary'

afterEach(() => { locale.value = DEFAULT_LOCALE })

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
  it('defines each term once: lesson terms that have a hint card reuse its meaning', () => {
    const titles = lessonGlossary.map(([term]) => term)
    expect(new Set(titles).size).toBe(titles.length)
    const shared: string[] = []
    for (const [term, description] of lessonGlossary) {
      const segments = splitTerms(term)
      const hinted = segments.length === 1 ? segments[0]!.term : undefined
      if (!hinted) continue
      shared.push(term)
      expect(description, term).toBe(hinted.meaning)
    }
    // Every term the lesson shares with the hint glossary keeps its hint, and none is redefined.
    expect(shared).toEqual(['Soma', 'Dendrit', 'Akson', 'Reseptör', 'Plastisite', 'Gap junction', 'Konnektom'])
  })
})

describe('English term explanations', () => {
  const ids = (text: string) => splitTerms(text).flatMap(segment => segment.term ? [segment.term.id] : [])
  const labels = (text: string) => splitTerms(text).flatMap(segment => segment.term ? [segment.text] : [])

  it('has the same terms as the Turkish list: ids, order, sources and optional notes', () => {
    expect(glossaryTermsEn.map(term => term.id)).toEqual(glossaryTerms.map(term => term.id))
    glossaryTermsEn.forEach((term, index) => {
      const turkish = glossaryTerms[index]!
      expect(term.sources.map(source => source.url), term.id).toEqual(turkish.sources.map(source => source.url))
      expect(term.context === undefined, term.id).toBe(turkish.context === undefined)
      expect(term.meaning.length, term.id).toBeGreaterThan(10)
      expect(term.origin.length, term.id).toBeGreaterThan(10)
      expect(term.aliases.length, term.id).toBeGreaterThan(0)
      // The title is itself a form the matcher knows, so a lesson glossary row that shows the title gets its card.
      expect(term.aliases, term.id).toContain(term.title.toLocaleLowerCase('en-US'))
    })
    const aliases = glossaryTermsEn.flatMap(term => term.aliases)
    expect(new Set(aliases).size).toBe(aliases.length)
  })
  it('contains no Turkish text', () => {
    for (const term of glossaryTermsEn) {
      const text = [term.title, ...term.aliases, term.meaning, term.origin, term.context ?? '', ...term.sources.map(source => source.title)].join(' ').replace('Académie française', '')
      expect(text, term.id).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
    }
  })
  it('annotates English words in English text and returns the English entries', () => {
    locale.value = 'en'
    expect(ids('Hermaphrodite neurons, dendrites and axons; synaptic receptors.')).toEqual(['hermafrodit', 'noron', 'dendrit', 'akson', 'sinaps', 'reseptor'])
    expect(ids('Gap junctions, the connectome, ablation, larvae, ventral, dorsal, ganglia, plasticity and the soma.')).toEqual(['gap-junction', 'konnektom', 'ablasyon', 'larva', 'ventral', 'dorsal', 'ganglion', 'plastisite', 'soma'])
    const [term] = splitTerms('Synapse').map(segment => segment.term)
    expect(term).toBe(glossaryTermsEn.find(candidate => candidate.id === 'sinaps'))
    expect(term!.title).toBe('Synapse')
  })
  it('matches whole words only, in any case, with a possessive or a hyphenated two-word form', () => {
    locale.value = 'en'
    expect(ids('Interneuron, neuronal, presynaptic, somatic, receptive, dorsally, plastic.')).toEqual([])
    expect(labels('The same dendritic tree and axonal branch.')).toEqual(['dendritic', 'axonal'])
    expect(labels('NEURONS and a Neuron’s input')).toEqual(['NEURONS'])
    expect(labels('The neuron’s input and the synapse\'s weight')).toEqual(['neuron’s', 'synapse\'s'])
    expect(labels('A gap-junction pair; non-synaptic input.')).toEqual(['gap-junction', 'synaptic'])
  })
  it('keeps the text exactly and annotates only the first use of each term', () => {
    locale.value = 'en'
    for (const text of ['In C. elegans, I count neurons; other neurons follow. IT IS İ.', '<script>neuron</script> & "synapse"', 'Synapses are synaptic; a synapse.', '']) {
      expect(splitTerms(text).map(segment => segment.text).join('')).toBe(text)
    }
    expect(ids('Neurons meet other neurons at a synapse; synaptic weights differ.')).toEqual(['noron', 'sinaps'])
  })
  it('does not annotate the other language’s words', () => {
    expect(ids('The neuron and its synapses')).toEqual([])
    locale.value = 'en'
    expect(ids('Nöronlarında dendritlerin aksonuyla sinaptik reseptörler; plastisite')).toEqual([])
    // Words that are spelled the same in both languages are terms in both.
    expect(ids('ventral larva')).toEqual(['ventral', 'larva'])
  })
  it('follows the language when it changes', () => {
    const text = 'Soma'
    expect(splitTerms(text)[0]!.term!.meaning).toBe(glossaryTerms.find(term => term.id === 'soma')!.meaning)
    locale.value = 'en'
    expect(splitTerms(text)[0]!.term!.meaning).toBe(glossaryTermsEn.find(term => term.id === 'soma')!.meaning)
  })
})
