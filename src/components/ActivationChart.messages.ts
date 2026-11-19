import { defineMessages } from '../i18n'

export const messages = defineMessages({
  tr: {
    /** `max` is the already formatted upper bound of the shared axis. */
    chartLabel: (max: string) => `Üç koşulun boyutsuz etkinlik değerlerini zamana göre karşılaştıran grafik. Ortak dikey eksen 0–${max}.`,
    pinnedNote: 'Sabitlenen eğri de çizilir.',
    inputNote: 'Uyarılan hücreye verilen girdi I(t) de aynı eksende ince çizgiyle çizilir.',
    yAxis: 'boyutsuz etkinlik',
    xAxis: 'zaman · ms',
  },
  en: {
    chartLabel: (max: string) => `Chart comparing the dimensionless activity values of the three conditions over time. Shared vertical axis 0–${max}.`,
    pinnedNote: 'The pinned curve is drawn as well.',
    inputNote: 'The input I(t) given to the stimulated cell is drawn as well, as a thin line on the same axis.',
    yAxis: 'dimensionless activity',
    xAxis: 'time · ms',
  },
})
