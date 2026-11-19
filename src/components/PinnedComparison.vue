<script setup lang="ts">
import { computed, ref } from 'vue'
import { decimal, withComma } from '../format'
import { L, useMessages } from '../i18n'
import { changedSettings, type PinnedCurve } from '../pinnedCurve'
import { shareFields, type ShareField, type ShareState } from '../shareState'
import { resolveProtocol } from '../stimulusProtocol'
import type { StimulusShape } from '../model/types'
import { messages } from './PinnedComparison.messages'

// "Pin and compare": the buttons, the two peaks and the list of settings changed since pinning.
// The curve itself is drawn by the activation chart; this component only describes it.
const props = defineProps<{
  pinned: PinnedCurve | null
  /** The experiment as it is now. */
  settings: ShareState
  /** Peak of the condition shown now, for the observed cell. */
  currentPeak: number
  /** "A · Referans" and so on, in the current language. */
  conditionNames: Record<ShareState['activeCondition'], string>
  /** Readable name of a connection id ("I3 → O1"). */
  edgeName: (id: string) => string
  /** "Darbe", "Rampa", "Sinüs" in the current language. */
  shapeNames: Record<StimulusShape, string>
}>()
const emit = defineEmits<{ pin: []; unpin: [] }>()
const m = useMessages(messages)
// Kept as a function so the announcement follows a later language change.
const status = ref<(() => string) | null>(null)

function pin() {
  const { activeCondition, outputNeuron } = props.settings
  emit('pin')
  status.value = () => m.value.statusPinned(props.conditionNames[activeCondition], outputNeuron)
}
function unpin() {
  emit('unpin')
  status.value = () => m.value.statusRemoved
}

function shown(field: ShareField, state: ShareState): string {
  // A record without the stimulus protocol fields means their defaults.
  const protocol = resolveProtocol(state)
  switch (field) {
    case 'stimulusShape': return props.shapeNames[protocol.stimulusShape]
    case 'sinePeriod': return m.value.ms(String(protocol.sinePeriod))
    case 'noiseAmplitude': return decimal(protocol.noiseAmplitude, 2)
    case 'noiseSeed': return String(protocol.noiseSeed)
    case 'activeCondition': return props.conditionNames[state.activeCondition]
    case 'selectedEdge': return props.edgeName(state.selectedEdge)
    case 'amplitude': case 'chemicalGain': case 'gapGain': return decimal(state[field], 2)
    case 'pulseDuration': case 'baseTau': case 'changedTau': return m.value.ms(String(state[field]))
    case 'dt': return m.value.ms(withComma(String(state.dt)))
    default: return String(state[field])
  }
}
const changes = computed(() => props.pinned
  ? changedSettings(props.pinned.settings, props.settings).map(field => ({
      field,
      text: m.value.change(L(shareFields[field].label, shareFields[field].labelEn), shown(field, props.pinned!.settings), shown(field, props.settings)),
    }))
  : [])
const difference = computed(() => {
  if (!props.pinned) return ''
  const value = props.currentPeak - props.pinned.peak
  return `${value > 0 ? '+' : ''}${decimal(value, 3)}`
})
</script>

<template>
  <section class="pin-compare" aria-labelledby="pin-compare-title">
    <h3 id="pin-compare-title">{{ m.heading }}</h3>
    <p class="pin-intro">{{ m.intro }}</p>
    <div class="pin-buttons">
      <button type="button" data-testid="pin-curve" @click="pin">{{ pinned ? m.replace : m.pin }}</button>
      <button v-if="pinned" type="button" data-testid="unpin-curve" @click="unpin">{{ m.remove }}</button>
    </div>
    <p class="sr-only" role="status" data-testid="pin-status">{{ status?.() }}</p>
    <div v-if="pinned" class="pin-summary" data-testid="pin-summary">
      <dl>
        <div><dt>{{ m.pinnedRow }}</dt><dd data-testid="pin-pinned">{{ m.curve(conditionNames[pinned.condition], pinned.output, decimal(pinned.peak, 3)) }}</dd></div>
        <div><dt>{{ m.currentRow }}</dt><dd data-testid="pin-current">{{ m.curve(conditionNames[settings.activeCondition], settings.outputNeuron, decimal(currentPeak, 3)) }}</dd></div>
        <div><dt>{{ m.differenceRow }}</dt><dd data-testid="pin-difference">{{ difference }}</dd></div>
      </dl>
      <template v-if="changes.length">
        <h4>{{ m.changesHeading }}</h4>
        <ul data-testid="pin-changes"><li v-for="change in changes" :key="change.field" :data-field="change.field">{{ change.text }}</li></ul>
      </template>
      <p v-else data-testid="pin-no-changes">{{ m.noChanges }}</p>
      <p class="pin-note">{{ m.note }}</p>
    </div>
  </section>
</template>

<style scoped>
.pin-compare { border-top: 1px solid var(--line); margin-top: 20px; padding-top: 16px; color: var(--theme-text, #263b35); }
.pin-compare h3 { margin: 0 0 6px; font-family: var(--serif); font-size: 16px; font-weight: 500; }
.pin-compare h4 { margin: 14px 0 6px; font-size: 12px; font-weight: 600; }
.pin-intro, .pin-note { margin: 0; font-size: 11px; line-height: 1.8; color: var(--muted); }
.pin-note { margin-top: 12px; }
.pin-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.pin-buttons button { min-height: 44px; padding: 9px 14px; border: 1px solid var(--theme-border, #d1d9ca); border-radius: 5px; background: var(--theme-surface, #fafbf5); color: var(--theme-text, #263b35); font-size: 12px; }
.pin-buttons button:hover { border-color: var(--theme-text, #263b35); }
.pin-buttons button:focus-visible { outline: 3px solid var(--theme-focus, #b78231); outline-offset: 2px; }
.pin-summary { margin-top: 14px; font-size: 12px; line-height: 1.7; }
.pin-summary dl { margin: 0; display: grid; gap: 6px; }
.pin-summary dl > div { display: grid; grid-template-columns: minmax(0, 15em) minmax(0, 1fr); gap: 2px 14px; }
.pin-summary dt { color: var(--muted); }
.pin-summary dd { margin: 0; font-family: var(--mono); font-size: 11px; overflow-wrap: anywhere; }
.pin-summary ul { margin: 0; padding-left: 18px; font-family: var(--mono); font-size: 11px; }
.pin-summary li { overflow-wrap: anywhere; }
.pin-summary p { margin: 12px 0 0; }
@media (max-width: 560px) { .pin-summary dl > div { grid-template-columns: minmax(0, 1fr); } }
</style>
