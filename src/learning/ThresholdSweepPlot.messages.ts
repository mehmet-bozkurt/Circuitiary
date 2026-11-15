import { defineMessages } from '../i18n'

export const messages = defineMessages({
  tr: {
    caption: 'AVAR’ın tepe ve kayıt sonu aktivitesi · çarpana göre',
    peakKey: 'Kayıt içindeki tepe',
    endKey: 'Son örnekte aktivite (700 model ms)',
    aboveKey: 'Eşiğin üstü',
    failedKey: 'Hesaplanamadı',
    label: (from: string, to: string, threshold: string) => `Kimyasal model çarpanına göre AVAR’ın tepe ve kayıt sonu aktivitesi. Yatay eksen çarpan, ${from}–${to}; dikey eksen boyutsuz aktivite, 0–1. Eşik ${threshold} çarpanında işaretli. Ayrıntılı sayılar aşağıdaki tabloda.`,
    yAxis: 'Boyutsuz AVAR aktivitesi',
    xAxis: 'Kimyasal model çarpanı · boyutsuz',
    threshold: (value: string) => `eşik: ${value}`,
    note: 'Noktalar hesaplanan çarpanlardır. Aralarındaki çizgiler yalnız gözü yönlendirir; hesaplanmamış değerleri göstermez. Dikey eksen sabit 0–1 aralığıdır.',
  },
  en: {
    caption: 'AVAR’s peak and end-of-recording activity · by gain',
    peakKey: 'Peak within the recording',
    endKey: 'Activity at the last sample (700 model ms)',
    aboveKey: 'Above the threshold',
    failedKey: 'Could not be computed',
    label: (from: string, to: string, threshold: string) => `AVAR’s peak and end-of-recording activity by chemical model gain. Horizontal axis is the gain, ${from}–${to}; vertical axis is dimensionless activity, 0–1. The threshold is marked at gain ${threshold}. Detailed numbers are in the table below.`,
    yAxis: 'Dimensionless AVAR activity',
    xAxis: 'Chemical model gain · dimensionless',
    threshold: (value: string) => `threshold: ${value}`,
    note: 'The points are the computed gains. The lines between them only guide the eye; they do not show values that were not computed. The vertical axis is a fixed 0–1 range.',
  },
})
