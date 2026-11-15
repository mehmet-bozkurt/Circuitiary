import type { Circuit, ConnectomeDataset, DeepReadonly, SimulationResult } from './model/types'
import { L } from './i18n'

export type ExportMode = 'illustrative' | 'real'
export type ExportCondition = 'baseline' | 'silenced' | 'tau'

/** A file the browser can download: ASCII name, MIME type and the full text. */
export interface ExportFile { name: string; type: string; text: string }

// Human-readable notes inside an exported file follow the interface language at the moment of export:
// each Turkish text has an English twin, chosen inside the functions that build the file. The structure,
// column order, keys and number formats are the same in both languages.
export const EXPORT_NOTE = 'Model çıktısı; ölçüm değildir'
export const EXPORT_NOTEEn = 'Model output; not a measurement'
const SCOPE: Record<ExportMode, string> = {
  illustrative: 'Öğretici kurgusal devre; biyolojik veri veya doğrulanmış davranış emülasyonu değildir.',
  real: 'Cook2019 anatomik altgrafı ve açıkça varsayımsal dinamikler; doğrulanmış davranış veya biyolojik beyin emülasyonu değildir. Yalnız yerel kullanım; yeniden dağıtım lisansı doğrulanmadı.',
}
const SCOPEEn: typeof SCOPE = {
  illustrative: 'Illustrative teaching circuit; not biological data or a validated behavior emulation.',
  real: 'Cook2019 anatomical subgraph and explicitly assumed dynamics; not validated behavior or a biological brain emulation. Local use only; redistribution license not verified.',
}
// File-name slugs (here, in modeSlug and in the JSON file name) stay Turkish in both languages:
// tests and the files users have already saved depend on them. Only the label inside the file is translated.
const conditionInfo: Record<ExportCondition, { slug: string; label: string; labelEn: string }> = {
  baseline: { slug: 'referans', label: 'Referans', labelEn: 'Reference' },
  silenced: { slug: 'baglanti-susturuldu', label: 'Bağlantı susturuldu', labelEn: 'Connection silenced' },
  tau: { slug: 'zaman-sabiti-degisti', label: 'Zaman sabiti değişti', labelEn: 'Time constant changed' },
}
const UNIT = 'boyutsuz etkinlik, 0 ile 1 arası'
const UNITEn = 'dimensionless activity, between 0 and 1'
const STATEMENT = 'Anatomi Cook2019 kaynağından gelir; etkinlik değerleri bu uygulamanın varsayımsal modelinin çıktısıdır. Yeniden dağıtım izni doğrulanmadı; yalnız yerel kullanım.'
const STATEMENTEn = 'The anatomy comes from the Cook2019 source; the activity values are the output of this app\'s assumed model. Redistribution permission has not been verified; local use only.'
const modeSlug: Record<ExportMode, string> = { illustrative: 'sekiz-hucreli', real: 'c-elegans-yerel' }
const conditionIds: ExportCondition[] = ['baseline', 'silenced', 'tau']

/** Fixed digits with trailing zeros removed and a dot decimal: the machine-readable counterpart of format.ts. */
export function plainNumber(value: number, digits = 8): string {
  if (!Number.isFinite(value)) return ''
  const text = value.toFixed(digits)
  const trimmed = text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
  return trimmed === '-0' ? '0' : trimmed
}

/** RFC 4180 quoting: only cells with a comma, quote or line break are wrapped. */
export function csvCell(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** `time_ms` plus one column per cell, in the given cell order; comma separated, dot decimals, LF line ends. */
export function buildCsv(cellIds: readonly string[], result: Pick<SimulationResult, 'timesMs' | 'activity'>): string {
  const lines = [['time_ms', ...cellIds].map(csvCell).join(',')]
  result.timesMs.forEach((time, index) => {
    lines.push([plainNumber(time), ...cellIds.map(id => plainNumber(result.activity[id]?.[index] ?? Number.NaN))].join(','))
  })
  return `${lines.join('\n')}\n`
}

/** Lowercase-free ASCII slug for a file name: letters, digits and single hyphens. */
const asciiSlug = (text: string): string => text.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'hucre'

export function csvFile(args: { mode: ExportMode; condition: ExportCondition; circuit: Pick<Circuit, 'neurons'>; result: SimulationResult }): ExportFile {
  return {
    name: `circuitiary-${modeSlug[args.mode]}-${conditionInfo[args.condition].slug}.csv`,
    type: 'text/csv;charset=utf-8',
    text: buildCsv(args.circuit.neurons.map(neuron => neuron.id), args.result),
  }
}

export interface JsonExportArgs {
  mode: ExportMode
  circuit: Pick<Circuit, 'id' | 'name' | 'neurons' | 'connections' | 'realData'>
  results: Record<ExportCondition, SimulationResult>
  outputCell: string
  /** The app version written into the file; the page passes the one from package.json. */
  appVersion: string
  /** The loaded dataset record; shown as source attribution in real mode only. */
  dataset?: DeepReadonly<ConnectomeDataset>
}

const rounded = (values: readonly number[]): number[] => values.map(value => Number(plainNumber(value)))
const peak = (values: readonly number[]): number => Math.max(0, ...values)

export function buildExportRecord(args: JsonExportArgs): Record<string, unknown> {
  const base = args.results.baseline.settings
  const parameters = args.circuit.realData?.parameters
  const conditions = Object.fromEntries(conditionIds.map(id => {
    const series = rounded(args.results[id].activity[args.outputCell] ?? [])
    return [id, { label: L(conditionInfo[id].label, conditionInfo[id].labelEn), peak: Number(plainNumber(peak(series))), activity: series }]
  }))
  return {
    format: 'circuitiary-output-series',
    formatVersion: 1,
    app: { name: 'Circuitiary', version: args.appVersion },
    note: L(EXPORT_NOTE, EXPORT_NOTEEn),
    scope: L(SCOPE, SCOPEEn)[args.mode],
    mode: args.mode,
    circuit: { id: args.circuit.id, name: args.circuit.name, neuronCount: args.circuit.neurons.length, connectionCount: args.circuit.connections.length },
    settings: {
      durationMs: base.durationMs,
      dtMs: base.dtMs,
      baseTauMs: base.tauMs,
      stimulus: { ...base.stimulus },
      silencedConnection: args.results.silenced.settings.silencedConnectionId ?? null,
      tauOverridesMs: { ...args.results.tau.settings.tauOverrides },
      ...(args.mode === 'real' && parameters ? { chemicalGain: parameters.chemicalGain, gapGain: parameters.gapGain } : {}),
    },
    output: {
      cell: args.outputCell,
      unit: L(UNIT, UNITEn),
      timesMs: rounded(args.results.baseline.timesMs),
      conditions,
    },
    ...(args.mode === 'real' && args.dataset ? {
      source: {
        dataset: { id: args.dataset.id, title: args.dataset.title, version: args.dataset.version, doi: args.dataset.doi },
        files: args.dataset.sources.map(source => ({ name: source.name, url: source.url, sha256: source.sha256, downloadedAtUtc: source.downloadedAtUtc })),
        license: { status: args.dataset.license.status, note: args.dataset.license.note },
        statement: L(STATEMENT, STATEMENTEn),
      },
    } : {}),
  }
}

/** Two-space JSON where number-only arrays stay on one line, so a 700-sample series is not 700 lines. */
export function stringifyRecord(record: unknown): string {
  const number = '-?\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?'
  const numberArray = new RegExp(`\\[\\s*(${number}(?:\\s*,\\s*${number})*)\\s*\\]`, 'g')
  return JSON.stringify(record, null, 2).replace(numberArray, (_all, inner: string) => `[${inner.replace(/\s+/g, '')}]`) + '\n'
}

export function jsonFile(args: JsonExportArgs): ExportFile {
  return {
    name: `circuitiary-${modeSlug[args.mode]}-${asciiSlug(args.outputCell)}-uc-kosul.json`,
    type: 'application/json;charset=utf-8',
    text: stringifyRecord(buildExportRecord(args)),
  }
}

/** Browser-only: hands the text to the user through a Blob and a temporary link. */
export function downloadFile(file: ExportFile): void {
  const url = URL.createObjectURL(new Blob([file.text], { type: file.type }))
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
