import { describe, expect, it } from 'vitest'
import { messages } from './CircuitBuilderPage.messages'

type Text = typeof messages.tr
/** Every message as finished text, with the same sample values in both languages. */
const rendered = (m: Text): Record<keyof Text, string> => ({
  ...(Object.fromEntries(Object.entries(m).filter(([, value]) => typeof value === 'string')) as Record<keyof Text, string>),
  cellCountOption: m.cellCountOption(4, 'A', 'D'),
  cellOption: m.cellOption('B'),
  milliseconds: m.milliseconds('120'),
  linkTitle: m.linkTitle(4),
  removeLabel: m.removeLabel(4, 'A → B'),
  inhibitoryHelp: m.inhibitoryHelp('0.60'),
  maxLinks: m.maxLinks(12),
  statusPresetLoaded: m.statusPresetLoaded('X'),
  statusCellsRemoved: m.statusCellsRemoved(['E', 'F'], 2, 4),
  statusCellCount: m.statusCellCount(4, 'A', 'D'),
  statusLinkAdded: m.statusLinkAdded(4, 'A → B'),
  statusLinkRemoved: m.statusLinkRemoved(4, 'A → B', 3),
  statusRunDone: m.statusRunDone(2, 3),
  recordSettings: m.recordSettings(2, 3, 4, 'A', '0.80', '100', '300'),
  chartLabel: m.chartLabel(['A', 'B']),
  columnReach: m.columnReach('0.10'),
  columnFinal: m.columnFinal('700'),
  tableNote: m.tableNote('0.10'),
})

describe('builder page text', () => {
  const tr = rendered(messages.tr)
  const en = rendered(messages.en)

  it('has every message in both languages, and no message is left as a function', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(messages.tr).sort())
    expect(Object.keys(tr).sort()).toEqual(Object.keys(messages.en).sort())
    for (const text of [...Object.values(tr), ...Object.values(en)]) expect(typeof text).toBe('string')
  })

  it('leaves no Turkish text in English', () => {
    // A unit and a number read the same in both languages.
    const shared = new Set<string>(['milliseconds'])
    for (const [key, text] of Object.entries(en)) {
      expect(text, key).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
      expect(text.trim().length, key).toBeGreaterThan(0)
      if (!shared.has(key)) expect(text, key).not.toBe(tr[key as keyof Text])
    }
  })

  it('keeps the spacing that joins a mark to the text before it', () => {
    for (const key of ['linkFlag', 'legendStimulated', 'rowStimulated'] as const) {
      expect(messages.tr[key].startsWith(' ')).toBe(true)
      expect(messages.en[key].startsWith(' ')).toBe(true)
    }
  })

  it('keeps the limits of the toy model in English', () => {
    expect(en.boundaryTitle).toBe('This is a toy model.')
    expect(en.boundaryText).toContain('is not a real circuit, and the result is not a prediction')
    expect(en.boundaryText).toContain('it is not voltage, firing rate, calcium or behavior')
    expect(en.stimulusHelp).toContain('the time scale is not calibrated to measurement')
    expect(en.tableNote).toContain('0.10 is a reporting level, not a biological threshold')
    expect(en.tableNote).toContain('the final value is not a claim of a steady state')
    expect(en.factsCaveat).toContain('They do not show that a real cell or a real circuit behaves this way.')
  })

  it('writes singular and plural counts in English', () => {
    expect(messages.en.statusLinkRemoved(2, 'B → C excitatory', 1)).toBe('Connection 2 was removed (B → C excitatory). 1 connection is left.')
    expect(messages.en.statusCellsRemoved(['C'], 1, 2)).toBe('C was removed; 1 connection attached to it was deleted. The number of cells is 2.')
    expect(messages.en.recordSettings(1, 2, 1, 'A', '0.80', '100', '300')).toBe('Record #1: 2 cells, 1 connection. A pulse of amplitude 0.80 to cell A, 100–300 model ms.')
  })

  it('keeps the Turkish sentences the browser tests look for', () => {
    expect(messages.tr.statusLinkRemoved(2, 'B → C uyarıcı', 1)).toBe('Bağlantı 2 kaldırıldı (B → C uyarıcı). 1 bağlantı kaldı.')
    expect(messages.tr.statusCellsRemoved(['C'], 2, 2)).toBe('C çıkarıldı; ona bağlı 2 bağlantı silindi. Hücre sayısı 2.')
    expect(messages.tr.recordSettings(1, 3, 2, 'A', '0,80', '100', '300')).toBe('Kayıt #1: 3 hücre, 2 bağlantı. A hücresine 0,80 genlikli darbe, 100–300 model ms.')
    expect(messages.tr.removeLabel(3, 'A → B uyarıcı')).toBe('Kaldır: bağlantı 3, A → B uyarıcı')
    expect(messages.tr.statusPresetLoaded('İleri beslemeli zincir')).toBe('“İleri beslemeli zincir” örneği yüklendi. İstersen değiştir, sonra çalıştır.')
  })
})
