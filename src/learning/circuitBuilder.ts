import { decimal } from '../format'
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

/** Reporting level shared with the guided lessons; not a biological threshold. */
export const REPORT_LEVEL = 0.1
const SETTLE_MS = 5 * defaultConfig.tauMs

export type ProblemCode =
  | 'cell-count' | 'too-many-links' | 'unknown-cell' | 'self-gap' | 'duplicate-chemical' | 'duplicate-gap'
  | 'strength' | 'stimulus-target' | 'amplitude' | 'onset' | 'pulse' | 'engine'
export interface BuilderProblem { code: ProblemCode; message: string; linkId?: string }

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
  facts: string[]
}
export type RunOutcome = { ok: true; run: BuilderRun } | { ok: false; problems: BuilderProblem[] }

export const cellIds = (cellCount: number): CellId[] => CELL_IDS.slice(0, cellCount)
export const strengthLimits = (type: LinkType) => type === 'gap' ? LIMITS.gap : LIMITS.chemical
export const linkLabel = (link: Pick<BuilderLink, 'source' | 'target' | 'type'>): string =>
  link.type === 'gap' ? `${[link.source, link.target].sort().join(' ↔ ')} elektriksel` : `${link.source} → ${link.target} ${link.type === 'excitatory' ? 'uyarıcı' : 'baskılayıcı'}`

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
const range = (limits: { min: number; max: number }): string => `${decimal(limits.min, limits.min % 1 === 0 ? 0 : 2)}–${decimal(limits.max, limits.max % 1 === 0 ? 0 : 2)}`

/** Every reason the circuit cannot be run, in Turkish and in reading order. An empty list means Run is allowed. */
export function validateDraft(draft: BuilderDraft): BuilderProblem[] {
  const problems: BuilderProblem[] = []
  const add = (code: ProblemCode, message: string, linkId?: string) => problems.push(linkId === undefined ? { code, message } : { code, message, linkId })
  if (!Number.isInteger(draft.cellCount) || !inRange(draft.cellCount, LIMITS.cells)) {
    add('cell-count', `Hücre sayısı ${LIMITS.cells.min}–${LIMITS.cells.max} arasında olmalı.`)
    return problems
  }
  const cells = new Set<string>(cellIds(draft.cellCount))
  if (draft.links.length > LIMITS.links.max) add('too-many-links', `En fazla ${LIMITS.links.max} bağlantı ekleyebilirsin. Birkaç bağlantıyı kaldır.`)
  const chemicalAt = new Map<string, number>()
  const gapAt = new Map<string, number>()
  draft.links.forEach((link, index) => {
    const n = index + 1
    if (!cells.has(link.source) || !cells.has(link.target)) {
      add('unknown-cell', `Bağlantı ${n}: devrede olmayan bir hücreye bağlı. Kaynak ve hedef hücreyi yeniden seç.`, link.id)
      return
    }
    if (!inRange(link.strength, strengthLimits(link.type))) {
      add('strength', `Bağlantı ${n}: güç ${range(strengthLimits(link.type))} aralığında olmalı.`, link.id)
    }
    if (link.type === 'gap') {
      if (link.source === link.target) {
        add('self-gap', `Bağlantı ${n}: elektriksel (gap) bağlantı iki farklı hücre arasında kurulur. Kaynak ve hedef için farklı hücreler seç.`, link.id)
        return
      }
      const pair = [link.source, link.target].sort().join(' ↔ ')
      const first = gapAt.get(pair)
      if (first !== undefined) add('duplicate-gap', `Bağlantı ${n}: ${pair} arasında elektriksel bağlantı zaten var (Bağlantı ${first}). Gap iki yöne birden işler; tek bağlantı yeter.`, link.id)
      else gapAt.set(pair, n)
      return
    }
    const pair = `${link.source}→${link.target}`
    const first = chemicalAt.get(pair)
    if (first !== undefined) add('duplicate-chemical', `Bağlantı ${n}: ${pair} için kimyasal bağlantı zaten var (Bağlantı ${first}). Bir hücre çifti için tek kimyasal bağlantı kur; türünü veya gücünü değiştir.`, link.id)
    else chemicalAt.set(pair, n)
  })
  const { stimulus } = draft
  if (!cells.has(stimulus.target)) add('stimulus-target', 'Uyarılan hücre devrede yok. Devredeki hücrelerden birini seç.')
  if (!inRange(stimulus.amplitude, LIMITS.amplitude)) add('amplitude', `Uyaran genliği ${range(LIMITS.amplitude)} arasında olmalı.`)
  if (!inRange(stimulus.onsetMs, LIMITS.onsetMs)) add('onset', `Uyaranın başlangıcı ${range(LIMITS.onsetMs)} ms arasında olmalı.`)
  if (!inRange(stimulus.durationMs, LIMITS.pulseMs)) add('pulse', `Uyaran süresi ${range(LIMITS.pulseMs)} ms arasında olmalı.`)
  return problems
}

/** Turns the UI model into the engine's circuit. Gaps become one canonical source < target record, weights are signed. Call after validateDraft. */
export function buildEngineCircuit(draft: BuilderDraft): Circuit {
  const ids = cellIds(draft.cellCount)
  const neurons: Neuron[] = ids.map((id, index) => {
    const angle = (2 * Math.PI * index) / ids.length
    return {
      id, label: `Hücre ${id}`, role: 'unspecified',
      description: 'Kullanıcının kurduğu oyuncak devrenin hücresi; gerçek bir hücreyi temsil etmez.',
      position: { x: Math.round(200 + 150 * Math.cos(angle)), y: Math.round(200 + 150 * Math.sin(angle)) },
    }
  })
  const connections: Connection[] = draft.links.map((link, index) => {
    const base = { id: `L${index + 1}`, evidence: 'illustrative' as const }
    if (link.type === 'gap') {
      const [source, target] = [link.source, link.target].sort() as [CellId, CellId]
      return { ...base, source, target, weight: link.strength, kind: 'gap' as const, note: 'Simetrik elektriksel (gap) bağlantı; iki yönde aynı katsayı.' }
    }
    return {
      ...base, source: link.source, target: link.target, kind: 'chemical' as const,
      weight: link.type === 'inhibitory' ? -link.strength : link.strength,
      note: link.type === 'inhibitory' ? 'Baskılayıcı kimyasal bağlantı; model ağırlığı negatif.' : 'Uyarıcı kimyasal bağlantı; model ağırlığı pozitif.',
    }
  })
  return {
    id: 'user-built', name: 'Kurulan oyuncak devre',
    provenance: 'Öğrenme amacıyla kullanıcı tarafından kurulmuş oyuncak devre. Gerçek bir devre, ölçüm veya öngörü değildir.',
    neurons, connections,
  }
}

export function buildEngineConfig(draft: BuilderDraft): SimulationConfig {
  const { durationMs, dtMs, tauMs } = defaultConfig
  return { durationMs, dtMs, tauMs, stimulus: { ...draft.stimulus } }
}

/** Engine errors are English developer messages; the learner only ever sees one of these sentences. */
export function explainEngineError(error: unknown): string {
  const text = error instanceof Error ? error.message : ''
  if (/dtMs must not exceed/.test(text)) return 'Elektriksel bağlantıların toplam gücü bu zaman adımı için çok büyük; hesap kararlı kalamaz. Gap güçlerini azalt.'
  if (/overflowed/.test(text)) return 'Bağlantı güçleri çok büyük; hesap taştı. Güçleri azalt.'
  if (/stored only once/.test(text)) return 'İki hücre arasında yalnız bir elektriksel bağlantı olabilir.'
  if (/Physical gap/.test(text)) return 'Elektriksel bağlantı iki farklı hücre arasında kurulmalı ve gücü sıfırdan küçük olmamalı.'
  if (/unknown (neuron|connection)|Stimulus target/.test(text)) return 'Devrede olmayan bir hücreye başvuruluyor. Hücre sayısını ve bağlantıları kontrol et.'
  if (/amplitude/.test(text)) return `Uyaran genliği ${range(LIMITS.amplitude)} arasında olmalı.`
  if (/onset|duration|Stimulus/.test(text)) return 'Uyaranın başlangıcı ve süresi sıfırdan küçük olamaz.'
  if (/Weight|Raw weight|conductance/.test(text)) return 'Bir bağlantının gücü geçerli bir sayı değil. Gücü yeniden seç.'
  return 'Bu ayarlarla hesap tamamlanamadı. Hücreleri, bağlantıları ve uyaranı kontrol edip yeniden dene.'
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

const joinIds = (ids: readonly string[]): string => ids.length < 2 ? (ids[0] ?? '') : `${ids.slice(0, -1).join(', ')} ve ${ids.at(-1)}`

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

/** Plain facts read off the computed traces; they describe the model output only. */
export function describeRun(draft: BuilderDraft, cells: readonly CellSummary[], durationMs: number): string[] {
  const facts: string[] = []
  const best = cells.reduce((top, cell) => cell.peak > top.peak ? cell : top, cells[0]!)
  if (best.peak > 0) facts.push(`En yüksek tepe ${best.id} hücresinde: ${decimal(best.peak, 3)}.`)
  const silent = cells.filter(cell => cell.peak === 0).map(cell => cell.id)
  if (silent.length) facts.push(`${joinIds(silent)} hücre${silent.length > 1 ? 'leri' : 'si'} hiç yanıt vermedi: tepe 0 kaldı. Ona etkinlik taşıyan bir uyarıcı yol olmayabilir ya da baskılama etkinliği 0’da tutmuş olabilir.`)
  const end = draft.stimulus.onsetMs + draft.stimulus.durationMs
  if (best.peak > 0 && end + SETTLE_MS <= durationMs) {
    const lasting = cells.filter(cell => cell.finalValue >= REPORT_LEVEL).map(cell => cell.id)
    facts.push(lasting.length
      ? `Uyaran ${decimal(end, 0)} ms’de bitti; ${decimal(durationMs, 0)} ms’de ${joinIds(lasting)} hücre${lasting.length > 1 ? 'lerinin' : 'sinin'} aktivitesi hâlâ ${decimal(REPORT_LEVEL, 2)} düzeyinde ya da üstünde. ${hasExcitatoryLoop(draft.links) ? 'Devrede uyarıcı bir geri besleme döngüsü var; etkinliği sürdürüyor olabilir.' : 'Devrede uyarıcı bir geri besleme döngüsü yok; kalan etkinlik, hücrelerin birbirini sırayla izlemesindeki gecikmeden gelir.'}`
      : `Uyaran ${decimal(end, 0)} ms’de bitti; ${decimal(durationMs, 0)} ms’de bütün hücrelerin aktivitesi ${decimal(REPORT_LEVEL, 2)} düzeyinin altına indi.`)
  }
  return facts
}

/** Validates, runs the existing engine and summarizes. Never throws: every failure is a Turkish problem list. */
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
    return { ok: false, problems: [{ code: 'engine', message: explainEngineError(error) }] }
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

export const presets: readonly BuilderPreset[] = [
  {
    id: 'chain', title: 'İleri beslemeli zincir',
    teaches: 'Etkinlik tek yönlü bir zincirde sırayla ilerler; her adımda biraz gecikir ve zayıflar.',
    look: 'Tablodaki “0,10’a ulaşma” sütununa ve tepe değerlerine bak: A’dan C’ye doğru yanıt daha geç başlar ve tepe değeri küçülür.',
    tryThis: 'A→B gücünü 0,9’dan 0,5’e indir ve yeniden çalıştır: B ve C daha düşük kalır.',
    boundary: 'Gecikme burada hücrelerin tepki hızından (τ = 30 model ms) gelir; gerçek bir sinyal iletim süresi değildir.',
    draft: { cellCount: 3, links: [link('p1', 'A', 'B', 'excitatory', 0.9), link('p2', 'B', 'C', 'excitatory', 0.9)], stimulus: pulse() },
  },
  {
    id: 'excitation-inhibition', title: 'Uyarma ve baskılama',
    teaches: 'Aynı hedefe gelen uyarıcı ve baskılayıcı girdiler birbirini götürür; hedef, ikisinin farkını izler.',
    look: 'C hücresine hem A’dan uyarıcı hem B’den baskılayıcı girdi gelir. C önce yükselir, B’nin baskısı gelince geriler.',
    tryThis: 'B→C baskılayıcı bağlantısını kaldır ve yeniden çalıştır: C’nin tepesi belirgin biçimde yükselir.',
    boundary: 'Baskılama burada negatif bir model ağırlığıdır; gerçek bir sinapsın işareti nörotransmitterden tek başına çıkarılamaz.',
    draft: { cellCount: 3, links: [link('p1', 'A', 'B', 'excitatory', 0.9), link('p2', 'A', 'C', 'excitatory', 0.9), link('p3', 'B', 'C', 'inhibitory', 0.6)], stimulus: pulse() },
  },
  {
    id: 'mutual-inhibition', title: 'Karşılıklı baskılama',
    teaches: 'İki hücre birbirini güçlü biçimde bastırınca biraz daha güçlü girdi alan kazanır, diğeri susar.',
    look: 'B ve C aynı A hücresinden uyarılır; A→B biraz daha güçlüdür. B yüksek kalır, C ise erken bir yükselişten sonra bastırılır.',
    tryThis: 'A→C gücünü 0,95’e çıkar ve yeniden çalıştır: kazanan C olur.',
    boundary: 'Kazanan, bu modelin yuvarlak ağırlıklarının sonucudur. Gerçek devrelerde karar verme veya davranış seçimi bu basit modelden çıkarılmaz.',
    draft: { cellCount: 3, links: [link('p1', 'A', 'B', 'excitatory', 0.9), link('p2', 'A', 'C', 'excitatory', 0.8), link('p3', 'B', 'C', 'inhibitory', 1.5), link('p4', 'C', 'B', 'inhibitory', 1.5)], stimulus: pulse() },
  },
  {
    id: 'loop', title: 'Kendini sürdüren döngü',
    teaches: 'Geri besleme döngüsünde kimyasal ağırlık 1’e ulaşınca etkinlik uyaran bittikten sonra da sönmez.',
    look: 'Uyaran 300 ms’de biter, ama A, B ve C eğrileri kaydın sonuna kadar neredeyse hiç düşmeden yüksekte kalır. Bu modelde her hücreye gelen kimyasal ağırlık toplamı tam 1’dir; 1 bir eşiktir.',
    tryThis: 'Üç bağlantının gücünü 0,8’e indir: etkinlik söner. 1,2’ye çıkar: etkinlik büyüyüp üst sınıra (1) dayanır.',
    boundary: 'Çarpan 1’in altındayken etkinlik uyaran bitince söner; 1’in üstünde yönlü kimyasal döngüler etkinliği kendi kendine besler. Bu yalnız kaydedilen 700 model ms için geçerlidir. Biyolojik bir bulgu değil, seçilen modelin ve normalizasyonun sonucudur.',
    draft: { cellCount: 3, links: [link('p1', 'A', 'B', 'excitatory', 1), link('p2', 'B', 'C', 'excitatory', 1), link('p3', 'C', 'A', 'excitatory', 1)], stimulus: pulse() },
  },
]

export const presetById = (id: BuilderPreset['id']): BuilderPreset => presets.find(preset => preset.id === id)!
