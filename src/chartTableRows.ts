/** One column of the chart data table: the same values the chart draws for one condition. */
export interface TableSeries { id: string; values: readonly number[] }

export interface TableRow {
  timeMs: number
  /** One entry per series, in order; null when the series has no sample at that time. */
  values: Array<number | null>
}

/**
 * Picks the recorded samples whose time is a multiple of `everyMs`. Values are
 * read by sample index from the very arrays the chart plots, never recomputed.
 */
export function sampleRows(times: readonly number[], series: readonly TableSeries[], everyMs: number): TableRow[] {
  const rows: TableRow[] = []
  times.forEach((timeMs, index) => {
    const slot = timeMs / everyMs
    if (Math.abs(slot - Math.round(slot)) > 1e-9) return
    rows.push({ timeMs, values: series.map(item => item.values[index] ?? null) })
  })
  return rows
}
