import { defineMessages } from '../i18n'

export const messages = defineMessages({
  tr: {
    legend: 'Grafik çizgileri',
    yLabel: 'Göreli düzey',
    timeAxis: 'Öğretici zaman · boyutsuz',
    plot: (title: string, yLabel: string) => `${title}. Dikey eksen ${yLabel}, 0 ile 1 arasında. Yatay eksen öğretici zaman; biyolojik zaman birimi değildir.`,
  },
  en: {
    legend: 'Chart lines',
    yLabel: 'Relative level',
    timeAxis: 'Teaching time · dimensionless',
    plot: (title: string, yLabel: string) => `${title}. Vertical axis: ${yLabel}, from 0 to 1. Horizontal axis: teaching time; it is not a biological unit of time.`,
  },
})
