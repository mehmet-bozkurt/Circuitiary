import { describe, expect, it } from 'vitest'
import { sampleRows } from './chartTableRows'

const grid = (dt: number, duration = 700) => Array.from({ length: Math.round(duration / dt) + 1 }, (_, index) => index * dt)

describe('sampleRows', () => {
  it('keeps the samples at multiples of 10 ms and reads the plotted values by index', () => {
    const times = grid(1)
    const a = times.map(time => time / 1000)
    const b = times.map(time => 1 - time / 1000)
    const rows = sampleRows(times, [{ id: 'a', values: a }, { id: 'b', values: b }], 10)
    expect(rows).toHaveLength(71)
    expect(rows[0]).toEqual({ timeMs: 0, values: [0, 1] })
    expect(rows[25]).toEqual({ timeMs: 250, values: [a[250], b[250]] })
    expect(rows.at(-1)).toEqual({ timeMs: 700, values: [a[700], b[700]] })
    expect(rows.map(row => row.timeMs)).toEqual(Array.from({ length: 71 }, (_, index) => index * 10))
  })

  it.each([0.0625, 0.125, 0.25, 0.5, 1, 2])('gives the same 71 rows for a step of %s ms, with the value of that exact sample', dt => {
    const times = grid(dt)
    const values = times.map((_, index) => index * 1e-4)
    const rows = sampleRows(times, [{ id: 'x', values }], 10)
    expect(rows).toHaveLength(71)
    rows.forEach((row, index) => {
      expect(row.timeMs).toBe(index * 10)
      expect(row.values).toEqual([values[Math.round(row.timeMs / dt)]])
    })
  })

  it('shows a missing sample as null instead of inventing a value', () => {
    const rows = sampleRows([0, 10, 20], [{ id: 'short', values: [0.5] }, { id: 'none', values: [] }], 10)
    expect(rows).toEqual([{ timeMs: 0, values: [0.5, null] }, { timeMs: 10, values: [null, null] }, { timeMs: 20, values: [null, null] }])
  })

  it('returns no rows for an empty recording and honours another interval', () => {
    expect(sampleRows([], [{ id: 'x', values: [] }], 10)).toEqual([])
    expect(sampleRows(grid(1, 100), [{ id: 'x', values: grid(1, 100) }], 25).map(row => row.timeMs)).toEqual([0, 25, 50, 75, 100])
  })

  it('does not interpolate: a time that is not a multiple is skipped', () => {
    expect(sampleRows([0, 7, 14, 20], [{ id: 'x', values: [1, 2, 3, 4] }], 10).map(row => row.timeMs)).toEqual([0, 20])
  })
})
