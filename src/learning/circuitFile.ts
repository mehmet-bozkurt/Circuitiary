import { decimal } from '../format'
import { defineMessages, pick } from '../i18n'
import type { ExportFile } from '../exportData'
import {
  CELL_IDS, LIMITS, blankDraft, draftKey, strengthLimits, validateDraft,
  type BuilderDraft, type BuilderLink, type BuilderProblem, type CellId, type LinkType,
} from './circuitBuilder'

/**
 * The builder's circuit as a small JSON text: the file the learner saves and loads, and the same text kept in
 * localStorage. It holds the draft only (cells, connections, stimulus), never a result: a result is
 * recomputed by running. Reading is strict; whatever is not exactly this shape is refused with a reason and
 * the page keeps its current circuit.
 *
 * {
 *   "app": "Circuitiary",
 *   "format": "circuitiary-builder-circuit",
 *   "schemaVersion": 1,
 *   "draft": {
 *     "cellCount": 3,
 *     "links": [{ "type": "excitatory", "source": "A", "target": "B", "strength": 0.9 }],
 *     "stimulus": { "target": "A", "amplitude": 0.8, "onsetMs": 100, "durationMs": 200 }
 *   }
 * }
 */
export const CIRCUIT_FILE_APP = 'Circuitiary'
export const CIRCUIT_FILE_FORMAT = 'circuitiary-builder-circuit'
export const CIRCUIT_FILE_VERSION = 1
/** The same name in both languages, like the other exported files. */
export const CIRCUIT_FILE_NAME = 'circuitiary-devre.json'
/** The largest valid file (12 connections, indented) is under 2 kB. */
export const CIRCUIT_FILE_MAX_BYTES = 4096
export const DRAFT_STORAGE_KEY = 'circuitiary-builder-draft'

const LINK_TYPES: readonly LinkType[] = ['excitatory', 'inhibitory', 'gap']
const ROOT_KEYS = ['app', 'format', 'schemaVersion', 'draft'] as const
const DRAFT_KEYS = ['cellCount', 'links', 'stimulus'] as const
const LINK_KEYS = ['type', 'source', 'target', 'strength'] as const
const STIMULUS_KEYS = ['target', 'amplitude', 'onsetMs', 'durationMs'] as const

export type CircuitFileErrorCode =
  | 'unreadable' | 'too-large' | 'not-json' | 'not-object' | 'not-circuit-file' | 'schema-version'
  | 'missing-key' | 'unknown-key' | 'wrong-type' | 'bad-cell' | 'bad-link-type' | 'off-step' | 'invalid-circuit'
type ValueKind = 'object' | 'list' | 'number' | 'text'

const text = defineMessages({
  tr: {
    unreadable: 'Dosya okunamadı. Dosyayı yeniden seç.',
    tooLarge: (limit: string) => `Dosya çok büyük. Bir devre dosyası en fazla ${limit} bayt olabilir; bu dosya bir devre dosyası olmayabilir.`,
    notJson: 'Dosya geçerli bir JSON metni değil. “Devreyi dosyaya kaydet” ile yazılmış bir dosya seç.',
    notObject: 'Dosyanın içeriği bir devre kaydı değil: en dışta bir JSON nesnesi olmalı.',
    notCircuitFile: 'Bu bir Circuitiary devre dosyası değil: “app” ve “format” alanları beklenen değerleri taşımıyor.',
    schemaMissing: (supported: number) => `Dosyada geçerli bir şema sürümü (“schemaVersion”) yok. Bu sayfa yalnız sürüm ${supported} dosyalarını okur.`,
    schemaOther: (found: number, supported: number) => `Dosyanın şema sürümü ${found}; bu sayfa yalnız sürüm ${supported} dosyalarını okur.`,
    missingKey: (path: string) => `Dosyada gerekli bir alan eksik: “${path}”.`,
    unknownKey: (path: string) => `Dosyada tanınmayan bir alan var: “${path}”. Devre dosyasında yalnız bilinen alanlar bulunabilir.`,
    wrongType: (path: string, kind: ValueKind) => `“${path}” alanı ${{ object: 'bir nesne', list: 'bir liste', number: 'bir sayı', text: 'bir metin' }[kind]} olmalı.`,
    badCell: (path: string, first: string, last: string) => `“${path}” alanı bir hücre harfi olmalı (${first}–${last}).`,
    badLinkType: (path: string) => `“${path}” alanı şu türlerden biri olmalı: excitatory, inhibitory, gap.`,
    offStep: (path: string, step: string) => `“${path}” değeri sayfadaki kaydırıcının adımlarına uymuyor; adım ${step}.`,
    invalidCircuit: (problems: string) => `Dosyadaki devre geçerli değil. ${problems}`,
  },
  en: {
    unreadable: 'The file could not be read. Choose the file again.',
    tooLarge: (limit: string) => `The file is too large. A circuit file can be at most ${limit} bytes; this file may not be a circuit file.`,
    notJson: 'The file is not valid JSON text. Choose a file written with “Save the circuit to a file”.',
    notObject: 'The content of the file is not a circuit record: the outermost value must be a JSON object.',
    notCircuitFile: 'This is not a Circuitiary circuit file: the “app” and “format” fields do not hold the expected values.',
    schemaMissing: (supported: number) => `The file has no valid schema version (“schemaVersion”). This page reads only version ${supported} files.`,
    schemaOther: (found: number, supported: number) => `The schema version of the file is ${found}; this page reads only version ${supported} files.`,
    missingKey: (path: string) => `A required field is missing from the file: “${path}”.`,
    unknownKey: (path: string) => `The file has an unknown field: “${path}”. A circuit file may hold only the known fields.`,
    wrongType: (path: string, kind: ValueKind) => `The “${path}” field must be ${{ object: 'an object', list: 'a list', number: 'a number', text: 'text' }[kind]}.`,
    badCell: (path: string, first: string, last: string) => `The “${path}” field must be a cell letter (${first}–${last}).`,
    badLinkType: (path: string) => `The “${path}” field must be one of these types: excitatory, inhibitory, gap.`,
    offStep: (path: string, step: string) => `The “${path}” value does not fit the steps of the slider on the page; the step is ${step}.`,
    invalidCircuit: (problems: string) => `The circuit in the file is not valid. ${problems}`,
  },
})

/** `message` is written in the interface language each time it is read, so a kept error follows a language change. */
export interface CircuitFileError { code: CircuitFileErrorCode; message: string; path?: string }
export type CircuitFileOutcome = { ok: true; draft: BuilderDraft } | { ok: false; error: CircuitFileError }

const refuse = (code: CircuitFileErrorCode, message: () => string, path?: string): CircuitFileOutcome =>
  ({ ok: false, error: path === undefined ? { code, get message() { return message() } } : { code, get message() { return message() }, path } })

/** A file the page could not read at all (the browser refused or failed). */
export const unreadableFile = (): CircuitFileOutcome => refuse('unreadable', () => pick(text).unreadable)
/** The size refusal, also used by the page before it reads a large file into memory. */
export const tooLargeFile = (): CircuitFileOutcome => refuse('too-large', () => pick(text).tooLarge(decimal(CIRCUIT_FILE_MAX_BYTES, 0)))

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isCell = (value: unknown): value is CellId => typeof value === 'string' && (CELL_IDS as readonly string[]).includes(value)
/** A key copied into a message is cut short; it is shown as text, never as markup. */
const shown = (key: string): string => key.length > 24 ? `${key.slice(0, 24)}…` : key
const at = (parent: string, key: string): string => parent ? `${parent}.${key}` : key

/** Exactly these keys: the first missing one, else the first extra one. */
function keyProblem(value: Json, keys: readonly string[], parent: string): CircuitFileOutcome | null {
  const missing = keys.find(key => !Object.hasOwn(value, key))
  if (missing !== undefined) return refuse('missing-key', () => pick(text).missingKey(at(parent, missing)), at(parent, missing))
  const extra = Object.keys(value).find(key => !keys.includes(key))
  if (extra !== undefined) return refuse('unknown-key', () => pick(text).unknownKey(at(parent, shown(extra))), at(parent, shown(extra)))
  return null
}
const wrongType = (path: string, kind: ValueKind): CircuitFileOutcome => refuse('wrong-type', () => pick(text).wrongType(path, kind), path)
const badCell = (path: string): CircuitFileOutcome => refuse('bad-cell', () => pick(text).badCell(path, CELL_IDS[0], CELL_IDS.at(-1)!), path)

/** The value on the slider's grid, or null when it is not a multiple of the step. Removes binary noise such as 0.30000000000000004. */
function onStep(value: number, step: number): number | null {
  const steps = Math.round(value / step)
  return Math.abs(value / step - steps) < 1e-6 ? Number((steps * step).toFixed(2)) : null
}

/**
 * Reads a circuit file. Never throws and never evaluates the text: it is parsed as JSON and every field is
 * checked by name, type and value. Connection ids are made here; cell letters come from the fixed A–F set.
 */
export function parseCircuitFile(source: string): CircuitFileOutcome {
  if (source.length > CIRCUIT_FILE_MAX_BYTES || new TextEncoder().encode(source).length > CIRCUIT_FILE_MAX_BYTES) return tooLargeFile()
  let root: unknown
  try { root = JSON.parse(source) } catch { return refuse('not-json', () => pick(text).notJson) }
  if (!isObject(root)) return refuse('not-object', () => pick(text).notObject)
  if (root.app !== CIRCUIT_FILE_APP || root.format !== CIRCUIT_FILE_FORMAT) return refuse('not-circuit-file', () => pick(text).notCircuitFile)
  const version = root.schemaVersion
  if (!isNumber(version) || !Number.isInteger(version)) return refuse('schema-version', () => pick(text).schemaMissing(CIRCUIT_FILE_VERSION), 'schemaVersion')
  if (version !== CIRCUIT_FILE_VERSION) return refuse('schema-version', () => pick(text).schemaOther(version, CIRCUIT_FILE_VERSION), 'schemaVersion')
  const rootKeys = keyProblem(root, ROOT_KEYS, '')
  if (rootKeys) return rootKeys

  const draft = root.draft
  if (!isObject(draft)) return wrongType('draft', 'object')
  const draftKeys = keyProblem(draft, DRAFT_KEYS, 'draft')
  if (draftKeys) return draftKeys
  if (!isNumber(draft.cellCount)) return wrongType('draft.cellCount', 'number')
  if (!Array.isArray(draft.links)) return wrongType('draft.links', 'list')
  const stimulus = draft.stimulus
  if (!isObject(stimulus)) return wrongType('draft.stimulus', 'object')

  const links: BuilderLink[] = []
  for (const [index, item] of (draft.links as unknown[]).entries()) {
    const path = `draft.links[${index}]`
    if (!isObject(item)) return wrongType(path, 'object')
    const linkKeys = keyProblem(item, LINK_KEYS, path)
    if (linkKeys) return linkKeys
    if (typeof item.type !== 'string') return wrongType(`${path}.type`, 'text')
    if (!(LINK_TYPES as readonly string[]).includes(item.type)) return refuse('bad-link-type', () => pick(text).badLinkType(`${path}.type`), `${path}.type`)
    for (const end of ['source', 'target'] as const) {
      if (typeof item[end] !== 'string') return wrongType(`${path}.${end}`, 'text')
      if (!isCell(item[end])) return badCell(`${path}.${end}`)
    }
    if (!isNumber(item.strength)) return wrongType(`${path}.strength`, 'number')
    links.push({ id: `f${index + 1}`, type: item.type as LinkType, source: item.source as CellId, target: item.target as CellId, strength: item.strength })
  }

  const stimulusKeys = keyProblem(stimulus, STIMULUS_KEYS, 'draft.stimulus')
  if (stimulusKeys) return stimulusKeys
  if (typeof stimulus.target !== 'string') return wrongType('draft.stimulus.target', 'text')
  if (!isCell(stimulus.target)) return badCell('draft.stimulus.target')
  for (const key of ['amplitude', 'onsetMs', 'durationMs'] as const) if (!isNumber(stimulus[key])) return wrongType(`draft.stimulus.${key}`, 'number')

  const read: BuilderDraft = {
    cellCount: draft.cellCount,
    links,
    stimulus: { target: stimulus.target, amplitude: stimulus.amplitude as number, onsetMs: stimulus.onsetMs as number, durationMs: stimulus.durationMs as number },
  }
  // The same rules as the page: cell count, ranges, cells that exist, duplicate and self connections, connection count.
  const problems: BuilderProblem[] = validateDraft(read)
  if (problems.length) return refuse('invalid-circuit', () => pick(text).invalidCircuit(problems.map(problem => problem.message).join(' ')))

  // Only values the page's own sliders can show: a file cannot bring in a strength the controls would misreport.
  const stepped = (value: number, step: number, path: string, digits: number, set: (next: number) => void): CircuitFileOutcome | null => {
    const next = onStep(value, step)
    if (next === null) return refuse('off-step', () => pick(text).offStep(path, decimal(step, digits)), path)
    set(next)
    return null
  }
  for (const [index, item] of read.links.entries()) {
    const off = stepped(item.strength, strengthLimits(item.type).step, `draft.links[${index}].strength`, 2, next => { item.strength = next })
    if (off) return off
  }
  const off = stepped(read.stimulus.amplitude, LIMITS.amplitude.step, 'draft.stimulus.amplitude', 2, next => { read.stimulus.amplitude = next })
    ?? stepped(read.stimulus.onsetMs, LIMITS.onsetMs.step, 'draft.stimulus.onsetMs', 0, next => { read.stimulus.onsetMs = next })
    ?? stepped(read.stimulus.durationMs, LIMITS.pulseMs.step, 'draft.stimulus.durationMs', 0, next => { read.stimulus.durationMs = next })
  if (off) return off
  return { ok: true, draft: read }
}

/** The file's text: the draft without connection ids and without any result, indented, with a final line break. */
export function circuitFileText(draft: BuilderDraft): string {
  return `${JSON.stringify({
    app: CIRCUIT_FILE_APP,
    format: CIRCUIT_FILE_FORMAT,
    schemaVersion: CIRCUIT_FILE_VERSION,
    draft: {
      cellCount: draft.cellCount,
      links: draft.links.map(link => ({ type: link.type, source: link.source, target: link.target, strength: link.strength })),
      stimulus: { target: draft.stimulus.target, amplitude: draft.stimulus.amplitude, onsetMs: draft.stimulus.onsetMs, durationMs: draft.stimulus.durationMs },
    },
  }, null, 2)}\n`
}

export const circuitFile = (draft: BuilderDraft): ExportFile => ({ name: CIRCUIT_FILE_NAME, type: 'application/json;charset=utf-8', text: circuitFileText(draft) })

/** The three calls the keeping needs; a test passes its own. */
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
/** localStorage, or null where it does not exist or reading the property itself is refused. */
function browserStorage(): DraftStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}
const isBlank = (draft: BuilderDraft): boolean => draftKey(draft) === draftKey(blankDraft())

/**
 * The circuit kept in this browser, or null: nothing kept, storage unavailable, or the kept text is not a
 * valid circuit file. Invalid text is ignored without a message; the page then opens with the blank circuit.
 */
export function readStoredDraft(storage: DraftStorage | null = browserStorage()): BuilderDraft | null {
  try {
    const kept = storage?.getItem(DRAFT_STORAGE_KEY)
    if (typeof kept !== 'string') return null
    const outcome = parseCircuitFile(kept)
    return outcome.ok && !isBlank(outcome.draft) ? outcome.draft : null
  } catch { return null }
}

/**
 * Keeps the circuit. The blank circuit is kept as "nothing", so an untouched page stores nothing. A circuit
 * with a problem is not written (it could not be read back); the last valid one stays. Returns whether the
 * storage now matches the draft.
 */
export function storeDraft(draft: BuilderDraft, storage: DraftStorage | null = browserStorage()): boolean {
  try {
    if (!storage || validateDraft(draft).length) return false
    if (isBlank(draft)) storage.removeItem(DRAFT_STORAGE_KEY)
    else storage.setItem(DRAFT_STORAGE_KEY, circuitFileText(draft))
    return true
  } catch { return false }
}

export function clearStoredDraft(storage: DraftStorage | null = browserStorage()): void {
  try { storage?.removeItem(DRAFT_STORAGE_KEY) } catch { /* The page works without storage. */ }
}
