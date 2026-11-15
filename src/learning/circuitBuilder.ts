import { decimal } from '../format'
import { L, defineMessages, pick } from '../i18n'
import { defaultConfig } from '../model/circuit'
import { simulate } from '../model/simulation'
import type { Circuit, Connection, Neuron, SimulationConfig, SimulationResult } from '../model/types'

export const CELL_IDS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export type CellId = (typeof CELL_IDS)[number]
export type LinkType = 'excitatory' | 'inhibitory' | 'gap'

/** One row of the connection list. A gap is one symmetric record: `source` and `target` are its two ends, in either order. */
export interface BuilderLink { id: string; source: CellId; target: CellId; type: LinkType; strength: number }
export interface BuilderStimulus { target: CellId; amplitude: number; onsetMs: number; durationMs: number }
export interface BuilderDraft { cellCount: number; links: BuilderLink[]; stimulus: BuilderStimulus }

/** UI ranges. They are chosen so the engine's own validation and its dt stability bound can never trigger from the page. */
export const LIMITS = {
  cells: { min: 2, max: 6 },
  links: { max: 12 },
  chemical: { min: 0.05, max: 2, step: 0.05 },
  gap: { min: 0.05, max: 1, step: 0.05 },
  amplitude: { min: 0, max: 1, step: 0.05 },
  onsetMs: { min: 0, max: 500, step: 10 },
  pulseMs: { min: 10, max: 500, step: 10 },
} as const

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  excitatory: 'Uyarıcı kimyasal',
  inhibitory: 'Baskılayıcı kimyasal',
  gap: 'Elektriksel (gap)',
}
export const LINK_TYPE_LABELSEn: typeof LINK_TYPE_LABELS = {
  excitatory: 'Excitatory chemical',
  inhibitory: 'Inhibitory chemical',
  gap: 'Electrical (gap)',
}
/** The type's name in the interface language. Call it while rendering. */
export const linkTypeLabel = (type: LinkType): string => L(LINK_TYPE_LABELS, LINK_TYPE_LABELSEn)[type]

/**
 * Every sentence this module produces, in both languages. Functions below choose with `pick(text)` when they
 * are called, so a caller that renders their result inside a computed or a template follows the language.
 */
const text = defineMessages({
  tr: {
    and: 've',
    linkGap: (pair: string) => `${pair} elektriksel`,
    linkChemical: (source: string, target: string, excitatory: boolean) => `${source} → ${target} ${excitatory ? 'uyarıcı' : 'baskılayıcı'}`,
    cellCount: (min: number, max: number) => `Hücre sayısı ${min}–${max} arasında olmalı.`,
    tooManyLinks: (max: number) => `En fazla ${max} bağlantı ekleyebilirsin. Birkaç bağlantıyı kaldır.`,
    unknownCell: (n: number) => `Bağlantı ${n}: devrede olmayan bir hücreye bağlı. Kaynak ve hedef hücreyi yeniden seç.`,
    strength: (n: number, min: string, max: string) => `Bağlantı ${n}: güç ${min}–${max} aralığında olmalı.`,
    selfGap: (n: number) => `Bağlantı ${n}: elektriksel (gap) bağlantı iki farklı hücre arasında kurulur. Kaynak ve hedef için farklı hücreler seç.`,
    duplicateGap: (n: number, pair: string, first: number) => `Bağlantı ${n}: ${pair} arasında elektriksel bağlantı zaten var (Bağlantı ${first}). Gap iki yöne birden işler; tek bağlantı yeter.`,
    duplicateChemical: (n: number, pair: string, first: number) => `Bağlantı ${n}: ${pair} için kimyasal bağlantı zaten var (Bağlantı ${first}). Bir hücre çifti için tek kimyasal bağlantı kur; türünü veya gücünü değiştir.`,
    stimulusTarget: 'Uyarılan hücre devrede yok. Devredeki hücrelerden birini seç.',
    amplitude: (min: string, max: string) => `Uyaran genliği ${min}–${max} arasında olmalı.`,
    onset: (min: string, max: string) => `Uyaranın başlangıcı ${min}–${max} ms arasında olmalı.`,
    pulse: (min: string, max: string) => `Uyaran süresi ${min}–${max} ms arasında olmalı.`,
    engine: {
      unstable: 'Elektriksel bağlantıların toplam gücü bu zaman adımı için çok büyük; hesap kararlı kalamaz. Gap güçlerini azalt.',
      overflow: 'Bağlantı güçleri çok büyük; hesap taştı. Güçleri azalt.',
      'gap-once': 'İki hücre arasında yalnız bir elektriksel bağlantı olabilir.',
      'gap-invalid': 'Elektriksel bağlantı iki farklı hücre arasında kurulmalı ve gücü sıfırdan küçük olmamalı.',
      'unknown-cell': 'Devrede olmayan bir hücreye başvuruluyor. Hücre sayısını ve bağlantıları kontrol et.',
      timing: 'Uyaranın başlangıcı ve süresi sıfırdan küçük olamaz.',
      weight: 'Bir bağlantının gücü geçerli bir sayı değil. Gücü yeniden seç.',
      other: 'Bu ayarlarla hesap tamamlanamadı. Hücreleri, bağlantıları ve uyaranı kontrol edip yeniden dene.',
    },
    cellLabel: (id: string) => `Hücre ${id}`,
    cellDescription: 'Kullanıcının kurduğu oyuncak devrenin hücresi; gerçek bir hücreyi temsil etmez.',
    gapNote: 'Simetrik elektriksel (gap) bağlantı; iki yönde aynı katsayı.',
    inhibitoryNote: 'Baskılayıcı kimyasal bağlantı; model ağırlığı negatif.',
    excitatoryNote: 'Uyarıcı kimyasal bağlantı; model ağırlığı pozitif.',
    circuitName: 'Kurulan oyuncak devre',
    provenance: 'Öğrenme amacıyla kullanıcı tarafından kurulmuş oyuncak devre. Gerçek bir devre, ölçüm veya öngörü değildir.',
    highestPeak: (id: string, peak: string) => `En yüksek tepe ${id} hücresinde: ${peak}.`,
    silent: (ids: string, many: boolean) => `${ids} hücre${many ? 'leri' : 'si'} hiç yanıt vermedi: tepe 0 kaldı. Ona etkinlik taşıyan bir uyarıcı yol olmayabilir ya da baskılama etkinliği 0’da tutmuş olabilir.`,
    lasting: (end: string, duration: string, ids: string, many: boolean, level: string, loop: boolean) =>
      `Uyaran ${end} ms’de bitti; ${duration} ms’de ${ids} hücre${many ? 'lerinin' : 'sinin'} aktivitesi hâlâ ${level} düzeyinde ya da üstünde. ${loop ? 'Devrede uyarıcı bir geri besleme döngüsü var; etkinliği sürdürüyor olabilir.' : 'Devrede uyarıcı bir geri besleme döngüsü yok; kalan etkinlik, hücrelerin birbirini sırayla izlemesindeki gecikmeden gelir.'}`,
    faded: (end: string, duration: string, level: string) => `Uyaran ${end} ms’de bitti; ${duration} ms’de bütün hücrelerin aktivitesi ${level} düzeyinin altına indi.`,
  },
  en: {
    and: 'and',
    linkGap: (pair: string) => `${pair} electrical`,
    linkChemical: (source: string, target: string, excitatory: boolean) => `${source} → ${target} ${excitatory ? 'excitatory' : 'inhibitory'}`,
    cellCount: (min: number, max: number) => `The number of cells must be between ${min} and ${max}.`,
    tooManyLinks: (max: number) => `You can add at most ${max} connections. Remove a few connections.`,
    unknownCell: (n: number) => `Connection ${n}: it is connected to a cell that is not in the circuit. Choose the source and target cells again.`,
    strength: (n: number, min: string, max: string) => `Connection ${n}: the strength must be in the range ${min}–${max}.`,
    selfGap: (n: number) => `Connection ${n}: an electrical (gap) connection is made between two different cells. Choose different cells for the source and the target.`,
    duplicateGap: (n: number, pair: string, first: number) => `Connection ${n}: there is already an electrical connection for ${pair} (Connection ${first}). A gap works in both directions at once; one connection is enough.`,
    duplicateChemical: (n: number, pair: string, first: number) => `Connection ${n}: there is already a chemical connection for ${pair} (Connection ${first}). Make a single chemical connection for a pair of cells; change its type or its strength.`,
    stimulusTarget: 'The stimulated cell is not in the circuit. Choose one of the cells in the circuit.',
    amplitude: (min: string, max: string) => `The stimulus amplitude must be between ${min} and ${max}.`,
    onset: (min: string, max: string) => `The stimulus onset must be between ${min} and ${max} ms.`,
    pulse: (min: string, max: string) => `The stimulus duration must be between ${min} and ${max} ms.`,
    engine: {
      unstable: 'The total strength of the electrical connections is too large for this time step; the calculation cannot stay stable. Reduce the gap strengths.',
      overflow: 'The connection strengths are too large; the calculation overflowed. Reduce the strengths.',
      'gap-once': 'There can be only one electrical connection between two cells.',
      'gap-invalid': 'An electrical connection must be made between two different cells, and its strength must not be less than zero.',
      'unknown-cell': 'A cell that is not in the circuit is referred to. Check the number of cells and the connections.',
      timing: 'The stimulus onset and duration cannot be less than zero.',
      weight: 'The strength of a connection is not a valid number. Choose the strength again.',
      other: 'The calculation could not be completed with these settings. Check the cells, the connections and the stimulus, then try again.',
    },
    cellLabel: (id: string) => `Cell ${id}`,
    cellDescription: 'A cell of the toy circuit the user built; it does not represent a real cell.',
    gapNote: 'Symmetric electrical (gap) connection; the same gain in both directions.',
    inhibitoryNote: 'Inhibitory chemical connection; the model weight is negative.',
    excitatoryNote: 'Excitatory chemical connection; the model weight is positive.',
    circuitName: 'Built toy circuit',
    provenance: 'A toy circuit built by the user for learning. It is not a real circuit, a measurement or a prediction.',
    highestPeak: (id: string, peak: string) => `The highest peak is in cell ${id}: ${peak}.`,
    silent: (ids: string, many: boolean) => `${many ? 'Cells' : 'Cell'} ${ids} did not respond at all: the peak stayed at 0. There may be no excitatory path carrying activity to ${many ? 'them' : 'it'}, or inhibition may have held the activity at 0.`,
    lasting: (end: string, duration: string, ids: string, many: boolean, level: string, loop: boolean) =>
      `The stimulus ended at ${end} ms; at ${duration} ms the activity of ${many ? 'cells' : 'cell'} ${ids} is still at or above the ${level} level. ${loop ? 'The circuit has an excitatory feedback loop; it may be sustaining the activity.' : 'The circuit has no excitatory feedback loop; the remaining activity comes from the delay with which the cells follow one another in turn.'}`,
    faded: (end: string, duration: string, level: string) => `The stimulus ended at ${end} ms; at ${duration} ms the activity of all cells has fallen below the ${level} level.`,
  },
})

/** Reporting level shared with the guided lessons; not a biological threshold. */
export const REPORT_LEVEL = 0.1
const SETTLE_MS = 5 * defaultConfig.tauMs

export type ProblemCode =
  | 'cell-count' | 'too-many-links' | 'unknown-cell' | 'self-gap' | 'duplicate-chemical' | 'duplicate-gap'
  | 'strength' | 'stimulus-target' | 'amplitude' | 'onset' | 'pulse' | 'engine'
/**
 * `message` is the learner's sentence in the interface language. On problems made by this module it is built
 * each time it is read, so a problem list kept in page state follows a later language change.
 */
export interface BuilderProblem { code: ProblemCode; message: string; linkId?: string }
const problemOf = (code: ProblemCode, message: () => string, linkId?: string): BuilderProblem =>
  linkId === undefined ? { code, get message() { return message() } } : { code, get message() { return message() }, linkId }

export interface CellSummary {
  id: CellId
  /** Highest recorded activity of this run. */
  peak: number
  /** Earliest sample attaining a positive peak; null for an all-zero trace. */
  peakTimeMs: number | null
  /** First sample at or above the reporting level (a reporting convention, not a threshold of the cell); null if never. */
  reachMs: number | null
  /** Activity at the last recorded sample, not a steady-state estimate. */
  finalValue: number
}
export interface BuilderRun {
  draft: BuilderDraft
  result: SimulationResult
  cells: CellSummary[]
  /** The sentences in the language of the moment of the run. A page renders `runFacts(run)` instead, which follows the language. */
  facts: string[]
}
export type RunOutcome = { ok: true; run: BuilderRun } | { ok: false; problems: BuilderProblem[] }

export const cellIds = (cellCount: number): CellId[] => CELL_IDS.slice(0, cellCount)
export const strengthLimits = (type: LinkType) => type === 'gap' ? LIMITS.gap : LIMITS.chemical
export const linkLabel = (link: Pick<BuilderLink, 'source' | 'target' | 'type'>): string =>
  link.type === 'gap' ? pick(text).linkGap([link.source, link.target].sort().join(' ↔ ')) : pick(text).linkChemical(link.source, link.target, link.type === 'excitatory')

export const blankDraft = (): BuilderDraft => ({
  cellCount: 3,
  links: [],
  stimulus: { target: 'A', amplitude: 0.8, onsetMs: 100, durationMs: 200 },
})

/** Content-only fingerprint (link ids ignored): equal keys mean equal circuits and equal runs. */
export const draftKey = (draft: BuilderDraft): string => JSON.stringify([
  draft.cellCount, draft.stimulus.target, draft.stimulus.amplitude, draft.stimulus.onsetMs, draft.stimulus.durationMs,
  draft.links.map(link => [link.source, link.target, link.type, link.strength]),
])

/** Plain copy that also accepts a Vue reactive draft (structuredClone throws on proxies). */
export const cloneDraft = (draft: BuilderDraft): BuilderDraft => ({
  cellCount: draft.cellCount,
  links: draft.links.map(link => ({ ...link })),
  stimulus: { ...draft.stimulus },
})

const inRange = (value: number, limits: { min: number; max: number }): boolean => Number.isFinite(value) && value >= limits.min && value <= limits.max
/** Both ends of a range as number text in the interface language. */
const bounds = (limits: { min: number; max: number }): [string, string] => [decimal(limits.min, limits.min % 1 === 0 ? 0 : 2), decimal(limits.max, limits.max % 1 === 0 ? 0 : 2)]

/** Every reason the circuit cannot be run, in the interface language and in reading order. An empty list means Run is allowed. */
export function validateDraft(draft: BuilderDraft): BuilderProblem[] {
  const problems: BuilderProblem[] = []
  const add = (code: ProblemCode, message: () => string, linkId?: string) => problems.push(problemOf(code, message, linkId))
  if (!Number.isInteger(draft.cellCount) || !inRange(draft.cellCount, LIMITS.cells)) {
    add('cell-count', () => pick(text).cellCount(LIMITS.cells.min, LIMITS.cells.max))
    return problems
  }
  const cells = new Set<string>(cellIds(draft.cellCount))
  if (draft.links.length > LIMITS.links.max) add('too-many-links', () => pick(text).tooManyLinks(LIMITS.links.max))
  const chemicalAt = new Map<string, number>()
  const gapAt = new Map<string, number>()
  draft.links.forEach((link, index) => {
    const n = index + 1
    if (!cells.has(link.source) || !cells.has(link.target)) {
      add('unknown-cell', () => pick(text).unknownCell(n), link.id)
      return
    }
    if (!inRange(link.strength, strengthLimits(link.type))) {
      const limits = strengthLimits(link.type)
      add('strength', () => pick(text).strength(n, ...bounds(limits)), link.id)
    }
    if (link.type === 'gap') {
      if (link.source === link.target) {
        add('self-gap', () => pick(text).selfGap(n), link.id)
        return
      }
      const pair = [link.source, link.target].sort().join(' ↔ ')
      const first = gapAt.get(pair)
      if (first !== undefined) add('duplicate-gap', () => pick(text).duplicateGap(n, pair, first), link.id)
      else gapAt.set(pair, n)
      return
    }
    const pair = `${link.source}→${link.target}`
    const first = chemicalAt.get(pair)
    if (first !== undefined) add('duplicate-chemical', () => pick(text).duplicateChemical(n, pair, first), link.id)
    else chemicalAt.set(pair, n)
  })
  const { stimulus } = draft
  if (!cells.has(stimulus.target)) add('stimulus-target', () => pick(text).stimulusTarget)
  if (!inRange(stimulus.amplitude, LIMITS.amplitude)) add('amplitude', () => pick(text).amplitude(...bounds(LIMITS.amplitude)))
  if (!inRange(stimulus.onsetMs, LIMITS.onsetMs)) add('onset', () => pick(text).onset(...bounds(LIMITS.onsetMs)))
  if (!inRange(stimulus.durationMs, LIMITS.pulseMs)) add('pulse', () => pick(text).pulse(...bounds(LIMITS.pulseMs)))
  return problems
}

/**
 * Turns the UI model into the engine's circuit. Gaps become one canonical source < target record, weights are signed. Call after validateDraft.
 * Its labels and notes are in the language of the moment of the call; the builder page shows none of them.
 */
export function buildEngineCircuit(draft: BuilderDraft): Circuit {
  const t = pick(text)
  const ids = cellIds(draft.cellCount)
  const neurons: Neuron[] = ids.map((id, index) => {
    const angle = (2 * Math.PI * index) / ids.length
    return {
      id, label: t.cellLabel(id), role: 'unspecified',
      description: t.cellDescription,
      position: { x: Math.round(200 + 150 * Math.cos(angle)), y: Math.round(200 + 150 * Math.sin(angle)) },
    }
  })
  const connections: Connection[] = draft.links.map((link, index) => {
    const base = { id: `L${index + 1}`, evidence: 'illustrative' as const }
    if (link.type === 'gap') {
      const [source, target] = [link.source, link.target].sort() as [CellId, CellId]
      return { ...base, source, target, weight: link.strength, kind: 'gap' as const, note: t.gapNote }
    }
    return {
      ...base, source: link.source, target: link.target, kind: 'chemical' as const,
      weight: link.type === 'inhibitory' ? -link.strength : link.strength,
      note: link.type === 'inhibitory' ? t.inhibitoryNote : t.excitatoryNote,
    }
  })
  return {
    id: 'user-built', name: t.circuitName,
    provenance: t.provenance,
    neurons, connections,
  }
}

export function buildEngineConfig(draft: BuilderDraft): SimulationConfig {
  const { durationMs, dtMs, tauMs } = defaultConfig
  return { durationMs, dtMs, tauMs, stimulus: { ...draft.stimulus } }
}

/** What the engine rejected, read off its English developer message. A code, so the sentence can be written in either language later. */
export type EngineErrorKind = 'unstable' | 'overflow' | 'gap-once' | 'gap-invalid' | 'unknown-cell' | 'amplitude' | 'timing' | 'weight' | 'other'
export function engineErrorKind(error: unknown): EngineErrorKind {
  const raw = error instanceof Error ? error.message : ''
  if (/dtMs must not exceed/.test(raw)) return 'unstable'
  if (/overflowed/.test(raw)) return 'overflow'
  if (/stored only once/.test(raw)) return 'gap-once'
  if (/Physical gap/.test(raw)) return 'gap-invalid'
  if (/unknown (neuron|connection)|Stimulus target/.test(raw)) return 'unknown-cell'
  if (/amplitude/.test(raw)) return 'amplitude'
  if (/onset|duration|Stimulus/.test(raw)) return 'timing'
  if (/Weight|Raw weight|conductance/.test(raw)) return 'weight'
  return 'other'
}
/** The learner's sentence for an engine rejection, in the interface language. */
export const engineErrorText = (kind: EngineErrorKind): string =>
  kind === 'amplitude' ? pick(text).amplitude(...bounds(LIMITS.amplitude)) : pick(text).engine[kind]

/** Engine errors are English developer messages; the learner only ever sees one of these sentences. */
export function explainEngineError(error: unknown): string {
  return engineErrorText(engineErrorKind(error))
}

/** True when the uyarıcı kimyasal links contain a directed cycle (a self-link counts): only then can activity feed itself. */
export function hasExcitatoryLoop(links: readonly BuilderLink[]): boolean {
  const next = new Map<string, string[]>()
  for (const link of links) if (link.type === 'excitatory') next.set(link.source, [...(next.get(link.source) ?? []), link.target])
  const done = new Set<string>()
  const visit = (id: string, path: Set<string>): boolean => {
    if (path.has(id)) return true
    if (done.has(id)) return false
    path.add(id)
    const found = (next.get(id) ?? []).some(target => visit(target, path))
    path.delete(id)
    done.add(id)
    return found
  }
  return [...next.keys()].some(id => visit(id, new Set()))
}

const joinIds = (ids: readonly string[]): string => ids.length < 2 ? (ids[0] ?? '') : `${ids.slice(0, -1).join(', ')} ${pick(text).and} ${ids.at(-1)}`

export function summarizeCells(draft: BuilderDraft, result: SimulationResult): CellSummary[] {
  return cellIds(draft.cellCount).map(id => {
    const trace = result.activity[id]!
    let peak = 0
    let peakIndex: number | null = null
    trace.forEach((value, index) => { if (value > peak) { peak = value; peakIndex = index } })
    const reachIndex = trace.findIndex(value => value >= REPORT_LEVEL)
    return { id, peak, peakTimeMs: peakIndex === null ? null : result.timesMs[peakIndex]!, reachMs: reachIndex < 0 ? null : result.timesMs[reachIndex]!, finalValue: trace.at(-1)! }
  })
}

/** Plain facts read off the computed traces, in the interface language; they describe the model output only. */
export function describeRun(draft: BuilderDraft, cells: readonly CellSummary[], durationMs: number): string[] {
  const t = pick(text)
  const facts: string[] = []
  const best = cells.reduce((top, cell) => cell.peak > top.peak ? cell : top, cells[0]!)
  if (best.peak > 0) facts.push(t.highestPeak(best.id, decimal(best.peak, 3)))
  const silent = cells.filter(cell => cell.peak === 0).map(cell => cell.id)
  if (silent.length) facts.push(t.silent(joinIds(silent), silent.length > 1))
  const end = draft.stimulus.onsetMs + draft.stimulus.durationMs
  if (best.peak > 0 && end + SETTLE_MS <= durationMs) {
    const lasting = cells.filter(cell => cell.finalValue >= REPORT_LEVEL).map(cell => cell.id)
    facts.push(lasting.length
      ? t.lasting(decimal(end, 0), decimal(durationMs, 0), joinIds(lasting), lasting.length > 1, decimal(REPORT_LEVEL, 2), hasExcitatoryLoop(draft.links))
      : t.faded(decimal(end, 0), decimal(durationMs, 0), decimal(REPORT_LEVEL, 2)))
  }
  return facts
}

/** The facts of a recorded run, written again in the current interface language. Call it while rendering. */
export const runFacts = (run: BuilderRun): string[] => describeRun(run.draft, run.cells, run.result.settings.durationMs)

/** Validates, runs the existing engine and summarizes. Never throws: every failure is a problem list in the interface language. */
export function runDraft(draft: BuilderDraft, engine: typeof simulate = simulate): RunOutcome {
  const problems = validateDraft(draft)
  if (problems.length) return { ok: false, problems }
  const recorded = cloneDraft(draft)
  try {
    const config = buildEngineConfig(recorded)
    const result = engine(buildEngineCircuit(recorded), config)
    const cells = summarizeCells(recorded, result)
    return { ok: true, run: { draft: recorded, result, cells, facts: describeRun(recorded, cells, config.durationMs) } }
  } catch (error) {
    const kind = engineErrorKind(error)
    return { ok: false, problems: [problemOf('engine', () => engineErrorText(kind))] }
  }
}

export interface BuilderPreset {
  id: 'chain' | 'excitation-inhibition' | 'mutual-inhibition' | 'loop'
  title: string
  /** One sentence: the single thing this example teaches. */
  teaches: string
  /** What to look for in the traces. */
  look: string
  /** One change to try and what it shows. */
  tryThis: string
  /** Honest limit of the example. */
  boundary: string
  draft: BuilderDraft
}

const link = (id: string, source: CellId, target: CellId, type: LinkType, strength: number): BuilderLink => ({ id, source, target, type, strength })
const pulse = (target: CellId = 'A'): BuilderStimulus => ({ target, amplitude: 0.8, onsetMs: 100, durationMs: 200 })

type PresetId = BuilderPreset['id']
const PRESET_IDS: readonly PresetId[] = ['chain', 'excitation-inhibition', 'mutual-inhibition', 'loop']
/** The circuits of the examples. They exist once; the Turkish and the English list share them. */
const presetDrafts: Record<PresetId, BuilderDraft> = {
  chain: { cellCount: 3, links: [link('p1', 'A', 'B', 'excitatory', 0.9), link('p2', 'B', 'C', 'excitatory', 0.9)], stimulus: pulse() },
  'excitation-inhibition': { cellCount: 3, links: [link('p1', 'A', 'B', 'excitatory', 0.9), link('p2', 'A', 'C', 'excitatory', 0.9), link('p3', 'B', 'C', 'inhibitory', 0.6)], stimulus: pulse() },
  'mutual-inhibition': { cellCount: 3, links: [link('p1', 'A', 'B', 'excitatory', 0.9), link('p2', 'A', 'C', 'excitatory', 0.8), link('p3', 'B', 'C', 'inhibitory', 1.5), link('p4', 'C', 'B', 'inhibitory', 1.5)], stimulus: pulse() },
  loop: { cellCount: 3, links: [link('p1', 'A', 'B', 'excitatory', 1), link('p2', 'B', 'C', 'excitatory', 1), link('p3', 'C', 'A', 'excitatory', 1)], stimulus: pulse() },
}
const presetList = (texts: Record<PresetId, Omit<BuilderPreset, 'id' | 'draft'>>): readonly BuilderPreset[] =>
  PRESET_IDS.map(id => ({ id, ...texts[id], draft: presetDrafts[id] }))

export const presets: readonly BuilderPreset[] = presetList({
  chain: {
    title: 'İleri beslemeli zincir',
    teaches: 'Etkinlik tek yönlü bir zincirde sırayla ilerler; her adımda biraz gecikir ve zayıflar.',
    look: 'Tablodaki “0,10’a ulaşma” sütununa ve tepe değerlerine bak: A’dan C’ye doğru yanıt daha geç başlar ve tepe değeri küçülür.',
    tryThis: 'A→B gücünü 0,9’dan 0,5’e indir ve yeniden çalıştır: B ve C daha düşük kalır.',
    boundary: 'Gecikme burada hücrelerin tepki hızından (τ = 30 model ms) gelir; gerçek bir sinyal iletim süresi değildir.',
  },
  'excitation-inhibition': {
    title: 'Uyarma ve baskılama',
    teaches: 'Aynı hedefe gelen uyarıcı ve baskılayıcı girdiler birbirini götürür; hedef, ikisinin farkını izler.',
    look: 'C hücresine hem A’dan uyarıcı hem B’den baskılayıcı girdi gelir. C önce yükselir, B’nin baskısı gelince geriler.',
    tryThis: 'B→C baskılayıcı bağlantısını kaldır ve yeniden çalıştır: C’nin tepesi belirgin biçimde yükselir.',
    boundary: 'Baskılama burada negatif bir model ağırlığıdır; gerçek bir sinapsın işareti nörotransmitterden tek başına çıkarılamaz.',
  },
  'mutual-inhibition': {
    title: 'Karşılıklı baskılama',
    teaches: 'İki hücre birbirini güçlü biçimde bastırınca biraz daha güçlü girdi alan kazanır, diğeri susar.',
    look: 'B ve C aynı A hücresinden uyarılır; A→B biraz daha güçlüdür. B yüksek kalır, C ise erken bir yükselişten sonra bastırılır.',
    tryThis: 'A→C gücünü 0,95’e çıkar ve yeniden çalıştır: kazanan C olur.',
    boundary: 'Kazanan, bu modelin yuvarlak ağırlıklarının sonucudur. Gerçek devrelerde karar verme veya davranış seçimi bu basit modelden çıkarılmaz.',
  },
  loop: {
    title: 'Kendini sürdüren döngü',
    teaches: 'Geri besleme döngüsünde kimyasal ağırlık 1’e ulaşınca etkinlik uyaran bittikten sonra da sönmez.',
    look: 'Uyaran 300 ms’de biter, ama A, B ve C eğrileri kaydın sonuna kadar neredeyse hiç düşmeden yüksekte kalır. Bu modelde her hücreye gelen kimyasal ağırlık toplamı tam 1’dir; 1 bir eşiktir.',
    tryThis: 'Üç bağlantının gücünü 0,8’e indir: etkinlik söner. 1,2’ye çıkar: etkinlik büyüyüp üst sınıra (1) dayanır.',
    boundary: 'Çarpan 1’in altındayken etkinlik uyaran bitince söner; 1’in üstünde yönlü kimyasal döngüler etkinliği kendi kendine besler. Bu yalnız kaydedilen 700 model ms için geçerlidir. Biyolojik bir bulgu değil, seçilen modelin ve normalizasyonun sonucudur.',
  },
})

export const presetsEn: typeof presets = presetList({
  chain: {
    title: 'Feedforward chain',
    teaches: 'Activity moves along a one-way chain in order; at every step it is a little later and a little weaker.',
    look: 'Look at the “Reaching 0.10” column of the table and at the peak values: from A to C the response starts later and the peak value gets smaller.',
    tryThis: 'Lower the A→B strength from 0.9 to 0.5 and run again: B and C stay lower.',
    boundary: 'The delay here comes from how fast the cells respond (τ = 30 model ms); it is not a real signal conduction time.',
  },
  'excitation-inhibition': {
    title: 'Excitation and inhibition',
    teaches: 'Excitatory and inhibitory inputs arriving at the same target cancel each other; the target follows the difference between the two.',
    look: 'Cell C receives both excitatory input from A and inhibitory input from B. C rises first, then falls back when the inhibition from B arrives.',
    tryThis: 'Remove the inhibitory B→C connection and run again: the peak of C rises clearly.',
    boundary: 'Inhibition here is a negative model weight; the sign of a real synapse cannot be inferred from the neurotransmitter alone.',
  },
  'mutual-inhibition': {
    title: 'Mutual inhibition',
    teaches: 'When two cells inhibit each other strongly, the one that receives slightly stronger input wins and the other falls silent.',
    look: 'B and C are excited by the same cell A; A→B is slightly stronger. B stays high, while C is suppressed after an early rise.',
    tryThis: 'Raise the A→C strength to 0.95 and run again: C becomes the winner.',
    boundary: 'The winner is a result of the round weights of this model. Decision making or behavior selection in real circuits cannot be inferred from this simple model.',
  },
  loop: {
    title: 'Self-sustaining loop',
    teaches: 'When the chemical weight in a feedback loop reaches 1, the activity does not die out even after the stimulus has ended.',
    look: 'The stimulus ends at 300 ms, but the A, B and C traces stay high until the end of the record, hardly falling at all. In this model the chemical weights arriving at each cell sum to exactly 1; 1 is a threshold.',
    tryThis: 'Lower the strength of the three connections to 0.8: the activity dies out. Raise it to 1.2: the activity grows until it meets the upper bound (1).',
    boundary: 'While the gain is below 1, the activity dies out once the stimulus ends; above 1, directed chemical loops feed the activity by themselves. This holds only for the recorded 700 model ms. It is not a biological finding; it is a result of the chosen model and normalization.',
  },
})

/** The example in the interface language. Its `draft` is the same object in both languages. */
export const presetById = (id: BuilderPreset['id']): BuilderPreset => L(presets, presetsEn).find(preset => preset.id === id)!
