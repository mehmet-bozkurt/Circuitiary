<script setup lang="ts">
import TermText from './components/TermText.vue'
import { BASE, DEMO, LOCAL_DATA_URL, appPath, demoDataNotice } from './siteBase'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import CircuitGraph from './components/CircuitGraph.vue'
import CircuitGraph3D from './components/CircuitGraph3D.vue'
import ActivationChart from './components/ActivationChart.vue'
import ChartDataTable from './components/ChartDataTable.vue'
import PinnedComparison from './components/PinnedComparison.vue'
import type { PinnedCurve } from './pinnedCurve'
import { SHORTCUT_STEP_MS, stepTime, useExperimentShortcuts } from './useExperimentShortcuts'
import type { ShortcutAction } from './useExperimentShortcuts'
import { illustrativeCircuit, illustrativeCircuitEn, defaultConfig } from './model/circuit'
import { simulate } from './model/simulation'
import { parseRealConnectome, buildRealCircuit, defaultRealModelParameters } from './model/realConnectome'
import type { SimulationConfig } from './model/types'
import { prepareRealInspection } from './learning/readingHandoff'
import type { ExperimentDraft } from './learning/readingHandoff'
import { decimal, withComma } from './format'
import { L, useMessages } from './i18n'
import { messages } from './App.messages'
import ExperimentTools from './components/ExperimentTools.vue'
import { csvFile, jsonFile } from './exportData'
import { version as appVersion } from '../package.json'
import { buildShareUrl, parseShareQuery, restrictToCircuit, shareNotice, withoutRealSelections } from './shareState'
import type { ShareParse, ShareState } from './shareState'
import { NOISE_HOLD_MS, exportedStimulusModel, hasCustomInput, inputWaveform, nextNoiseSeed, protocolStimulus, resolveProtocol, stimulusDefaults, stimulusRanges, stimulusShapes } from './stimulusProtocol'

// The shell keeps this page mounted but hidden behind the lesson pages; the
// playback loop stays idle there and continues from the same time on return.
const props = defineProps<{ suspended?: boolean }>()
const m = useMessages(messages)
type Condition = 'baseline' | 'silenced' | 'tau'
type GraphView = '2d' | '3d'
const graphView = ref<GraphView>('2d')
type RealData = ReturnType<typeof parseRealConnectome>
const mode = ref<'illustrative' | 'real'>('illustrative')
const realData = shallowRef<RealData>()
const dataLoading = ref(false)
// Status and error lines are kept as functions so they follow a later language change.
const dataError = ref<(() => string) | null>(null)
const chemicalGain = ref(defaultRealModelParameters.chemicalGain)
const gapGain = ref(defaultRealModelParameters.gapGain)
const focusConnections = ref(true)
const scaleToResponse = ref(false)
const isReal = computed(() => mode.value === 'real')
// Both branches read the language (buildRealCircuit writes its text in it), so the circuit's text follows a switch.
const circuit = computed(() => isReal.value && realData.value
  ? buildRealCircuit(realData.value, { chemicalGain: chemicalGain.value, gapGain: gapGain.value })
  : L(illustrativeCircuit, illustrativeCircuitEn))
const conditionStyles: { id: Condition; short: string; color: string }[] = [
  { id: 'baseline', short: 'A', color: 'var(--theme-trace-green, #2f7960)' },
  { id: 'silenced', short: 'B', color: 'var(--theme-trace-red, #bb695e)' },
  { id: 'tau', short: 'C', color: 'var(--theme-trace-blue, #647fb3)' },
]
const conditions = computed(() => conditionStyles.map(({ id, short, color }) => ({ id, label: m.value.conditions[id], short, color })))
const activeCondition = ref<Condition>('baseline')
const stimulusTarget = ref('S1')
const amplitude = ref(defaultConfig.stimulus.amplitude)
const pulseDuration = ref(defaultConfig.stimulus.durationMs)
// Stimulus protocol (stimulusProtocol.ts): the shape of the input and an optional reproducible pseudo-random addition.
const stimulusShape = ref(stimulusDefaults.stimulusShape)
const sinePeriod = ref(stimulusDefaults.sinePeriod)
const noiseAmplitude = ref(stimulusDefaults.noiseAmplitude)
const noiseSeed = ref(stimulusDefaults.noiseSeed)
const baseTau = ref(defaultConfig.tauMs)
const changedTau = ref(90)
const changedNeuron = ref('O1')
const selectedEdge = ref('I3-O1')
const outputNeuron = ref('O1')
const selectedNeuron = ref('S1')
const dt = ref(defaultConfig.dtMs)
const cursorMs = ref(250)
const playing = ref(false)
let frame = 0
let previousTime = 0
let dataRequest: AbortController | undefined
let readingToyDraft: Readonly<ExperimentDraft> | undefined

const inputNeurons = computed(() => isReal.value ? circuit.value.neurons : circuit.value.neurons.filter(n => n.role === 'input'))
const readoutNeurons = computed(() => isReal.value ? circuit.value.neurons : circuit.value.neurons.filter(n => n.role === 'output'))
const chemicalCount = computed(() => circuit.value.connections.filter(e => e.kind !== 'gap').length)
const gapCount = computed(() => circuit.value.connections.filter(e => e.kind === 'gap').length)
const visibleEdgeCount = computed(() => isReal.value && focusConnections.value
  ? circuit.value.connections.filter(e => e.source === selectedNeuron.value || e.target === selectedNeuron.value).length
  : circuit.value.connections.length)
const baselineSettings = computed<SimulationConfig>(() => ({
  ...defaultConfig, dtMs: dt.value, tauMs: baseTau.value,
  // With the default protocol this is exactly the stimulus object the page always passed: no extra keys.
  stimulus: protocolStimulus(
    { ...defaultConfig.stimulus, target: stimulusTarget.value, amplitude: amplitude.value, durationMs: pulseDuration.value },
    { stimulusShape: stimulusShape.value, sinePeriod: sinePeriod.value, noiseAmplitude: noiseAmplitude.value, noiseSeed: noiseSeed.value },
  ),
}))
// The input I(t) at the recorded times, for the chart; null for the plain pulse, which the yellow band already shows. Not a simulation run.
const inputValues = computed(() => hasCustomInput(baselineSettings.value.stimulus) ? inputWaveform(baselineSettings.value.stimulus, baselineResult.value.timesMs) : null)
const INPUT_COLOR = 'var(--theme-trace-gold, #8c6417)'
const INPUT_FORMULAS = { pulse: 'I(t) = A', ramp: 'I(t) = A · (t − t₀) / T', sine: 'I(t) = A · (1 − cos(2π(t − t₀) / P)) / 2' } as const
const NOISE_FORMULA = ' + g · u(s, ⌊(t − t₀) / h⌋)'
// One computed per condition: a control only re-runs the simulations it feeds
// (the tau slider costs one run, not the three conditions plus the check).
const baselineResult = computed(() => simulate(circuit.value, baselineSettings.value))
const silencedResult = computed(() => simulate(circuit.value, { ...baselineSettings.value, silencedConnectionId: selectedEdge.value }))
const tauResult = computed(() => simulate(circuit.value, { ...baselineSettings.value, tauOverrides: { [changedNeuron.value]: changedTau.value } }))
const results = computed(() => ({ baseline: baselineResult.value, silenced: silencedResult.value, tau: tauResult.value }))
const currentResult = computed(() => results.value[activeCondition.value])
const sampleIndex = computed(() => Math.min(currentResult.value.timesMs.length - 1, Math.round(cursorMs.value / dt.value)))
const timeDigits = computed(() => (String(dt.value).split('.')[1] ?? '').length)
const displayedTimeMs = computed(() => currentResult.value.timesMs[sampleIndex.value] ?? 0)
const nodeActivity = computed(() => Object.fromEntries(circuit.value.neurons.map(neuron => [neuron.id, currentResult.value.activity[neuron.id]?.[sampleIndex.value] ?? 0])))
const selected = computed(() => circuit.value.neurons.find(neuron => neuron.id === selectedNeuron.value) ?? circuit.value.neurons[0]!)
const selectedAnatomy = computed(() => realData.value?.neurons.find(n => n.id === selectedNeuron.value))
const traces = computed(() => conditions.value.map(condition => ({ ...condition, values: results.value[condition.id].activity[outputNeuron.value] ?? [] })))
const peaks = computed(() => Object.fromEntries(conditionStyles.map(condition => [condition.id, Math.max(...(results.value[condition.id].activity[outputNeuron.value] ?? [0]))])) as Record<Condition, number>)
// Pin and compare: one recorded curve stays on the chart while the settings change (pinnedCurve.ts).
const pinned = shallowRef<PinnedCurve | null>(null)
const PINNED_COLOR = 'var(--theme-trace-neutral, #5f665c)'
const PINNED_DASH = '9 3 2 3'
function pinCurve() {
  pinned.value = {
    condition: activeCondition.value, output: outputNeuron.value,
    timesMs: currentResult.value.timesMs, values: currentResult.value.activity[outputNeuron.value] ?? [],
    peak: peaks.value[activeCondition.value], settings: { ...shareState.value },
  }
}
// A pinned curve belongs to one circuit: the other mode has other cells.
watch(mode, () => { pinned.value = null })
const conditionNames = computed(() => Object.fromEntries(conditions.value.map(condition => [condition.id, `${condition.short} · ${condition.label}`])) as Record<Condition, string>)
const chartTraces = computed(() => {
  const curve = pinned.value
  if (!curve) return traces.value
  const short = conditionStyles.find(condition => condition.id === curve.condition)!.short
  return [...traces.value, { id: 'pinned', short: '◆', label: m.value.pinnedTrace(short, curve.output), color: PINNED_COLOR, values: curve.values as number[], times: curve.timesMs, dash: PINNED_DASH }]
})
const tablePeaks = computed<Record<string, number>>(() => pinned.value ? { ...peaks.value, pinned: pinned.value.peak } : peaks.value)
const edgeName = (id: string) => { const edge = circuit.value.connections.find(candidate => candidate.id === id); return edge ? edgeLabel(edge) : id }
const chartYMax = computed(() => {
  if (!scaleToResponse.value) return 1
  const target = Math.max(0.01, ...Object.values(peaks.value), pinned.value?.peak ?? 0) * 1.15
  const decade = 10 ** Math.floor(Math.log10(target))
  const ratio = target / decade
  const nice = [1, 2, 5, 10].find(value => value >= ratio) ?? 10
  return Math.min(1, nice * decade)
})
const convergenceError = computed(() => {
  const refined = simulate(circuit.value, { ...baselineSettings.value, dtMs: dt.value / 2 })
  let maxError = 0
  for (const neuron of circuit.value.neurons) {
    baselineResult.value.activity[neuron.id]!.forEach((value, index) => {
      maxError = Math.max(maxError, Math.abs(value - (refined.activity[neuron.id]?.[index * 2] ?? 0)))
    })
  }
  return maxError
})
const roleName = (role: string) => m.value.roles[role] ?? role
const format = (value: number, digits = 3) => decimal(value, digits)
const edgeLabel = (edge: typeof circuit.value.connections[number]) => `${edge.source} ${edge.kind === 'gap' ? '↔' : '→'} ${edge.target}`
const selectedConnection = computed(() => circuit.value.connections.find(e => e.id === selectedEdge.value))
const interpretation = computed(() => activeCondition.value === 'baseline'
  ? m.value.readBaseline
  : activeCondition.value === 'silenced'
    ? m.value.readSilenced(selectedConnection.value ? edgeLabel(selectedConnection.value) : selectedEdge.value, selectedConnection.value?.kind === 'gap')
    : m.value.readTau(changedNeuron.value, changedTau.value))

function chooseGraphView(next: GraphView, focusTab = false) {
  graphView.value = next
  // View changes intentionally leave all experiment state and playback intact.
  if (focusTab) void nextTick(() => document.getElementById(`graph-tab-${next}`)?.focus())
}
function graphTabKeydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const next: GraphView = event.key === 'Home' ? '2d' : event.key === 'End' ? '3d' : graphView.value === '2d' ? '3d' : '2d'
  chooseGraphView(next, true)
}
function stopLoop() { cancelAnimationFrame(frame); previousTime = 0 }
function startLoop() { previousTime = 0; if (!props.suspended) frame = requestAnimationFrame(tick) }
function pause() { playing.value = false; stopLoop() }
function tick(time: number) {
  if (!playing.value) return
  if (previousTime) cursorMs.value = Math.min(defaultConfig.durationMs, cursorMs.value + (time - previousTime) * 0.22)
  previousTime = time
  if (cursorMs.value >= defaultConfig.durationMs) { pause(); return }
  frame = requestAnimationFrame(tick)
}
function togglePlayback() {
  if (playing.value) { pause(); return }
  if (cursorMs.value >= defaultConfig.durationMs) cursorMs.value = 0
  playing.value = true; startLoop()
}
// Hidden: keep `playing` (the draft and button state) but stop advancing time.
watch(() => props.suspended, suspended => { if (suspended) stopLoop(); else if (playing.value) startLoop() })
function seek(time: number) { pause(); cursorMs.value = time }
// Page-level keys (Space, arrows, Home); the pure decision lives in useExperimentShortcuts.ts.
const shortcutMessage = ref<(() => string) | null>(null)
function runShortcut(action: ShortcutAction) {
  if (action === 'toggle-playback') {
    togglePlayback()
    const nowPlaying = playing.value
    shortcutMessage.value = () => nowPlaying ? m.value.statusPlaying : m.value.statusPaused
    return
  }
  const time = action === 'to-start' ? 0 : stepTime(cursorMs.value, action === 'step-forward' ? 1 : -1, defaultConfig.durationMs)
  seek(time)
  const recorded = currentResult.value.timesMs
  const shownTime = recorded[Math.min(recorded.length - 1, Math.round(time / dt.value))] ?? time
  const digits = timeDigits.value
  shortcutMessage.value = () => m.value.statusTime(format(shownTime, digits))
}
useExperimentShortcuts({ suspended: () => Boolean(props.suspended), onAction: runShortcut })
function reset() {
  pause(); amplitude.value = defaultConfig.stimulus.amplitude; pulseDuration.value = defaultConfig.stimulus.durationMs
  stimulusShape.value = stimulusDefaults.stimulusShape; sinePeriod.value = stimulusDefaults.sinePeriod
  noiseAmplitude.value = stimulusDefaults.noiseAmplitude; noiseSeed.value = stimulusDefaults.noiseSeed
  baseTau.value = defaultConfig.tauMs; changedTau.value = 90
  chemicalGain.value = defaultRealModelParameters.chemicalGain; gapGain.value = defaultRealModelParameters.gapGain
  stimulusTarget.value = isReal.value ? 'AVER' : 'S1'; outputNeuron.value = isReal.value ? 'AVAR' : 'O1'
  changedNeuron.value = outputNeuron.value; selectedNeuron.value = stimulusTarget.value
  selectedEdge.value = isReal.value
    ? (circuit.value.connections.find(e => e.source === 'AVER' && e.target === 'AVAR' && e.kind !== 'gap')?.id ?? circuit.value.connections[0]!.id)
    : 'I3-O1'
  focusConnections.value = true; scaleToResponse.value = isReal.value; activeCondition.value = 'baseline'; dt.value = defaultConfig.dtMs; cursorMs.value = 250
}
async function chooseMode(next: 'illustrative' | 'real') {
  if (dataLoading.value) return
  if (next === 'illustrative' && readingToyDraft) {
    const draft = readingToyDraft
    readingToyDraft = undefined
    applyExperimentDraft(draft)
    return
  }
  if (next === mode.value) return
  if (next === 'real' && !realData.value) {
    // The online demo has no local data endpoint: say so instead of asking for it.
    if (DEMO) { dataError.value = demoDataNotice; return }
    dataLoading.value = true; dataError.value = null
    dataRequest = new AbortController()
    const timeout = setTimeout(() => dataRequest?.abort(), 10000)
    try {
      const response = await fetch(LOCAL_DATA_URL, { cache: 'no-store', signal: dataRequest.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      realData.value = parseRealConnectome(await response.json())
    } catch {
      dataError.value = () => m.value.dataLoadFailed
      return
    } finally { clearTimeout(timeout); dataRequest = undefined; dataLoading.value = false }
  }
  mode.value = next; reset()
}
function captureExperimentDraft(): Readonly<ExperimentDraft> {
  return Object.freeze({ mode: mode.value, graphView: graphView.value, chemicalGain: chemicalGain.value, gapGain: gapGain.value,
    focusConnections: focusConnections.value, scaleToResponse: scaleToResponse.value, activeCondition: activeCondition.value,
    stimulusTarget: stimulusTarget.value, amplitude: amplitude.value, pulseDuration: pulseDuration.value,
    stimulusShape: stimulusShape.value, sinePeriod: sinePeriod.value, noiseAmplitude: noiseAmplitude.value, noiseSeed: noiseSeed.value,
    baseTau: baseTau.value, changedTau: changedTau.value, changedNeuron: changedNeuron.value,
    selectedEdge: selectedEdge.value, outputNeuron: outputNeuron.value, selectedNeuron: selectedNeuron.value,
    dt: dt.value, cursorMs: cursorMs.value, playing: playing.value })
}
function applyExperimentDraft(draft: Readonly<ExperimentDraft>) {
  pause()
  mode.value = draft.mode; graphView.value = draft.graphView
  chemicalGain.value = draft.chemicalGain; gapGain.value = draft.gapGain
  focusConnections.value = draft.focusConnections; scaleToResponse.value = draft.scaleToResponse
  activeCondition.value = draft.activeCondition; stimulusTarget.value = draft.stimulusTarget
  amplitude.value = draft.amplitude; pulseDuration.value = draft.pulseDuration
  const protocol = resolveProtocol(draft)
  stimulusShape.value = protocol.stimulusShape; sinePeriod.value = protocol.sinePeriod
  noiseAmplitude.value = protocol.noiseAmplitude; noiseSeed.value = protocol.noiseSeed
  baseTau.value = draft.baseTau; changedTau.value = draft.changedTau; changedNeuron.value = draft.changedNeuron
  selectedEdge.value = draft.selectedEdge; outputNeuron.value = draft.outputNeuron; selectedNeuron.value = draft.selectedNeuron
  dt.value = draft.dt; cursorMs.value = draft.cursorMs
  if (draft.playing) togglePlayback()
}
async function inspectAnatomicalNeuron(neuronId: string, shouldCommit: () => boolean = () => true): Promise<
  { ok: true; graphView: GraphView } | { ok: false; message: () => string; cancelled?: boolean }
> {
  // Messages are returned as functions so the caller's error line follows a later language change.
  if (!shouldCommit()) return { ok: false, message: () => '', cancelled: true }
  if (dataLoading.value) return { ok: false, message: () => m.value.inspectLoading }
  if (!realData.value) {
    if (DEMO) return { ok: false, message: demoDataNotice }
    dataLoading.value = true; dataError.value = null
    dataRequest = new AbortController()
    const timeout = setTimeout(() => dataRequest?.abort(), 10000)
    try {
      const response = await fetch(LOCAL_DATA_URL, { cache: 'no-store', signal: dataRequest.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      realData.value = parseRealConnectome(await response.json())
    } catch {
      return { ok: false, message: () => m.value.inspectLoadFailed }
    } finally { clearTimeout(timeout); dataRequest = undefined; dataLoading.value = false }
  }
  // Navigation during the fetch cancels the handoff, rather than changing a
  // hidden experiment or pulling the user away from their newer destination.
  if (!shouldCommit()) return { ok: false, message: () => '', cancelled: true }
  const before = captureExperimentDraft()
  let next: Readonly<ExperimentDraft>
  try { next = prepareRealInspection(before, realData.value, neuronId) }
  catch { return { ok: false, message: () => m.value.inspectNotInSubgraph } }
  if (before.mode === 'real') selectedNeuron.value = neuronId
  else {
    readingToyDraft ??= before
    applyExperimentDraft(next)
  }
  return { ok: true, graphView: graphView.value }
}
defineExpose({ inspectAnatomicalNeuron })
function exportExperiment() {
  const record = {
    schemaVersion: isReal.value ? 2 : 1, project: 'Circuitiary', circuit: circuit.value,
    // The scope sentence and the circuit's own text are written in the language current at the moment of export.
    scope: isReal.value ? m.value.exportScopeReal : m.value.exportScopeIllustrative,
    model: { equation: isReal.value
      ? 'tau_i * dx_i/dt = -x_i + clip(sum_j(w_ij * x_j) + I_i(t), 0, 1) + sum_j(g_ij * (x_j - x_i))'
      : 'tau_i * dx_i/dt = -x_i + clip(sum_j(w_ij * x_j) + I_i(t), 0, 1)',
      method: 'synchronous explicit Euler', activityUnit: 'dimensionless', initialState: 'all zero',
      // '[onsetMs, onsetMs + durationMs)' and `noise: false` for the plain pulse; a shape or the pseudo-random addition is described.
      ...exportedStimulusModel(baselineSettings.value.stimulus),
      biologicalDataset: isReal.value ? realData.value?.dataset : null,
      ...(isReal.value ? { parameters: { chemicalGain: chemicalGain.value, gapGain: gapGain.value },
        chemicalSigns: 'unknown in anatomy; all positive by model assumption',
        chemicalNormalization: 'w(source,target) = chemicalGain * rawWeight / max(1, sum incoming rawWeight to target within subset)',
        gapNormalization: 'g(a,b) = gapGain * rawWeight / max(1, max(sum incident rawWeight at a, sum incident rawWeight at b) within subset)',
        boundary: 'External connections removed; external chemical input zero; external gap effects not modeled. Outside cells are not clamped to zero.',
        timeScale: 'Assumed milliseconds; not calibrated to measured physiology', biologicalValidation: false } : {}),
    },
    ...(isReal.value ? { anatomy: realData.value, display: { graphView: graphView.value, spatialLayout: graphView.value === '3d' ? 'schematic-not-anatomical' : 'reading-grid-not-anatomical', focusConnections: focusConnections.value, selectedNeuron: selectedNeuron.value, scaleToResponse: scaleToResponse.value, chartYMax: chartYMax.value, affectsSimulation: false } } : {}),
    observedOutput: outputNeuron.value, results: results.value,
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = isReal.value ? 'circuitiary-cook2019-local-experiment.json' : 'circuitiary-experiment.json'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
// Share link and exports (cluster share-export). The state that defines the experiment goes into
// query keys (see shareState.ts); the cursor and the playing flag stay out. Nothing here writes the address bar.
const shareNoticeText = ref<(() => string) | null>(null)
const shareState = computed<ShareState>(() => ({
  mode: mode.value, graphView: graphView.value, activeCondition: activeCondition.value,
  chemicalGain: chemicalGain.value, gapGain: gapGain.value, focusConnections: focusConnections.value, scaleToResponse: scaleToResponse.value,
  stimulusTarget: stimulusTarget.value, amplitude: amplitude.value, pulseDuration: pulseDuration.value,
  stimulusShape: stimulusShape.value, sinePeriod: sinePeriod.value, noiseAmplitude: noiseAmplitude.value, noiseSeed: noiseSeed.value,
  baseTau: baseTau.value, changedTau: changedTau.value, changedNeuron: changedNeuron.value,
  selectedEdge: selectedEdge.value, outputNeuron: outputNeuron.value, selectedNeuron: selectedNeuron.value, dt: dt.value,
}))
const shareUrl = computed(() => buildShareUrl(shareState.value, new URL(BASE, location.href).href))
const activeConditionLabel = computed(() => conditions.value.find(condition => condition.id === activeCondition.value)?.label ?? '')
const csvExport = () => csvFile({ mode: mode.value, condition: activeCondition.value, circuit: circuit.value, result: currentResult.value })
const jsonExport = () => jsonFile({ mode: mode.value, circuit: circuit.value, results: results.value, outputCell: outputNeuron.value, appVersion, dataset: realData.value?.dataset })
async function loadRealForLink(): Promise<boolean> {
  if (realData.value) return true
  if (DEMO) return false
  dataLoading.value = true
  dataRequest = new AbortController()
  const timeout = setTimeout(() => dataRequest?.abort(), 10000)
  try {
    const response = await fetch(LOCAL_DATA_URL, { cache: 'no-store', signal: dataRequest.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    realData.value = parseRealConnectome(await response.json())
    return true
  } catch { return false }
  finally { clearTimeout(timeout); dataRequest = undefined; dataLoading.value = false }
}
async function applyShareLink(parsed: ShareParse) {
  if (!parsed.found) return
  let link = parsed
  let realUnavailable = false
  if (link.values.mode === 'real' && !(await loadRealForLink())) { realUnavailable = true; link = withoutRealSelections(link) }
  // Start from the mode's own defaults, then lay the valid parts of the link over them.
  pause(); mode.value = link.values.mode ?? 'illustrative'; reset()
  link = restrictToCircuit(link, {
    stimulusTargets: inputNeurons.value.map(neuron => neuron.id), outputs: readoutNeurons.value.map(neuron => neuron.id),
    neurons: circuit.value.neurons.map(neuron => neuron.id), edges: circuit.value.connections.map(edge => edge.id),
  }, mode.value)
  const v = link.values
  if (v.graphView !== undefined) graphView.value = v.graphView
  if (v.activeCondition !== undefined) activeCondition.value = v.activeCondition
  if (v.stimulusTarget !== undefined) stimulusTarget.value = v.stimulusTarget
  if (v.amplitude !== undefined) amplitude.value = v.amplitude
  if (v.pulseDuration !== undefined) pulseDuration.value = v.pulseDuration
  if (v.stimulusShape !== undefined) stimulusShape.value = v.stimulusShape
  if (v.sinePeriod !== undefined) sinePeriod.value = v.sinePeriod
  if (v.noiseAmplitude !== undefined) noiseAmplitude.value = v.noiseAmplitude
  if (v.noiseSeed !== undefined) noiseSeed.value = v.noiseSeed
  if (v.baseTau !== undefined) baseTau.value = v.baseTau
  if (v.changedNeuron !== undefined) changedNeuron.value = v.changedNeuron
  if (v.changedTau !== undefined) changedTau.value = v.changedTau
  if (v.selectedEdge !== undefined) selectedEdge.value = v.selectedEdge
  if (v.outputNeuron !== undefined) outputNeuron.value = v.outputNeuron
  if (v.selectedNeuron !== undefined) selectedNeuron.value = v.selectedNeuron
  if (v.dt !== undefined) dt.value = v.dt
  if (v.chemicalGain !== undefined) chemicalGain.value = v.chemicalGain
  if (v.gapGain !== undefined) gapGain.value = v.gapGain
  if (v.focusConnections !== undefined) focusConnections.value = v.focusConnections
  if (v.scaleToResponse !== undefined) scaleToResponse.value = v.scaleToResponse
  // The status line must already be on the page, empty, when its text arrives, or screen readers do not announce it.
  await nextTick()
  const outcome = { applied: Object.keys(v).length, ignored: link.ignored, realUnavailable }
  shareNoticeText.value = () => shareNotice(outcome)
}
// Only the experiment page reads a link; another page's own query is none of its business.
if (!appPath(location.pathname).replace(/\/$/, '').startsWith('/ogren/')) void applyShareLink(parseShareQuery(location.search))
onBeforeUnmount(() => { pause(); dataRequest?.abort() })
</script>

<template>
  <header class="site-header">
    <a class="brand" href="#top" :aria-label="m.brandHome">
      <svg viewBox="0 0 44 44" aria-hidden="true"><path d="M10 22 22 9 34 22 22 35Z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10 22h24M22 9v26" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="22" cy="22" r="4" fill="currentColor"/><circle cx="10" cy="22" r="2.6" fill="currentColor"/><circle cx="34" cy="22" r="2.6" fill="currentColor"/></svg>
      Circuitiary
    </a>
    <span class="brand-subtitle">AN ATLAS OF ANIMAL CIRCUITS</span>
    <a class="header-link" href="#assumptions">{{ m.understandModel }} <span aria-hidden="true">↗</span></a>
  </header>

  <main id="top">
    <section class="intro">
      <div>
        <p class="eyebrow"><span class="status-dot"></span> {{ m.notebookKicker }} <TermText :text="isReal ? '002' : '001'" /></p>
        <h1>{{ m.heroLine1 }}<br><em>{{ m.heroLine2 }}</em></h1>
        <p class="intro-copy">{{ m.introCopy1 }}<br class="desktop-break"> {{ m.introCopy2 }}</p>
      </div>
      <div class="intro-note">
        <span class="tag">{{ isReal ? m.tagReal : m.tagIllustrative }}</span>
        <p>{{ m.introNote1 }}<br>{{ m.introNote2 }}</p>
        <span class="small-muted">{{ m.introNoteSmall }}</span>
      </div>
    </section>

    <section class="dataset-switch" :aria-label="m.circuitChoice">
      <div><span class="eyebrow">{{ m.circuitKicker }}</span><p><TermText :text="isReal ? m.circuitReal : m.circuitIllustrative" /></p></div>
      <div class="mode-buttons" role="group" :aria-label="m.circuitMode">
        <button :aria-pressed="!isReal" :disabled="dataLoading" @click="chooseMode('illustrative')">{{ m.modeIllustrative }}</button>
        <button :aria-pressed="isReal" :disabled="dataLoading" @click="chooseMode('real')">{{ dataLoading ? m.dataReading : m.modeReal }}</button>
      </div>
      <p v-if="dataError" class="data-error" role="alert">{{ dataError() }}</p>
    </section>

    <section v-if="isReal && realData" class="data-summary" :aria-label="m.dataSummary">
      <div><span class="tag">{{ m.dataTag }}</span><h2><TermText :text="circuit.neurons.length" /><TermText :text="m.dataHeadingRest" /></h2><p>{{ m.dataLead }}</p></div>
      <div class="data-facts"><span><strong>{{ chemicalCount }}</strong> {{ m.factChemical }}</span><span><strong>{{ gapCount }}</strong> {{ m.factGap }}</span><span>{{ m.factUnitLabel }} <strong>{{ m.factUnitValue }}</strong></span><span>{{ m.factFilesLabel }} <strong>{{ m.factFilesValue }}</strong></span></div>
    </section>

    <section class="experiment-layout" :aria-label="isReal ? m.experimentReal : m.experimentIllustrative">
      <div class="experiment-main">
        <div class="circuit-panel">
          <div class="panel-heading dark-heading">
            <div><span class="eyebrow">{{ m.connectionsKicker }}</span><h2>{{ m.connectionsHeading }}</h2></div>
            <span class="graph-stats">{{ m.cellCount(circuit.neurons.length) }} <span>·</span> {{ m.connectionCount(circuit.connections.length) }}</span>
          </div>
          <div class="condition-tabs" role="group" :aria-label="m.conditionShown">
            <button v-for="condition in conditions" :key="condition.id" :aria-pressed="activeCondition === condition.id" :class="{ active: activeCondition === condition.id }" @click="activeCondition = condition.id">
              <span>{{ condition.short }}</span>{{ condition.label }}
            </button>
          </div>
          <div class="graph-view-tabs" role="tablist" :aria-label="m.graphViewLabel" @keydown="graphTabKeydown">
            <button id="graph-tab-2d" type="button" role="tab" :aria-selected="graphView === '2d'" aria-controls="graph-panel-2d" :tabindex="graphView === '2d' ? 0 : -1" @click="chooseGraphView('2d')">{{ m.view2d }}</button>
            <button id="graph-tab-3d" type="button" role="tab" :aria-selected="graphView === '3d'" aria-controls="graph-panel-3d" :tabindex="graphView === '3d' ? 0 : -1" @click="chooseGraphView('3d')">{{ m.view3d }}</button>
          </div>
          <div id="graph-panel-2d" v-show="graphView === '2d'" role="tabpanel" aria-labelledby="graph-tab-2d">
            <CircuitGraph v-if="graphView === '2d'" :key="mode" :focus-connections="isReal && focusConnections" :circuit="circuit" :activity="nodeActivity" :selected-node="selectedNeuron" :silenced-connection-id="activeCondition === 'silenced' ? selectedEdge : undefined" @select="selectedNeuron = $event" />
          </div>
          <div id="graph-panel-3d" v-show="graphView === '3d'" role="tabpanel" aria-labelledby="graph-tab-3d">
            <CircuitGraph3D v-if="graphView === '3d'" :key="mode" :focus-connections="isReal && focusConnections" :circuit="circuit" :activity="nodeActivity" :selected-node="selectedNeuron" :silenced-connection-id="activeCondition === 'silenced' ? selectedEdge : undefined" @select="selectedNeuron = $event" @request2d="chooseGraphView('2d', true)" />
            <div v-if="graphView === '3d'" class="spatial-selection" role="group" :aria-label="m.selected3d">
              <div><span class="eyebrow" aria-live="polite">{{ selected.id }} / {{ roleName(selected.role) }}</span><p>{{ selected.description }}</p></div>
              <div class="spatial-activity"><span>{{ m.modelActivity }}</span><output data-testid="three-d-selected-activity">{{ format(nodeActivity[selected.id] ?? 0, 3) }}</output><small>{{ m.dimensionless }} · {{ format(displayedTimeMs, timeDigits) }} ms</small></div>
            </div>
          </div>
          <div v-if="isReal" class="graph-key real-key"><span>{{ m.keyChemical }}</span><span>{{ m.keyGap }}</span><label><input v-model="focusConnections" type="checkbox" :aria-label="m.focusLabel"> {{ m.focusText }}</label></div>
          <div v-else class="graph-key"><span><i class="input-key"></i>{{ m.keyInput }}</span><span><i class="interneuron-key"></i>{{ m.keyInterneuron }}</span><span><i class="output-key"></i>{{ m.keyOutput }}</span><span class="inhibition-key">{{ m.keyInhibition }}</span></div>
          <div class="timeline">
            <button class="play-button" @click="togglePlayback" :aria-label="playing ? m.pausePlayback : m.playActivity">{{ playing ? 'Ⅱ' : '▶' }}</button>
            <input type="range" min="0" :max="defaultConfig.durationMs" :step="dt" :value="displayedTimeMs" :aria-valuetext="`${format(displayedTimeMs, timeDigits)} ms`" :aria-label="m.simulationTime" @input="seek(Number(($event.target as HTMLInputElement).value))">
            <output>{{ format(displayedTimeMs, timeDigits) }} <span>ms</span></output>
          </div>
          <details class="shortcut-help">
            <summary>{{ m.shortcutsSummary }}</summary>
            <dl>
              <div><dt><kbd>{{ m.keySpace }}</kbd></dt><dd>{{ m.shortcutToggle }}</dd></div>
              <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>{{ m.shortcutStep(SHORTCUT_STEP_MS) }}</dd></div>
              <div><dt><kbd>Home</kbd></dt><dd>{{ m.shortcutHome }}</dd></div>
            </dl>
            <p>{{ m.shortcutsNote }}</p>
          </details>
          <p class="sr-only" role="status" data-testid="shortcut-status">{{ shortcutMessage?.() }}</p>
          <p class="graph-caption">{{ m.captionBase }}<template v-if="isReal"> {{ m.captionReal(visibleEdgeCount, circuit.connections.length) }}<template v-if="graphView === '2d'">{{ m.caption2d }}</template><template v-else>{{ m.caption3d }}</template></template></p>
        </div>

        <section class="chart-panel">
          <div class="panel-heading">
            <div><span class="eyebrow">{{ m.outputKicker }}</span><h2>{{ m.outputHeading }}</h2></div>
            <label class="output-picker">{{ isReal ? m.pickerReal : m.pickerIllustrative }} <select v-model="outputNeuron" :aria-label="m.watchedOutput"><option v-for="neuron in readoutNeurons" :key="neuron.id" :value="neuron.id">{{ neuron.id }}</option></select></label>
          </div>
          <div class="trace-key"><span v-for="condition in conditions" :key="condition.id"><i :style="{ borderTop: `2px ${condition.id === 'baseline' ? 'solid' : condition.id === 'silenced' ? 'dotted' : 'dashed'} ${condition.color}` }"></i>{{ condition.label }}</span><span v-if="pinned" data-testid="pinned-key"><i :style="{ borderTop: `2px dashed ${PINNED_COLOR}` }"></i>◆ {{ chartTraces.at(-1)!.label }}</span><span v-if="inputValues" data-testid="input-key"><i :style="{ borderTop: `1px solid ${INPUT_COLOR}` }"></i>{{ m.inputTrace }}</span></div>
          <ActivationChart :y-max="chartYMax" :times="results.baseline.timesMs" :traces="chartTraces" :cursor-ms="displayedTimeMs" :stimulus="baselineSettings.stimulus" :input="inputValues" @seek="seek" />
          <div class="peak-row"><div v-for="condition in conditions" :key="condition.id"><span>{{ condition.short }} / {{ m.peakActivity }}</span><strong :data-testid="`peak-${condition.id}`">{{ format(peaks[condition.id]) }}</strong></div></div>
          <div class="chart-scale"><label><input v-model="scaleToResponse" type="checkbox" :aria-label="m.scaleToResponse"> {{ m.scaleToResponse }}</label><span>{{ m.verticalAxis }} 0–<output data-testid="chart-y-max">{{ format(chartYMax, chartYMax < 1 ? 3 : 0) }}</output></span></div>
          <ChartDataTable :times="results.baseline.timesMs" :traces="chartTraces" :peaks="tablePeaks" :output="outputNeuron" />
          <PinnedComparison :pinned="pinned" :settings="shareState" :current-peak="peaks[activeCondition]" :condition-names="conditionNames" :edge-name="edgeName" :shape-names="m.shapes" @pin="pinCurve" @unpin="pinned = null" />
          <p class="chart-note"><TermText :text="m.chartNote" /></p>
        </section>
      </div>

      <aside class="control-panel">
        <div class="panel-heading"><div><span class="eyebrow">{{ m.setupKicker }}</span><h2>{{ m.setupHeading }}</h2></div><button class="text-button" @click="reset">{{ m.reset }}</button></div>
        <p class="control-intro">{{ m.setupIntro }}</p>
        <div class="control-section">
          <label for="stimulus-target">{{ m.stimulusCell }}</label>
          <select id="stimulus-target" v-model="stimulusTarget"><option v-for="neuron in inputNeurons" :key="neuron.id" :value="neuron.id">{{ neuron.id }}{{ isReal ? '' : m.inputCellSuffix }}</option></select><p v-if="isReal" class="field-note">{{ m.targetNote }}</p>
          <label class="slider-label" for="amplitude">{{ m.stimulusStrength }} <output>{{ format(amplitude, 2) }}</output></label>
          <input id="amplitude" v-model.number="amplitude" type="range" :aria-valuetext="format(amplitude, 2)" min="0" max="1" step="0.05">
          <label class="slider-label" for="duration">{{ m.stimulusDuration }} <output>{{ pulseDuration }} ms</output></label>
          <input id="duration" v-model.number="pulseDuration" type="range" min="50" max="400" step="10">
          <p class="field-note">{{ m.onsetBefore }} <TermText :text="defaultConfig.stimulus.onsetMs" /> {{ m.onsetAfter }}</p>
          <label class="protocol-label" for="stimulus-shape">{{ m.stimulusShape }}</label>
          <select id="stimulus-shape" v-model="stimulusShape" class="protocol-control"><option v-for="shape in stimulusShapes" :key="shape" :value="shape">{{ m.shapes[shape] }}</option></select>
          <template v-if="stimulusShape === 'sine'">
            <label class="slider-label" for="sine-period">{{ m.sinePeriod }} <output>{{ sinePeriod }} ms</output></label>
            <input id="sine-period" v-model.number="sinePeriod" class="protocol-control" type="range" :min="stimulusRanges.sinePeriod.min" :max="stimulusRanges.sinePeriod.max" :step="stimulusRanges.sinePeriod.step">
          </template>
          <label class="slider-label" for="noise-amplitude">{{ m.inputNoise }} <output>{{ format(noiseAmplitude, 2) }}</output></label>
          <input id="noise-amplitude" v-model.number="noiseAmplitude" class="protocol-control" type="range" :aria-valuetext="format(noiseAmplitude, 2)" :min="stimulusRanges.noiseAmplitude.min" :max="stimulusRanges.noiseAmplitude.max" :step="stimulusRanges.noiseAmplitude.step">
          <div v-if="noiseAmplitude > 0" class="noise-sample">
            <button type="button" data-testid="noise-resample" @click="noiseSeed = nextNoiseSeed(noiseSeed)">{{ m.newNoiseSample }}</button>
            <output data-testid="noise-seed">{{ m.noiseSeed(noiseSeed) }}</output>
          </div>
          <p class="field-note" data-testid="protocol-note">{{ m.protocolNote }}</p>
        </div>
        <div class="control-section">
          <span class="condition-label"><i class="condition-b">B</i> {{ m.silenceKicker }}</span>
          <label class="sr-only" for="silenced-edge">{{ m.silencedEdge }}</label>
          <select id="silenced-edge" v-model="selectedEdge"><option v-for="edge in circuit.connections" :key="edge.id" :value="edge.id">{{ edgeLabel(edge) }} · {{ edge.kind === 'gap' ? m.edgeGap : isReal ? m.edgeChemicalAssumed : edge.weight < 0 ? m.edgeInhibitory : m.edgeExcitatory }}</option></select>
          <p class="field-note">{{ m.silenceNote }}<template v-if="isReal"><TermText :text="m.silenceNoteGap" /></template></p>
        </div>
        <div class="control-section">
          <span class="condition-label"><i class="condition-c">C</i> {{ m.tauKicker }}</span>
          <label class="sr-only" for="changed-neuron">{{ m.tauCell }}</label>
          <select id="changed-neuron" v-model="changedNeuron"><option v-for="neuron in circuit.neurons" :key="neuron.id" :value="neuron.id">{{ neuron.id }} · {{ roleName(neuron.role) }}</option></select>
          <label class="slider-label" for="changed-tau">{{ m.tauOfCell }} <output>{{ changedTau }} ms</output></label>
          <input id="changed-tau" v-model.number="changedTau" type="range" min="10" max="180" step="5">
          <label class="slider-label" for="base-tau">{{ m.tauReference }} <output>{{ baseTau }} ms</output></label>
          <input id="base-tau" v-model.number="baseTau" type="range" min="10" max="80" step="5">
        </div>
        <div v-if="isReal" class="control-section model-gains">
          <span class="condition-label">{{ m.gainsKicker }}</span>
          <label class="slider-label" for="chemical-gain">{{ m.chemicalGain }} <output>{{ format(chemicalGain, 2) }}</output></label><input id="chemical-gain" v-model.number="chemicalGain" type="range" :aria-valuetext="format(chemicalGain, 2)" min="0" max="2" step="0.1">
          <label class="slider-label" for="gap-gain">{{ m.gapGain }} <output>{{ format(gapGain, 2) }}</output></label><input id="gap-gain" v-model.number="gapGain" type="range" :aria-valuetext="format(gapGain, 2)" min="0" max="1" step="0.1">
          <p class="field-note">{{ m.gainsNote }}</p>
        </div>
        <div class="interpretation"><span class="eyebrow">{{ m.readKicker }}</span><p><TermText :text="interpretation" /></p></div>
        <button class="export-button" @click="exportExperiment">{{ m.downloadRecord }} <span aria-hidden="true">↓</span></button>
        <span class="export-note">{{ m.exportNote }}<template v-if="isReal"> · {{ m.exportNoteReal }}</template></span>
      </aside>
    </section>

    <section :aria-label="m.shareSection">
      <ExperimentTools :url="shareUrl" :notice="shareNoticeText?.() ?? ''" :condition-label="activeConditionLabel" :output-cell="outputNeuron" :csv-file="csvExport" :json-file="jsonExport" />
    </section>

    <section class="node-inspector" :class="{ 'real-inspector': isReal }" :aria-label="m.inspector">
      <div class="node-buttons" role="group" :aria-label="m.inspectCell"><button v-for="neuron in circuit.neurons" :key="neuron.id" :aria-pressed="selectedNeuron === neuron.id" :class="{ selected: selectedNeuron === neuron.id }" @click="selectedNeuron = neuron.id"><span>{{ neuron.id }}</span><small>{{ format(nodeActivity[neuron.id] ?? 0, 2) }}</small></button></div>
      <div class="node-description"><span class="eyebrow">{{ selected.id }} / {{ roleName(selected.role) }}</span><p><TermText :text="selected.description" /></p><p v-if="isReal && selectedAnatomy">{{ m.si4Class }} <strong><TermText :text="selectedAnatomy.cellType" /></strong>{{ m.experimentRole }} <TermText :text="selected.id === stimulusTarget ? m.roleStimulusTarget : selected.id === outputNeuron ? m.roleReadout : m.roleOther" />.</p></div>
    </section>

    <section id="assumptions" class="assumption-section">
      <div class="section-intro"><span class="eyebrow">{{ m.assumptionsKicker }}</span><h2>{{ m.assumptionsHeading1 }}<br><em>{{ m.assumptionsHeading2 }}</em></h2><p>{{ m.assumptionsIntro }} <TermText :text="isReal ? m.assumptionsIntroReal : m.assumptionsIntroIllustrative" /></p></div>
      <div class="assumption-content">
        <div v-if="isReal && realData" class="scope-card" data-testid="real-assumptions"><span class="tag">{{ m.scopeTagReal }}</span><p><TermText :text="m.scopeMatrix" /></p><p>{{ m.scopeSelection }}</p><p><TermText :text="m.scopeBoundary" /></p><p v-if="realData.selection.omittedExternal">{{ m.omittedLead }} <TermText :text="realData.selection.omittedExternal.chemicalIncomingCount" /> {{ m.omittedIncoming }} <TermText :text="realData.selection.omittedExternal.chemicalOutgoingCount" /> {{ m.omittedOutgoing }} <TermText :text="realData.selection.omittedExternal.gapCount" /> {{ m.omittedGap }}</p></div>
        <div v-else class="scope-card"><span class="tag">{{ m.scopeTagIllustrative }}</span><p>{{ m.scopeIllustrative }}</p></div>
        <div class="equation-card"><span class="eyebrow">{{ m.dynamicsKicker }}</span><code>τᵢ dxᵢ/dt = −xᵢ + clip(Σⱼ wᵢⱼxⱼ + Iᵢ(t), 0, 1)<template v-if="isReal"> + Σⱼ gᵢⱼ(xⱼ − xᵢ)</template></code><p v-if="isReal">{{ m.normalization }}</p><p><strong>x</strong> {{ m.symbolActivity }} · <strong>w</strong> {{ m.symbolWeight }} · <strong>I</strong> {{ m.symbolStimulus }} · <strong>τ</strong> {{ m.symbolTauAndMethod }}</p>
          <p v-if="inputValues" class="field-note input-formula" data-testid="input-formula">{{ m.inputFormulaLead }} <code>{{ INPUT_FORMULAS[stimulusShape] }}<template v-if="noiseAmplitude > 0">{{ NOISE_FORMULA }}</template></code>. {{ m.inputLegend(stimulusShape, noiseAmplitude > 0, NOISE_HOLD_MS) }}</p>
          <div class="numerical-check"><label for="dt">{{ m.timeStep }} <select id="dt" v-model.number="dt"><option :value="0.0625">{{ withComma('0.0625') }} ms</option><option :value="0.125">{{ withComma('0.125') }} ms</option><option :value="0.25">{{ withComma('0.25') }} ms</option><option :value="0.5">{{ withComma('0.5') }} ms</option><option :value="1">1 ms</option><option :value="2">2 ms</option></select></label><span>{{ m.halfStepDifference }} <strong data-testid="convergence-error">{{ format(convergenceError, 5) }}</strong></span></div>
          <p v-if="convergenceError > 0.01" class="numerical-warning" role="status" data-testid="numerical-warning">{{ m.numericalWarning(format(0.01, 2)) }}</p>
          <p class="field-note">{{ m.numericalNote }}</p>
        </div>
        <details class="connection-table"><summary>{{ m.tableSummary }} <span>{{ circuit.connections.length }} {{ isReal ? m.tableCountReal : m.tableCountIllustrative }}</span></summary><div class="table-scroll"><table><caption class="sr-only">{{ isReal ? m.tableCaptionReal : m.tableCaptionIllustrative }}</caption><thead><tr><th>{{ m.columnConnection }}</th><th v-if="isReal">{{ m.columnRaw }}</th><th>{{ m.columnWeight }}</th><th>{{ m.columnEffect }}</th><th><TermText :text="isReal ? m.columnNoteReal : m.columnNoteIllustrative" /></th></tr></thead><tbody><tr v-for="edge in circuit.connections" :key="edge.id"><td><TermText :text="edgeLabel(edge)" /></td><td v-if="isReal"><TermText :text="edge.rawWeight" /></td><td>{{ format(edge.weight, isReal ? 4 : 2) }}</td><td><TermText :text="edge.kind === 'gap' ? m.effectGap : isReal ? m.effectAssumed : edge.weight < 0 ? m.effectInhibitory : m.effectExcitatory" /></td><td><TermText :text="edge.note" /></td></tr></tbody></table></div></details>
      <details v-if="isReal && realData" class="provenance-details"><summary>{{ m.provenanceSummary }}</summary><p>{{ m.provenanceLead }}</p><div v-for="source in realData.dataset.sources" :key="source.sha256"><a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name }} ↗</a><code>SHA-256 {{ source.sha256 }}</code><p>{{ m.downloadedUtc }} <TermText :text="source.downloadedAtUtc" /></p></div><p>{{ m.licenceNote }}</p><p><TermText :text="m.diagonalNote" /></p></details>
      </div>
    </section>

    <section class="next-step"><div><span class="eyebrow">{{ isReal ? m.nextKickerReal : m.nextKickerIllustrative }}</span><h2>{{ m.nextHeading1 }}<br>{{ m.nextHeading2 }}</h2></div><div><p><TermText :text="m.nextLead" /></p><p class="small-muted">{{ m.nextLimit }}</p><a href="https://wormwiring.org/pages/adjacency.html" target="_blank" rel="noopener noreferrer">{{ m.linkWormWiring }}</a><a href="https://www.nature.com/articles/s41586-023-06683-4" target="_blank" rel="noopener noreferrer">{{ m.linkFunctional }}</a></div></section>
  </main>
  <footer><span>Circuitiary</span><p>{{ m.footerMotto }}</p><span class="footer-note">{{ isReal ? m.footerReal : m.footerIllustrative }}</span></footer>
</template>

<style scoped>
/* Stimulus protocol controls: shape, sine period, input noise and its sample button. */
.protocol-label { margin-top: 17px; }
select.protocol-control, input.protocol-control { min-height: 44px; }
.noise-sample { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; margin-top: 6px; }
.noise-sample button { min-height: 44px; padding: 9px 14px; border: 1px solid var(--theme-border, #d1d9ca); border-radius: 5px; background: var(--theme-surface, #fafbf5); color: var(--theme-text, #263b35); font-size: 11px; }
.noise-sample button:hover { border-color: var(--theme-text, #263b35); }
.noise-sample output { font-family: var(--mono); font-size: 11px; }
.input-formula code { display: inline; padding: 0; margin: 0; border: 0; background: transparent; font-family: var(--mono); font-size: inherit; color: inherit; white-space: normal; overflow-wrap: anywhere; }
/* Keyboard shortcut list under the playback controls (the circuit panel is dark in both themes). */
.shortcut-help { position: relative; z-index: 1; margin-top: 6px; color: #c9d8cc; font-size: 11px; }
.shortcut-help summary { display: flex; align-items: center; min-height: 44px; cursor: pointer; color: #d3e0d4; }
.shortcut-help summary::before { content: '▸'; width: 16px; }
.shortcut-help[open] > summary::before { content: '▾'; }
.shortcut-help summary:focus-visible { outline: 3px solid #e8c47a; outline-offset: 2px; }
.shortcut-help dl { margin: 0 0 8px; display: grid; gap: 8px; }
.shortcut-help dl > div { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 4px 12px; align-items: baseline; }
.shortcut-help dt { display: flex; gap: 4px; }
.shortcut-help dd { margin: 0; line-height: 1.7; }
.shortcut-help kbd { min-width: 26px; padding: 2px 7px; text-align: center; font-family: var(--mono); font-size: 11px; color: #eef3e6; background: #2b4339; border: 1px solid #5d7568; border-radius: 4px; }
.shortcut-help p { font-size: 10px; line-height: 1.8; color: #a9bbac; margin: 0 0 10px; }
</style>
