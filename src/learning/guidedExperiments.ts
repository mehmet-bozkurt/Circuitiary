import { defaultConfig, illustrativeCircuit } from '../model/circuit'
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
  label: string
  result: SimulationResult
  metrics: GuidedOutputMetrics
}

export interface GuidedControlledVariable {
  kind: 'stimulus-amplitude' | 'connection-effect' | 'time-constant'
  targetId: string
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
