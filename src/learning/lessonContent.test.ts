import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, L, locale, pick } from '../i18n'
import { glossaryTerms, glossaryTermsEn } from '../terms/glossary'
import { messages as pageMessages } from '../components/NeuronLearningPage.messages'
import { messages as plotMessages } from './LessonTracePlot.messages'
import {
  glossary, glossaryEn, lessonSections, lessonSectionsEn, lessonSources, lessonSourcesEn,
  neuronParts, neuronPartsEn, selfChecks, selfChecksEn,
} from './lessonContent'

afterEach(() => { locale.value = DEFAULT_LOCALE })

const turkishLetters = /[ğĞşŞıİçÇöÖüÜ]/
// A decimal comma between digits, as tests/language.spec.ts looks for it.
const decimalComma = /(?<![\w.,])\d+,\d+(?![\w,])/

/** Every string in a content value, however deeply nested. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

describe('English twins of the lesson content', () => {
  it('lists the same sources under the same ids, in the same order, at the same addresses', () => {
    expect(Object.keys(lessonSourcesEn)).toEqual(Object.keys(lessonSources))
    for (const id of Object.keys(lessonSources) as (keyof typeof lessonSources)[]) {
      expect(lessonSourcesEn[id].url, id).toBe(lessonSources[id].url)
      expect(lessonSourcesEn[id].title.length, id).toBeGreaterThan(0)
    }
    // A title published in English is not rewritten.
    expect(lessonSourcesEn.openstax.title).toBe(lessonSources.openstax.title)
  })

  it('keeps the ids, numbers and order of the neuron parts', () => {
    expect(neuronPartsEn.map(part => [part.id, part.number])).toEqual(neuronParts.map(part => [part.id, part.number]))
    expect(neuronParts.map(part => part.id)).toEqual(['dendrite', 'soma', 'axon', 'terminal', 'cleft'])
  })

  it('keeps the ids, paragraph counts and sources of the six sections', () => {
    expect(lessonSectionsEn).toHaveLength(lessonSections.length)
    expect(lessonSections).toHaveLength(6)
    lessonSections.forEach((section, index) => {
      const twin = lessonSectionsEn[index]!
      expect(twin.id).toBe(section.id)
      expect(twin.paragraphs, section.id).toHaveLength(section.paragraphs.length)
      expect(twin.sources, section.id).toEqual(section.sources)
      // Paragraphs are list keys on the page, so they are distinct within a section.
      expect(new Set(twin.paragraphs).size, section.id).toBe(twin.paragraphs.length)
    })
  })

  it('builds the mini glossary from the same hint cards at the same positions', () => {
    expect(glossaryEn).toHaveLength(glossary.length)
    const sharedIds = glossary.map(([term, description]) => glossaryTerms.find(candidate => candidate.title === term && candidate.meaning === description)?.id)
    expect(sharedIds.filter(Boolean)).toEqual(['soma', 'dendrit', 'akson', 'reseptor', 'plastisite', 'gap-junction', 'konnektom'])
    glossaryEn.forEach(([term, description], index) => {
      const id = sharedIds[index]
      const shared = glossaryTermsEn.find(candidate => candidate.title === term && candidate.meaning === description)
      // A shared entry reuses the English card of the same id; a lesson-only entry stays lesson-only.
      expect(shared?.id, term).toBe(id)
    })
    expect(new Set(glossaryEn.map(([term]) => term)).size).toBe(glossaryEn.length)
  })

  it('keeps question ids, option ids, option order and the correct option of the self-checks', () => {
    expect(selfChecksEn).toHaveLength(selfChecks.length)
    expect(selfChecks).toHaveLength(8)
    selfChecks.forEach((question, index) => {
      const twin = selfChecksEn[index]!
      expect(twin.id).toBe(question.id)
      expect(twin.correct, question.id).toBe(question.correct)
      expect(twin.options.map(option => option.id), question.id).toEqual(question.options.map(option => option.id))
      expect(twin.options.some(option => option.id === twin.correct), question.id).toBe(true)
    })
  })

  it('leaves no Turkish letters or decimal commas in the English text', () => {
    for (const text of strings([lessonSourcesEn, neuronPartsEn, lessonSectionsEn, glossaryEn, selfChecksEn, pageMessages.en, plotMessages.en])) {
      expect(turkishLetters.test(text), text).toBe(false)
      expect(decimalComma.test(text), text).toBe(false)
    }
    const called = [
      ...(['ablated', 'inhibitory', 'excitatory'] as const).map(link => pageMessages.en.circuitLabel(link)),
      pageMessages.en.quizProgress(3, 2), plotMessages.en.plot('Title', 'Axis'),
    ]
    for (const text of called) {
      expect(turkishLetters.test(text), text).toBe(false)
      expect(decimalComma.test(text), text).toBe(false)
    }
  })

  it('translates every prose field instead of repeating the Turkish', () => {
    lessonSections.forEach((section, index) => {
      const twin = lessonSectionsEn[index]!
      expect(twin.title).not.toBe(section.title)
      expect(twin.lead).not.toBe(section.lead)
      section.paragraphs.forEach((paragraph, position) => expect(twin.paragraphs[position]).not.toBe(paragraph))
    })
    selfChecks.forEach((question, index) => {
      const twin = selfChecksEn[index]!
      expect(twin.question).not.toBe(question.question)
      expect(twin.explanation).not.toBe(question.explanation)
      question.options.forEach((option, position) => expect(twin.options[position]!.text).not.toBe(option.text))
    })
  })
})

describe('lesson text follows the language', () => {
  it('chooses the content of the current language when it is read', () => {
    expect(L(lessonSections, lessonSectionsEn)[0]!.title).toBe('Nöronun parçaları')
    expect(L(selfChecks, selfChecksEn)[2]!.options[2]!.text).toBe('Çizilen tek olayın tepesi aynı kalır')
    locale.value = 'en'
    expect(L(lessonSections, lessonSectionsEn)[0]!.title).toBe('Parts of a neuron')
    expect(L(selfChecks, selfChecksEn)[2]!.options[2]!.text).toBe('The peak of the drawn single event stays the same')
    expect(L(lessonSources, lessonSourcesEn).membrane.title).toBe('Purves et al. / NCBI — resting membrane potential')
  })

  it('keeps the Turkish page and plot text exactly as it was, and gives English after a switch', () => {
    expect(pick(pageMessages).circuitLabel('excitatory')).toBe('A, B\'yi uyarır. B ile C bağlantısı uyarıcı. C ayrıca sabit 0,35 taban girdisi alır.')
    expect(pick(pageMessages).circuitLabel('inhibitory')).toBe('A, B\'yi uyarır. B ile C bağlantısı baskılayıcı. C ayrıca sabit 0,35 taban girdisi alır.')
    expect(pick(pageMessages).circuitLabel('ablated')).toBe('A, B\'yi uyarır. B ile C bağlantısı kaldırılmış. C ayrıca sabit 0,35 taban girdisi alır.')
    expect(pick(pageMessages).quizProgress(0, 0)).toBe('0/8 yanıtlandı · 0/8 doğru')
    expect(pick(pageMessages).titleLead + pick(pageMessages).titleEmphasis).toBe('Nörondan devreye')
    expect(pick(pageMessages).baselineTag).toBe('taban: 0,35')
    expect(pick(plotMessages).plot('İki göreli düzeyin yakınlaşması', pick(plotMessages).yLabel))
      .toBe('İki göreli düzeyin yakınlaşması. Dikey eksen Göreli düzey, 0 ile 1 arasında. Yatay eksen öğretici zaman; biyolojik zaman birimi değildir.')
    locale.value = 'en'
    expect(pick(pageMessages).circuitLabel('ablated')).toBe('A excites B. The connection from B to C is removed. C also receives a constant baseline input of 0.35.')
    expect(pick(pageMessages).quizProgress(8, 7)).toBe('8/8 answered · 7/8 correct')
    expect(pick(pageMessages).titleLead + pick(pageMessages).titleEmphasis).toBe('From neuron to circuit')
    expect(pick(pageMessages).baselineTag).toBe('baseline: 0.35')
    expect(pick(plotMessages).plot('Convergence of two relative levels', pick(plotMessages).yLabel))
      .toBe('Convergence of two relative levels. Vertical axis: Relative level, from 0 to 1. Horizontal axis: teaching time; it is not a biological unit of time.')
  })
})
