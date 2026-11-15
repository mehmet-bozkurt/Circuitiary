import { defineMessages } from '../i18n'

export const messages = defineMessages({
  tr: {
    title: 'Grafiğin veri tablosu',
    summary: (rows: number, everyMs: number) => `${rows} satır · her ${everyMs} ms`,
    note: (samples: number, everyMs: number, rows: number) => `Grafikle aynı hesaplanmış değerler; ayarlar değişince birlikte güncellenir. Satırlar, kayıtlı ${samples} örnekten her ${everyMs} ms'deki ${rows} tanesidir; aradaki örnekler tabloda yok. Tepe satırı ise tablodaki satırlardan değil, kayıtlı örneklerin hepsinden alınır. Değerler 0–1 arasında boyutsuz model etkinliğidir, ölçülmüş bir yanıt değildir.`,
    caption: (output: string) => `${output} hücresinin model etkinliği · üç koşul`,
    captionPinned: (output: string) => `${output} hücresinin model etkinliği · üç koşul ve sabitlenen eğri`,
    time: 'Zaman (ms)',
    peak: 'Tepe etkinlik',
  },
  en: {
    title: 'Data table of the chart',
    summary: (rows: number, everyMs: number) => `${rows} ${rows === 1 ? 'row' : 'rows'} · every ${everyMs} ms`,
    note: (samples: number, everyMs: number, rows: number) => `The same computed values as the chart; they update together when the settings change. The rows are ${rows} of the ${samples} recorded samples, one every ${everyMs} ms; the samples in between are not in the table. The peak row, however, is taken from all the recorded samples, not from the rows of the table. The values are dimensionless model activity between 0 and 1, not a measured response.`,
    caption: (output: string) => `Model activity of cell ${output} · three conditions`,
    captionPinned: (output: string) => `Model activity of cell ${output} · three conditions and the pinned curve`,
    time: 'Time (ms)',
    peak: 'Peak activity',
  },
})
