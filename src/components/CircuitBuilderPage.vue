<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { downloadFile } from '../exportData'
import { decimal } from '../format'
import { L, useMessages } from '../i18n'
import { messages } from './CircuitBuilderPage.messages'
import MotifSchematic from './MotifSchematic.vue'
import { TICK_FRACTIONS, bandWidth, plotX, plotY, tracePath, useChartWidth } from '../learning/plotBox'
import {
  CELL_IDS, LIMITS, LINK_TYPE_LABELS, REPORT_LEVEL, blankDraft, cellIds, cloneDraft, draftKey, linkLabel, linkTypeLabel, motifs, motifsEn, presetById,
  runDraft, runFacts, strengthLimits, validateDraft,
  type BuilderLink, type BuilderPreset, type BuilderProblem, type BuilderRun, type CellId, type LinkType,
} from '../learning/circuitBuilder'
import { noPrediction, predictionFeedback, predictionRules, samePrediction, type BuilderPrediction } from '../learning/builderPrediction'
import { CIRCUIT_FILE_MAX_BYTES, circuitFile, clearStoredDraft, parseCircuitFile, readStoredDraft, storeDraft, tooLargeFile, unreadableFile, type CircuitFileOutcome } from '../learning/circuitFile'

const m = useMessages(messages)

const emit = defineEmits<{ ready: [] }>()
onMounted(async () => { await nextTick(); emit('ready') })

// The circuit an earlier visit left in this browser, if it still reads as a valid circuit file; otherwise the blank circuit.
const kept = readStoredDraft()
const draft = reactive(kept ?? blankDraft())
/** 'restored': the page opened with the kept circuit. 'blank': the learner then chose to start from the blank one. */
const keepNotice = ref<'restored' | 'blank' | null>(kept ? 'restored' : null)
const linkTypes = Object.keys(LINK_TYPE_LABELS) as LinkType[]
let counter = 0
const newLinkId = () => `n${++counter}`

// State holds ids, numbers and functions, never finished sentences, so everything on the page follows a language change.
const status = ref<(() => string) | null>(null)
const loadedPresetId = ref<BuilderPreset['id'] | null>(null)
const loadedPreset = computed(() => loadedPresetId.value === null ? null : presetById(loadedPresetId.value))
const presetList = computed(() => L(motifs, motifsEn))
let loadedKey = ''
const recorded = ref<BuilderRun | null>(null)
const recordedKey = ref('')
const runNumber = ref(0)
// A problem writes its sentence when `message` is read (circuitBuilder.ts), so a kept list is not fixed in one language.
const engineProblems = ref<BuilderProblem[]>([])

const cells = computed(() => cellIds(draft.cellCount))
const problems = computed(() => validateDraft(draft))
const invalidLinks = computed(() => new Set(problems.value.map(problem => problem.linkId)))
const stale = computed(() => recorded.value !== null && draftKey(draft) !== recordedKey.value)
const presetEdited = computed(() => loadedPreset.value !== null && draftKey(draft) !== loadedKey)
const canAddLink = computed(() => draft.links.length < LIMITS.links.max)

// Keeping: every change of the circuit is written to this browser (a valid circuit only; the blank one as "nothing").
watch(() => draftKey(draft), () => { storeDraft(draft) })
const fileStatus = ref<(() => string) | null>(null)
/** `rejected`: a file was refused (the circuit is unchanged). Otherwise the page's own circuit could not be saved. */
const fileError = ref<{ code: string; rejected: boolean; text: () => string } | null>(null)

// Optional prediction: ids only. `recordedPrediction` is the copy taken by the run that is on screen.
const prediction = reactive<BuilderPrediction>(noPrediction())
const recordedPrediction = ref<BuilderPrediction>(noPrediction())
const predictionChanged = computed(() => recorded.value !== null && !samePrediction(prediction, recordedPrediction.value))
const feedback = computed(() => recorded.value ? predictionFeedback(recordedPrediction.value, recorded.value) : [])
// The peak question is about the cells other than the stimulated one. A predicted cell that left the circuit,
// or that became the stimulated cell, is no longer a possible answer and is dropped.
const peakCandidates = computed(() => cells.value.filter(id => id !== draft.stimulus.target))
watch(peakCandidates, ids => { if (prediction.peak !== '' && prediction.peak !== 'unsure' && !ids.includes(prediction.peak)) prediction.peak = '' })

/** A circuit replaced as a whole is a new question: the prediction, the kept-circuit notice and the file lines start over. */
function startOver() {
  Object.assign(prediction, noPrediction())
  keepNotice.value = null
  fileStatus.value = null
  fileError.value = null
}

function replaceDraft(next: typeof draft) {
  draft.cellCount = next.cellCount
  draft.links = next.links
  draft.stimulus = next.stimulus
}

function loadPreset(id: BuilderPreset['id']) {
  const preset = presetById(id)
  replaceDraft(cloneDraft(preset.draft))
  startOver()
  loadedPresetId.value = id
  loadedKey = draftKey(draft)
  recorded.value = null
  engineProblems.value = []
  status.value = () => m.value.statusPresetLoaded(presetById(id).title)
}

function clearToBlank() {
  replaceDraft(blankDraft())
  startOver()
  loadedPresetId.value = null
  recorded.value = null
  runNumber.value = 0
  engineProblems.value = []
}

function reset() {
  clearToBlank()
  status.value = () => m.value.statusReset
}

/** From the notice of a restored circuit: the blank circuit, and nothing kept in the browser. */
function startBlank() {
  clearToBlank()
  clearStoredDraft()
  status.value = null
  keepNotice.value = 'blank'
  focusSoon('builder-cell-count')
}

function saveFile() {
  fileStatus.value = null
  if (problems.value.length) {
    fileError.value = { code: 'save-blocked', rejected: false, text: () => m.value.saveBlocked }
    return
  }
  fileError.value = null
  downloadFile(circuitFile(cloneDraft(draft)))
  fileStatus.value = () => m.value.statusFileSaved
}

async function loadFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Cleared so that choosing the same file again is a change again.
  input.value = ''
  if (!file) return
  let outcome: CircuitFileOutcome
  if (file.size > CIRCUIT_FILE_MAX_BYTES) outcome = tooLargeFile()
  else {
    try { outcome = parseCircuitFile(await file.text()) } catch { outcome = unreadableFile() }
  }
  if (!outcome.ok) {
    const error = outcome.error
    fileStatus.value = null
    fileError.value = { code: error.code, rejected: true, text: () => error.message }
    return
  }
  replaceDraft(outcome.draft)
  startOver()
  loadedPresetId.value = null
  recorded.value = null
  engineProblems.value = []
  status.value = null
  fileStatus.value = () => m.value.statusFileLoaded
}

function setCellCount(event: Event) {
  const count = Number((event.target as HTMLSelectElement).value)
  const kept = new Set<string>(cellIds(count))
  const before = draft.links.length
  const removedCells = cellIds(draft.cellCount).filter(id => !kept.has(id))
  draft.cellCount = count
  draft.links = draft.links.filter(link => kept.has(link.source) && kept.has(link.target))
  if (!kept.has(draft.stimulus.target)) draft.stimulus.target = 'A'
  const dropped = before - draft.links.length
  const now = cellIds(count)
  status.value = removedCells.length
    ? () => m.value.statusCellsRemoved(removedCells, dropped, count)
    : () => m.value.statusCellCount(count, now[0]!, now.at(-1)!)
}

function focusSoon(id: string) {
  void nextTick(() => document.getElementById(id)?.focus())
}

function addLink() {
  if (!canAddLink.value) return
  let pair: [CellId, CellId] = ['A', 'B']
  const taken = new Set(draft.links.filter(link => link.type !== 'gap').map(link => `${link.source}${link.target}`))
  search: for (const source of cells.value) for (const target of cells.value) {
    if (source !== target && !taken.has(`${source}${target}`)) { pair = [source, target]; break search }
  }
  const link: BuilderLink = { id: newLinkId(), source: pair[0], target: pair[1], type: 'excitatory', strength: 0.8 }
  draft.links.push(link)
  // The line keeps describing the connection as it was added, whatever is edited later.
  const [n, added] = [draft.links.length, { ...link }]
  status.value = () => m.value.statusLinkAdded(n, linkLabel(added))
  focusSoon(`link-${link.id}-type`)
}

function removeLink(id: string) {
  const index = draft.links.findIndex(link => link.id === id)
  if (index < 0) return
  const [removed] = draft.links.splice(index, 1)
  const [gone, left] = [{ ...removed! }, draft.links.length]
  status.value = () => m.value.statusLinkRemoved(index + 1, linkLabel(gone), left)
  const next = draft.links[index] ?? draft.links[index - 1]
  focusSoon(next ? `link-${next.id}-remove` : 'builder-add-link')
}

function setType(link: BuilderLink, event: Event) {
  link.type = (event.target as HTMLSelectElement).value as LinkType
  link.strength = Math.min(link.strength, strengthLimits(link.type).max)
}

function runCircuit() {
  const outcome = runDraft(draft)
  if (!outcome.ok) {
    engineProblems.value = outcome.problems
    status.value = () => m.value.statusRunFailed
    return
  }
  engineProblems.value = []
  recorded.value = outcome.run
  recordedKey.value = draftKey(draft)
  recordedPrediction.value = { ...prediction }
  runNumber.value += 1
  const [n, count] = [runNumber.value, outcome.run.cells.length]
  status.value = () => m.value.statusRunDone(n, count)
}

const sliderText = (value: number, digits: number) => decimal(value, digits)
const ms = (value: number | null) => value === null ? '—' : m.value.milliseconds(decimal(value, 0))
const fieldLabel = (link: BuilderLink, side: 'source' | 'target') => link.type === 'gap' ? (side === 'source' ? m.value.cell1 : m.value.cell2) : (side === 'source' ? m.value.source : m.value.target)

// Chart: one line per cell on a shared 0-1 axis. Color, dash pattern and the legend letter together identify a cell.
const traceStyles = [
  { color: 'var(--b-c0)', dash: undefined }, { color: 'var(--b-c1)', dash: '9 5' }, { color: 'var(--b-c2)', dash: '2 4' },
  { color: 'var(--b-c3)', dash: '11 4 2 4' }, { color: 'var(--b-c4)', dash: '16 6' }, { color: 'var(--b-c5)', dash: '1 6' },
]
// The host exists before the first run, so the width is measured from mount on; the SVG itself only appears with a result.
const plotHost = ref<HTMLDivElement | null>(null)
const width = useChartWidth(plotHost, { initial: 640 })
const height = 280
const pad = { top: 22, bottom: 46, left: 46, right: 16 }
const maxTime = computed(() => recorded.value?.result.timesMs.at(-1) ?? 1)
const x = (time: number) => plotX(time, maxTime.value, width.value, pad)
const y = (value: number) => plotY(value, 1, height, pad)
const paths = computed(() => {
  const run = recorded.value
  return run ? run.cells.map((cell, index) => ({ id: cell.id, d: tracePath(run.result.activity[cell.id]!, run.result.timesMs, x, y), style: traceStyles[index]! })) : []
})
const settings = computed(() => recorded.value?.result.settings.stimulus)
// One message for the whole sentence. The spaces around it keep the paragraph's text exactly as it was when the sentence was written out in the template.
const recordLine = computed(() => {
  const [run, stimulus] = [recorded.value, settings.value]
  return run && stimulus ? ` ${m.value.recordSettings(runNumber.value, run.draft.cellCount, run.draft.links.length, stimulus.target, decimal(stimulus.amplitude, 2), decimal(stimulus.onsetMs, 0), decimal(stimulus.onsetMs + stimulus.durationMs, 0))} ` : ''
})
const chartLabel = computed(() => recorded.value ? m.value.chartLabel(recorded.value.cells.map(cell => cell.id)) : '')
// Written again from the recorded numbers on every render, so the sentences of an earlier run follow the language too.
const facts = computed(() => recorded.value ? runFacts(recorded.value) : [])
</script>

<template>
  <main id="circuit-builder" tabindex="-1" class="builder-page">
    <header class="builder-intro">
      <p class="builder-eyebrow">{{ m.eyebrow }}</p>
      <h1 tabindex="-1">{{ m.title }}</h1>
      <p class="builder-summary">{{ m.summary }}</p>
    </header>

    <div class="builder-boundary" data-testid="builder-boundary">
      <strong>{{ m.boundaryTitle }}</strong>
      <p>{{ m.boundaryText }}</p>
    </div>

    <div v-if="keepNotice" class="keep-notice" data-testid="builder-restored" :data-state="keepNotice" data-print-hide>
      <p role="status" aria-live="polite">{{ keepNotice === 'restored' ? m.restored : m.startedBlank }}</p>
      <button v-if="keepNotice === 'restored'" type="button" class="secondary-button" data-testid="builder-start-blank" @click="startBlank">{{ m.startBlank }}</button>
    </div>

    <div class="builder-grid">
      <div class="builder-setup">
        <section aria-labelledby="builder-presets-title" class="builder-card builder-gallery">
          <h2 id="builder-presets-title">{{ m.presetsTitle }}</h2>
          <p class="builder-help">{{ m.presetsHelp }}</p>
          <ul class="schematic-legend" :aria-label="m.schematicLegend">
            <li><svg width="36" height="14" viewBox="0 0 36 14" aria-hidden="true"><path d="M2 7H26" /><path class="solid" d="M34 7 26 3.4V10.6Z" /></svg>{{ m.legendExcitatory }}</li>
            <li><svg width="36" height="14" viewBox="0 0 36 14" aria-hidden="true"><path d="M2 7H32" /><path class="bar" d="M32.5 1.5V12.5" /></svg>{{ m.legendInhibitory }}</li>
            <li><svg width="36" height="14" viewBox="0 0 36 14" aria-hidden="true"><path d="M2 5.2H34M2 8.8H34" /></svg>{{ m.legendGap }}</li>
            <li><svg width="36" height="14" viewBox="0 0 36 14" aria-hidden="true"><circle cx="18" cy="7" r="3.6" /><circle cx="18" cy="7" r="6.2" /></svg>{{ m.legendRing }}</li>
          </ul>
          <p class="builder-help motif-scroll-hint">{{ m.motifScrollHint }}</p>
          <ul class="motif-gallery" :aria-label="m.presetsTitle" data-testid="builder-gallery">
            <li v-for="preset in presetList" :key="preset.id" class="motif-card" :data-motif="preset.id">
              <h3 :id="`motif-${preset.id}-title`">{{ preset.title }}</h3>
              <MotifSchematic :draft="preset.draft" />
              <p>{{ preset.teaches }}</p>
              <button :id="`motif-${preset.id}-load`" type="button" class="secondary-button" :data-preset="preset.id" :aria-labelledby="`motif-${preset.id}-title motif-${preset.id}-load`" @click="loadPreset(preset.id)">{{ m.motifLoad }}</button>
            </li>
          </ul>
          <p class="builder-help">{{ m.schematicNote }}</p>
          <section v-if="loadedPreset" class="preset-note" aria-labelledby="preset-note-title" data-testid="builder-preset-note" :data-preset="loadedPreset.id">
            <h3 id="preset-note-title">{{ loadedPreset.title }}</h3>
            <p><strong>{{ m.presetTeaches }}</strong> {{ loadedPreset.teaches }}</p>
            <p><strong>{{ m.presetLook }}</strong> {{ loadedPreset.look }}</p>
            <p><strong>{{ m.presetTry }}</strong> {{ loadedPreset.tryThis }}</p>
            <p><strong>{{ m.presetBoundary }}</strong> {{ loadedPreset.boundary }}</p>
            <p v-if="presetEdited" class="builder-help" data-testid="builder-preset-edited">{{ m.presetEdited }}</p>
          </section>
        </section>

        <section aria-labelledby="builder-cells-title" class="builder-card">
          <h2 id="builder-cells-title">{{ m.cellsTitle }}</h2>
          <div class="field-grid">
            <div class="field">
              <label for="builder-cell-count">{{ m.cellCount }}</label>
              <select id="builder-cell-count" :value="draft.cellCount" @change="setCellCount">
                <option v-for="count in LIMITS.cells.max - LIMITS.cells.min + 1" :key="count" :value="count + LIMITS.cells.min - 1">{{ m.cellCountOption(count + LIMITS.cells.min - 1, CELL_IDS[0], CELL_IDS[count + LIMITS.cells.min - 2]!) }}</option>
              </select>
            </div>
            <div class="field">
              <label for="builder-stim-target">{{ m.stimulusTarget }}</label>
              <select id="builder-stim-target" v-model="draft.stimulus.target">
                <option v-for="id in cells" :key="id" :value="id">{{ m.cellOption(id) }}</option>
              </select>
            </div>
            <div class="field">
              <div class="field-head"><label for="builder-amplitude">{{ m.amplitude }}</label><output for="builder-amplitude" data-testid="builder-amplitude-output">{{ sliderText(draft.stimulus.amplitude, 2) }}</output></div>
              <input id="builder-amplitude" v-model.number="draft.stimulus.amplitude" type="range" :min="LIMITS.amplitude.min" :max="LIMITS.amplitude.max" :step="LIMITS.amplitude.step" :aria-valuetext="sliderText(draft.stimulus.amplitude, 2)" />
            </div>
            <div class="field">
              <div class="field-head"><label for="builder-onset">{{ m.onset }}</label><output for="builder-onset">{{ ms(draft.stimulus.onsetMs) }}</output></div>
              <input id="builder-onset" v-model.number="draft.stimulus.onsetMs" type="range" :min="LIMITS.onsetMs.min" :max="LIMITS.onsetMs.max" :step="LIMITS.onsetMs.step" :aria-valuetext="ms(draft.stimulus.onsetMs)" />
            </div>
            <div class="field">
              <div class="field-head"><label for="builder-pulse">{{ m.pulse }}</label><output for="builder-pulse">{{ ms(draft.stimulus.durationMs) }}</output></div>
              <input id="builder-pulse" v-model.number="draft.stimulus.durationMs" type="range" :min="LIMITS.pulseMs.min" :max="LIMITS.pulseMs.max" :step="LIMITS.pulseMs.step" :aria-valuetext="ms(draft.stimulus.durationMs)" />
            </div>
          </div>
          <p class="builder-help">{{ m.stimulusHelp }}</p>
        </section>

        <section aria-labelledby="builder-links-title" class="builder-card">
          <h2 id="builder-links-title">{{ m.linksTitle }}</h2>
          <p class="builder-help">{{ m.linksHelp }}</p>
          <p v-if="!draft.links.length" class="builder-empty" data-testid="builder-no-links">{{ m.noLinks }}</p>
          <ul v-else class="link-list" :aria-label="m.linkList">
            <li v-for="(link, index) in draft.links" :key="link.id" class="link-row" :class="{ invalid: invalidLinks.has(link.id) }" :data-testid="`builder-link-${index + 1}`" :data-type="link.type">
              <div class="link-head">
                <p class="link-title"><span :id="`link-${link.id}-title`">{{ m.linkTitle(index + 1) }}</span> <span class="link-sum">{{ linkLabel(link) }}</span><span v-if="invalidLinks.has(link.id)" class="link-flag">{{ m.linkFlag }}</span></p>
                <button :id="`link-${link.id}-remove`" type="button" class="secondary-button" :aria-label="m.removeLabel(index + 1, linkLabel(link))" @click="removeLink(link.id)">{{ m.remove }}</button>
              </div>
              <div class="field-grid">
                <div class="field">
                  <label :id="`link-${link.id}-type-label`" :for="`link-${link.id}-type`">{{ m.type }}</label>
                  <select :id="`link-${link.id}-type`" :value="link.type" :aria-labelledby="`link-${link.id}-title link-${link.id}-type-label`" @change="setType(link, $event)">
                    <option v-for="type in linkTypes" :key="type" :value="type">{{ linkTypeLabel(type) }}</option>
                  </select>
                </div>
                <div class="field">
                  <label :id="`link-${link.id}-source-label`" :for="`link-${link.id}-source`">{{ fieldLabel(link, 'source') }}</label>
                  <select :id="`link-${link.id}-source`" v-model="link.source" :aria-labelledby="`link-${link.id}-title link-${link.id}-source-label`">
                    <option v-for="id in cells" :key="id" :value="id">{{ id }}</option>
                  </select>
                </div>
                <div class="field">
                  <label :id="`link-${link.id}-target-label`" :for="`link-${link.id}-target`">{{ fieldLabel(link, 'target') }}</label>
                  <select :id="`link-${link.id}-target`" v-model="link.target" :aria-labelledby="`link-${link.id}-title link-${link.id}-target-label`">
                    <option v-for="id in cells" :key="id" :value="id">{{ id }}</option>
                  </select>
                </div>
                <div class="field field-wide">
                  <div class="field-head"><label :id="`link-${link.id}-strength-label`" :for="`link-${link.id}-strength`">{{ m.strength }}</label><output :for="`link-${link.id}-strength`" :data-testid="`builder-link-${index + 1}-strength-output`">{{ sliderText(link.strength, 2) }}</output></div>
                  <input :id="`link-${link.id}-strength`" v-model.number="link.strength" type="range" :min="strengthLimits(link.type).min" :max="strengthLimits(link.type).max" :step="strengthLimits(link.type).step" :aria-labelledby="`link-${link.id}-title link-${link.id}-strength-label`" :aria-valuetext="sliderText(link.strength, 2)" />
                </div>
              </div>
              <p v-if="link.type === 'gap'" class="builder-help">{{ m.gapHelp }}</p>
              <p v-else-if="link.type === 'inhibitory'" class="builder-help">{{ m.inhibitoryHelp(sliderText(link.strength, 2)) }}</p>
            </li>
          </ul>
          <button id="builder-add-link" type="button" class="secondary-button add-button" :disabled="!canAddLink" @click="addLink">{{ m.addLink }}</button>
          <p v-if="!canAddLink" class="builder-help">{{ m.maxLinks(LIMITS.links.max) }}</p>
        </section>

        <section aria-labelledby="builder-run-title" class="builder-card">
          <h2 id="builder-run-title">{{ m.runTitle }}</h2>
          <div id="builder-validity" class="validity" role="status" aria-live="polite" data-testid="builder-validity" :data-valid="problems.length === 0">
            <p v-if="!problems.length">{{ m.valid }}</p>
            <template v-else>
              <p>{{ m.invalidIntro }}</p>
              <ul><li v-for="(problem, index) in problems" :key="index" :data-code="problem.code">{{ problem.message }}</li></ul>
            </template>
          </div>
          <fieldset class="prediction" data-testid="builder-prediction">
            <legend>{{ m.predictionTitle }}</legend>
            <p class="builder-help">{{ m.predictionHelp }}</p>
            <div class="field-grid">
              <div class="field">
                <label for="builder-predict-peak">{{ m.predictPeak }}</label>
                <select id="builder-predict-peak" v-model="prediction.peak" aria-describedby="builder-prediction-rules">
                  <option value="">{{ m.predictNone }}</option>
                  <option v-for="id in peakCandidates" :key="id" :value="id">{{ m.cellOption(id) }}</option>
                  <option value="unsure">{{ m.predictUnsure }}</option>
                </select>
              </div>
              <div class="field">
                <label for="builder-predict-end">{{ m.predictEnd }}</label>
                <select id="builder-predict-end" v-model="prediction.end" aria-describedby="builder-prediction-rules">
                  <option value="">{{ m.predictNone }}</option>
                  <option value="fades">{{ m.predictFades }}</option>
                  <option value="persists">{{ m.predictPersists }}</option>
                  <option value="unsure">{{ m.predictUnsure }}</option>
                </select>
              </div>
            </div>
            <p id="builder-prediction-rules" class="builder-help">{{ predictionRules() }}</p>
          </fieldset>
          <div class="builder-actions">
            <button type="button" class="primary-button" data-testid="builder-run" :disabled="problems.length > 0" aria-describedby="builder-validity" @click="runCircuit">{{ recorded ? m.runAgain : m.run }}</button>
            <button type="button" class="secondary-button" data-testid="builder-reset" @click="reset">{{ m.reset }}</button>
          </div>
          <p class="builder-status" role="status" aria-live="polite" data-testid="builder-status">{{ status?.() }}</p>
          <ul v-if="engineProblems.length" class="engine-problems" role="alert"><li v-for="problem in engineProblems" :key="problem.code">{{ problem.message }}</li></ul>
        </section>

        <section aria-labelledby="builder-keep-title" class="builder-card" data-print-hide>
          <h2 id="builder-keep-title">{{ m.keepTitle }}</h2>
          <p class="builder-help">{{ m.keepHelp }}</p>
          <div class="builder-actions">
            <button type="button" class="secondary-button" data-testid="builder-save-file" @click="saveFile">{{ m.saveFile }}</button>
            <span class="file-picker">
              <input id="builder-file" class="file-input" type="file" accept="application/json,.json" data-testid="builder-file-input" @change="loadFile" />
              <label for="builder-file" class="secondary-button file-label">{{ m.loadFile }}</label>
            </span>
          </div>
          <p class="builder-help">{{ m.fileHelp }}</p>
          <p class="builder-status" role="status" aria-live="polite" data-testid="builder-file-status">{{ fileStatus?.() }}</p>
          <div v-if="fileError" class="file-error" role="alert" data-testid="builder-file-error" :data-code="fileError.code">
            <p v-if="fileError.rejected">{{ m.fileRejected }}</p>
            <p>{{ fileError.text() }}</p>
          </div>
        </section>
      </div>

      <section aria-labelledby="builder-result-title" class="builder-card builder-results" tabindex="0">
        <h2 id="builder-result-title">{{ m.resultTitle }}</h2>
        <div ref="plotHost">
        <div v-if="!recorded" class="not-run" data-testid="builder-not-run">
          <p>{{ m.notRun }}</p>
          <p>{{ m.notRunHelp }}</p>
        </div>
        <div v-else data-testid="builder-result" :data-run-number="runNumber" :data-stale="stale">
          <p v-if="stale" class="stale-warning" role="status" data-testid="builder-stale">{{ m.stale }}</p>
          <p class="record-settings" data-testid="builder-run-settings" :data-cells="recorded.draft.cellCount" :data-links="recorded.draft.links.length" :data-target="settings!.target" :data-amplitude="settings!.amplitude" :data-onset="settings!.onsetMs" :data-pulse="settings!.durationMs">
            {{ recordLine }}
          </p>
          <figure class="trace-figure">
            <figcaption>{{ m.figureCaption }}</figcaption>
            <ul class="trace-legend" :aria-label="m.legend">
              <li v-for="path in paths" :key="path.id"><svg class="swatch" width="30" height="10" viewBox="0 0 30 10" aria-hidden="true"><line x1="0" y1="5" x2="30" y2="5" :stroke="path.style.color" stroke-width="3" :stroke-dasharray="path.style.dash" /></svg>{{ path.id }}<template v-if="path.id === settings!.target">{{ m.legendStimulated }}</template></li>
              <li><span class="band-swatch" aria-hidden="true"></span>{{ m.legendPulse }}</li>
            </ul>
            <svg data-testid="builder-plot" role="img" :aria-label="chartLabel" :viewBox="`0 0 ${width} ${height}`">
              <rect data-testid="builder-pulse-band" :x="x(settings!.onsetMs)" :y="pad.top" :width="bandWidth(x, settings!.onsetMs, settings!.durationMs, maxTime)" :height="height - pad.top - pad.bottom" class="pulse-band" />
              <g v-for="tick in TICK_FRACTIONS" :key="`y${tick}`"><line :x1="pad.left" :x2="width - pad.right" :y1="y(tick)" :y2="y(tick)" class="grid-line" :stroke-dasharray="tick ? '3 5' : undefined" /><text :x="pad.left - 8" :y="y(tick) + 4" text-anchor="end">{{ decimal(tick, 2) }}</text></g>
              <g v-for="fraction in TICK_FRACTIONS" :key="`x${fraction}`"><text :x="x(maxTime * fraction)" :y="height - pad.bottom + 18" text-anchor="middle">{{ decimal(Math.round(maxTime * fraction), 0) }}</text></g>
              <text :x="pad.left" y="12">{{ m.axisActivity }}</text>
              <text :x="pad.left + (width - pad.left - pad.right) / 2" :y="height - 6" text-anchor="middle">{{ m.axisTime }}</text>
              <path v-for="path in paths" :key="path.id" :data-trace="path.id" :d="path.d" fill="none" :stroke="path.style.color" stroke-width="2.6" stroke-linejoin="round" :stroke-dasharray="path.style.dash" />
            </svg>
            <p class="plot-note">{{ m.plotNote }}</p>
          </figure>
          <table class="metrics-table" data-testid="builder-table">
            <caption>{{ m.tableCaption }}</caption>
            <thead><tr><th scope="col">{{ m.columnCell }}</th><th scope="col">{{ m.columnPeak }}</th><th scope="col">{{ m.columnPeakTime }}</th><th scope="col">{{ m.columnReach(decimal(REPORT_LEVEL, 2)) }}</th><th scope="col">{{ m.columnFinal(decimal(recorded.result.timesMs.at(-1)!, 0)) }}</th></tr></thead>
            <tbody>
              <tr v-for="cell in recorded.cells" :key="cell.id" :data-testid="`builder-row-${cell.id}`">
                <th scope="row">{{ cell.id }}<template v-if="cell.id === settings!.target">{{ m.rowStimulated }}</template></th>
                <td :data-testid="`builder-peak-${cell.id}`" :data-value="cell.peak">{{ decimal(cell.peak, 3) }}</td>
                <td :data-testid="`builder-peak-time-${cell.id}`" :data-value="cell.peakTimeMs ?? 'null'">{{ ms(cell.peakTimeMs) }}</td>
                <td :data-testid="`builder-reach-${cell.id}`" :data-value="cell.reachMs ?? 'null'">{{ ms(cell.reachMs) }}</td>
                <td :data-testid="`builder-final-${cell.id}`" :data-value="cell.finalValue">{{ decimal(cell.finalValue, 3) }}</td>
              </tr>
            </tbody>
          </table>
          <p class="plot-note">{{ m.tableNote(decimal(REPORT_LEVEL, 2)) }}</p>
          <div class="facts" data-testid="builder-facts">
            <h3>{{ m.factsTitle }}</h3>
            <ul><li v-for="fact in facts" :key="fact">{{ fact }}</li></ul>
            <p>{{ m.factsCaveat }}</p>
          </div>
          <div class="prediction-feedback" data-testid="builder-prediction-feedback" :data-predicted="feedback.length > 0" :data-changed="predictionChanged">
            <h3>{{ m.predictionFeedbackTitle }}</h3>
            <p v-if="!feedback.length" data-testid="builder-prediction-none">{{ m.predictionNone }}</p>
            <template v-else>
              <ul><li v-for="line in feedback" :key="line.question" :data-testid="`builder-prediction-${line.question}`" :data-verdict="line.verdict">{{ line.text }}</li></ul>
              <p>{{ m.predictionNotScore }}</p>
            </template>
            <p v-if="predictionChanged" class="prediction-changed" role="status" data-testid="builder-prediction-changed">{{ m.predictionChanged }}</p>
          </div>
        </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.builder-page {
  --b-surface: var(--theme-surface, #fbfcf7);
  --b-soft: var(--theme-surface-soft, #ecf0e4);
  --b-border: var(--theme-border, #cbd4c1);
  --b-text: var(--theme-text, #263b35);
  --b-muted: var(--theme-muted, #55645b);
  --b-problem: var(--theme-danger, #8a3b2e);
  --b-c0: #2f7960; --b-c1: #b4513f; --b-c2: #3f6ea6; --b-c3: #8f6a14; --b-c4: #7b4f94; --b-c5: #5f6655;
  padding-bottom: 64px; outline: none;
}
:root[data-theme="dark"] .builder-page { --b-c0: #87c7a2; --b-c1: #efaaa0; --b-c2: #a7c5f1; --b-c3: #e5c17f; --b-c4: #d3b3ea; --b-c5: #bac5a4; }
.builder-intro { padding: 48px 0 26px; }
.builder-eyebrow { font: 10px/1.8 var(--mono, monospace); letter-spacing: 1.2px; color: var(--b-muted); }
.builder-intro h1 { font: 400 56px/1.1 var(--serif, Georgia, serif); letter-spacing: -1.5px; margin: 16px 0 18px; }
.builder-summary { font-size: 17px; line-height: 1.8; max-width: 680px; }
.builder-boundary { padding: 16px 20px; border-left: 3px solid #7c9571; background: var(--b-soft); font-size: 14px; line-height: 1.8; margin-bottom: 26px; }
.builder-boundary p { margin-top: 6px; max-width: 900px; }
.builder-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px; align-items: start; }
.builder-setup { display: grid; gap: 22px; min-width: 0; }
.builder-card { border: 1px solid var(--b-border); border-radius: 7px; background: var(--b-surface); padding: 22px; min-width: 0; }
.builder-card h2 { font: 400 25px/1.3 var(--serif, Georgia, serif); margin-bottom: 12px; }
.builder-card h3 { font-size: 15px; line-height: 1.6; margin: 0 0 8px; }
.builder-help { font-size: 13px; line-height: 1.8; color: var(--b-muted); margin: 8px 0; }
.builder-empty { font-size: 13px; line-height: 1.8; padding: 14px; border: 1px dashed var(--b-border); border-radius: 5px; margin-bottom: 12px; }
.schematic-legend { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 18px; padding: 0; margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: var(--b-muted); }
.schematic-legend li { display: flex; align-items: center; gap: 7px; min-height: 22px; }
.schematic-legend svg { flex: none; color: var(--b-text); fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
.schematic-legend .solid { fill: currentColor; stroke-linejoin: round; stroke-width: 1; }
.schematic-legend .bar { stroke-width: 2.8; }
/* One row that scrolls sideways: nine cards one under another would push the builder itself far down the page.
   The scrollbar is always drawn, so the row reads as scrollable with a mouse too; a button inside scrolls into view on focus. */
.motif-gallery { list-style: none; display: flex; gap: 10px; overflow-x: auto; padding: 4px 4px 10px; margin: 6px -4px 0; scrollbar-width: thin; scrollbar-color: var(--b-muted) var(--b-soft); }
.motif-gallery::-webkit-scrollbar { height: 10px; }
.motif-gallery::-webkit-scrollbar-track { background: var(--b-soft); border-radius: 5px; }
.motif-gallery::-webkit-scrollbar-thumb { background: var(--b-muted); border-radius: 5px; }
.motif-card { flex: 0 0 min(212px, 80%); display: grid; grid-template-rows: auto auto 1fr auto; gap: 8px; min-width: 0; padding: 14px; border: 1px solid var(--b-border); border-radius: 6px; background: var(--b-soft); }
.motif-card h3 { font-size: 14px; font-weight: 600; line-height: 1.5; margin: 0; }
.motif-card p { font-size: 12px; line-height: 1.65; color: var(--b-muted); }
.motif-card .motif-schematic { justify-self: center; }
.motif-card button { justify-self: start; }
.keep-notice { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 18px; padding: 12px 16px; margin-bottom: 22px; border: 1px solid var(--b-border); border-left: 3px solid #7c9571; border-radius: 6px; background: var(--b-surface); font-size: 13px; line-height: 1.8; }
.keep-notice p { flex: 1 1 260px; }
.file-picker { position: relative; display: inline-flex; }
/* The real file input stays focusable and labelled; only its browser-drawn box is hidden behind the label. */
.file-input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none; }
.file-label { display: inline-flex; align-items: center; cursor: pointer; }
.file-input:focus-visible + .file-label { outline: 3px solid var(--theme-focus, #b78231); outline-offset: 4px; }
.file-error { margin-top: 8px; padding: 10px 14px; border-left: 3px solid var(--b-problem); background: var(--b-soft); color: var(--b-problem); font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; }
.prediction { min-width: 0; margin: 0 0 14px; padding: 12px 14px; border: 1px solid var(--b-border); border-radius: 6px; }
.prediction legend { padding: 0 6px; font-size: 14px; font-weight: 600; line-height: 1.6; }
.prediction .field-grid { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); margin-top: 10px; }
/* A question that wraps onto a second line must not push its own list below its neighbour's. */
.prediction .field { grid-template-rows: 1fr auto; }
.prediction .field label { align-self: end; }
.prediction-feedback { margin-top: 14px; padding: 14px 16px; border: 1px solid var(--b-border); border-radius: 6px; font-size: 13px; line-height: 1.8; }
.prediction-feedback ul { margin: 0 0 8px; padding-left: 18px; }
.prediction-feedback li { margin-bottom: 6px; }
.prediction-feedback p { color: var(--b-muted); }
.prediction-feedback .prediction-changed { margin-top: 8px; padding-left: 12px; border-left: 2px solid #b2823e; color: var(--theme-warning, #765726); }
.preset-note { margin-top: 16px; padding: 14px 16px; border-left: 3px solid #7c9571; background: var(--b-soft); font-size: 13px; line-height: 1.8; }
.preset-note p { margin-top: 6px; }
.field-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
.field { display: grid; gap: 6px; align-content: start; min-width: 0; }
.field-wide { grid-column: 1 / -1; }
.link-row .field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.link-row .field:first-child { grid-column: 1 / -1; }
@media (min-width: 761px) { .link-row .field-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .link-row .field:first-child { grid-column: auto; } }
/* A tall result (six cells) is taller than the window: the stuck card scrolls inside itself so its table and sentences stay reachable. */
@media (min-width: 1051px) and (min-height: 900px) { .builder-results { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto; } }
.builder-results:focus-visible { outline: 3px solid var(--theme-focus, #b78231); outline-offset: 2px; }
.field label, .field-head label { font-size: 13px; line-height: 1.6; font-weight: 500; }
.field-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.field-head output { font: 13px var(--mono, monospace); color: var(--b-text); }
.field select { min-height: 44px; padding: 8px 10px; font-size: 14px; width: 100%; }
.field input[type=range] { height: 44px; }
.link-list { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 12px; }
.link-row { border: 1px solid var(--b-border); border-radius: 6px; padding: 12px 14px; background: var(--b-soft); }
.link-row.invalid { border-color: var(--b-problem); border-width: 2px; }
.link-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.link-title { font-size: 14px; line-height: 1.6; font-weight: 600; overflow-wrap: anywhere; }
.link-sum { font-weight: 400; color: var(--b-muted); }
.link-flag { color: var(--b-problem); font-weight: 600; }
.primary-button, .secondary-button { min-height: 44px; padding: 10px 16px; border-radius: 5px; font-size: 14px; line-height: 1.5; }
.primary-button { background: #2c483b; color: #f7f7eb; border: 1px solid #2c483b; }
.secondary-button { background: var(--b-surface); color: var(--b-text); border: 1px solid var(--b-border); flex: none; }
.primary-button:disabled, .secondary-button:disabled { opacity: .55; cursor: not-allowed; }
.add-button { margin-top: 4px; }
.validity { font-size: 13px; line-height: 1.8; margin-bottom: 14px; }
.validity ul { margin: 8px 0 0; padding-left: 18px; color: var(--b-problem); }
.validity li { margin-bottom: 6px; overflow-wrap: anywhere; }
.validity[data-valid="true"] { color: var(--b-text); }
.builder-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.builder-status { font-size: 13px; line-height: 1.8; color: var(--b-muted); margin-top: 12px; min-height: 23px; }
.engine-problems { margin: 8px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.8; color: var(--b-problem); }
.not-run { min-height: 200px; display: grid; align-content: center; gap: 8px; padding: 16px; border: 1px dashed var(--b-border); border-radius: 6px; font-size: 14px; line-height: 1.8; color: var(--b-muted); }
.stale-warning { padding: 12px 14px; border-left: 3px solid #b2823e; background: var(--theme-warning-bg, #f2ead7); color: var(--theme-warning, #765726); font-size: 13px; line-height: 1.8; margin-bottom: 14px; }
.record-settings { font-size: 13px; line-height: 1.8; color: var(--b-muted); }
.trace-figure { margin: 16px 0 0; min-width: 0; }
.trace-figure figcaption { font-size: 14px; font-weight: 600; line-height: 1.6; margin-bottom: 8px; }
.trace-legend { list-style: none; display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 0; margin: 0 0 10px; font-size: 13px; }
.trace-legend li { display: flex; align-items: center; gap: 6px; min-height: 22px; }
.swatch { flex: none; }
.band-swatch { width: 14px; height: 10px; background: #d9b977; opacity: .55; flex: none; }
.trace-figure > svg { display: block; width: 100%; height: 280px; overflow: visible; }
.trace-figure text { fill: var(--b-muted); font: 11px var(--mono, monospace); }
.pulse-band { fill: #d9b977; opacity: .2; }
.grid-line { stroke: var(--b-border); }
.plot-note { font-size: 12px; line-height: 1.8; color: var(--b-muted); margin-top: 8px; }
.metrics-table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 13px; }
.metrics-table caption { text-align: left; font-size: 14px; font-weight: 600; line-height: 1.6; padding-bottom: 8px; }
.metrics-table th, .metrics-table td { padding: 9px 8px; border-top: 1px solid var(--b-border); text-align: right; font-variant-numeric: tabular-nums; }
.metrics-table thead th { text-align: right; font-weight: 600; font-size: 12px; line-height: 1.5; vertical-align: bottom; }
.metrics-table th:first-child { text-align: left; font-weight: 600; }
.facts { margin-top: 18px; padding: 14px 16px; background: var(--b-soft); border-radius: 6px; font-size: 13px; line-height: 1.8; }
.facts ul { margin: 0 0 8px; padding-left: 18px; }
.facts li { margin-bottom: 6px; }
.facts p { color: var(--b-muted); }
@media (max-width: 1050px) { .builder-grid { grid-template-columns: minmax(0, 1fr); } .builder-intro h1 { font-size: 48px; } }
@media (max-width: 760px) {
  .builder-intro { padding: 32px 0 20px; }
  .builder-intro h1 { font-size: 42px; letter-spacing: -1px; }
  .builder-summary { font-size: 15px; }
  .builder-boundary { font-size: 13px; padding: 14px 16px; }
  .builder-card { padding: 18px 14px; }
  .builder-card h2 { font-size: 22px; }
  .metrics-table { font-size: 12px; }
  .metrics-table th, .metrics-table td { padding: 8px 4px; }
  .metrics-table thead th { font-size: 11px; }
  .builder-actions .primary-button, .builder-actions .secondary-button { flex: 1 1 140px; }
}
@media print { .motif-gallery { display: grid; overflow: visible; grid-template-columns: repeat(3, minmax(0, 1fr)); } .motif-scroll-hint { display: none; } }
@media (prefers-reduced-motion: reduce) { .builder-page * { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
</style>
