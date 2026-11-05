<script setup lang="ts">
import TermText from './components/TermText.vue'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import CircuitGraph from './components/CircuitGraph.vue'
import CircuitGraph3D from './components/CircuitGraph3D.vue'
import ActivationChart from './components/ActivationChart.vue'
import ChartDataTable from './components/ChartDataTable.vue'
import { SHORTCUT_STEP_MS, stepTime, useExperimentShortcuts } from './useExperimentShortcuts'
import type { ShortcutAction } from './useExperimentShortcuts'
import { illustrativeCircuit, defaultConfig } from './model/circuit'
import { simulate } from './model/simulation'
import { parseRealConnectome, buildRealCircuit, defaultRealModelParameters } from './model/realConnectome'
import type { SimulationConfig } from './model/types'
import { prepareRealInspection } from './learning/readingHandoff'
import type { ExperimentDraft } from './learning/readingHandoff'
import { decimal } from './format'
import ExperimentTools from './components/ExperimentTools.vue'
import { csvFile, jsonFile } from './exportData'
import { version as appVersion } from '../package.json'
import { buildShareUrl, parseShareQuery, restrictToCircuit, shareNotice, withoutRealSelections } from './shareState'
import type { ShareParse, ShareState } from './shareState'

// The shell keeps this page mounted but hidden behind the lesson pages; the
// playback loop stays idle there and continues from the same time on return.
const props = defineProps<{ suspended?: boolean }>()
type Condition = 'baseline' | 'silenced' | 'tau'
type GraphView = '2d' | '3d'
const graphView = ref<GraphView>('2d')
type RealData = ReturnType<typeof parseRealConnectome>
const mode = ref<'illustrative' | 'real'>('illustrative')
const realData = shallowRef<RealData>()
const dataLoading = ref(false)
const dataError = ref('')
const chemicalGain = ref(defaultRealModelParameters.chemicalGain)
const gapGain = ref(defaultRealModelParameters.gapGain)
const focusConnections = ref(true)
const scaleToResponse = ref(false)
const isReal = computed(() => mode.value === 'real')
const circuit = computed(() => isReal.value && realData.value
  ? buildRealCircuit(realData.value, { chemicalGain: chemicalGain.value, gapGain: gapGain.value })
  : illustrativeCircuit)
const conditions: { id: Condition; label: string; short: string; color: string }[] = [
  { id: 'baseline', label: 'Referans', short: 'A', color: 'var(--theme-trace-green, #2f7960)' },
  { id: 'silenced', label: 'Bağlantı susturuldu', short: 'B', color: 'var(--theme-trace-red, #bb695e)' },
  { id: 'tau', label: 'Zaman sabiti değişti', short: 'C', color: 'var(--theme-trace-blue, #647fb3)' },
]
const activeCondition = ref<Condition>('baseline')
const stimulusTarget = ref('S1')
const amplitude = ref(defaultConfig.stimulus.amplitude)
const pulseDuration = ref(defaultConfig.stimulus.durationMs)
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
  stimulus: { ...defaultConfig.stimulus, target: stimulusTarget.value, amplitude: amplitude.value, durationMs: pulseDuration.value },
}))
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
const traces = computed(() => conditions.map(condition => ({ ...condition, values: results.value[condition.id].activity[outputNeuron.value] ?? [] })))
const peaks = computed(() => Object.fromEntries(conditions.map(condition => [condition.id, Math.max(...(results.value[condition.id].activity[outputNeuron.value] ?? [0]))])) as Record<Condition, number>)
const chartYMax = computed(() => {
  if (!scaleToResponse.value) return 1
  const target = Math.max(0.01, ...Object.values(peaks.value)) * 1.15
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
const roleName = (role: string) => ({ input: 'Giriş hücresi', interneuron: 'Ara hücre', output: 'Çıktı hücresi', unspecified: 'Kaynak nöronu' } as Record<string, string>)[role] ?? role
const format = (value: number, digits = 3) => decimal(value, digits)
const edgeLabel = (edge: typeof circuit.value.connections[number]) => `${edge.source} ${edge.kind === 'gap' ? '↔' : '→'} ${edge.target}`
const selectedConnection = computed(() => circuit.value.connections.find(e => e.id === selectedEdge.value))
const interpretation = computed(() => activeCondition.value === 'baseline'
  ? 'Bu koşul karşılaştırmanın referansı. Diğer deneylerde uyaran ve başlangıç durumu aynı kalıyor.'
  : activeCondition.value === 'silenced'
    ? `${selectedConnection.value ? edgeLabel(selectedConnection.value) : selectedEdge.value} bağlantısının model ağırlığı sıfırlandı. Hücreler devrede kalıyor; ${selectedConnection.value?.kind === 'gap' ? 'bu elektriksel çiftin iki yönlü etkisi kaldırılıyor.' : 'yalnızca bu aktarım kaldırılıyor.'}`
    : `${changedNeuron.value} için τ ${changedTau.value} ms. Daha büyük τ, bu denklemde etkinliğin değişimini yavaşlatır; daha güçlü yanıtı garanti etmez.`)

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
const shortcutMessage = ref('')
function runShortcut(action: ShortcutAction) {
  if (action === 'toggle-playback') {
    togglePlayback()
    shortcutMessage.value = playing.value ? 'Oynatılıyor.' : 'Duraklatıldı.'
    return
  }
  const time = action === 'to-start' ? 0 : stepTime(cursorMs.value, action === 'step-forward' ? 1 : -1, defaultConfig.durationMs)
  seek(time)
  const recorded = currentResult.value.timesMs
  shortcutMessage.value = `Zaman ${format(recorded[Math.min(recorded.length - 1, Math.round(time / dt.value))] ?? time, timeDigits.value)} ms.`
}
useExperimentShortcuts({ suspended: () => Boolean(props.suspended), onAction: runShortcut })
function reset() {
  pause(); amplitude.value = defaultConfig.stimulus.amplitude; pulseDuration.value = defaultConfig.stimulus.durationMs
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
    dataLoading.value = true; dataError.value = ''
    dataRequest = new AbortController()
    const timeout = setTimeout(() => dataRequest?.abort(), 10000)
    try {
      const response = await fetch('/api/local-connectome', { cache: 'no-store', signal: dataRequest.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      realData.value = parseRealConnectome(await response.json())
    } catch {
      dataError.value = 'Yerel gerçek veri yüklenemedi. README içindeki ithalat komutunu çalıştırıp yerel Vite sunucusunu kullanın. Sekiz hücreli deney hazır.'
      return
    } finally { clearTimeout(timeout); dataRequest = undefined; dataLoading.value = false }
  }
  mode.value = next; reset()
}
function captureExperimentDraft(): Readonly<ExperimentDraft> {
  return Object.freeze({ mode: mode.value, graphView: graphView.value, chemicalGain: chemicalGain.value, gapGain: gapGain.value,
    focusConnections: focusConnections.value, scaleToResponse: scaleToResponse.value, activeCondition: activeCondition.value,
    stimulusTarget: stimulusTarget.value, amplitude: amplitude.value, pulseDuration: pulseDuration.value,
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
  baseTau.value = draft.baseTau; changedTau.value = draft.changedTau; changedNeuron.value = draft.changedNeuron
  selectedEdge.value = draft.selectedEdge; outputNeuron.value = draft.outputNeuron; selectedNeuron.value = draft.selectedNeuron
  dt.value = draft.dt; cursorMs.value = draft.cursorMs
  if (draft.playing) togglePlayback()
}
async function inspectAnatomicalNeuron(neuronId: string, shouldCommit: () => boolean = () => true): Promise<
  { ok: true; graphView: GraphView } | { ok: false; message: string; cancelled?: boolean }
> {
  if (!shouldCommit()) return { ok: false, message: '', cancelled: true }
  if (dataLoading.value) return { ok: false, message: 'Ana deneyde veri yükleniyor. Yükleme tamamlandıktan sonra yeniden dene.' }
  if (!realData.value) {
    dataLoading.value = true; dataError.value = ''
    dataRequest = new AbortController()
    const timeout = setTimeout(() => dataRequest?.abort(), 10000)
    try {
      const response = await fetch('/api/local-connectome', { cache: 'no-store', signal: dataRequest.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      realData.value = parseRealConnectome(await response.json())
    } catch {
      return { ok: false, message: 'Ana deney için yerel gerçek veri yüklenemedi. Bu sayfadaki seçimin korunuyor; yeniden deneyebilirsin.' }
    } finally { clearTimeout(timeout); dataRequest = undefined; dataLoading.value = false }
  }
  // Navigation during the fetch cancels the handoff, rather than changing a
  // hidden experiment or pulling the user away from their newer destination.
  if (!shouldCommit()) return { ok: false, message: '', cancelled: true }
  const before = captureExperimentDraft()
  let next: Readonly<ExperimentDraft>
  try { next = prepareRealInspection(before, realData.value, neuronId) }
  catch { return { ok: false, message: 'Seçilen hücre mevcut deney altgrafında bulunamadı. Deney ayarların değiştirilmedi.' } }
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
    scope: isReal.value
      ? 'Cook2019 anatomik altgrafı ve açıkça varsayımsal dinamikler; doğrulanmış davranış veya biyolojik beyin emülasyonu değildir. Yalnız yerel kullanım; yeniden dağıtım lisansı doğrulanmadı.'
      : 'Öğretici kurgusal devre; biyolojik veri veya doğrulanmış davranış emülasyonu değildir.',
    model: { equation: isReal.value
      ? 'tau_i * dx_i/dt = -x_i + clip(sum_j(w_ij * x_j) + I_i(t), 0, 1) + sum_j(g_ij * (x_j - x_i))'
      : 'tau_i * dx_i/dt = -x_i + clip(sum_j(w_ij * x_j) + I_i(t), 0, 1)',
      method: 'synchronous explicit Euler', activityUnit: 'dimensionless', initialState: 'all zero',
      stimulusWindow: '[onsetMs, onsetMs + durationMs)', noise: false,
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
const shareNoticeText = ref('')
const shareState = computed<ShareState>(() => ({
  mode: mode.value, graphView: graphView.value, activeCondition: activeCondition.value,
  chemicalGain: chemicalGain.value, gapGain: gapGain.value, focusConnections: focusConnections.value, scaleToResponse: scaleToResponse.value,
  stimulusTarget: stimulusTarget.value, amplitude: amplitude.value, pulseDuration: pulseDuration.value,
  baseTau: baseTau.value, changedTau: changedTau.value, changedNeuron: changedNeuron.value,
  selectedEdge: selectedEdge.value, outputNeuron: outputNeuron.value, selectedNeuron: selectedNeuron.value, dt: dt.value,
}))
const shareUrl = computed(() => buildShareUrl(shareState.value, new URL('/', location.href).href))
const activeConditionLabel = computed(() => conditions.find(condition => condition.id === activeCondition.value)?.label ?? '')
const csvExport = () => csvFile({ mode: mode.value, condition: activeCondition.value, circuit: circuit.value, result: currentResult.value })
const jsonExport = () => jsonFile({ mode: mode.value, circuit: circuit.value, results: results.value, outputCell: outputNeuron.value, appVersion, dataset: realData.value?.dataset })
async function loadRealForLink(): Promise<boolean> {
  if (realData.value) return true
  dataLoading.value = true
  dataRequest = new AbortController()
  const timeout = setTimeout(() => dataRequest?.abort(), 10000)
  try {
    const response = await fetch('/api/local-connectome', { cache: 'no-store', signal: dataRequest.signal })
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
  shareNoticeText.value = shareNotice({ applied: Object.keys(v).length, ignored: link.ignored, realUnavailable })
}
// Only the experiment page reads a link; another page's own query is none of its business.
if (!location.pathname.replace(/\/$/, '').startsWith('/ogren/')) void applyShareLink(parseShareQuery(location.search))
onBeforeUnmount(() => { pause(); dataRequest?.abort() })
</script>

<template>
  <header class="site-header">
    <a class="brand" href="#top" aria-label="Circuitiary başlangıcı">
      <svg viewBox="0 0 44 44" aria-hidden="true"><path d="M10 22 22 9 34 22 22 35Z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10 22h24M22 9v26" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="22" cy="22" r="4" fill="currentColor"/><circle cx="10" cy="22" r="2.6" fill="currentColor"/><circle cx="34" cy="22" r="2.6" fill="currentColor"/></svg>
      Circuitiary
    </a>
    <span class="brand-subtitle">AN ATLAS OF ANIMAL CIRCUITS</span>
    <a class="header-link" href="#assumptions">Modeli anlamak <span aria-hidden="true">↗</span></a>
  </header>

  <main id="top">
    <section class="intro">
      <div>
        <p class="eyebrow"><span class="status-dot"></span> DENEY DEFTERİ / <TermText :text="isReal ? '002' : '001'" /></p>
        <h1>Bir uyaranın<br><em>izini sür.</em></h1>
        <p class="intro-copy">Küçük bir devreye sinyal ver. Etkinliğin nasıl yayıldığını izle.<br class="desktop-break"> Aynı bağlantılar, farklı varsayımlar: sonuç nasıl değişiyor?</p>
      </div>
      <div class="intro-note">
        <span class="tag">{{ isReal ? 'GERÇEK ANATOMİ · VARSAYIMSAL DİNAMİK' : 'ÖĞRETİCİ · KURGUSAL DEVRE' }}</span>
        <p>Önce sekiz hücre.<br>Sonra bir solucanın bağlantıları.</p>
        <span class="small-muted">Bağlantı haritasından işleyişe, adım adım.</span>
      </div>
    </section>

    <section class="dataset-switch" aria-label="Devre seçimi">
      <div><span class="eyebrow">İNCELEYECEĞİN DEVRE</span><p><TermText :text="isReal ? 'Cook2019 · yetişkin hermafrodit · AVER / AVAR çevresi' : 'Elle tasarlanmış sekiz hücre · dinamikleri öğren'" /></p></div>
      <div class="mode-buttons" role="group" aria-label="Devre modu">
        <button :aria-pressed="!isReal" :disabled="dataLoading" @click="chooseMode('illustrative')">Sekiz hücreli örnek</button>
        <button :aria-pressed="isReal" :disabled="dataLoading" @click="chooseMode('real')">{{ dataLoading ? 'Veri okunuyor…' : 'C. elegans · gerçek veri' }}</button>
      </div>
      <p v-if="dataError" class="data-error" role="alert">{{ dataError }}</p>
    </section>

    <section v-if="isReal && realData" class="data-summary" aria-label="Gerçek veri kaynağı ve sınırları">
      <div><span class="tag">COOK2019 · DÜZELTME TEMMUZ 2020</span><h2><TermText :text="circuit.neurons.length" /><TermText text=" nöron. Gerçek anatomik bağlantılar." /></h2><p>Kimyasal işaretler ve zaman sabitleri bu dosyada ölçülmüyor. Aşağıdaki etkinlik, bu bağlantı haritasına eklediğimiz varsayımsal modelin sonucudur.</p></div>
      <div class="data-facts"><span><strong>{{ chemicalCount }}</strong> yönlü kimyasal bağlantı</span><span><strong>{{ gapCount }}</strong> tekil gap junction çifti</span><span>Ham birim: <strong>seri EM kesiti ağırlığı</strong></span><span>Kaynak dosyalar ve altküme: <strong>yalnız yerel</strong></span></div>
    </section>

    <section class="experiment-layout" :aria-label="isReal ? 'Gerçek anatomik altgraf deneyi' : 'Sekiz hücreli devre deneyi'">
      <div class="experiment-main">
        <div class="circuit-panel">
          <div class="panel-heading dark-heading">
            <div><span class="eyebrow">01 / BAĞLANTILAR</span><h2>Bir devrenin içinden</h2></div>
            <span class="graph-stats">{{ circuit.neurons.length }} hücre <span>·</span> {{ circuit.connections.length }} bağlantı</span>
          </div>
          <div class="condition-tabs" role="group" aria-label="Grafikte gösterilen deney koşulu">
            <button v-for="condition in conditions" :key="condition.id" :aria-pressed="activeCondition === condition.id" :class="{ active: activeCondition === condition.id }" @click="activeCondition = condition.id">
              <span>{{ condition.short }}</span>{{ condition.label }}
            </button>
          </div>
          <div class="graph-view-tabs" role="tablist" aria-label="Devre görünümü" @keydown="graphTabKeydown">
            <button id="graph-tab-2d" type="button" role="tab" :aria-selected="graphView === '2d'" aria-controls="graph-panel-2d" :tabindex="graphView === '2d' ? 0 : -1" @click="chooseGraphView('2d')">2D · bağlantı haritası</button>
            <button id="graph-tab-3d" type="button" role="tab" :aria-selected="graphView === '3d'" aria-controls="graph-panel-3d" :tabindex="graphView === '3d' ? 0 : -1" @click="chooseGraphView('3d')">3D · şematik uzay</button>
          </div>
          <div id="graph-panel-2d" v-show="graphView === '2d'" role="tabpanel" aria-labelledby="graph-tab-2d">
            <CircuitGraph v-if="graphView === '2d'" :key="mode" :focus-connections="isReal && focusConnections" :circuit="circuit" :activity="nodeActivity" :selected-node="selectedNeuron" :silenced-connection-id="activeCondition === 'silenced' ? selectedEdge : undefined" @select="selectedNeuron = $event" />
          </div>
          <div id="graph-panel-3d" v-show="graphView === '3d'" role="tabpanel" aria-labelledby="graph-tab-3d">
            <CircuitGraph3D v-if="graphView === '3d'" :key="mode" :focus-connections="isReal && focusConnections" :circuit="circuit" :activity="nodeActivity" :selected-node="selectedNeuron" :silenced-connection-id="activeCondition === 'silenced' ? selectedEdge : undefined" @select="selectedNeuron = $event" @request2d="chooseGraphView('2d', true)" />
            <div v-if="graphView === '3d'" class="spatial-selection" role="group" aria-label="3D görünümünde seçili nöron ayrıntıları">
              <div><span class="eyebrow" aria-live="polite">{{ selected.id }} / {{ roleName(selected.role) }}</span><p>{{ selected.description }}</p></div>
              <div class="spatial-activity"><span>Model etkinliği</span><output data-testid="three-d-selected-activity">{{ format(nodeActivity[selected.id] ?? 0, 3) }}</output><small>boyutsuz · {{ format(displayedTimeMs, timeDigits) }} ms</small></div>
            </div>
          </div>
          <div v-if="isReal" class="graph-key real-key"><span>→ Kimyasal · yönlü</span><span>↔ Gap junction · iki yönlü</span><label><input v-model="focusConnections" type="checkbox" aria-label="Yalnız seçili hücrenin bağlantıları"> Seçili hücreye odaklan</label></div>
          <div v-else class="graph-key"><span><i class="input-key"></i>Giriş</span><span><i class="interneuron-key"></i>Ara hücre</span><span><i class="output-key"></i>Çıktı</span><span class="inhibition-key">⊣ Baskılayıcı bağlantı</span></div>
          <div class="timeline">
            <button class="play-button" @click="togglePlayback" :aria-label="playing ? 'Oynatmayı duraklat' : 'Etkinliği oynat'">{{ playing ? 'Ⅱ' : '▶' }}</button>
            <input type="range" min="0" :max="defaultConfig.durationMs" :step="dt" :value="displayedTimeMs" :aria-valuetext="`${format(displayedTimeMs, timeDigits)} ms`" aria-label="Simülasyon zamanı" @input="seek(Number(($event.target as HTMLInputElement).value))">
            <output>{{ format(displayedTimeMs, timeDigits) }} <span>ms</span></output>
          </div>
          <details class="shortcut-help">
            <summary>Klavye kısayolları</summary>
            <dl>
              <div><dt><kbd>Boşluk</kbd></dt><dd>Oynat / duraklat</dd></div>
              <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Zaman imlecini {{ SHORTCUT_STEP_MS }} ms geri / ileri al; oynatmayı duraklatır</dd></div>
              <div><dt><kbd>Home</kbd></dt><dd>Başa dön (0 ms)</dd></div>
            </dl>
            <p>Tuşlar odak bir kontrolde, kaydırıcıda, bağlantıda, açıklama kartında ya da başka bir kaydırılabilir alanda değilken ve bu sayfa görünürken çalışır. Çalışmıyorsa sayfanın boş bir yerine tıkla. Ctrl, Cmd, Alt ve Shift ile birlikte çalışmaz.</p>
          </details>
          <p class="sr-only" role="status" data-testid="shortcut-status">{{ shortcutMessage }}</p>
          <p class="graph-caption">Düğüme tıkla veya aşağıdan bir hücre seç. Parlaklık hesaplanan etkinliği gösterir.<template v-if="isReal"> {{ visibleEdgeCount }}/{{ circuit.connections.length }} bağlantı çiziliyor; görünüm filtresi hesaplamayı değiştirmez. Yerleşim şematiktir, anatomik konum değildir.<template v-if="graphView === '2d'"> Çizgi kalınlığı model ağırlığına bağlıdır. Grafiği sürükle, yakınlaştır veya sığdır.</template><template v-else> Çizgiler bağlantı türünü ve yönünü gösterir; ağırlıkları tabloda inceleyebilirsin.</template></template></p>
        </div>

        <section class="chart-panel">
          <div class="panel-heading">
            <div><span class="eyebrow">02 / MODEL ÇIKTISI</span><h2>Aynı uyaran, üç koşul</h2></div>
            <label class="output-picker">{{ isReal ? 'Okuma' : 'Çıktı' }} <select v-model="outputNeuron" aria-label="İzlenen çıktı hücresi"><option v-for="neuron in readoutNeurons" :key="neuron.id" :value="neuron.id">{{ neuron.id }}</option></select></label>
          </div>
          <div class="trace-key"><span v-for="condition in conditions" :key="condition.id"><i :style="{ borderTop: `2px ${condition.id === 'baseline' ? 'solid' : condition.id === 'silenced' ? 'dotted' : 'dashed'} ${condition.color}` }"></i>{{ condition.label }}</span></div>
          <ActivationChart :y-max="chartYMax" :times="results.baseline.timesMs" :traces="traces" :cursor-ms="displayedTimeMs" :stimulus="baselineSettings.stimulus" @seek="seek" />
          <div class="peak-row"><div v-for="condition in conditions" :key="condition.id"><span>{{ condition.short }} / tepe etkinlik</span><strong :data-testid="`peak-${condition.id}`">{{ format(peaks[condition.id]) }}</strong></div></div>
          <div class="chart-scale"><label><input v-model="scaleToResponse" type="checkbox" aria-label="Yanıta göre dikey ölçek"> Yanıta göre dikey ölçek</label><span>Dikey eksen: 0–<output data-testid="chart-y-max">{{ format(chartYMax, chartYMax < 1 ? 3 : 0) }}</output></span></div>
          <ChartDataTable :times="results.baseline.timesMs" :traces="traces" :peaks="peaks" :output="outputNeuron" />
          <p class="chart-note"><TermText text="Üç koşul aynı ekseni kullanır; dikey ölçek etkinlik değerlerini değiştirmez. Etkinlik 0–1 arasında ve boyutsuzdur. Sarı alan uyaran süresini gösterir. Çizgiler hareket, karar veya ölçülmüş nöron ateşleme hızı değildir." /></p>
        </section>
      </div>

      <aside class="control-panel">
        <div class="panel-heading"><div><span class="eyebrow">DENEYİ KUR</span><h2>Bir şeyi değiştir.</h2></div><button class="text-button" @click="reset">Sıfırla ↺</button></div>
        <p class="control-intro">Ayarlar değiştiğinde üç koşul da aynı girişle yeniden hesaplanır.</p>
        <div class="control-section">
          <label for="stimulus-target">Uyaranın girdiği hücre</label>
          <select id="stimulus-target" v-model="stimulusTarget"><option v-for="neuron in inputNeurons" :key="neuron.id" :value="neuron.id">{{ neuron.id }}{{ isReal ? '' : ' · Giriş hücresi' }}</option></select><p v-if="isReal" class="field-note">Uyaran hedefi ve okunan hücre deney seçimleridir; duyusal veya motor hücre oldukları anlamına gelmez.</p>
          <label class="slider-label" for="amplitude">Uyaran gücü <output>{{ format(amplitude, 2) }}</output></label>
          <input id="amplitude" v-model.number="amplitude" type="range" :aria-valuetext="format(amplitude, 2)" min="0" max="1" step="0.05">
          <label class="slider-label" for="duration">Uyaran süresi <output>{{ pulseDuration }} ms</output></label>
          <input id="duration" v-model.number="pulseDuration" type="range" min="50" max="400" step="10">
          <p class="field-note">Uyaran <TermText :text="defaultConfig.stimulus.onsetMs" /> ms'de başlar. Başlangıç etkinlikleri sıfırdır.</p>
        </div>
        <div class="control-section">
          <span class="condition-label"><i class="condition-b">B</i> BAĞLANTIYI SUSTUR</span>
          <label class="sr-only" for="silenced-edge">Susturulacak bağlantı</label>
          <select id="silenced-edge" v-model="selectedEdge"><option v-for="edge in circuit.connections" :key="edge.id" :value="edge.id">{{ edgeLabel(edge) }} · {{ edge.kind === 'gap' ? 'elektriksel çift' : isReal ? 'kimyasal · varsayımsal +' : edge.weight < 0 ? 'baskılayıcı' : 'uyarıcı' }}</option></select>
          <p class="field-note">Seçilen bağlantının model ağırlığı sıfır olur.<template v-if="isReal"><TermText text=" Gap junction çiftinde iki yön birlikte kaldırılır. Bu bir hücre ablasyonu değildir." /></template></p>
        </div>
        <div class="control-section">
          <span class="condition-label"><i class="condition-c">C</i> ZAMAN SABİTİNİ DEĞİŞTİR</span>
          <label class="sr-only" for="changed-neuron">Zaman sabiti değiştirilen hücre</label>
          <select id="changed-neuron" v-model="changedNeuron"><option v-for="neuron in circuit.neurons" :key="neuron.id" :value="neuron.id">{{ neuron.id }} · {{ roleName(neuron.role) }}</option></select>
          <label class="slider-label" for="changed-tau">Bu hücrenin τ değeri <output>{{ changedTau }} ms</output></label>
          <input id="changed-tau" v-model.number="changedTau" type="range" min="10" max="180" step="5">
          <label class="slider-label" for="base-tau">Referansta tüm hücreler <output>{{ baseTau }} ms</output></label>
          <input id="base-tau" v-model.number="baseTau" type="range" min="10" max="80" step="5">
        </div>
        <div v-if="isReal" class="control-section model-gains">
          <span class="condition-label">VARSAYIMSAL DİNAMİK ÖLÇEKLER</span>
          <label class="slider-label" for="chemical-gain">Kimyasal katsayı <output>{{ format(chemicalGain, 2) }}</output></label><input id="chemical-gain" v-model.number="chemicalGain" type="range" :aria-valuetext="format(chemicalGain, 2)" min="0" max="2" step="0.1">
          <label class="slider-label" for="gap-gain">Gap katsayısı <output>{{ format(gapGain, 2) }}</output></label><input id="gap-gain" v-model.number="gapGain" type="range" :aria-valuetext="format(gapGain, 2)" min="0" max="1" step="0.1">
          <p class="field-note">Ham anatomi değişmez. Kimyasal etkilerin tümü bu modelde pozitif varsayılır; gerçek işaretleri bu kaynaktan bilinmiyor. Katsayılar ölçülmüş iletkenlik değildir.</p>
        </div>
        <div class="interpretation"><span class="eyebrow">BU KOŞULU NASIL OKUMALI?</span><p><TermText :text="interpretation" /></p></div>
        <button class="export-button" @click="exportExperiment">Deney kaydını indir <span aria-hidden="true">↓</span></button>
        <span class="export-note">Bağlantılar, varsayımlar ve üç koşulun sonuçları · JSON<template v-if="isReal"> · yerel kullanım; yeniden dağıtım izni doğrulanmadı</template></span>
      </aside>
    </section>

    <section aria-label="Paylaş ve dışa aktar">
      <ExperimentTools :url="shareUrl" :notice="shareNoticeText" :condition-label="activeConditionLabel" :output-cell="outputNeuron" :csv-file="csvExport" :json-file="jsonExport" />
    </section>

    <section class="node-inspector" :class="{ 'real-inspector': isReal }" aria-label="Hücre etkinlikleri ve seçilen hücre">
      <div class="node-buttons" role="group" aria-label="İncelenecek hücre"><button v-for="neuron in circuit.neurons" :key="neuron.id" :aria-pressed="selectedNeuron === neuron.id" :class="{ selected: selectedNeuron === neuron.id }" @click="selectedNeuron = neuron.id"><span>{{ neuron.id }}</span><small>{{ format(nodeActivity[neuron.id] ?? 0, 2) }}</small></button></div>
      <div class="node-description"><span class="eyebrow">{{ selected.id }} / {{ roleName(selected.role) }}</span><p><TermText :text="selected.description" /></p><p v-if="isReal && selectedAnatomy">SI4 hücre sınıfı: <strong><TermText :text="selectedAnatomy.cellType" /></strong>. Deney rolü: <TermText :text="selected.id === stimulusTarget ? 'uyaran hedefi' : selected.id === outputNeuron ? 'okunan hücre' : 'diğer nöron'" />.</p></div>
    </section>

    <section id="assumptions" class="assumption-section">
      <div class="section-intro"><span class="eyebrow">03 / VARSAYIM DEFTERİ</span><h2>Haritada olan.<br><em>Modele eklediğimiz.</em></h2><p>Bir bağlantının varlığı, işleyişinin bütün ayrıntılarını vermez. <TermText :text="isReal ? 'Bu deneyde anatomi kaynaktan geliyor; işaret, dinamik ölçek ve zaman sabitlerini biz seçiyoruz.' : 'Bu deneyde ikisini de biz tanımladık; değiştirerek sonuçlarını araştırıyoruz.'" /></p></div>
      <div class="assumption-content">
        <div v-if="isReal && realData" class="scope-card" data-testid="real-assumptions"><span class="tag">ANATOMİ: KAYNAKTAN · DİNAMİK: VARSAYIM</span><p><TermText text="Kimyasal matrisin satırı kaynak, sütunu hedeftir. Ham ağırlık seri EM kesitidir; sinaps adedi veya sinaptik güç değildir. Pozitif kimyasal işaret, boyutsuz etkinlik ve ms zaman ölçeği bizim seçimimizdir." /></p><p>Seçim: AVAR/AVER ve bir bağlantı uzaklığındaki adaylar; önce kimyasal toplam, sonra ayrı gap toplamı, sonra hücre adı. İlk 28 aday ve iki başlangıç hücresi; aralarındaki tüm bağlantılar korunur.</p><p><TermText text="Dış kimyasal girdi sıfır kabul edilir. Dış bağlantılar kesilir; dış gap junction etkisi modellenmez. Dış hücreler sıfıra sabitlenmez. Altgraf işlevsel olarak kapalı değildir." /></p><p v-if="realData.selection.omittedExternal">Çıkarılan dış bağlantılar: <TermText :text="realData.selection.omittedExternal.chemicalIncomingCount" /> gelen kimyasal, <TermText :text="realData.selection.omittedExternal.chemicalOutgoingCount" /> giden kimyasal ve <TermText :text="realData.selection.omittedExternal.gapCount" /> gap çifti. Tüm kayıtlar JSON'da yer alır.</p></div>
        <div v-else class="scope-card"><span class="tag">ÖLÇÜLMÜŞ BİYOLOJİK VERİ: YOK</span><p>Sekiz hücre ve bağlantıları öğretim için oluşturuldu. Her bağlantının işareti ve ağırlığı da bir model tercihi. Bu modda gerçek hayvan verisi kullanılmaz.</p></div>
        <div class="equation-card"><span class="eyebrow">KULLANDIĞIMIZ DİNAMİK</span><code>τᵢ dxᵢ/dt = −xᵢ + clip(Σⱼ wᵢⱼxⱼ + Iᵢ(t), 0, 1)<template v-if="isReal"> + Σⱼ gᵢⱼ(xⱼ − xᵢ)</template></code><p v-if="isReal">Kimyasal: w = katsayı × ham ağırlık / max(1, hedefin altgraf içi gelen ham toplamı). Gap: g = katsayı × ham ağırlık / max(1, iki uçtaki altgraf içi gap toplamlarının büyüğü). Gap terimi iki yönde aynı g katsayısını kullanır; işaretli kimyasal ağırlıkla birleştirilmez.</p><p><strong>x</strong> etkinlik · <strong>w</strong> bağlantı ağırlığı · <strong>I</strong> uyaran · <strong>τ</strong> zaman sabiti. Hücreler eşzamanlı Euler adımlarıyla ilerler. Gürültü, spike, öğrenme, beden ve kimyasal süreçler bu modele eklenmedi.</p>
          <div class="numerical-check"><label for="dt">Zaman adımı <select id="dt" v-model.number="dt"><option :value="0.0625">0,0625 ms</option><option :value="0.125">0,125 ms</option><option :value="0.25">0,25 ms</option><option :value="0.5">0,5 ms</option><option :value="1">1 ms</option><option :value="2">2 ms</option></select></label><span>dt/2 ile en büyük fark: <strong data-testid="convergence-error">{{ format(convergenceError, 5) }}</strong></span></div>
          <p v-if="convergenceError > 0.01" class="numerical-warning" role="status" data-testid="numerical-warning">Bu ayarlarda zaman adımı duyarlılığı belirgin. Daha küçük adım seçip farkın azalmasını kontrol et. 0,01 eşiği yalnız bir inceleme uyarısıdır; doğruluk garantisi değildir.</p>
          <p class="field-note">Referans koşul, yarı zaman adımıyla tekrar hesaplanır ve aynı zamanlardaki tüm hücreler karşılaştırılır. Küçük fark sayısal tutarlılığı gösterir; biyolojik doğruluk kanıtı değildir.</p>
        </div>
        <details class="connection-table"><summary>Tüm bağlantıları ve ağırlıkları incele <span>{{ circuit.connections.length }} {{ isReal ? 'anatomik bağlantı + model ağırlığı' : 'model tercihi' }}</span></summary><div class="table-scroll"><table><caption class="sr-only">{{ isReal ? 'Kaynak anatomisi ve ayrı model ağırlıkları' : 'Kurgusal devrenin yönlü bağlantıları' }}</caption><thead><tr><th>Bağlantı</th><th v-if="isReal">Ham EM kesiti</th><th>Model ağırlığı</th><th>Etki</th><th><TermText :text="isReal ? 'Model varsayımı' : 'Öğretici amaç'" /></th></tr></thead><tbody><tr v-for="edge in circuit.connections" :key="edge.id"><td><TermText :text="edgeLabel(edge)" /></td><td v-if="isReal"><TermText :text="edge.rawWeight" /></td><td>{{ format(edge.weight, isReal ? 4 : 2) }}</td><td><TermText :text="edge.kind === 'gap' ? 'Difüzyon' : isReal ? 'Varsayımsal +' : edge.weight < 0 ? 'Baskılayıcı' : 'Uyarıcı'" /></td><td><TermText :text="edge.note" /></td></tr></tbody></table></div></details>
      <details v-if="isReal && realData" class="provenance-details"><summary>Dosya sürümünü, bütünlüğünü ve lisans durumunu incele</summary><p>Birleşik EM serileri ve bağlantı ekstrapolasyonları içeren Cook2019 kaynağıdır; tek hayvanın eksiksiz ölçümü olarak yorumlanmaz. Kaynakta kesin ayrıştırılmayan ekstrapolasyonlar için kenar düzeyinde sahte etiket üretilmedi.</p><div v-for="source in realData.dataset.sources" :key="source.sha256"><a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name }} ↗</a><code>SHA-256 {{ source.sha256 }}</code><p>İndirme UTC: <TermText :text="source.downloadedAtUtc" /></p></div><p>Lisans: dosyaya özgü yeniden dağıtım izni doğrulanmadı. XLSX ve türetilmiş altküme yerel klasördedir; üretim paketine eklenmez.</p><p><TermText text="Diagonal gap kayıtları dinamik çift olarak kullanılmaz; kaynak koordinatları ve seçim raporunda ayrı korunur. Kimyasal matrisin nöron kaynak/hedef kapsamındaki bilinen eksiklikleri de ithalat raporundadır." /></p></details>
      </div>
    </section>

    <section class="next-step"><div><span class="eyebrow">{{ isReal ? 'BU DENEYİN SINIRI / ÖLÇÜMLE KARŞILAŞTIRMA' : 'İKİNCİ SAYFA / GERÇEK BAĞLANTILAR' }}</span><h2>Bir solucanın devresinden<br>küçük bir bölüm.</h2></div><div><p><TermText text="C. elegans'ın yayımlanmış bağlantı tablosundan AVER/AVAR çevresinde en fazla 30 nöron seçiyoruz. Anatomik ağırlık, bağlantı türü, eksik bilgi ve bizim dinamik varsayımlarımız ayrı kaydediliyor." /></p><p class="small-muted">Randi2023 işlevsel ölçümlerine bağlantı bir okuma önerisidir; bu model ölçülmüş kalsiyum yanıtlarına uydurulmadı. Gerçek bağlantılar, doğrulanmış davranış anlamına gelmez.</p><a href="https://wormwiring.org/pages/adjacency.html" target="_blank" rel="noopener noreferrer">WormWiring veri kaynağı ↗</a><a href="https://www.nature.com/articles/s41586-023-06683-4" target="_blank" rel="noopener noreferrer">İşlevsel ölçüm referansı ↗</a></div></section>
  </main>
  <footer><span>Circuitiary</span><p>Kur. Gözlemle. Varsayımını sorgula.</p><span class="footer-note">{{ isReal ? '002 · YEREL ANATOMİ DENEYİ' : '001 · BAŞLANGIÇ DEVRESİ' }}</span></footer>
</template>

<style scoped>
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
