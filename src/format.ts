import { locale, localeTag } from './i18n'

/** Number text in the interface language: decimal comma in Turkish, decimal point in English; fixed digits, no digit grouping. */
export function decimal(value: number, digits: number): string {
  return value.toLocaleString(localeTag(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false })
}

/** Decimal comma (Turkish only) for text already produced by String(), toPrecision or toExponential; English keeps the point. */
export const withComma = (text: string): string => locale.value === 'en' ? text : text.replace('.', ',')
