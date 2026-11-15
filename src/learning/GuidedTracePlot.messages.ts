import { defineMessages } from '../i18n'

export const messages = defineMessages({
  tr: {
    caption: 'O1’in zaman içindeki model aktivitesi',
    stimulusOn: 'Uyaran açık',
    chartLabel: (baseline: string, changed: string) => `O1 için iki koşulun boyutsuz aktivite grafiği. ${baseline} düz çizgi; ${changed} kesikli çizgi. Ortak dikey eksen 0 ile 1. Yatay eksen model zamanı, milisaniye.`,
    activityAxis: 'Boyutsuz model aktivitesi',
    timeAxis: 'Model zamanı · ms',
    note: 'İki eğri aynı ölçekle gösterilir. Tepe değerleri, tepe zamanları ve son değerler aşağıdaki tablodadır.',
  },
  en: {
    caption: 'Model activity of O1 over time',
    stimulusOn: 'Stimulus on',
    chartLabel: (baseline: string, changed: string) => `Chart of the dimensionless activity of O1 in two conditions. ${baseline} solid line; ${changed} dashed line. Shared vertical axis from 0 to 1. Horizontal axis is model time, in milliseconds.`,
    activityAxis: 'Dimensionless model activity',
    timeAxis: 'Model time · ms',
    note: 'The two curves are shown on the same scale. The peak values, peak times and final values are in the table below.',
  },
})
