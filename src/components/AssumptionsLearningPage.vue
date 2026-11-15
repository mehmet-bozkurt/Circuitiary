<script setup lang="ts">
import TermText from './TermText.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { chemicalNormalizationFormula, gapNormalizationFormula, parseRealConnectome } from '../model/realConnectome'
import type { DeepReadonly, ReadonlyRealConnectome, SourceReference } from '../model/types'
import { conditionLabel, runAssumptionExperiment } from '../learning/assumptionExperiments'
import type { AssumptionRunSnapshot, AssumptionVariable } from '../learning/assumptionExperiments'
import AssumptionTracePlot from '../learning/AssumptionTracePlot.vue'
import {
  assumptionCopy, assumptionCopyEn, assumptionSources, assumptionSourcesEn, assumptionVariables, assumptionVariablesEn,
  sweepPrediction, sweepPredictionEn,
} from '../learning/assumptionsContent'
import ThresholdSweepPlot from '../learning/ThresholdSweepPlot.vue'
import { runThresholdSweep, sweepGrid, thresholdCrossing, thresholdGain } from '../learning/thresholdSweep'
import type { CompletedPoint, ThresholdSweep } from '../learning/thresholdSweep'
import { decimal, withComma } from '../format'
import { L, useMessages } from '../i18n'
import { BASE, DEMO, LOCAL_DATA_URL, demoDataNotice, withBase } from '../siteBase'
import { messages } from './AssumptionsLearningPage.messages'

const emit = defineEmits<{ ready: [] }>()
type LoadState = 'loading' | 'ready' | 'missing' | 'invalid' | 'error'
/** Status and error lines are kept as functions, so a line already on screen follows a language change. */
type Line = (() => string) | null
const m = useMessages(messages)
const copy = computed(() => L(assumptionCopy, assumptionCopyEn))
const sources = computed(() => L(assumptionSources, assumptionSourcesEn))
const variables = computed(() => L(assumptionVariables, assumptionVariablesEn))
const prediction = computed(() => L(sweepPrediction, sweepPredictionEn))
const loadState = ref<LoadState>('loading')
const loadMessage = ref<Line>(() => m.value.loading)
const dataError = ref<Line>(null)
const data = shallowRef<ReadonlyRealConnectome | null>(null)
const variable = ref<AssumptionVariable>('chemical-gain')
const comparisonValue = ref(1.2)
const snapshot = shallowRef<AssumptionRunSnapshot | null>(null)
const runNumber = ref(0)
const runMessage = ref<Line>(null)
const runError = ref<Line>(null)
const responseScale = ref(true)
const sweep = shallowRef<ThresholdSweep | null>(null)
const sweepRun = ref(0)
const sweepMessage = ref<Line>(null)
const sweepError = ref<Line>(null)
const sweepDraft = ref('')
const sweepRecorded = ref('')
let request: AbortController | null = null
let requestTimer: ReturnType<typeof setTimeout> | undefined
let requestVersion = 0
let disposed = false

const chosenVariable = computed(() => variables.value.find(option => option.id === variable.value) ?? variables.value[0])
const isStale = computed(() => snapshot.value !== null && (snapshot.value.controlledVariable.variable !== variable.value || snapshot.value.controlledVariable.comparisonValue !== comparisonValue.value))
const sourceSelfLoops = computed(() => data.value?.chemicalEdges.filter(edge => edge.source === edge.target).length ?? 0)
const yMax = computed(() => {
  const maximum = snapshot.value ? Math.max(snapshot.value.baseline.metrics.peak, snapshot.value.comparison.metrics.peak) : 0
  // Activity is bounded by 1, so the zoomed axis stops there instead of drawing a range no value can reach.
  return responseScale.value && maximum > 0 ? Math.min(1, maximum * 1.1) : 1
})
const windowEndMaximum = computed(() => snapshot.value !== null && (snapshot.value.baseline.metrics.peakTimeMs === snapshot.value.fixed.durationMs || snapshot.value.comparison.metrics.peakTimeMs === snapshot.value.fixed.durationMs))
const format = (value: number, digits = 5) => value === 0 ? '0' : withComma(Math.abs(value) < .0001 ? value.toExponential(digits - 1) : value.toPrecision(digits))
const signed = (value: number) => `${value > 0 ? '+' : ''}${format(value)}`
const parameter = (value: number, id: AssumptionVariable) => id === 'time-constant' ? `${value} model ms` : decimal(value, 1)
const timeText = (value: number | null) => value === null ? '—' : `${value} model ms`
const regime = (gain: number) => gain < thresholdGain ? { id: 'below', text: m.value.regimeBelow } : gain > thresholdGain ? { id: 'above', text: m.value.regimeAbove } : { id: 'at', text: m.value.regimeAt }
const crossing = computed(() => sweep.value ? thresholdCrossing(sweep.value) : null)
const sweepWindowEnd = computed(() => { const run = sweep.value; return run ? run.points.filter((point): point is CompletedPoint => point.ok && point.peakTimeMs === run.fixed.durationMs).map(point => point.gain) : [] })
const sweepNeverPositive = computed(() => sweep.value?.points.some(point => point.ok && point.peakTimeMs === null) ?? false)
const sweepDraftChanged = computed(() => sweep.value !== null && sweepDraft.value !== sweepRecorded.value)
const sweepFeedback = computed(() => {
  if (!sweep.value) return ''
  const found = crossing.value
  const text = m.value.feedback
  if (!found) return text.noCrossing
  const verdict = sweepRecorded.value === '' ? text.noPrediction : sweepRecorded.value === 'unsure' ? text.unsure : sweepRecorded.value === found.trend ? text.matches : text.differs
  const change = text.change(decimal(found.below.gain, 1), decimal(found.above.gain, 1), decimal(found.gainFactor, 1), format(found.below.endValue, 3), format(found.above.endValue, 3))
  const size = found.trend === 'steep' ? `${found.factor === null ? text.fromZero : text.byFactor(decimal(found.factor, found.factor < 10 ? 1 : 0))}${text.steep}`
    : found.trend === 'proportional' ? text.proportional : found.trend === 'flat' ? text.flat : text.falling
  return `${verdict} ${change}${size}`
})
const sourceText = (source: DeepReadonly<SourceReference>) => m.value.sourceText(source.sheet, source.cell, source.row, source.column)
const scopeText = (run: AssumptionRunSnapshot) => run.controlledVariable.scope === 'all-neurons' ? m.value.scopeAllNeurons(run.anatomyCounts.neurons) : run.controlledVariable.scope === 'chemical-edges' ? m.value.scopeChemical : m.value.scopeGap
watch(variable, () => { comparisonValue.value = chosenVariable.value.initial; runError.value = null })

const examples = computed(() => {
  const run = snapshot.value
  if (!run) return []
  const chemical = run.sourceData.chemicalEdges.find(edge => edge.source === 'AVER' && edge.target === 'AVAR')
  const gap = run.sourceData.gapEdges.find(edge => edge.a === 'AVAR' && edge.b === 'AVER')
  const before = run.baseline.circuit.realData?.normalization
  const after = run.comparison.circuit.realData?.normalization
  return [
    ...(chemical ? [{ kind: 'chemical' as const, label: m.value.chemicalExample, id: chemical.id, from: chemical.source, to: chemical.target, rawWeight: chemical.rawWeight, sourceRef: chemical.sourceRef, reciprocalSourceRef: undefined,
      baselineWeight: run.baseline.circuit.connections.find(edge => edge.id === chemical.id)?.weight, comparisonWeight: run.comparison.circuit.connections.find(edge => edge.id === chemical.id)?.weight,
      baselineDenominator: before?.chemicalDenominatorByTarget.AVAR, comparisonDenominator: after?.chemicalDenominatorByTarget.AVAR,
      firstTotal: before?.chemicalIncomingRawWeight.AVAR, secondTotal: undefined }] : []),
    ...(gap ? [{ kind: 'gap' as const, label: m.value.gapExample, id: gap.id, from: gap.a, to: gap.b, rawWeight: gap.rawWeight, sourceRef: gap.sourceRef, reciprocalSourceRef: gap.reciprocalSourceRef,
      baselineWeight: run.baseline.circuit.connections.find(edge => edge.id === gap.id)?.weight, comparisonWeight: run.comparison.circuit.connections.find(edge => edge.id === gap.id)?.weight,
      baselineDenominator: before?.gapDenominatorByConnection[gap.id], comparisonDenominator: after?.gapDenominatorByConnection[gap.id],
      firstTotal: before?.gapIncidentRawWeight.AVAR, secondTotal: before?.gapIncidentRawWeight.AVER }] : []),
  ]
})
function sourceAttributes(source: DeepReadonly<SourceReference>, reciprocal?: DeepReadonly<SourceReference>) {
  return {
    'data-source-sheet': source.sheet, 'data-source-row': source.row, 'data-source-column': source.column, 'data-source-cell': source.cell,
    'data-reciprocal-source-sheet': reciprocal?.sheet, 'data-reciprocal-source-row': reciprocal?.row, 'data-reciprocal-source-column': reciprocal?.column, 'data-reciprocal-source-cell': reciprocal?.cell,
  }
}
function runExperiment() {
  if (!data.value) return
  try {
    const result = runAssumptionExperiment(data.value, runNumber.value + 1, { variable: variable.value, comparisonValue: comparisonValue.value })
    snapshot.value = result
    runNumber.value = result.runNumber
    runError.value = null
    runMessage.value = () => m.value.runReady(result.runNumber)
  } catch {
    runError.value = () => m.value.runFailed
  }
}
function runSweep() {
  if (!data.value) return
  const result = runThresholdSweep(data.value)
  if (result.completed === 0) {
    sweepError.value = () => m.value.sweepAllFailed
    return
  }
  sweep.value = result
  sweepRun.value += 1
  sweepRecorded.value = sweepDraft.value
  sweepError.value = null
  const record = sweepRun.value
  sweepMessage.value = () => m.value.sweepReady(record, result.points.length, result.completed)
}
function resetExperiment() {
  sweep.value = null; sweepRun.value = 0; sweepMessage.value = null; sweepError.value = null; sweepDraft.value = ''; sweepRecorded.value = ''
  variable.value = 'chemical-gain'
  comparisonValue.value = 1.2
  snapshot.value = null
  runNumber.value = 0
  responseScale.value = true
  runError.value = null
  runMessage.value = () => m.value.resetDone
}
const resultExplanation = computed(() => {
  const run = snapshot.value
  if (!run) return ''
  const text = m.value.explanation
  const difference = run.delta.peak
  const peak = difference > 0 ? text.peakUp(format(difference)) : difference < 0 ? text.peakDown(format(-difference)) : text.peakSame
  const recordedVariable = variables.value.find(option => option.id === run.controlledVariable.variable)!
  const conditions = text.conditions(recordedVariable.short, parameter(run.controlledVariable.baselineValue, recordedVariable.id), parameter(run.controlledVariable.comparisonValue, recordedVariable.id))
  const wholeNetwork = run.delta.maxAbsTraceDifference === 0 ? text.networkSame : text.networkDiffers(run.anatomyCounts.neurons, format(run.delta.maxAbsTraceDifference))
  const selfSustaining = run.controlledVariable.variable === 'chemical-gain' && run.controlledVariable.comparisonValue > 1 ? text.selfSustaining : ''
  return `${peak} ${conditions} ${wholeNetwork}${selfSustaining}${text.closing}`
})
async function loadData() {
  const version = ++requestVersion
  request?.abort()
  if (requestTimer !== undefined) clearTimeout(requestTimer)
  const controller = new AbortController()
  request = controller
  let timedOut = false
  let phase: 'request' | 'parse' = 'request'
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 10_000)
  requestTimer = timer
  loadState.value = 'loading'
  loadMessage.value = () => m.value.loading
  dataError.value = null
  data.value = null
  snapshot.value = null
  runNumber.value = 0
  runMessage.value = null
  runError.value = null
  sweep.value = null
  sweepRun.value = 0
  sweepMessage.value = null
  sweepError.value = null
  sweepRecorded.value = ''
  try {
    // The online demo has no local data endpoint: say so instead of asking for it.
    if (DEMO) { loadState.value = 'missing'; loadMessage.value = null; dataError.value = demoDataNotice; return }
    const response = await fetch(LOCAL_DATA_URL, { cache: 'no-store', signal: controller.signal })
    if (disposed || version !== requestVersion) return
    if (response.status === 404) {
      loadState.value = 'missing'; loadMessage.value = null
      dataError.value = () => m.value.missing
      return
    }
    if (!response.ok) throw new Error('Local data request failed')
    phase = 'parse'
    const parsed = parseRealConnectome(await response.json())
    if (disposed || version !== requestVersion) return
    data.value = parsed
    loadState.value = 'ready'
    loadMessage.value = () => m.value.loaded(parsed.neurons.length, parsed.chemicalEdges.length, parsed.gapEdges.length)
  } catch {
    if (disposed || version !== requestVersion) return
    loadState.value = timedOut || phase === 'request' ? 'error' : 'invalid'
    loadMessage.value = null
    dataError.value = timedOut ? () => m.value.timedOut : phase === 'parse' ? () => m.value.invalid : () => m.value.unreadable
  } finally {
    clearTimeout(timer)
    if (version === requestVersion) { request = null; requestTimer = undefined }
    if (!disposed && version === requestVersion) {
      await nextTick()
      if (!disposed && version === requestVersion) emit('ready')
    }
  }
}
onMounted(() => { emit('ready'); void loadData() })
onBeforeUnmount(() => { disposed = true; requestVersion += 1; request?.abort(); if (requestTimer !== undefined) clearTimeout(requestTimer) })
</script>

<template>
  <main id="real-assumptions" tabindex="-1" class="assumptions-page" :data-data-state="loadState">
    <header class="assumptions-intro"><div><p class="assumptions-eyebrow">{{ m.eyebrow }}</p><h1 id="assumptions-title" tabindex="-1">{{ m.titleLead }}<em>{{ m.titleEmphasis }}</em></h1><p class="assumptions-summary"><TermText :text="copy.lead" /></p><p class="assumptions-meta">{{ m.meta }}</p></div><button type="button" class="assumptions-reset" @click="resetExperiment">{{ m.reset }}</button></header>
    <div class="assumptions-boundary"><strong>{{ m.boundaryTitle }}</strong><p>{{ m.boundaryText }}</p></div>
    <nav class="assumptions-navigation" :aria-label="m.navigation"><a href="#assumptions-data">{{ m.nav.data }}</a><a href="#assumptions-model">{{ m.nav.model }}</a><a href="#assumptions-experiment">{{ m.nav.experiment }}</a><a href="#assumptions-sweep">{{ m.nav.sweep }}</a><a href="#assumptions-validation">{{ m.nav.validation }}</a><a href="#assumptions-provenance">{{ m.nav.provenance }}</a></nav>

    <section id="assumptions-data" tabindex="-1" aria-labelledby="assumptions-data-title" class="assumptions-section">
      <p class="assumptions-eyebrow">{{ m.dataEyebrow }}</p><h2 id="assumptions-data-title">{{ m.dataTitle }}</h2><p class="assumptions-paragraph"><TermText :text="copy.raw" /></p><p class="assumptions-paragraph"><TermText :text="copy.identity" /></p>
      <div data-testid="assumptions-load-status" :data-state="loadState" class="data-load-state"><p role="status" aria-live="polite" aria-atomic="true">{{ loadMessage?.() }}</p><div v-if="dataError" :role="DEMO ? 'status' : 'alert'" class="assumptions-error"><p>{{ dataError() }}</p><button v-if="!DEMO" type="button" @click="loadData">{{ m.retry }}</button></div></div>
      <div v-if="data" data-testid="assumptions-source-summary" :data-neuron-count="data.neurons.length" :data-chemical-count="data.chemicalEdges.length" :data-gap-count="data.gapEdges.length" :data-self-loop-count="sourceSelfLoops" :data-synapse-count="'not-provided'" class="source-counts"><div><span>{{ m.selectedCells }}</span><strong>{{ data.neurons.length }}</strong></div><div><span>{{ m.chemicalRecords }}</span><strong>{{ data.chemicalEdges.length }}</strong></div><div><span>{{ m.physicalPairs }}</span><strong>{{ data.gapEdges.length }}</strong></div><p>{{ m.selfLoopsLead(sourceSelfLoops) }}<TermText :text="m.selfLoopsRest(sourceSelfLoops)" /></p><p>{{ m.rawUnit }}</p></div>
      <table data-testid="assumptions-evidence-table" class="evidence-table"><caption>{{ m.evidenceCaption }}</caption><thead><tr><th scope="col">{{ m.evidenceReported }}</th><th scope="col">{{ m.evidenceAdded }}</th><th scope="col">{{ m.evidenceAbsent }}</th></tr></thead><tbody><tr><td>{{ m.evidence.cellsReported }}</td><td>{{ m.evidence.cellsAdded }}</td><td>{{ m.evidence.cellsAbsent }}</td></tr><tr><td>{{ m.evidence.recordsReported }}</td><td>{{ m.evidence.recordsAdded }}</td><td><TermText :text="m.evidence.recordsAbsent" /></td></tr><tr><td>{{ m.evidence.weightsReported }}</td><td>{{ m.evidence.weightsAdded }}</td><td><TermText :text="m.evidence.weightsAbsent" /></td></tr><tr><td>{{ m.evidence.boundaryReported }}</td><td>{{ m.evidence.boundaryAdded }}</td><td>{{ m.evidence.boundaryAbsent }}</td></tr></tbody></table>
      <p class="assumptions-paragraph"><TermText :text="copy.composite" /></p>
    </section>

    <section id="assumptions-model" tabindex="-1" aria-labelledby="assumptions-model-title" class="assumptions-section">
      <p class="assumptions-eyebrow">{{ m.modelEyebrow }}</p><h2 id="assumptions-model-title">{{ m.modelTitle }}</h2><p class="assumptions-paragraph"><TermText :text="copy.signs" /></p><p class="assumptions-paragraph"><TermText :text="copy.gap" /></p><p class="assumptions-paragraph"><TermText :text="copy.normalization" /></p>
      <div class="normalization-formulas"><h3>{{ m.formulasTitle }}</h3><p>{{ m.chemicalFormula }}</p><code>{{ chemicalNormalizationFormula }}</code><p>{{ m.gapFormula }}</p><code>{{ gapNormalizationFormula }}</code><p>{{ m.formulasNote }}</p></div>
      <p class="assumptions-paragraph"><TermText :text="copy.dynamics" /></p><p class="assumptions-paragraph"><TermText :text="copy.boundary" /></p>
      <div v-if="data" data-testid="assumptions-external-boundary" class="omitted-boundary"><h3>{{ m.omittedTitle }}</h3><p><span data-testid="assumptions-omitted-incoming" :data-count="data.selection.omittedExternal.chemicalIncomingCount">{{ m.omittedIncoming(data.selection.omittedExternal.chemicalIncomingCount) }}</span> · <span data-testid="assumptions-omitted-outgoing" :data-count="data.selection.omittedExternal.chemicalOutgoingCount">{{ m.omittedOutgoing(data.selection.omittedExternal.chemicalOutgoingCount) }}</span> · <span data-testid="assumptions-omitted-gaps" :data-count="data.selection.omittedExternal.gapCount">{{ m.omittedGaps(data.selection.omittedExternal.gapCount) }}</span></p><p>{{ m.omittedNote }}</p></div>
    </section>

    <section id="assumptions-experiment" tabindex="-1" aria-labelledby="assumptions-experiment-title" class="assumptions-section">
      <p class="assumptions-eyebrow">{{ m.experimentEyebrow }}</p><h2 id="assumptions-experiment-title">{{ m.experimentTitle }}</h2><p class="assumptions-paragraph"><TermText :text="copy.experiment" /></p>
      <div class="assumptions-workspace"><div class="assumptions-controls"><h3>{{ m.settingsTitle }}</h3><label for="assumptions-variable">{{ m.variableLabel }}</label><select id="assumptions-variable" v-model="variable"><option v-for="option in variables" :key="option.id" :value="option.id">{{ option.label }}</option></select><div class="comparison-control"><label for="assumptions-comparison-value">{{ m.comparisonValue(chosenVariable.label) }} <output for="assumptions-comparison-value">{{ parameter(comparisonValue, variable) }}</output></label><input :key="variable" id="assumptions-comparison-value" v-model.number="comparisonValue" type="range" :min="chosenVariable.min" :max="chosenVariable.max" :step="chosenVariable.step" :aria-valuetext="parameter(comparisonValue, variable)" /><p>{{ m.baselineValueLead }}<TermText :text="parameter(chosenVariable.baseline, variable)" />{{ m.scopeLead }}<TermText :text="chosenVariable.scope" />.</p></div><p class="chosen-explanation"><TermText :text="chosenVariable.explanation" /></p><div class="fixed-conditions" data-testid="assumptions-fixed-conditions"><strong>{{ m.fixedTitle }}</strong><p>{{ m.fixedRoles }}</p><p>{{ m.fixedPulse }}</p><p>{{ m.fixedRecording }}</p><p>{{ m.fixedNote }}</p></div><button type="button" class="assumptions-primary run-button" :disabled="!data || loadState !== 'ready'" aria-controls="assumptions-result-region" @click="runExperiment">{{ snapshot ? m.runAgain : m.run }} <span aria-hidden="true">→</span></button><p data-testid="assumptions-run-status" role="status" aria-live="polite" aria-atomic="true" class="run-status">{{ runMessage?.() }}</p><p v-if="runError" class="assumptions-error" role="alert">{{ runError() }}</p><p v-if="!data" class="wait-for-data">{{ m.waitForData }}</p></div>
        <div id="assumptions-result-region" role="region" :aria-label="m.resultRegion" class="assumptions-observation"><h3>{{ m.resultTitle }}</h3><div v-if="!snapshot" class="not-run"><p>{{ m.notRun }}</p><p>{{ m.notRunHint }}</p></div>
          <div v-else data-testid="assumptions-result" :data-run-number="snapshot.runNumber" :data-stale="isStale" class="assumptions-result"><div class="record-heading"><span>{{ m.recordNumber(snapshot.runNumber) }}</span><span>{{ isStale ? m.resultOfPrevious : m.resultOfCurrent }}</span></div><p v-if="isStale" data-testid="assumptions-stale" class="stale-warning" role="status">{{ m.stale }}</p>
            <div data-testid="assumptions-run-settings" :data-variable="snapshot.controlledVariable.variable" :data-baseline-value="snapshot.controlledVariable.baselineValue" :data-comparison-value="snapshot.controlledVariable.comparisonValue" :data-scope="snapshot.controlledVariable.scope" :data-baseline-chemical-gain="snapshot.baseline.parameters.chemicalGain" :data-comparison-chemical-gain="snapshot.comparison.parameters.chemicalGain" :data-baseline-gap-gain="snapshot.baseline.parameters.gapGain" :data-comparison-gap-gain="snapshot.comparison.parameters.gapGain" :data-baseline-tau="snapshot.baseline.config.tauMs" :data-comparison-tau="snapshot.comparison.config.tauMs" :data-baseline-tau-override-count="Object.keys(snapshot.baseline.config.tauOverrides ?? {}).length" :data-comparison-tau-override-count="Object.keys(snapshot.comparison.config.tauOverrides ?? {}).length" :data-stimulus-target="snapshot.fixed.stimulusTarget" :data-output-id="snapshot.fixed.outputId" :data-amplitude="snapshot.fixed.amplitude" :data-onset-ms="snapshot.fixed.onsetMs" :data-stimulus-duration-ms="snapshot.fixed.stimulusDurationMs" :data-duration-ms="snapshot.fixed.durationMs" :data-dt-ms="snapshot.fixed.dtMs" :data-baseline-edge-count="snapshot.baseline.circuit.connections.length" :data-comparison-edge-count="snapshot.comparison.circuit.connections.length" class="record-settings"><strong>{{ m.inThisRecord }}</strong><p><TermText :text="scopeText(snapshot)" />.</p><p>{{ m.recordGains(withComma(String(snapshot.baseline.parameters.chemicalGain)), withComma(String(snapshot.comparison.parameters.chemicalGain)), withComma(String(snapshot.baseline.parameters.gapGain)), withComma(String(snapshot.comparison.parameters.gapGain))) }}</p><p>{{ m.recordTau(snapshot.baseline.config.tauMs, snapshot.comparison.config.tauMs) }}</p><p>{{ m.recordAnatomy(snapshot.anatomyCounts.neurons, snapshot.anatomyCounts.chemicalEdges, snapshot.anatomyCounts.chemicalSelfLoops, snapshot.anatomyCounts.physicalGapPairs) }}</p></div>
            <div class="assumptions-chart-scale"><label for="assumptions-focus-scale"><input id="assumptions-focus-scale" v-model="responseScale" type="checkbox" /> {{ m.responseScale }}</label><output data-testid="assumptions-axis-limit" :data-value="yMax">{{ m.axisLimit(format(yMax)) }}</output></div>
            <AssumptionTracePlot :times-ms="snapshot.baseline.result.timesMs" :baseline="snapshot.baseline.result.activity.AVAR!" :comparison="snapshot.comparison.result.activity.AVAR!" :baseline-label="conditionLabel(snapshot, 'baseline')" :comparison-label="conditionLabel(snapshot, 'comparison')" :y-max="yMax" :response-scale="responseScale" :onset-ms="snapshot.fixed.onsetMs" :stimulus-duration-ms="snapshot.fixed.stimulusDurationMs" />
            <table class="metrics-table"><caption>{{ m.metricsCaption }}</caption><thead><tr><th scope="col">{{ m.metric }}</th><th scope="col">{{ m.baseline }}</th><th scope="col">{{ m.change }}</th></tr></thead><tbody><tr><th scope="row">{{ m.peakActivity }}</th><td data-testid="assumptions-baseline-peak" :data-value="snapshot.baseline.metrics.peak">{{ format(snapshot.baseline.metrics.peak) }}</td><td data-testid="assumptions-comparison-peak" :data-value="snapshot.comparison.metrics.peak">{{ format(snapshot.comparison.metrics.peak) }}</td></tr><tr><th scope="row">{{ m.peakTime }}</th><td data-testid="assumptions-baseline-peak-time" :data-value="snapshot.baseline.metrics.peakTimeMs ?? 'null'"><TermText :text="timeText(snapshot.baseline.metrics.peakTimeMs)" /></td><td data-testid="assumptions-comparison-peak-time" :data-value="snapshot.comparison.metrics.peakTimeMs ?? 'null'"><TermText :text="timeText(snapshot.comparison.metrics.peakTimeMs)" /></td></tr><tr><th scope="row">{{ m.endActivity }}</th><td data-testid="assumptions-baseline-end" :data-value="snapshot.baseline.metrics.endValue">{{ format(snapshot.baseline.metrics.endValue) }}</td><td data-testid="assumptions-comparison-end" :data-value="snapshot.comparison.metrics.endValue">{{ format(snapshot.comparison.metrics.endValue) }}</td></tr></tbody></table>
            <dl class="delta-metrics"><div><dt>{{ m.peakDifference }}</dt><dd data-testid="assumptions-peak-difference" :data-value="snapshot.delta.peak"><TermText :text="signed(snapshot.delta.peak)" /></dd></div><div><dt>{{ m.endDifference }}</dt><dd data-testid="assumptions-end-difference" :data-value="snapshot.delta.endValue"><TermText :text="signed(snapshot.delta.endValue)" /></dd></div><div><dt>{{ m.maxTraceDifference(snapshot.anatomyCounts.neurons) }}</dt><dd data-testid="assumptions-max-trace-difference" :data-value="snapshot.delta.maxAbsTraceDifference">{{ format(snapshot.delta.maxAbsTraceDifference) }}</dd></div></dl>
            <p v-if="windowEndMaximum" data-testid="assumptions-window-end-maximum" class="window-note">{{ m.windowEndMaximum(snapshot.fixed.durationMs) }}</p><p v-if="snapshot.baseline.metrics.peakTimeMs === null || snapshot.comparison.metrics.peakTimeMs === null" class="window-note">{{ m.noPeakTime }}</p><p class="metric-note">{{ m.metricNote }}</p>
            <div class="result-meaning"><p class="assumptions-eyebrow">{{ m.readWithConditions }}</p><p data-testid="assumptions-explanation"><TermText :text="resultExplanation" /></p></div>
          </div>
        </div>
      </div>
      <div v-if="snapshot" data-testid="assumptions-source-examples" class="source-examples"><h3>{{ m.examplesTitle }}</h3><p>{{ m.examplesLead }}</p><div class="example-grid"><article v-for="example in examples" :key="example.id" :data-testid="`assumptions-example-${example.kind}`" :data-edge-id="example.id" :data-kind="example.kind" :data-from="example.from" :data-to="example.to" :data-raw-weight="example.rawWeight" :data-baseline-weight="example.baselineWeight" :data-comparison-weight="example.comparisonWeight" :data-baseline-denominator="example.baselineDenominator" :data-comparison-denominator="example.comparisonDenominator" :data-first-total="example.firstTotal" :data-second-total="example.secondTotal" v-bind="sourceAttributes(example.sourceRef, example.reciprocalSourceRef)" class="example-card"><h4><TermText :text="example.label" /></h4><dl><div><dt>{{ m.rawWeight }}</dt><dd>{{ m.emSections(example.rawWeight) }}</dd></div><div><dt>{{ m.sourceCell }}</dt><dd><TermText :text="sourceText(example.sourceRef)" /></dd></div><div v-if="example.reciprocalSourceRef"><dt>{{ m.reciprocalCell }}</dt><dd><TermText :text="sourceText(example.reciprocalSourceRef)" /></dd></div><div><dt>{{ m.subgraphLead }}<TermText :text="example.kind === 'chemical' ? m.incomingTotal : m.incidentTotals" /></dt><dd><TermText :text="example.kind === 'chemical' ? `AVAR: ${example.firstTotal}` : `AVAR: ${example.firstTotal}; AVER: ${example.secondTotal}`" /></dd></div><div><dt>{{ m.denominator }}</dt><dd><TermText :text="example.baselineDenominator" /> / <TermText :text="example.comparisonDenominator" /></dd></div><div><dt>{{ m.baselineWeight }}</dt><dd :data-testid="`assumptions-example-${example.kind}-baseline-weight`" :data-value="example.baselineWeight"><TermText :text="example.baselineWeight === undefined ? m.notInRecord : format(example.baselineWeight, 8)" /></dd></div><div><dt>{{ m.changedWeight }}</dt><dd :data-testid="`assumptions-example-${example.kind}-comparison-weight`" :data-value="example.comparisonWeight"><TermText :text="example.comparisonWeight === undefined ? m.notInRecord : format(example.comparisonWeight, 8)" /></dd></div></dl></article></div><p>{{ m.examplesNote }}</p></div>
    </section>

    <section id="assumptions-sweep" tabindex="-1" aria-labelledby="assumptions-sweep-title" class="assumptions-section" data-testid="assumptions-sweep">
      <p class="assumptions-eyebrow">{{ m.sweepEyebrow }}</p><h2 id="assumptions-sweep-title">{{ m.sweepTitle }}</h2><p class="assumptions-paragraph"><TermText :text="copy.sweep" /></p>
      <div class="assumptions-workspace">
        <div class="assumptions-controls">
          <h3>{{ m.sweepSettingsTitle }}</h3>
          <div class="fixed-conditions no-rule" data-testid="sweep-fixed-conditions"><strong>{{ m.sweepFixedTitle }}</strong><p>{{ m.sweepFixedGrid(decimal(sweepGrid[0]!, 1), decimal(sweepGrid.at(-1)!, 1), sweepGrid.length) }}</p><p>{{ m.sweepFixedOthers }}</p><p>{{ m.sweepFixedPulse }}</p><p>{{ m.sweepFixedRecording }}</p></div>
          <div class="comparison-control"><label for="sweep-prediction">{{ prediction.prompt }}</label><select id="sweep-prediction" v-model="sweepDraft"><option value="">{{ m.noPrediction }}</option><option v-for="option in prediction.options" :key="option.id" :value="option.id">{{ option.label }}</option></select><p>{{ prediction.hint }}</p></div>
          <button type="button" class="assumptions-primary run-button" data-testid="sweep-run" :disabled="!data || loadState !== 'ready'" aria-controls="assumptions-sweep-result" @click="runSweep">{{ sweep ? m.runSweepAgain : m.runSweep }} <span aria-hidden="true">→</span></button>
          <p data-testid="sweep-status" role="status" aria-live="polite" aria-atomic="true" class="run-status">{{ sweepMessage?.() }}</p>
          <p v-if="sweepError" data-testid="sweep-error" class="assumptions-error" role="alert">{{ sweepError() }}</p>
          <p v-if="!data" class="wait-for-data">{{ m.sweepWaitForData }}</p>
        </div>
        <div id="assumptions-sweep-result" role="region" :aria-label="m.sweepRegion" class="assumptions-observation">
          <h3>{{ m.sweepResultTitle }}</h3>
          <div v-if="!sweep" class="not-run"><p>{{ m.sweepNotRun }}</p><p>{{ m.sweepNotRunHint }}</p></div>
          <div v-else data-testid="sweep-result" :data-run-number="sweepRun" :data-completed="sweep.completed" :data-failed="sweep.failed" :data-gap-gain="sweep.fixed.gapGain" :data-tau-ms="sweep.fixed.tauMs" :data-duration-ms="sweep.fixed.durationMs" class="assumptions-result">
            <div class="record-heading"><span>{{ m.sweepRecord(sweepRun) }}</span><span>{{ m.sweepCompleted(sweep.points.length, sweep.completed) }}</span></div>
            <p v-if="sweep.failed" data-testid="sweep-failed-note" class="assumptions-error" role="alert">{{ m.sweepSomeFailed(sweep.failed) }}</p>
            <ThresholdSweepPlot :points="sweep.points" :threshold-gain="thresholdGain" />
            <table class="sweep-table" data-testid="sweep-table"><caption>{{ m.sweepCaption }}</caption><thead><tr><th scope="col">{{ m.sweepGain }}</th><th scope="col">{{ m.sweepPeak }}</th><th scope="col">{{ m.sweepPeakTime }}</th><th scope="col">{{ m.sweepEnd }}</th></tr></thead>
              <tbody><tr v-for="point in sweep.points" :key="point.gain" data-testid="sweep-row" :data-gain="point.gain" :data-regime="regime(point.gain).id" :data-ok="point.ok" :data-peak="point.ok ? point.peak : undefined" :data-peak-time="point.ok ? (point.peakTimeMs ?? 'null') : undefined" :data-end="point.ok ? point.endValue : undefined"><th scope="row">{{ decimal(point.gain, 1) }}<span class="regime">{{ regime(point.gain).text }}</span></th><template v-if="point.ok"><td>{{ format(point.peak, 4) }}</td><td>{{ point.peakTimeMs ?? '—' }}</td><td>{{ format(point.endValue, 4) }}</td></template><td v-else colspan="3" class="failed-cell">{{ m.notComputed }}</td></tr></tbody></table>
            <dl v-if="crossing" class="delta-metrics" data-testid="sweep-crossing" :data-below-gain="crossing.below.gain" :data-above-gain="crossing.above.gain" :data-below-end="crossing.below.endValue" :data-above-end="crossing.above.endValue" :data-trend="crossing.trend"><div><dt>{{ m.nearestBelow(decimal(crossing.below.gain, 1)) }}</dt><dd>{{ format(crossing.below.endValue, 4) }}</dd></div><div><dt>{{ m.nearestAbove(decimal(crossing.above.gain, 1)) }}</dt><dd>{{ format(crossing.above.endValue, 4) }}</dd></div></dl>
            <p v-if="sweepWindowEnd.length" data-testid="sweep-window-end" class="window-note">{{ m.sweepWindowEnd(sweepWindowEnd.map(gain => decimal(gain, 1)).join(' · '), sweepWindowEnd.length, sweep.fixed.durationMs) }}</p>
            <p v-if="sweepNeverPositive" class="window-note">{{ m.sweepNoPeakTime }}</p>
            <p class="metric-note"><TermText :text="copy.sweepWindow" /></p>
            <p v-if="sweepDraftChanged" data-testid="sweep-prediction-changed" class="window-note" role="status">{{ m.predictionChanged }}</p>
            <div class="result-meaning"><p class="assumptions-eyebrow">{{ m.readWithConditions }}</p><p data-testid="sweep-feedback"><TermText :text="sweepFeedback" /></p></div>
          </div>
        </div>
      </div>
    </section>

    <section id="assumptions-validation" tabindex="-1" aria-labelledby="assumptions-validation-title" class="assumptions-section"><p class="assumptions-eyebrow">{{ m.validationEyebrow }}</p><h2 id="assumptions-validation-title">{{ m.validationTitle }}</h2><p class="assumptions-paragraph"><TermText :text="copy.validation" /></p><p class="assumptions-paragraph"><TermText :text="copy.physiology" /></p><p class="assumptions-paragraph"><TermText :text="copy.questions" /></p><div class="validation-distinction"><div><h3>{{ m.numericalTitle }}</h3><p>{{ m.numericalText }}</p></div><div><h3>{{ m.biologicalTitle }}</h3><p>{{ m.biologicalText }}</p></div></div></section>
    <section id="assumptions-provenance" tabindex="-1" aria-labelledby="assumptions-provenance-title" data-testid="assumptions-provenance" :data-license-status="data?.dataset.license.status" :data-source-unit="data?.dataset.anatomicalWeightUnit" class="assumptions-section"><p class="assumptions-eyebrow">{{ m.provenanceEyebrow }}</p><h2 id="assumptions-provenance-title">{{ m.provenanceTitle }}</h2><p class="assumptions-paragraph"><TermText :text="copy.local" /></p><dl v-if="data" class="provenance-facts"><div><dt>{{ m.localData }}</dt><dd><TermText :text="data.dataset.title" /></dd></div><div><dt>{{ m.version }}</dt><dd><TermText :text="data.dataset.version" /></dd></div><div data-testid="assumptions-subset-selection" :data-algorithm="data.selection.algorithm" :data-seeds="data.selection.seeds.join(',')" :data-limit="data.selection.limit"><dt>{{ m.subgraphSelection }}</dt><dd>{{ m.seedsLead }}<TermText :text="data.selection.seeds.join(', ')" />{{ m.cellLimit(data.selection.limit) }}<code>{{ data.selection.algorithm }}</code></dd></div><div><dt>{{ m.sourceUnit }}</dt><dd><TermText :text="data.dataset.anatomicalWeightUnit" /></dd></div><div><dt>{{ m.orientation }}</dt><dd><TermText :text="data.dataset.orientation" /></dd></div><div><dt>{{ m.fileLicence }}</dt><dd>{{ m.licenceUnverified }} <code>{{ data.dataset.license.status }}</code></dd></div></dl><details v-if="data" class="source-files"><summary>{{ m.sourceFiles }}</summary><div v-for="source in data.dataset.sources" :key="source.sha256"><a :href="source.url">{{ source.name }}</a><p>{{ m.acquiredLead }}<TermText :text="source.downloadedAtUtc" /></p><p>SHA-256: <code>{{ source.sha256 }}</code></p></div></details><ul class="primary-sources"><li v-for="source in sources" :key="source.url"><a :href="source.url">{{ source.title }} <span aria-hidden="true">↗</span></a></li></ul><p class="source-purpose">{{ m.sourcePurpose }}</p></section>
    <div class="assumptions-next"><a :href="withBase('/ogren/devreyi-okumak')">{{ m.backToReading }} <span aria-hidden="true">←</span></a><a :href="BASE" class="assumptions-primary">{{ m.toExperiment }} <span aria-hidden="true">→</span></a></div>
  </main>
</template>

<style scoped>
.assumptions-page{padding-bottom:64px;outline:none}.assumptions-intro{display:flex;justify-content:space-between;align-items:flex-start;gap:30px;padding:51px 0 31px}.assumptions-eyebrow{font:10px/1.8 var(--mono,monospace);letter-spacing:1.2px;color:var(--theme-muted, #5a6b55)}.assumptions-intro h1{font:400 59px/1.13 var(--serif,Georgia,serif);letter-spacing:-1.8px;margin:18px 0 22px;max-width:780px}.assumptions-intro h1 em{color:var(--theme-muted, #476f5b)}.assumptions-summary{font-size:17px;line-height:1.9;max-width:760px}.assumptions-meta{font-size:12px;line-height:1.8;color:var(--theme-muted, #5d6a57);margin-top:17px}.assumptions-reset{background:var(--theme-surface-soft, #eef2e5);border:1px solid var(--theme-border, #c5d0ba);border-radius:5px;min-height:44px;padding:12px 15px;font-size:12px;line-height:1.8;color:var(--theme-muted, #4e6844);margin-top:22px;flex:none}.assumptions-boundary{border-left:3px solid #7f9871;background:var(--theme-surface-soft, #eaf0e1);padding:17px 21px;font-size:13px;line-height:1.9}.assumptions-boundary strong{font-weight:500}.assumptions-boundary p{margin-top:6px}.assumptions-navigation{display:flex;gap:10px;flex-wrap:wrap;margin:27px 0 31px}.assumptions-navigation a{border:1px solid var(--theme-border, #cbd4c0);border-radius:5px;font-size:11px;line-height:1.8;padding:11px 14px;min-height:44px;background:var(--theme-surface, #f8f9ef)}.assumptions-navigation a:hover{background:var(--theme-surface-soft, #eaf0e0)}.assumptions-section{border-top:1px solid var(--theme-border, #daddd2);padding:35px 0 39px;scroll-margin-top:25px;outline:none}.assumptions-section h2{font:400 31px/1.4 var(--serif,Georgia,serif);letter-spacing:-.6px;margin:12px 0 20px}.assumptions-paragraph{font-size:14px;line-height:2;color:var(--theme-muted, #4c634b);max-width:920px;margin:16px 0}.data-load-state{font-size:12px;line-height:1.9;color:var(--theme-muted, #566d4a);margin-top:24px}.assumptions-error,.stale-warning,.window-note{border-left:3px solid #a87d3e;background:var(--theme-surface-soft, #f4eddb);color:var(--theme-warning, #7a5a30);font-size:12px;line-height:1.95;padding:14px 17px;margin-top:16px}.assumptions-error button{border:1px solid #b9ac85;border-radius:5px;background:var(--theme-warning-bg, #efe4ca);color:var(--theme-warning, #725b31);font-size:12px;min-height:44px;padding:11px 16px;margin-top:13px}.source-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 25px;padding:23px;border:1px solid var(--theme-border, #cbd6be);border-radius:7px;background:var(--theme-surface-soft, #edf2e4);margin-top:20px}.source-counts>div{display:flex;align-items:center;justify-content:space-between;gap:14px}.source-counts span{font-size:12px;line-height:1.9}.source-counts strong{font:28px/1.4 var(--serif,Georgia,serif);font-weight:400}.source-counts>p{grid-column:1/-1;font-size:11px;line-height:1.9;color:var(--theme-muted, #596c52)}.evidence-table{width:100%;table-layout:fixed;border-collapse:collapse;margin:27px 0 23px;font-size:12px;line-height:1.95}.evidence-table caption{text-align:left;font-size:13px;margin-bottom:12px;font-weight:500}.evidence-table th,.evidence-table td{padding:16px 17px;vertical-align:top;text-align:left;border:1px solid var(--theme-border, #d6dfca);overflow-wrap:anywhere;white-space:normal}.evidence-table th{font-weight:500;background:var(--theme-surface-soft, #e8efde)}.evidence-table td{background:var(--theme-surface, #fafbf4);color:var(--theme-muted, #52694c)}.normalization-formulas{border:1px solid var(--theme-border, #cbd6be);border-radius:7px;background:var(--theme-surface-soft, #eef3e6);padding:23px;margin:25px 0}.normalization-formulas h3,.omitted-boundary h3{font:400 24px/1.5 var(--serif,Georgia,serif);margin:0 0 16px}.normalization-formulas p{font-size:12px;line-height:1.95;margin-top:14px;color:var(--theme-muted, #566d48)}.normalization-formulas code{display:block;font:11px/2 var(--mono,monospace);background:var(--theme-surface, #f7f9ef);border-radius:4px;padding:11px 13px;margin-top:11px;overflow-wrap:anywhere}.omitted-boundary{border:1px solid var(--theme-border, #ced8c1);background:var(--theme-surface-soft, #edf1e3);border-radius:7px;padding:23px;margin-top:23px}.omitted-boundary p{font-size:12px;line-height:1.95;color:var(--theme-muted, #576c50);margin-top:10px}.assumptions-workspace{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:24px;margin-top:28px;align-items:start}.assumptions-controls,.assumptions-observation{border:1px solid var(--theme-border, #cbd5bf);border-radius:8px;padding:24px;min-width:0;background:var(--theme-surface, #fafbf4)}.assumptions-controls{background:var(--theme-surface-soft, #eff3e7)}.assumptions-workspace h3{font:400 24px/1.5 var(--serif,Georgia,serif);margin:0 0 19px}.assumptions-controls>label,.comparison-control label{font-size:12px;line-height:1.9;display:block;margin-bottom:9px}.assumptions-controls select{width:100%;min-height:45px;font-size:12px;background:var(--theme-surface, #fafbf5)}.comparison-control{margin-top:24px}.comparison-control label output{display:block;font:18px/1.8 var(--mono,monospace);color:var(--theme-muted, #426c3b);margin-top:8px}.comparison-control input{display:block;height:32px;width:100%;margin:0;accent-color:#487950}.comparison-control p,.chosen-explanation{font-size:12px;line-height:1.95;color:var(--theme-muted, #576d4a);margin-top:13px}.fixed-conditions{border-top:1px solid var(--theme-border, #d2ddc5);padding-top:18px;margin-top:22px;font-size:11px;line-height:1.95;color:var(--theme-muted, #586c4d)}.fixed-conditions strong{font-weight:500}.fixed-conditions p{margin-top:9px}.assumptions-primary{background:#355a3d;border-radius:5px;color:#faf8e8;font-size:12px;line-height:1.8;min-height:44px;padding:12px 17px}.run-button{margin-top:23px}.assumptions-primary span{margin-left:12px}.run-button:disabled{opacity:.55;cursor:default}.run-status{font-size:11px;line-height:1.95;color:var(--theme-muted, #556d48);min-height:21px;margin-top:13px}.wait-for-data{font-size:11px;line-height:1.95;color:var(--theme-muted, #676850);margin-top:12px}.not-run{min-height:250px;border:1px dashed var(--theme-border, #c8d4bb);border-radius:6px;background:var(--theme-surface-soft, #f1f5e9);padding:29px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;color:var(--theme-muted, #596c4d)}.not-run p{font-size:13px;line-height:1.9;max-width:320px}.not-run p+p{font-size:11px;margin-top:13px}.record-heading{display:flex;justify-content:space-between;gap:13px;flex-wrap:wrap;font-size:11px;line-height:1.8;color:var(--theme-muted, #536d49);padding-bottom:14px;border-bottom:1px solid var(--theme-border, #d8e1cc)}.record-heading>span:first-child{font-family:var(--mono,monospace)}.record-heading>span:last-child{font-size:10px}.record-settings{font-size:11px;line-height:1.95;color:var(--theme-muted, #576c4e);margin-top:18px}.record-settings strong{font-weight:500}.record-settings p{margin-top:9px}.assumptions-chart-scale{display:flex;flex-wrap:wrap;gap:11px;justify-content:space-between;font-size:10px;line-height:1.9;margin-top:23px;color:var(--theme-muted, #5a6c51)}.assumptions-chart-scale label{display:flex;align-items:center;gap:7px;cursor:pointer}.assumptions-chart-scale input{width:16px;height:16px;accent-color:#49794b;flex:none}.assumptions-chart-scale output{font-family:var(--mono,monospace)}.metrics-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px;line-height:1.9;margin-top:23px}.metrics-table caption{text-align:left;color:var(--theme-muted, #576d4b);font-size:11px;margin-bottom:11px}.metrics-table th,.metrics-table td{padding:11px 8px;border-bottom:1px solid var(--theme-border, #d9e0ce);text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:normal}.metrics-table th{font-weight:500}.metrics-table thead{background:var(--theme-surface-soft, #e9f0df)}.metrics-table th:first-child{width:45%}.metrics-table td{font:11px/1.9 var(--mono,monospace)}.delta-metrics{display:grid;gap:13px;margin:20px 0 0}.delta-metrics>div{display:flex;justify-content:space-between;gap:18px;border-top:1px solid var(--theme-border, #dce4d2);padding-top:12px}.delta-metrics dt{font-size:11px;line-height:1.9;color:var(--theme-muted, #576c4a);max-width:340px}.delta-metrics dd{font:13px/1.9 var(--mono,monospace);margin:0;white-space:nowrap}.metric-note{font-size:11px;line-height:1.95;color:var(--theme-muted, #5b6b52);margin-top:18px}.result-meaning{background:var(--theme-surface-soft, #eaf1e1);border-radius:6px;padding:19px;margin-top:21px}.result-meaning p+p{font-size:12px;line-height:1.95;color:var(--theme-muted, #536e46);margin-top:12px}.source-examples{margin-top:28px;padding:24px;border:1px solid var(--theme-border, #c9d6ba);border-radius:8px;background:var(--theme-surface-soft, #eef3e5)}.source-examples>h3{font:400 27px/1.5 var(--serif,Georgia,serif);margin:0 0 14px}.source-examples>p{font-size:12px;line-height:1.95;color:var(--theme-muted, #566d48);margin-top:14px}.example-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:22px}.example-card{background:var(--theme-surface, #fafbf3);border:1px solid var(--theme-border, #ccd8c0);border-radius:6px;padding:20px;min-width:0}.example-card h4{font:400 23px/1.5 var(--serif,Georgia,serif);margin:0 0 17px}.example-card dl{margin:0}.example-card dl>div{display:grid;grid-template-columns:1fr 1fr;gap:16px;border-top:1px solid var(--theme-border, #dde5d3);padding:12px 0;font-size:11px;line-height:1.95}.example-card dt{color:var(--theme-muted, #586c4d)}.example-card dd{margin:0;overflow-wrap:anywhere}.validation-distinction{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:25px}.validation-distinction>div{background:var(--theme-surface-soft, #edf2e4);border:1px solid var(--theme-border, #cbd6be);border-radius:6px;padding:21px}.validation-distinction h3{font:400 24px/1.5 var(--serif,Georgia,serif);margin:0 0 13px}.validation-distinction p{font-size:12px;line-height:1.95;color:var(--theme-muted, #576d4b)}.provenance-facts{max-width:960px;margin:24px 0 0}.provenance-facts>div{display:grid;grid-template-columns:210px minmax(0,1fr);gap:21px;border-top:1px solid var(--theme-border, #daddd2);padding:14px 0;font-size:12px;line-height:1.95}.provenance-facts dt{font-weight:500;color:var(--theme-muted, #566d4b)}.provenance-facts dd{margin:0;overflow-wrap:anywhere}.provenance-facts code{font:10px/1.95 var(--mono,monospace);display:block;color:var(--theme-muted, #5d6b53);margin-top:6px}.source-files{max-width:960px;border-top:1px solid var(--theme-border, #daddd2);margin-top:24px;padding-top:18px}.source-files summary{font-size:12px;line-height:1.95;min-height:36px;cursor:pointer}.source-files>div{border-top:1px solid var(--theme-border, #daddd2);padding:17px 0;font-size:11px;line-height:1.95}.source-files p{margin-top:10px;overflow-wrap:anywhere}.source-files code{font:10px/1.95 var(--mono,monospace)}.source-files a,.primary-sources a{text-decoration:underline;text-decoration-color:var(--theme-border, #adc09d);text-underline-offset:3px}.primary-sources{padding-left:20px;margin:24px 0 0}.primary-sources li{font-size:12px;line-height:1.95;margin-bottom:12px;overflow-wrap:anywhere}.source-purpose{font-size:11px;line-height:1.95;color:var(--theme-muted, #5a6c50);margin-top:19px}.assumptions-next{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:25px;border:1px solid var(--theme-border, #cbd5be);border-radius:7px;background:var(--theme-surface-soft, #e9efdf)}.assumptions-next a{font-size:12px;line-height:1.9;padding:11px 4px}.assumptions-next a.assumptions-primary{padding:12px 17px}.assumptions-next span{margin-left:11px}
.fixed-conditions.no-rule{border-top:0;padding-top:0;margin-top:0}.sweep-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px;line-height:1.9;margin-top:23px}.sweep-table caption{text-align:left;color:var(--theme-muted, #576d4b);font-size:11px;margin-bottom:11px}.sweep-table th,.sweep-table td{padding:7px 8px;border-bottom:1px solid var(--theme-border, #d9e0ce);text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:normal}.sweep-table thead{background:var(--theme-surface-soft, #e9f0df)}.sweep-table th{font-weight:500;color:var(--theme-text, #263b35)}.sweep-table th:first-child{width:31%}.sweep-table td{font:11px/1.9 var(--mono,monospace)}.sweep-table tr[data-regime="at"]>*{background:var(--theme-warning-bg, #efe4ca)}.sweep-table .regime{display:inline;margin-left:8px;font-size:10px;font-weight:400;color:var(--theme-muted, #4f6247)}.sweep-table td.failed-cell{font-family:inherit;color:var(--theme-danger, #92574b)}
@media(max-width:1050px){.assumptions-intro h1{font-size:53px}.assumptions-reset{font-size:11px}.assumptions-controls,.assumptions-observation{padding:19px}.assumptions-workspace{gap:18px;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)}.source-counts>div{flex-direction:column;align-items:flex-start;gap:8px}.evidence-table th,.evidence-table td{padding:14px}.example-card dl>div{grid-template-columns:1fr;gap:7px}}
@media(max-width:760px){.sweep-table,.sweep-table td{font-size:10px}.sweep-table th,.sweep-table td{padding:8px 4px}.sweep-table th:first-child{width:28%}.assumptions-intro{padding:34px 0 26px;flex-direction:column;gap:21px}.assumptions-intro h1{font-size:44px;letter-spacing:-1.4px;margin:16px 0 20px}.assumptions-summary{font-size:15px}.assumptions-meta{font-size:11px}.assumptions-reset{margin:0}.assumptions-boundary{padding:15px 17px;font-size:12px}.assumptions-navigation{gap:7px;margin:23px 0 26px}.assumptions-navigation a{font-size:10px;padding:10px 11px}.assumptions-section{padding:28px 0 34px}.assumptions-section h2{font-size:28px}.assumptions-paragraph{font-size:13px}.source-counts{padding:19px;grid-template-columns:1fr;gap:12px}.source-counts>div{flex-direction:row;align-items:center;gap:14px}.source-counts span{font-size:11px}.source-counts strong{font-size:25px}.evidence-table{font-size:10px;line-height:1.9}.evidence-table caption{font-size:12px;line-height:1.9}.evidence-table th,.evidence-table td{padding:11px 7px}.normalization-formulas{padding:20px 16px}.normalization-formulas h3,.omitted-boundary h3{font-size:23px}.normalization-formulas code{font-size:10px;padding:10px}.normalization-formulas p{font-size:11px}.omitted-boundary{padding:20px}.omitted-boundary p{font-size:11px}.assumptions-workspace{grid-template-columns:1fr;gap:16px;margin-top:23px}.assumptions-controls,.assumptions-observation{padding:20px 14px}.assumptions-workspace h3{font-size:23px}.assumptions-controls select{font-size:11px}.chosen-explanation,.comparison-control p{font-size:11px}.run-button{width:100%}.assumptions-chart-scale{font-size:10px}.metrics-table{font-size:10px}.metrics-table th,.metrics-table td{padding:10px 5px}.metrics-table td{font-size:10px}.metrics-table th:first-child{width:43%}.delta-metrics>div{flex-direction:column;gap:6px}.delta-metrics dd{font-size:13px}.window-note,.stale-warning,.assumptions-error{font-size:11px;padding:13px 14px}.result-meaning{padding:17px 14px}.result-meaning p+p{font-size:11px}.source-examples{padding:20px 14px}.source-examples>h3{font-size:25px}.source-examples>p{font-size:11px}.example-grid,.validation-distinction{grid-template-columns:1fr;gap:15px}.example-card{padding:19px 15px}.example-card h4{font-size:22px}.example-card dl>div{font-size:11px;gap:6px}.validation-distinction>div{padding:20px}.validation-distinction h3{font-size:23px}.validation-distinction p{font-size:11px}.provenance-facts>div{grid-template-columns:1fr;gap:7px;font-size:11px}.primary-sources li{font-size:11px}.assumptions-next{flex-direction:column;align-items:stretch;padding:21px;gap:10px}.assumptions-next a{text-align:center;font-size:11px}}
@media(prefers-reduced-motion:reduce){.assumptions-page *{scroll-behavior:auto!important}}
</style>
