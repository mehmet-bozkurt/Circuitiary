// Interface language. Turkish is the default and the source text; English is an optional second language.
//
// The language is one reactive value (`locale`). Text reads it when it is rendered, so the
// language picker changes the page in place and no page state is lost. Conventions for
// adding text are in docs/i18n.md.

import { computed, ref, type ComputedRef } from 'vue'

export type Locale = 'tr' | 'en'
export const DEFAULT_LOCALE: Locale = 'tr'
export const LOCALES: readonly Locale[] = ['tr', 'en']
/** Each language named in itself, for the picker. */
export const localeNames: Record<Locale, string> = { tr: 'Türkçe', en: 'English' }
export const LOCALE_STORAGE_KEY = 'circuitiary-locale'
export const LOCALE_QUERY_KEY = 'lang'

export const isLocale = (value: unknown): value is Locale => value === 'tr' || value === 'en'

/**
 * The language to start in: an explicit `?lang=` wins, then the saved choice, then Turkish.
 * The browser's own language is deliberately not consulted: the app opens in Turkish unless asked otherwise.
 */
export function resolveLocale(search: string, stored: string | null): Locale {
  const asked = new URLSearchParams(search).get(LOCALE_QUERY_KEY)
  if (isLocale(asked)) return asked
  return isLocale(stored) ? stored : DEFAULT_LOCALE
}

function readStored(): string | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(LOCALE_STORAGE_KEY) } catch { return null }
}
function store(value: Locale) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_STORAGE_KEY, value) } catch { /* The language still works when storage is unavailable. */ }
}
const hasPage = typeof document !== 'undefined' && typeof location !== 'undefined'

export const locale = ref<Locale>(resolveLocale(hasPage ? location.search : '', readStored()))
if (hasPage) {
  document.documentElement.lang = locale.value
  // A language asked for in the address is kept for later pages of the same visit and for the next one.
  if (isLocale(new URLSearchParams(location.search).get(LOCALE_QUERY_KEY))) store(locale.value)
}

/** Changes the language in place, remembers it, and drops a `?lang=` from the address so a reload keeps the new choice. */
export function setLocale(next: Locale) {
  locale.value = next
  store(next)
  if (!hasPage) return
  document.documentElement.lang = next
  const url = new URL(location.href)
  if (url.searchParams.has(LOCALE_QUERY_KEY)) {
    url.searchParams.delete(LOCALE_QUERY_KEY)
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }
}

/** Another tab changed the language: follow it. Returns the listener's remover. */
export function followStoredLocale(): () => void {
  const sync = (event: StorageEvent) => {
    if (event.key !== LOCALE_STORAGE_KEY || !isLocale(event.newValue)) return
    locale.value = event.newValue
    document.documentElement.lang = event.newValue
  }
  window.addEventListener('storage', sync)
  return () => window.removeEventListener('storage', sync)
}

/** The Turkish or the English value, by the current language. Call it where text is rendered or computed, never once at module load. */
export const L = <T>(tr: T, en: T): T => locale.value === 'en' ? en : tr

/**
 * A component's or module's text in both languages. English must have exactly the Turkish
 * shape (same keys, same function parameters); the type check fails otherwise.
 */
export function defineMessages<T>(messages: { tr: T; en: NoInfer<T> }): Record<Locale, T> {
  return messages
}

/** The current language's messages as a computed value: `const m = useMessages(messages)`, then `m.title` in the template and `m.value.title` in script. */
export function useMessages<T>(messages: Record<Locale, T>): ComputedRef<T> {
  return computed(() => messages[locale.value])
}

/** The same choice outside a component (pure modules, tests). */
export const pick = <T>(messages: Record<Locale, T>): T => messages[locale.value]

/** BCP 47 tag for number and case conversions in the current language. */
export const localeTag = (): string => locale.value === 'en' ? 'en-US' : 'tr-TR'
