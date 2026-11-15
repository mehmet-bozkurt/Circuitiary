import { afterEach, describe, expect, it } from 'vitest'
import { locale, pick, useMessages } from '../i18n'
import { messages } from './CircuitReadingPage.messages'

afterEach(() => { locale.value = 'tr' })

/** Every text of one language: plain strings as they are, functions called with sample values. */
function texts(value: unknown, samples: (key: string) => unknown[], key = ''): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value === 'function') return [String((value as (...values: unknown[]) => unknown)(...samples(key)))]
  return Object.entries(value as Record<string, unknown>).flatMap(([name, child]) => texts(child, samples, name))
}
const samples = (key: string): unknown[] => ({
  loaded: [30, 196, 50], selfLoopShare: [196, 5], sourceRef: ['sex-shared', 'A161', 161, 1], emSections: [12],
  announceFound: [2], announceStep: [2, 'RICL', 'gap', 'AVBR'], sameCell: ['AVAR', 'AVAR'], noPath: ['AVAR', 'ASHL', 'chemical'],
  pathLength: [3], inspectRecord: [2], visited: [9], cycleFor: ['AVAR'], omittedFor: ['AVAR'], records: [7], pairs: [4], excludedDiagonal: [2],
} as Record<string, unknown[]>)[key] ?? []

describe('reading page text', () => {
  it('keeps the Turkish sentences that are built from values exactly as they were', () => {
    const tr = messages.tr
    expect(tr.loaded(30, 196, 50)).toBe('30 hücre, 196 kimyasal kayıt ve 50 fiziksel elektriksel çift yüklendi.')
    expect(tr.selfLoopShare(196, 5)).toBe('196 kimyasal kaydın 5 tanesi öz döngüdür. Elektriksel çiftler iki kez sayılmaz.')
    expect(tr.sourceRef('sex-shared', 'A161', 161, 1)).toBe('sex-shared · A161 · satır 161, sütun 1')
    expect(tr.emSections(1)).toBe('1 EM kesiti')
    expect(tr.emSections(12)).toBe('12 EM kesiti')
    expect(tr.announceFound(2)).toBe('2 bağlantılı anatomik yol bulundu. İlk adım gösteriliyor.')
    expect(tr.announceStep(1, 'RICL', 'chemical', 'AIBR')).toBe('1. adım: RICL, kimyasal kayıt yönünde, AIBR.')
    expect(tr.announceStep(2, 'AVAL', 'gap', 'AVAR')).toBe('2. adım: AVAL, elektriksel çift üzerinden, AVAR.')
    expect(tr.sameCell('AVAR', 'AVAR')).toBe('AVAR ile AVAR aynı hücre. Arada 0 kenar var; bu sonuç bir öz döngü veya etkileşim kanıtı değildir.')
    expect(tr.noPath('AVAR', 'ASHL', 'chemical')).toBe('AVAR → ASHL için kimyasal modda bu 30 hücrelik alt grafikte yol yok. Hayvanın tüm ağında bağlantı veya yol olmadığını söylemeyiz.')
    expect(tr.noPath('AVAR', 'ASHL', 'gap')).toContain(' için elektriksel modda ')
    expect(tr.noPath('AVAR', 'ASHL', 'mixed')).toContain(' için karma modda ')
    expect(tr.pathLength(1)).toBe('1 kenar · Arada başka hücre yok')
    expect(tr.pathLength(3)).toBe('3 kenar · 2 ara hücre')
    expect(tr.inspectRecord(2)).toBe('2. KAYDI İNCELE')
    expect(tr.visited(9)).toBe('Aramada keşfedilen farklı hücre: 9. Bu sayı hücre etkinliği veya sinyal yayılımı değildir.')
    expect(tr.cycleFor('AVAR')).toBe('AVAR için kimyasal döngü')
    expect(tr.omittedFor('AVAR')).toBe('AVAR için dışarıda kalan kayıtlar')
    expect(tr.records(7)).toBe('7 kayıt')
    expect(tr.pairs(4)).toBe('4 çift')
    expect(tr.excludedDiagonal(1)).toBe('Kaynak matrisindeki 1 elektriksel köşegen kaydı metadata olarak korunur; fiziksel öz bağlantı olarak çizilmez veya yol aramasına katılmaz.')
    expect(`${tr.pathSource} AVER${tr.pathSourceChange}`).toBe('Kaynak: AVER. Kaynağı üstteki hücre seçiminden değiştirebilirsin.')
  })

  it('has no Turkish text left in English, and no empty text in either language', () => {
    const english = texts(messages.en, samples)
    const turkish = texts(messages.tr, samples)
    expect(english).toHaveLength(turkish.length)
    for (const text of [...english, ...turkish]) expect(text.trim().length).toBeGreaterThan(0)
    for (const text of english) expect(text).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
  })

  it('uses singular and plural English count nouns', () => {
    const en = messages.en
    expect(en.emSections(1)).toBe('1 EM section')
    expect(en.emSections(12)).toBe('12 EM sections')
    expect(en.pathLength(1)).toBe('1 edge · No other cell in between')
    expect(en.pathLength(2)).toBe('2 edges · 1 cell in between')
    expect(en.pathLength(4)).toBe('4 edges · 3 cells in between')
    expect(en.selfLoopShare(196, 5)).toBe('5 of the 196 chemical records are self-loops. Electrical pairs are not counted twice.')
    expect(en.selfLoopShare(196, 1)).toContain('1 of the 196 chemical records is a self-loop.')
  })

  it('keeps names, numbers and limits in the English sentences', () => {
    const en = messages.en
    expect(en.sourceRef('sex-shared', 'A161', 161, 1)).toBe('sex-shared · A161 · row 161, column 1')
    expect(en.indirectExample).toContain('RICL → AVBR')
    expect(en.noPath('AVAR', 'ASHL', 'gap')).toBe('In electrical mode, this 30-cell subgraph has no path for AVAR → ASHL. We do not say that the animal’s whole network has no connection or path.')
    expect(en.sameCell('AVAR', 'AVAR')).toContain('not evidence of a self-loop or of an interaction')
    expect(en.visited(9)).toContain('is not cell activity or signal propagation')
    expect(en.kicker).toBe(en.kicker.toUpperCase())
  })

  it('follows the language at the moment a stored status line is shown', () => {
    const m = useMessages(messages)
    // The page keeps status lines as functions (docs/i18n.md, rule 6), like this one.
    const status = () => m.value.announceFound(3)
    expect(status()).toBe('3 bağlantılı anatomik yol bulundu. İlk adım gösteriliyor.')
    locale.value = 'en'
    expect(status()).toBe('An anatomical path with 3 connections was found. The first step is shown.')
    expect(pick(messages).title).toBe('Reading a circuit')
    locale.value = 'tr'
    expect(status()).toBe('3 bağlantılı anatomik yol bulundu. İlk adım gösteriliyor.')
  })
})
