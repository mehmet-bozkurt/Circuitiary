import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, L, defineMessages, locale, localeTag, pick, resolveLocale, setLocale, useMessages } from './i18n'
import { decimal, withComma } from './format'

afterEach(() => { locale.value = DEFAULT_LOCALE })

describe('starting language', () => {
  it('is Turkish when nothing asks otherwise', () => {
    expect(DEFAULT_LOCALE).toBe('tr')
    expect(resolveLocale('', null)).toBe('tr')
    expect(locale.value).toBe('tr')
  })

  it('takes a saved choice, and an address parameter over the saved choice', () => {
    expect(resolveLocale('', 'en')).toBe('en')
    expect(resolveLocale('?lang=tr', 'en')).toBe('tr')
    expect(resolveLocale('?am=0.5&lang=en', null)).toBe('en')
  })

  it('ignores values that are not a supported language', () => {
    expect(resolveLocale('?lang=de', null)).toBe('tr')
    expect(resolveLocale('?lang=EN', 'en')).toBe('en')
    expect(resolveLocale('?lang=', 'fr')).toBe('tr')
  })
})

describe('text by language', () => {
  const messages = defineMessages({
    tr: { title: 'Sözlük', count: (n: number) => `${n} sözcük` },
    en: { title: 'Glossary', count: (n: number) => `${n} words` },
  })

  it('follows a language change without reloading', () => {
    const m = useMessages(messages)
    expect(m.value.title).toBe('Sözlük')
    expect(L('Tema', 'Theme')).toBe('Tema')
    setLocale('en')
    expect(m.value.title).toBe('Glossary')
    expect(m.value.count(3)).toBe('3 words')
    expect(pick(messages).title).toBe('Glossary')
    expect(L('Tema', 'Theme')).toBe('Theme')
    expect(localeTag()).toBe('en-US')
  })

  it('writes numbers with a decimal point in English and a comma in Turkish', () => {
    expect(decimal(0.6633, 3)).toBe('0,663')
    expect(withComma('1.2')).toBe('1,2')
    setLocale('en')
    expect(decimal(0.6633, 3)).toBe('0.663')
    expect(decimal(1234.5, 1)).toBe('1234.5')
    expect(withComma('1.2')).toBe('1.2')
  })
})
