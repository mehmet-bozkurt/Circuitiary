import { plainNumber } from './exportData'
import type { ExperimentDraft } from './learning/readingHandoff'

/**
 * Everything in the experiment that changes the curves or the selection. The
 * playback position and the playing flag are left out on purpose: a link opens
 * paused at the default moment, and the peaks do not depend on either.
 */
export type ShareState = Omit<ExperimentDraft, 'playing' | 'cursorMs'>
export type ShareField = keyof ShareState

/** Short query keys and the Turkish names used when a part of a link is ignored. Order is the order in the URL. */
export const shareFields: Record<ShareField, { key: string; label: string }> = {
  mode: { key: 'm', label: 'Devre modu' },
  graphView: { key: 'v', label: 'Devre görünümü' },
  activeCondition: { key: 'c', label: 'Gösterilen koşul' },
  stimulusTarget: { key: 'st', label: 'Uyaranın girdiği hücre' },
  amplitude: { key: 'am', label: 'Uyaran gücü' },
  pulseDuration: { key: 'du', label: 'Uyaran süresi' },
  baseTau: { key: 'tb', label: 'Referans zaman sabiti' },
  changedNeuron: { key: 'tn', label: 'Zaman sabiti değişen hücre' },
  changedTau: { key: 'tc', label: 'Değişen zaman sabiti' },
  selectedEdge: { key: 'se', label: 'Susturulan bağlantı' },
  outputNeuron: { key: 'o', label: 'Okunan hücre' },
  selectedNeuron: { key: 'n', label: 'Seçili hücre' },
  dt: { key: 'dt', label: 'Zaman adımı' },
  chemicalGain: { key: 'cg', label: 'Kimyasal katsayı' },
  gapGain: { key: 'gg', label: 'Gap katsayısı' },
  focusConnections: { key: 'fc', label: 'Seçili hücreye odaklan' },
  scaleToResponse: { key: 'sc', label: 'Yanıta göre dikey ölçek' },
}
const fieldOrder = Object.keys(shareFields) as ShareField[]

/** The slider ranges of the experiment controls; a Playwright test checks them against the page. */
export const numberRanges = {
  amplitude: { min: 0, max: 1, step: 0.05 },
  pulseDuration: { min: 50, max: 400, step: 10 },
  baseTau: { min: 10, max: 80, step: 5 },
  changedTau: { min: 10, max: 180, step: 5 },
  chemicalGain: { min: 0, max: 2, step: 0.1 },
  gapGain: { min: 0, max: 1, step: 0.1 },
} as const
/** The options of the time-step select. */
export const dtChoices: readonly number[] = [0.0625, 0.125, 0.25, 0.5, 1, 2]

type Range = { readonly min: number; readonly max: number; readonly step: number }
const NUMBER = /^(?:0|[1-9]\d{0,3})(?:\.\d{1,6})?$/
const onGrid = (value: number, { min, max, step }: Range): boolean => {
  const steps = (value - min) / step
  return value >= min && value <= max && Math.abs(steps - Math.round(steps)) < 1e-6
}
const ranged = (range: Range) => (text: string): number | undefined => {
  if (!NUMBER.test(text)) return undefined
  const value = Number(text)
  return onGrid(value, range) ? value : undefined
}
const oneOf = <T extends string>(choices: readonly T[]) => (text: string): T | undefined => choices.find(choice => choice === text)
/** Syntax only (length, no control characters); membership in the circuit is checked by restrictToCircuit. */
const idText = (text: string): string | undefined => text.length >= 1 && text.length <= 64 && !/[\u0000-\u001f\u007f]/.test(text) ? text : undefined
const flag = (text: string): boolean | undefined => text === '1' ? true : text === '0' ? false : undefined
const timeStep = (text: string): number | undefined => {
  if (!NUMBER.test(text)) return undefined
  const value = Number(text)
  return dtChoices.includes(value) ? value : undefined
}

const parsers: { [K in ShareField]: (text: string) => ShareState[K] | undefined } = {
  mode: oneOf(['illustrative', 'real']),
  graphView: oneOf(['2d', '3d']),
  activeCondition: oneOf(['baseline', 'silenced', 'tau']),
  stimulusTarget: idText,
  amplitude: ranged(numberRanges.amplitude),
  pulseDuration: ranged(numberRanges.pulseDuration),
  baseTau: ranged(numberRanges.baseTau),
  changedNeuron: idText,
  changedTau: ranged(numberRanges.changedTau),
  selectedEdge: idText,
  outputNeuron: idText,
  selectedNeuron: idText,
  dt: timeStep,
  chemicalGain: ranged(numberRanges.chemicalGain),
  gapGain: ranged(numberRanges.gapGain),
  focusConnections: flag,
  scaleToResponse: flag,
}

const realOnly: ShareField[] = ['chemicalGain', 'gapGain', 'focusConnections']
const cellFields: ShareField[] = ['stimulusTarget', 'outputNeuron', 'changedNeuron', 'selectedNeuron', 'selectedEdge']

export interface ShareParse {
  /** At least one key of ours was present, valid or not. */
  found: boolean
  values: Partial<ShareState>
  /** Known keys whose value was invalid, repeated or unknown to the circuit. */
  ignored: ShareField[]
}

/** Strict parse of a query string: unknown keys are skipped silently, a known key with a bad or repeated value is reported. */
export function parseShareQuery(search: string): ShareParse {
  const params = new URLSearchParams(search)
  const values: Record<string, unknown> = {}
  const ignored: ShareField[] = []
  let found = false
  for (const field of fieldOrder) {
    const given = params.getAll(shareFields[field].key)
    if (given.length === 0) continue
    found = true
    const parsed = given.length === 1 ? parsers[field](given[0]!) : undefined
    if (parsed === undefined) ignored.push(field)
    else values[field] = parsed
  }
  return { found, values: values as Partial<ShareState>, ignored }
}

/** The cell and connection IDs the circuit of the chosen mode offers. */
export interface ShareIds { stimulusTargets: readonly string[]; outputs: readonly string[]; neurons: readonly string[]; edges: readonly string[] }

/** Drops IDs the circuit does not have (reported) and, in the example, the gains that only matter for real data (silent). */
export function restrictToCircuit(parse: ShareParse, ids: ShareIds, mode: ShareState['mode']): ShareParse {
  const allowed: Record<string, ReadonlySet<string>> = {
    stimulusTarget: new Set(ids.stimulusTargets), outputNeuron: new Set(ids.outputs),
    changedNeuron: new Set(ids.neurons), selectedNeuron: new Set(ids.neurons), selectedEdge: new Set(ids.edges),
  }
  const values: Record<string, unknown> = { ...parse.values }
  const ignored = [...parse.ignored]
  for (const field of cellFields) {
    const value = values[field]
    if (typeof value === 'string' && !allowed[field]!.has(value)) { delete values[field]; ignored.push(field) }
  }
  if (mode === 'illustrative') for (const field of realOnly) delete values[field]
  return { found: parse.found, values: values as Partial<ShareState>, ignored: ignored.filter(field => mode === 'real' || !realOnly.includes(field)) }
}

/** The link asked for real data that cannot be loaded: cell choices and real-only settings no longer apply, and are not listed as invalid. */
export function withoutRealSelections(parse: ShareParse): ShareParse {
  const values: Record<string, unknown> = { ...parse.values }
  const dropped = [...cellFields, ...realOnly]
  for (const field of dropped) delete values[field]
  return { found: parse.found, values: { ...values, mode: 'illustrative' } as Partial<ShareState>, ignored: parse.ignored.filter(field => !dropped.includes(field)) }
}

const serialise = (value: string | number | boolean): string => typeof value === 'number' ? plainNumber(value) : typeof value === 'boolean' ? (value ? '1' : '0') : value

/** The full link for a state; `base` is the app address without query. Real-only keys are written only in real mode. */
export function buildShareUrl(state: ShareState, base: string): string {
  const url = new URL(base)
  url.hash = ''
  const params = new URLSearchParams()
  for (const field of fieldOrder) {
    if (state.mode !== 'real' && realOnly.includes(field)) continue
    params.set(shareFields[field].key, serialise(state[field]))
  }
  url.search = params.toString()
  return url.href
}

export interface ShareOutcome { applied: number; ignored: readonly ShareField[]; realUnavailable: boolean }

/** The polite status line shown after a link was applied. */
export function shareNotice({ applied, ignored, realUnavailable }: ShareOutcome): string {
  const ignoredText = ignored.length ? ` Geçersiz olduğu için yok sayılan parçalar: ${ignored.map(field => shareFields[field].label).join(', ')}.` : ''
  if (realUnavailable) return `Bağlantıdaki ayarlar sekiz hücreli örneğe uygulandı. Bağlantı gerçek veri modunu istiyordu, ama yerel veri bu bilgisayarda yok; hücre ve bağlantı seçimleri atlandı.${ignoredText}`
  if (applied === 0) return `Bağlantıda geçerli ayar bulunamadı; varsayılan deney açıldı.${ignoredText}`
  return `Bağlantıdaki ayarlar uygulandı.${ignoredText}`
}
