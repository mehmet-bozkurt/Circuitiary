/** Number text for the Turkish interface: decimal comma, fixed digits, no digit grouping. */
export function decimal(value: number, digits: number): string {
  return value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false })
}

/** Decimal comma for text already produced by String(), toPrecision or toExponential. */
export const withComma = (text: string): string => text.replace('.', ',')
