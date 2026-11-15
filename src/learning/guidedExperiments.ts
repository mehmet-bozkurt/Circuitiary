import { decimal } from '../format'
import { locale } from '../i18n'
import { defaultConfig, illustrativeCircuit, illustrativeCircuitEn } from '../model/circuit'
import { simulate } from '../model/simulation'
import type { Circuit, DeepReadonly, SimulationConfig, SimulationResult } from '../model/types'

export type GuidedExperimentId = 'stimulus' | 'connection' | 'tau'
export type GuidedConnectionId = 'I3-O1' | 'I4-O1'

export interface GuidedRunOptions {
  connectionId?: GuidedConnectionId
  comparisonTauMs?: number
}

/** A reporting level chosen for this lesson, not a biological firing threshold. */
export const GUIDED_REPORTING_LEVEL = 0.1

export interface GuidedOutputMetrics {
  outputId: 'O1'
  /** Dimensionless activity, never a voltage, calcium measurement or spike count. */
  peak: number
  /** Earliest sample attaining a positive maximum; null for an all-zero output. */
  peakTimeMs: number | null
  peakDelayMs: number | null
  reportingLevel: number
  /** First recorded sample at or above reportingLevel; no interpolation. */
  responseTimeMs: number | null
  /** responseTimeMs minus pulse onset; null if the level is never reached. */
  responseDelayMs: number | null
}

export interface GuidedCondition {
  /** Turkish text fixed when the run was recorded; show `guidedConditionLabel()` instead. */
  label: string
  result: SimulationResult
  metrics: GuidedOutputMetrics
}

export interface GuidedControlledVariable {
  kind: 'stimulus-amplitude' | 'connection-effect' | 'time-constant'
  targetId: string
  /** Turkish text fixed when the run was recorded; show `guidedVariableLabel()` instead. */
  label: string
  baselineValue: number
  comparisonValue: number
  unit: 'dimensionless' | 'ms'
  configPath: 'stimulus.amplitude' | 'silencedConnectionId' | 'tauOverrides.O1'
}

interface GuidedRunRecord {
  experimentId: GuidedExperimentId
  /** Supplied by the UI when an explicit run succeeds; no fabricated timestamp. */
  runNumber: number
  circuit: Circuit
  controlledVariable: GuidedControlledVariable
  /** Turkish text fixed when the run was recorded; show `guidedAssumptions()` instead. */
  assumptions: string[]
  baseline: GuidedCondition
  comparison: GuidedCondition
  /** Comparison minus baseline; a missing event/time is never treated as zero. */
  delta: { peak: number; responseDelayMs: number | null; peakDelayMs: number | null }
}

export type GuidedRunSnapshot = DeepReadonly<GuidedRunRecord>

function freezeTree<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child)
    Object.freeze(value)
  }
  return value as DeepReadonly<T>
}

function baseConfig(): SimulationConfig {
  // Do not copy any mutable settings from another page's live experiment.
  return structuredClone(defaultConfig)
}

function metrics(result: SimulationResult): GuidedOutputMetrics {
  const trace = result.activity.O1
  if (!trace || trace.length !== result.timesMs.length) {
    throw new Error('The guided circuit must have an aligned O1 activity trace.')
  }
  let peak = 0
  let peakIndex: number | null = null
  let responseIndex: number | null = null
  for (let index = 0; index < trace.length; index += 1) {
    const value = trace[index]!
    if (value > peak) {
      peak = value
      peakIndex = index
    }
    if (responseIndex === null && value >= GUIDED_REPORTING_LEVEL) responseIndex = index
  }
  const peakTimeMs = peakIndex === null ? null : result.timesMs[peakIndex]!
  const responseTimeMs = responseIndex === null ? null : result.timesMs[responseIndex]!
  const onset = result.settings.stimulus.onsetMs
  return {
    outputId: 'O1', peak, peakTimeMs,
    peakDelayMs: peakTimeMs === null ? null : peakTimeMs - onset,
    reportingLevel: GUIDED_REPORTING_LEVEL,
    responseTimeMs,
    responseDelayMs: responseTimeMs === null ? null : responseTimeMs - onset,
  }
}

function timeDifference(comparison: number | null, baseline: number | null): number | null {
  return comparison === null || baseline === null ? null : comparison - baseline
}

/**
 * Three controlled comparisons using the existing eight-cell circuit and
 * existing simulation engine. This function owns no UI state and performs no
 * fetching, timers, randomization, storage or model modifications. It returns
 * a deep-frozen snapshot, so later draft edits cannot rewrite a completed run.
 */
export function runGuidedExperiment(
  experimentId: GuidedExperimentId,
  runNumber: number,
  options: GuidedRunOptions = {},
): GuidedRunSnapshot {
  if (!['stimulus', 'connection', 'tau'].includes(experimentId)) {
    throw new RangeError('Unknown guided experiment.')
  }
  if (!Number.isSafeInteger(runNumber) || runNumber < 1) {
    throw new RangeError('runNumber must be a positive safe integer.')
  }
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new RangeError('Guided options must be an object.')
  }
  for (const key of Object.keys(options)) {
    if (key !== 'connectionId' && key !== 'comparisonTauMs') throw new RangeError(`Unknown guided option: ${key}.`)
  }
  if (options.connectionId !== undefined && experimentId !== 'connection') {
    throw new RangeError('connectionId is only used in the connection experiment.')
  }
  if (options.comparisonTauMs !== undefined && experimentId !== 'tau') {
    throw new RangeError('comparisonTauMs is only used in the tau experiment.')
  }

  const circuit = structuredClone(illustrativeCircuit)
  const baselineConfig = baseConfig()
  const comparisonConfig = baseConfig()
  let baselineLabel: string
  let comparisonLabel: string
  let controlledVariable: GuidedControlledVariable

  if (experimentId === 'stimulus') {
    baselineConfig.stimulus.amplitude = 0.4
    comparisonConfig.stimulus.amplitude = 0.8
    baselineLabel = 'S1 uyaranı 0,40'
    comparisonLabel = 'S1 uyaranı 0,80'
    controlledVariable = {
      kind: 'stimulus-amplitude', targetId: baselineConfig.stimulus.target,
      label: 'Uyaran genliği', baselineValue: 0.4, comparisonValue: 0.8,
      unit: 'dimensionless', configPath: 'stimulus.amplitude',
    }
  } else if (experimentId === 'connection') {
    const connectionId = options.connectionId ?? 'I3-O1'
    if (connectionId !== 'I3-O1' && connectionId !== 'I4-O1') {
      throw new RangeError('Choose I3-O1 or I4-O1 for the connection experiment.')
    }
    const connection = circuit.connections.find(edge => edge.id === connectionId)
    if (!connection || connection.target !== 'O1' || connection.kind === 'gap') {
      throw new Error('The selected illustrative chemical connection is missing.')
    }
    comparisonConfig.silencedConnectionId = connectionId
    baselineLabel = `${connection.source} → O1 bağlantısı etkin`
    comparisonLabel = `${connection.source} → O1 model katkısı sıfır`
    controlledVariable = {
      kind: 'connection-effect', targetId: connectionId,
      label: 'Tek bağlantının model katkısı', baselineValue: connection.weight, comparisonValue: 0,
      unit: 'dimensionless', configPath: 'silencedConnectionId',
    }
  } else {
    const comparisonTauMs = options.comparisonTauMs ?? 90
    if (!Number.isFinite(comparisonTauMs) || comparisonTauMs <= baselineConfig.tauMs) {
      throw new RangeError(`comparisonTauMs must be finite and greater than ${baselineConfig.tauMs}.`)
    }
    comparisonConfig.tauOverrides = { O1: comparisonTauMs }
    baselineLabel = `O1 zaman sabiti ${baselineConfig.tauMs} ms`
    comparisonLabel = `O1 zaman sabiti ${comparisonTauMs} ms`
    controlledVariable = {
      kind: 'time-constant', targetId: 'O1', label: 'O1 zaman sabiti',
      baselineValue: baselineConfig.tauMs, comparisonValue: comparisonTauMs,
      unit: 'ms', configPath: 'tauOverrides.O1',
    }
  }

  const baselineResult = simulate(circuit, baselineConfig)
  const comparisonResult = simulate(circuit, comparisonConfig)
  const baselineMetrics = metrics(baselineResult)
  const comparisonMetrics = metrics(comparisonResult)
  return freezeTree({
    experimentId, runNumber, circuit, controlledVariable,
    assumptions: [
      circuit.provenance,
      'Mevcut sekiz hücreli örnek devre ve mevcut simülasyon motoru kullanılır; biyolojik bağlantı verisi veya ölçülmüş parametre içermez.',
      'Çıktı 0–1 aralığında boyutsuz sürekli model aktivitesidir; zar gerilimi, kalsiyum ölçümü, ateşleme hızı veya olay sayısı değildir.',
      'Zaman ms cinsinden model zamanıdır; zaman sabitleri, bağlantı işaretleri ve ağırlıkları öğretim için seçilmiştir.',
      'İki koşulda da kayıt süresi 700 ms, adım 1 ms, S1 darbesi [100,300) ms ve başlangıç aktiviteleri sıfırdır.',
      'Yalnız controlledVariable ile belirtilen ayar değişir; diğer devre ve simülasyon ayarları sabittir.',
      '0,10 raporlama düzeyi biyolojik ateşleme eşiği değildir. İlk ulaşma zamanı kaydedilen örneklerden alınır; ara değer hesaplanmaz.',
      'Düzeye ulaşılmaması gecikme sayısı olarak verilmez. Tamamen sıfır çıktının tepe zamanı yoktur; sıfır olmayan fakat 0,10 altında kalan çıktının tepesi olabilir.',
      'Bir bağlantının model katkısını sıfırlamak hücreyi susturmaz ve canlı hayvanda yapılmış bir müdahale değildir.',
      'Sabit raporlama düzeyine daha erken ulaşma, sinyalin biyolojik iletim hızının arttığını göstermez. Sonuçlar yalnız bu model ve kayıt aralığı içindir.',
    ],
    baseline: { label: baselineLabel, result: baselineResult, metrics: baselineMetrics },
    comparison: { label: comparisonLabel, result: comparisonResult, metrics: comparisonMetrics },
    delta: {
      peak: comparisonMetrics.peak - baselineMetrics.peak,
      responseDelayMs: timeDifference(comparisonMetrics.responseDelayMs, baselineMetrics.responseDelayMs),
      peakDelayMs: timeDifference(comparisonMetrics.peakDelayMs, baselineMetrics.peakDelayMs),
    },
  })
}

// A recorded run keeps the Turkish text it was created with, so a snapshot is the same
// whatever the interface language was. The functions below give the same text in the
// current language, built from the recorded ids and values; call them while rendering.

/** The name of one condition of a recorded run, in the interface language. */
export function guidedConditionLabel(snapshot: GuidedRunSnapshot, condition: 'baseline' | 'comparison'): string {
  if (locale.value !== 'en') return snapshot[condition].label
  const variable = snapshot.controlledVariable
  const value = condition === 'baseline' ? variable.baselineValue : variable.comparisonValue
  if (variable.kind === 'stimulus-amplitude') return `${variable.targetId} stimulus ${decimal(value, 2)}`
  if (variable.kind === 'time-constant') return `O1 time constant ${value} ms`
  const source = snapshot.circuit.connections.find(edge => edge.id === variable.targetId)?.source ?? variable.targetId
  return condition === 'baseline' ? `${source} → O1 connection active` : `${source} → O1 model contribution zero`
}

/** The name of the single setting a recorded run changed, in the interface language. */
export function guidedVariableLabel(snapshot: GuidedRunSnapshot): string {
  if (locale.value !== 'en') return snapshot.controlledVariable.label
  const kind = snapshot.controlledVariable.kind
  return kind === 'stimulus-amplitude' ? 'Stimulus amplitude' : kind === 'connection-effect' ? 'Model contribution of a single connection' : 'O1 time constant'
}

/** The assumptions of a recorded run, in the interface language and in the recorded order. */
export function guidedAssumptions(snapshot: GuidedRunSnapshot): readonly string[] {
  if (locale.value !== 'en') return snapshot.assumptions
  return [
    illustrativeCircuitEn.provenance,
    'The existing eight-cell example circuit and the existing simulation engine are used; they contain no biological connection data or measured parameters.',
    'The output is dimensionless continuous model activity in the range 0–1; it is not a membrane voltage, a calcium measurement, a firing rate or an event count.',
    'Time is model time in ms; the time constants, connection signs and weights were chosen for teaching.',
    'In both conditions the recording lasts 700 ms, the step is 1 ms, the S1 pulse is [100,300) ms and the initial activities are zero.',
    'Only the setting named by controlledVariable changes; the other circuit and simulation settings are fixed.',
    'The 0.10 reporting level is not a biological firing threshold. The first time it is reached is taken from the recorded samples; no interpolation is done.',
    'Not reaching the level is not given as a delay number. An output that is entirely zero has no peak time; an output that is nonzero but stays below 0.10 can have a peak.',
    'Setting the model contribution of a connection to zero does not silence the cell and is not an intervention performed in a living animal.',
    'Reaching the fixed reporting level earlier does not show that the biological conduction speed of the signal increased. The results are only for this model and recording interval.',
  ]
}
