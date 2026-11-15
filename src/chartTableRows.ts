/** One column of the chart data table: the same values the chart draws for one condition. */
export interface TableSeries {
  id: string
  values: readonly number[]
  /** Own sample times, for a series recorded with another time step than the table's `times` (a pinned curve). */
  times?: readonly number[]
}

/** The value a series recorded at exactly `timeMs`, or null when it has no sample there. Sample times are evenly spaced from 0. */
export function sampleAt(times: readonly number[], values: readonly number[], timeMs: number): number | null {
  const step = times.length > 1 ? times[1]! - times[0]! : 0
  const index = step > 0 ? Math.round((timeMs - times[0]!) / step) : 0
  const recorded = times[index]
  return recorded !== undefined && Math.abs(recorded - timeMs) <= 1e-9 ? values[index] ?? null : null
}

export interface TableRow {
  timeMs: number
  /** One entry per series, in order; null when the series has no sample at that time. */
  values: Array<number | null>
}

/**
 * Picks the recorded samples whose time is a multiple of `everyMs`. Values are
 * read by sample index from the very arrays the chart plots, never recomputed. A series
 * with its own `times` is read at the same moment instead of the same index.
 */
export function sampleRows(times: readonly number[], series: readonly TableSeries[], everyMs: number): TableRow[] {
  const rows: TableRow[] = []
  times.forEach((timeMs, index) => {
    const slot = timeMs / everyMs
    if (Math.abs(slot - Math.round(slot)) > 1e-9) return
    rows.push({ timeMs, values: series.map(item => item.times ? sampleAt(item.times, item.values, timeMs) : item.values[index] ?? null) })
  })
  return rows
}
