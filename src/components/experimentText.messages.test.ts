import { describe, expect, it } from 'vitest'
import { messages as chart } from './ActivationChart.messages'
import { messages as table } from './ChartDataTable.messages'
import { messages as graph } from './CircuitGraph.messages'
import { messages as graph3d } from './CircuitGraph3D.messages'
import { messages as tools } from './ExperimentTools.messages'

// The shape of English (keys, parameters) is checked by the type of defineMessages. These tests
// guard what the type cannot: the Turkish sentences that used to be assembled in the templates,
// and English text that is really English.

describe('Turkish sentences built from values', () => {
  it('are the sentences the templates wrote before', () => {
    expect(chart.tr.chartLabel('1,00')).toBe('Üç koşulun boyutsuz etkinlik değerlerini zamana göre karşılaştıran grafik. Ortak dikey eksen 0–1,00.')
    expect(table.tr.summary(71, 10)).toBe('71 satır · her 10 ms')
    expect(table.tr.note(701, 10, 71)).toBe('Grafikle aynı hesaplanmış değerler; ayarlar değişince birlikte güncellenir. Satırlar, kayıtlı 701 örnekten her 10 ms\'deki 71 tanesidir; aradaki örnekler tabloda yok. Tepe satırı ise tablodaki satırlardan değil, kayıtlı örneklerin hepsinden alınır. Değerler 0–1 arasında boyutsuz model etkinliğidir, ölçülmüş bir yanıt değildir.')
    expect(table.tr.caption('O1')).toBe('O1 hücresinin model etkinliği · üç koşul')
    expect(graph3d.tr.selectCell('S1', '0,125')).toBe('S1 hücresini seç; etkinlik 0,125')
    expect(tools.tr.fileReady('CSV', 'a.csv')).toBe('CSV dosyası hazırlandı, indirme başladı: a.csv')
    expect(tools.tr.fileFailed('JSON')).toBe('JSON dosyası oluşturulamadı.')
    expect(tools.tr.csvHint('Referans')).toBe('Referans koşulu · zaman ve her hücre bir sütun')
    expect(tools.tr.jsonHint('O1')).toBe('O1 hücresi · üç koşul · ayarlar')
  })
})

describe('English text', () => {
  const texts = (value: unknown): string[] => typeof value === 'string' ? [value]
    : typeof value === 'function' ? texts((value as (...args: unknown[]) => unknown)('X1', 7, 3))
    : value && typeof value === 'object' ? Object.values(value).flatMap(texts) : []

  it('has no Turkish letters and no empty entry', () => {
    for (const set of [chart, table, graph, graph3d, tools]) {
      const english = texts(set.en)
      expect(english).toHaveLength(texts(set.tr).length)
      for (const text of english) {
        expect(text.trim()).not.toBe('')
        expect(text).not.toMatch(/[ğĞşŞıİçÇöÖüÜ]/)
      }
    }
  })

  it('keeps the caveats of the Turkish', () => {
    expect(table.en.note(701, 10, 71)).toContain('not a measured response')
    expect(table.en.note(701, 10, 71)).toContain('71 of the 701 recorded samples, one every 10 ms')
    expect(table.en.summary(1, 10)).toBe('1 row · every 10 ms')
    expect(graph3d.en.schematicNote).toContain('not anatomical position')
    expect(tools.en.exportNote).toContain('not a measurement')
    expect(tools.en.shareBody).toContain('does not carry the results')
  })
})
