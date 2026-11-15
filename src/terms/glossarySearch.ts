import { defineMessages, locale, pick } from '../i18n'
import { glossaryTerms, termAnchorId, type GlossaryTerm } from './glossary'

/**
 * Lower-cases with Turkish rules first (İ becomes i, I becomes ı), then folds
 * ı and the accented letters (ş ğ ü ö ç â î û) to plain ASCII, so "NORON",
 * "Nöron" and "nöron" all give the same key and a keyboard without Turkish
 * letters still finds the term.
 */
export function foldTurkish(value: string): string {
  return value.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * The same key for English text: lower-cased by English rules (I becomes i), accents stripped.
 * ı also folds to i, because a Turkish keyboard types ı where an English word has i.
 */
export function foldEnglish(value: string): string {
  return value.toLocaleLowerCase('en-US').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/\s+/g, ' ').trim()
}

/** The fold of the current interface language. */
export const foldText = (value: string): string => locale.value === 'en' ? foldEnglish(value) : foldTurkish(value)

// Each term's Turkish title and other forms, for the English search.
const turkishNames = new Map(glossaryTerms.map(term => [term.id, foldTurkish([term.title, ...term.aliases].join(' '))]))

/**
 * Terms whose title, aliases or meaning contain every word of the query (any order). An empty query keeps all.
 * The fold follows the interface language. In English the term's Turkish title and forms are searched as well,
 * so a learner who types the word as the Turkish pages spell it still finds it.
 */
export function searchGlossary(terms: readonly GlossaryTerm[], query: string): GlossaryTerm[] {
  const english = locale.value === 'en'
  const fold = english ? foldEnglish : foldTurkish
  const words = fold(query).split(' ').filter(Boolean)
  if (!words.length) return [...terms]
  return terms.filter(term => {
    const own = fold([term.title, ...term.aliases, term.meaning].join(' '))
    const haystack = english ? `${own} ${turkishNames.get(term.id) ?? ''}` : own
    return words.every(word => haystack.includes(word))
  })
}

const messages = defineMessages({
  tr: {
    all: (total: number) => `${total} sözcüğün tamamı listeleniyor.`,
    none: (typed: string) => `“${typed}” ile eşleşen sözcük bulunamadı.`,
    some: (typed: string, shown: number, total: number) => `“${typed}” için ${total} sözcükten ${shown} tanesi bulundu.`,
  },
  en: {
    all: total => `All ${total} words are listed.`,
    none: typed => `No word matches “${typed}”.`,
    some: (typed, shown, total) => `Found ${shown} of ${total} words for “${typed}”.`,
  },
})

/** The sentence the status region announces after each change of the query, in the interface language. */
export function resultsMessage(query: string, shown: number, total: number): string {
  const typed = query.trim().replace(/\s+/g, ' ')
  const m = pick(messages)
  if (!typed) return m.all(total)
  if (!shown) return m.none(typed)
  return m.some(typed, shown, total)
}

/** The term a location hash such as "#term-noron" points at, or null for any other fragment. */
export function termIdFromHash(hash: string, terms: readonly GlossaryTerm[] = glossaryTerms): string | null {
  let fragment = ''
  try { fragment = decodeURIComponent(hash.replace(/^#/, '')) } catch { return null }
  return terms.find(term => termAnchorId(term.id) === fragment)?.id ?? null
}
