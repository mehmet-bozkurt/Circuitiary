import { afterEach, describe, expect, it } from 'vitest'
import { messages } from './App.messages'
import { DEFAULT_LOCALE, locale, pick } from './i18n'

afterEach(() => { locale.value = DEFAULT_LOCALE })

/** Every string a message group can produce, with sample arguments for the function messages. */
function texts(group: typeof messages.tr): string[] {
  const out: string[] = []
  for (const value of Object.values(group)) {
    if (typeof value === 'string') out.push(value)
    else if (typeof value === 'object') out.push(...Object.values(value))
  }
  out.push(group.cellCount(8), group.connectionCount(12), group.shortcutStep(10), group.statusTime('250'), group.captionReal(23, 246),
    group.readSilenced('I3 → O1', false), group.readSilenced('AVAL ↔ AVAR', true), group.readTau('O1', 90), group.numericalWarning('0,01'))
  return out
}

describe('main experiment page text', () => {
  it('keeps the Turkish sentences that are built from values', () => {
    const tr = messages.tr
    expect(tr.conditions).toEqual({ baseline: 'Referans', silenced: 'Bağlantı susturuldu', tau: 'Zaman sabiti değişti' })
    expect(tr.statusTime('250')).toBe('Zaman 250 ms.')
    expect(tr.readSilenced('I3 → O1', false)).toBe('I3 → O1 bağlantısının model ağırlığı sıfırlandı. Hücreler devrede kalıyor; yalnızca bu aktarım kaldırılıyor.')
    expect(tr.readSilenced('AVAL ↔ AVAR', true)).toBe('AVAL ↔ AVAR bağlantısının model ağırlığı sıfırlandı. Hücreler devrede kalıyor; bu elektriksel çiftin iki yönlü etkisi kaldırılıyor.')
    expect(tr.readTau('O1', 90)).toBe('O1 için τ 90 ms. Daha büyük τ, bu denklemde etkinliğin değişimini yavaşlatır; daha güçlü yanıtı garanti etmez.')
    expect(tr.numericalWarning('0,01')).toContain('0,01 eşiği yalnız bir inceleme uyarısıdır; doğruluk garantisi değildir.')
    expect(tr.captionReal(23, 246)).toBe('23/246 bağlantı çiziliyor; görünüm filtresi hesaplamayı değiştirmez. Yerleşim şematiktir, anatomik konum değildir.')
  })

  it('has English for every message, with no Turkish text left in it', () => {
    const turkish = texts(messages.tr)
    const english = texts(messages.en)
    expect(english).toHaveLength(turkish.length)
    for (const text of english) {
      expect(text.trim().length).toBeGreaterThan(0)
      expect(text).not.toMatch(/[ğşıİçöüĞŞÇÖÜ]/)
    }
    expect(Object.keys(messages.en.roles)).toEqual(Object.keys(messages.tr.roles))
  })

  it('keeps the caveats of the model in English', () => {
    const en = messages.en
    expect(en.readTau('O1', 90)).toContain('it does not guarantee a stronger response')
    expect(en.chartNote).toContain('not movement, a decision or a measured neuron firing rate')
    expect(en.gainsNote).toContain('The gains are not measured conductances.')
    expect(en.numericalNote).toContain('it is not evidence of biological accuracy')
    expect(en.numericalWarning('0.01')).toContain('it is not a guarantee of accuracy')
    expect(en.nextLimit).toContain('Real connections do not mean validated behavior.')
    expect(en.exportScopeReal).toContain('not validated behavior or a biological brain emulation')
  })

  it('follows the language', () => {
    expect(pick(messages).conditions.silenced).toBe('Bağlantı susturuldu')
    locale.value = 'en'
    expect(pick(messages).conditions.silenced).toBe('Connection silenced')
    expect(pick(messages).roles.interneuron).toBe('Interneuron')
  })
})
