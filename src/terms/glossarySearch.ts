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

/** Terms whose title, aliases or meaning contain every word of the query (any order). An empty query keeps all. */
export function searchGlossary(terms: readonly GlossaryTerm[], query: string): GlossaryTerm[] {
  const words = foldTurkish(query).split(' ').filter(Boolean)
  if (!words.length) return [...terms]
  return terms.filter(term => {
    const haystack = foldTurkish([term.title, ...term.aliases, term.meaning].join(' '))
    return words.every(word => haystack.includes(word))
  })
}

/** The sentence the status region announces after each change of the query. */
export function resultsMessage(query: string, shown: number, total: number): string {
  const typed = query.trim().replace(/\s+/g, ' ')
  if (!typed) return `${total} sözcüğün tamamı listeleniyor.`
  if (!shown) return `“${typed}” ile eşleşen sözcük bulunamadı.`
  return `“${typed}” için ${total} sözcükten ${shown} tanesi bulundu.`
}

/** The term a location hash such as "#term-noron" points at, or null for any other fragment. */
export function termIdFromHash(hash: string, terms: readonly GlossaryTerm[] = glossaryTerms): string | null {
  let fragment = ''
  try { fragment = decodeURIComponent(hash.replace(/^#/, '')) } catch { return null }
  return terms.find(term => termAnchorId(term.id) === fragment)?.id ?? null
}
