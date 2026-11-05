import { describe, expect, it } from 'vitest'
import { decimal, withComma } from './format'

describe('Turkish number text', () => {
  it('writes a decimal comma with the requested fixed digits', () => {
    expect(decimal(0.6633752699858795, 3)).toBe('0,663')
    expect(decimal(1, 2)).toBe('1,00')
    expect(decimal(0.025, 3)).toBe('0,025')
    expect(decimal(0, 1)).toBe('0,0')
  })

  it('keeps the minus sign and never groups digits', () => {
    expect(decimal(-0.2609, 3)).toBe('-0,261')
    expect(decimal(1234.5, 1)).toBe('1234,5')
  })

  it('moves only the decimal point of precision and exponent text', () => {
    expect(withComma((0.04924786).toPrecision(5))).toBe('0,049248')
    expect(withComma((0.00001234).toExponential(4))).toBe('1,2340e-5')
    expect(withComma('90')).toBe('90')
    expect(withComma(String(1.2))).toBe('1,2')
  })
})
