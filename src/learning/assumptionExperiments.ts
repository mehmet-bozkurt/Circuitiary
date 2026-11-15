import {
  buildRealCircuit, defaultRealModelParameters, parseRealConnectome,
  realDefaultConfig, realDefaultReadout,
} from '../model/realConnectome'
import { withComma } from '../format'
import { pick } from '../i18n'
import { simulate } from '../model/simulation'
import type {
  Circuit, DeepReadonly, ReadonlyRealConnectome, RealModelParameters,
  SimulationConfig, SimulationResult,
} from '../model/types'
import { messages } from './assumptionExperiments.messages'

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
  /** Turkish record text, the same whatever the interface language; show it with conditionLabel(). */
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
  /** Turkish record text, the same whatever the interface language; show it with runAssumptions(). */
  assumptions: string[]
}

export type AssumptionRunSnapshot = DeepReadonly<AssumptionRunRecord>

type RunText = (typeof messages)['tr']
/** The record itself is written in Turkish with a decimal comma, so the same inputs always give the same record. */
const recordText = messages.tr
const recordNumber = (value: number) => String(value).replace('.', ',')
const comparisonLabel = (text: RunText, variable: AssumptionVariable, value: number, numberText: (value: number) => string) =>
  variable === 'chemical-gain' ? text.chemicalLabel(numberText(value)) : variable === 'gap-gain' ? text.gapLabel(numberText(value)) : text.tauLabel(value)

/** A condition's label in the interface language, built from the record's values when it is shown. */
export function conditionLabel(run: AssumptionRunSnapshot, condition: 'baseline' | 'comparison'): string {
  const text = pick(messages)
  return condition === 'baseline' ? text.baselineLabel
    : comparisonLabel(text, run.controlledVariable.variable, run.controlledVariable.comparisonValue, value => withComma(String(value)))
}

/** The assumptions a record rests on, in the interface language. */
export function runAssumptions(run: AssumptionRunSnapshot): string[] {
  const { title, version, anatomicalWeightUnit } = run.sourceData.dataset
  return pick(messages).assumptions(title, version, anatomicalWeightUnit)
}

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

/** AVAR peak, first peak time and final-sample value of one recorded run; throws when the AVAR trace is missing or misaligned. */
export function outputMetrics(result: SimulationResult): AssumptionOutputMetrics {
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
  if (variable === 'chemical-gain') {
    baselineValue = baselineParameters.chemicalGain
    comparisonParameters.chemicalGain = comparisonValue
    scope = 'chemical-edges'
  } else if (variable === 'gap-gain') {
    baselineValue = baselineParameters.gapGain
    comparisonParameters.gapGain = comparisonValue
    scope = 'physical-gap-pairs'
  } else {
    baselineValue = baselineConfig.tauMs
    comparisonConfig.tauMs = comparisonValue
    scope = 'all-neurons'
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
    baseline: { label: recordText.baselineLabel, parameters: baselineParameters, circuit: baselineCircuit, config: baselineConfig, result: baselineResult, metrics: baselineMetrics },
    comparison: { label: comparisonLabel(recordText, variable, comparisonValue, recordNumber), parameters: comparisonParameters, circuit: comparisonCircuit, config: comparisonConfig, result: comparisonResult, metrics: comparisonMetrics },
    delta: {
      peak: comparisonMetrics.peak - baselineMetrics.peak,
      endValue: comparisonMetrics.endValue - baselineMetrics.endValue,
      maxAbsTraceDifference: maximumTraceDifference(sourceData, baselineResult, comparisonResult),
    },
    assumptions: recordText.assumptions(sourceData.dataset.title, sourceData.dataset.version, sourceData.dataset.anatomicalWeightUnit),
  })
}
