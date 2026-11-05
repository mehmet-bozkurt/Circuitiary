import {
  buildRealCircuit, defaultRealModelParameters, parseRealConnectome,
  realDefaultConfig, realDefaultReadout,
} from '../model/realConnectome'
import { withComma } from '../format'
import { simulate } from '../model/simulation'
import type {
  Circuit, DeepReadonly, ReadonlyRealConnectome, RealModelParameters,
  SimulationConfig, SimulationResult,
} from '../model/types'

export type AssumptionVariable = 'chemical-gain' | 'gap-gain' | 'time-constant'

export interface AssumptionRunOptions {
  variable: AssumptionVariable
  comparisonValue: number
}

export interface AssumptionOutputMetrics {
  outputId: 'AVAR'
  /** Maximum dimensionless AVAR activity within this recorded window. */
  peak: number
  /** Earliest sample attaining a positive maximum; null for an all-zero trace. */
  peakTimeMs: number | null
  /** AVAR activity at the final recorded sample, not a steady-state estimate. */
  endValue: number
}

export interface AssumptionCondition {
  label: string
  parameters: RealModelParameters
  circuit: Circuit
  config: SimulationConfig
  result: SimulationResult
  metrics: AssumptionOutputMetrics
}

interface AssumptionRunRecord {
  runNumber: number
  sourceData: ReadonlyRealConnectome
  anatomyCounts: { neurons: number; chemicalEdges: number; physicalGapPairs: number; chemicalSelfLoops: number }
  fixed: {
    stimulusTarget: string
    outputId: 'AVAR'
    amplitude: number
    onsetMs: number
    stimulusDurationMs: number
    durationMs: number
    dtMs: number
  }
  controlledVariable: {
    variable: AssumptionVariable
    baselineValue: number
    comparisonValue: number
    unit: 'dimensionless' | 'ms'
    scope: 'chemical-edges' | 'physical-gap-pairs' | 'all-neurons'
  }
  baseline: AssumptionCondition
  comparison: AssumptionCondition
  delta: {
    /** Comparison minus baseline, both for the observed AVAR trace. */
    peak: number
    endValue: number
    /** Maximum absolute sample difference across every selected cell and time. */
    maxAbsTraceDifference: number
  }
  assumptions: string[]
}

export type AssumptionRunSnapshot = DeepReadonly<AssumptionRunRecord>

function freezeTree<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeTree)
    Object.freeze(value)
  }
  return value as DeepReadonly<T>
}

function validateOptions(runNumber: number, options: AssumptionRunOptions): void {
  if (!Number.isSafeInteger(runNumber) || runNumber < 1) throw new RangeError('runNumber must be a positive safe integer.')
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new RangeError('Assumption options must be an object.')
  for (const key of Object.keys(options)) {
    if (key !== 'variable' && key !== 'comparisonValue') throw new RangeError(`Unknown assumption option: ${key}.`)
  }
  const { variable, comparisonValue } = options
  if (variable !== 'chemical-gain' && variable !== 'gap-gain' && variable !== 'time-constant') {
    throw new RangeError('Unknown assumption variable.')
  }
  const [minimum, maximum] = variable === 'chemical-gain' ? [0, 1.5] : variable === 'gap-gain' ? [0, 1] : [15, 120]
  if (!Number.isFinite(comparisonValue) || comparisonValue < minimum! || comparisonValue > maximum!) {
    throw new RangeError(`${variable} must be a finite number in [${minimum}, ${maximum}].`)
  }
}

function outputMetrics(result: SimulationResult): AssumptionOutputMetrics {
  const trace = result.activity[realDefaultReadout]
  if (!trace || !trace.length || trace.length !== result.timesMs.length) throw new Error('The AVAR trace must align with recorded model times.')
  let peak = 0
  let peakIndex: number | null = null
  for (let index = 0; index < trace.length; index += 1) {
    if (trace[index]! > peak) { peak = trace[index]!; peakIndex = index }
  }
  return { outputId: 'AVAR', peak, peakTimeMs: peakIndex === null ? null : result.timesMs[peakIndex]!, endValue: trace.at(-1)! }
}

function maximumTraceDifference(sourceData: ReadonlyRealConnectome, baseline: SimulationResult, comparison: SimulationResult): number {
  if (baseline.timesMs.length !== comparison.timesMs.length || baseline.timesMs.some((time, index) => time !== comparison.timesMs[index])) {
    throw new Error('Comparison traces must share the same recorded model times.')
  }
  let difference = 0
  for (const { id } of sourceData.neurons) {
    const before = baseline.activity[id]
    const after = comparison.activity[id]
    if (!before || !after || before.length !== baseline.timesMs.length || after.length !== before.length) throw new Error('Every selected cell must have aligned condition traces.')
    for (let index = 0; index < before.length; index += 1) difference = Math.max(difference, Math.abs(after[index]! - before[index]!))
  }
  return difference
}

/**
 * Sensitivity of the existing assumed dynamics with fixed real anatomy.
 * No timestamps, fetching, storage or live experiment state are introduced.
 * One parameter changes; every raw edge remains present, including at zero gain.
 */
export function runAssumptionExperiment(
  data: ReadonlyRealConnectome,
  runNumber: number,
  options: AssumptionRunOptions,
): AssumptionRunSnapshot {
  validateOptions(runNumber, options)
  const sourceData = parseRealConnectome(data)
  if (![realDefaultConfig.stimulus.target, realDefaultReadout].every(id => sourceData.neurons.some(neuron => neuron.id === id))) {
    throw new RangeError('Assumption experiments require selected AVER and AVAR cells.')
  }
  const baselineParameters = { ...defaultRealModelParameters }
  const comparisonParameters = { ...defaultRealModelParameters }
  const baselineConfig = structuredClone(realDefaultConfig)
  const comparisonConfig = structuredClone(realDefaultConfig)
  const variable = options.variable
  const comparisonValue = options.comparisonValue
  let baselineValue: number
  let scope: AssumptionRunRecord['controlledVariable']['scope']
  let comparisonLabel: string
  if (variable === 'chemical-gain') {
    baselineValue = baselineParameters.chemicalGain
    comparisonParameters.chemicalGain = comparisonValue
    scope = 'chemical-edges'
    comparisonLabel = `Kimyasal model ölçeği ${withComma(String(comparisonValue))}`
  } else if (variable === 'gap-gain') {
    baselineValue = baselineParameters.gapGain
    comparisonParameters.gapGain = comparisonValue
    scope = 'physical-gap-pairs'
    comparisonLabel = `Gap model ölçeği ${withComma(String(comparisonValue))}`
  } else {
    baselineValue = baselineConfig.tauMs
    comparisonConfig.tauMs = comparisonValue
    scope = 'all-neurons'
    comparisonLabel = `Bütün hücrelerde zaman sabiti ${comparisonValue} model ms`
  }
  const baselineCircuit = buildRealCircuit(sourceData, baselineParameters)
  const comparisonCircuit = buildRealCircuit(sourceData, comparisonParameters)
  const baselineResult = simulate(baselineCircuit, baselineConfig)
  const comparisonResult = simulate(comparisonCircuit, comparisonConfig)
  const baselineMetrics = outputMetrics(baselineResult)
  const comparisonMetrics = outputMetrics(comparisonResult)
  return freezeTree({
    runNumber, sourceData,
    anatomyCounts: {
      neurons: sourceData.neurons.length, chemicalEdges: sourceData.chemicalEdges.length,
      physicalGapPairs: sourceData.gapEdges.length,
      chemicalSelfLoops: sourceData.chemicalEdges.filter(edge => edge.source === edge.target).length,
    },
    fixed: {
      stimulusTarget: baselineConfig.stimulus.target, outputId: 'AVAR' as const,
      amplitude: baselineConfig.stimulus.amplitude, onsetMs: baselineConfig.stimulus.onsetMs,
      stimulusDurationMs: baselineConfig.stimulus.durationMs, durationMs: baselineConfig.durationMs, dtMs: baselineConfig.dtMs,
    },
    controlledVariable: { variable, baselineValue, comparisonValue, unit: variable === 'time-constant' ? 'ms' as const : 'dimensionless' as const, scope },
    baseline: { label: 'Temel varsayımlar', parameters: baselineParameters, circuit: baselineCircuit, config: baselineConfig, result: baselineResult, metrics: baselineMetrics },
    comparison: { label: comparisonLabel, parameters: comparisonParameters, circuit: comparisonCircuit, config: comparisonConfig, result: comparisonResult, metrics: comparisonMetrics },
    delta: {
      peak: comparisonMetrics.peak - baselineMetrics.peak,
      endValue: comparisonMetrics.endValue - baselineMetrics.endValue,
      maxAbsTraceDifference: maximumTraceDifference(sourceData, baselineResult, comparisonResult),
    },
    assumptions: [
      `${sourceData.dataset.title} (${sourceData.dataset.version}) anatomisi ve kaynak referansları iki koşulda aynıdır.`,
      `Ham ağırlık birimi: ${sourceData.dataset.anatomicalWeightUnit}. Ham kayıtlar sinaps sayısı, ölçülmüş iletim gücü veya model ağırlığı değildir.`,
      'Bu içe aktarılmış anatomi verisinde kimyasal işaretler yok; bu model bütün kimyasal etkileri pozitif varsayar. Verici, reseptör veya baskılayıcı etki ölçümü aktarılmamıştır.',
      'Normalize kimyasal ağırlıklar ve gap katsayıları boyutsuz model varsayımlarıdır; EM kayıtlarından seçilmiş bir normalizasyonla üretilir, ölçülmüş fizyolojik güç değildir.',
      'Gap çifti tek fiziksel kayıt olarak tutulur ve g·(komşu−hücre) terimiyle iki yönde eşit katsayı kullanır. Doğrultucu fizyoloji veya çiftlere özgü işlev ölçümü burada modellenmez.',
      'Seçilmiş alt ağ dışında kalan kimyasal girdiler sıfır kabul edilir; dış gap bağlantıları çıkarılmıştır. Dış hücreleri sıfıra bağlayan bir gap sınırı uygulanmaz.',
      'Kimyasal öz bağlantılar korunur; kaynak gap köşegen kayıtları yalnız metadatadır ve fiziksel gap olarak simüle edilmez.',
      'Her iki koşulda başlangıç aktiviteleri sıfır, AVER darbesi [100,300) model ms, genlik 0,8; kayıt 700 model ms ve Euler adımı 1 model ms’dir.',
      'AVER uyaran hedefi, AVAR gözlenen hücre olarak seçilmiştir. Bu deney rolleri ölçülmüş duyusal veya motor işlev ataması değildir.',
      'Aktivite 0–1 aralığında boyutsuz sürekli model değeridir; zar gerilimi, kalsiyum, olay sayısı veya ateşleme hızı değildir. Zaman sabitleri fizyolojik ölçümlere kalibre edilmemiştir.',
      'Bütün hücreler aynı önceki adımı okuyarak güncellenir; kimyasal toplam 0–1 hedef aralığına sınırlanır, gap yayılımı bu sınırlamanın dışındadır.',
      'Yalnız controlledVariable ile belirtilen varsayım değişir. Zaman sabiti deneyinde değişiklik seçilmiş bütün hücrelere uygulanır; tek hücreye özgü bir override yoktur.',
      'Sıfır model ölçeği anatomik kayıtları silmez; yalnız ilgili model katkılarını sıfırlar. Diğer bağlantı türü hâlâ etkin olabilir.',
      'Tepe zamanı kaydedilen pozitif en büyük değerin ilk örneğidir; eşik geçişi, akson iletim gecikmesi veya biyolojik tepki başlangıcı değildir. Sıfır kalan çıktının tepe zamanı yoktur.',
      'Son değer yalnız kayıt penceresinin son örneğidir; kalıcı veya kararlı durum iddiası değildir. En büyük mutlak iz farkı bütün seçilmiş hücre ve zaman örnekleri üzerinde hesaplanır.',
      'Sonuçlar bu sabit modelin varsayımlara duyarlılığını gösterir; hayvan davranışı, kalsiyum ölçümü, beden veya biyolojik beyin emülasyonu doğrulanmış değildir.',
    ],
  })
}
