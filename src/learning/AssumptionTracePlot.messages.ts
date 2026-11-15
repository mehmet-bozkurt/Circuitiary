import { defineMessages } from '../i18n'

export const messages = defineMessages({
  tr: {
    caption: 'AVAR’ın iki hesaplanan yanıtı',
    pulseOn: 'AVER darbesi açık',
    label: (axisMax: string) => `AVAR’ın iki koşuldaki boyutsuz model aktivitesi. Ortak dikey eksen 0–${axisMax}; yatay eksen model zamanı, milisaniye. Temel koşul düz, değişiklik kesikli çizgi.`,
    yAxis: 'Boyutsuz AVAR aktivitesi',
    xAxis: 'Model zamanı · ms',
    note: 'Çizgiler aynı dikey ölçeği kullanır; aktivite değerleri ayrı ayrı 1’e normalleştirilmez. Ölçeği değiştirmek hesaplanan değerleri değiştirmez.',
  },
  en: {
    caption: 'AVAR’s two computed responses',
    pulseOn: 'AVER pulse on',
    label: (axisMax: string) => `AVAR’s dimensionless model activity in the two conditions. Shared vertical axis 0–${axisMax}; horizontal axis is model time, milliseconds. The baseline condition is a solid line, the change a dashed line.`,
    yAxis: 'Dimensionless AVAR activity',
    xAxis: 'Model time · ms',
    note: 'The lines use the same vertical scale; the activity values are not each normalized to 1 separately. Changing the scale does not change the computed values.',
  },
})
