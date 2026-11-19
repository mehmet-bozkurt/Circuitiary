<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { decimal } from '../format'
import { TICK_FRACTIONS, bandWidth, plotX, plotY, tracePath, useChartWidth } from '../learning/plotBox'
import { useMessages } from '../i18n'
import { messages } from './ActivationChart.messages'

const m = useMessages(messages)

/** `times` and `dash` are set only for a curve recorded apart from the three conditions (the pinned curve). */
interface Trace { id: string; label: string; color: string; values: number[]; times?: readonly number[]; dash?: string }
const props = withDefaults(defineProps<{
  times: number[]
  traces: Trace[]
  cursorMs: number
  stimulus: { onsetMs: number; durationMs: number }
  /** Shared upper bound in the original dimensionless units, never per trace. */
  yMax?: number
  /**
   * The input I(t) of the stimulated cell at `times`, drawn as a thin line on the same axis. Passed only
   * when it is not the plain pulse; the yellow band alone shows that one.
   */
  input?: readonly number[] | null
}>(), { yMax: 1, input: null })
const emit = defineEmits<{ seek: [time: number] }>()
const chart = ref<SVGSVGElement>()
const width = useChartWidth(chart, { initial: 720, min: 300, read: element => element.getBoundingClientRect().width })
const height = 240
const pad = { top: 23, right: 18, bottom: 38, left: 46 }

const maxTime = computed(() => props.times[props.times.length - 1] || 1)
const axisMax = computed(() => Number.isFinite(props.yMax) && props.yMax > 0 ? props.yMax : 1)
const tickDecimals = computed(() => axisMax.value < 1 ? 3 : 2)
const x = (time: number) => plotX(time, maxTime.value, width.value, pad)
const y = (value: number) => plotY(value, axisMax.value, height, pad)
const tickTimes = computed(() => TICK_FRACTIONS.map(fraction => fraction * maxTime.value))
const tickValues = computed(() => TICK_FRACTIONS.map(fraction => fraction * axisMax.value))
const paths = computed(() => props.traces.map(trace => ({ ...trace, path: tracePath(trace.values, trace.times ?? props.times, x, y) })))
const hasPinned = computed(() => props.traces.some(trace => trace.id === 'pinned'))
const clipId = `input-clip-${useId()}`
/**
 * The input as polyline points. Samples inside a run of equal values add nothing to the line and are
 * left out (the input is zero outside the stimulus window). Values are in the axis' own units and are
 * not rescaled: what lies above the axis or below zero is cut off at the plot edge by the clip path.
 */
const inputPoints = computed(() => {
  const values = props.input
  if (!values || values.length === 0) return null
  const points: string[] = []
  values.forEach((value, index) => {
    if (index > 0 && index < values.length - 1 && values[index - 1] === value && values[index + 1] === value) return
    points.push(`${x(props.times[index] ?? 0).toFixed(2)},${y(value).toFixed(2)}`)
  })
  return points.join(' ')
})

function seek(event: MouseEvent) {
  const rect = event.currentTarget instanceof SVGElement ? event.currentTarget.getBoundingClientRect() : null
  if (!rect || rect.width <= 0) return
  const localX = (event.clientX - rect.left) / rect.width * width.value
  emit('seek', Math.max(0, Math.min(maxTime.value, (localX - pad.left) / (width.value - pad.left - pad.right) * maxTime.value)))
}
</script>

<template>
  <svg ref="chart" class="activation-chart" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="m.chartLabel(decimal(axisMax, tickDecimals)) + (hasPinned ? ` ${m.pinnedNote}` : '') + (inputPoints ? ` ${m.inputNote}` : '')" @click="seek">
    <rect :x="x(stimulus.onsetMs)" :y="pad.top" :width="bandWidth(x, stimulus.onsetMs, stimulus.durationMs, maxTime)" :height="height - pad.top - pad.bottom" fill="#d9b977" opacity="0.13" />
    <g v-for="tick in tickValues" :key="tick">
      <line :x1="pad.left" :x2="width - pad.right" :y1="y(tick)" :y2="y(tick)" stroke="var(--theme-border, #e1e4db)" />
      <text :x="pad.left - 10" :y="y(tick) + 4" text-anchor="end" class="chart-tick">{{ decimal(tick, tickDecimals) }}</text>
    </g>
    <g v-for="tick in tickTimes" :key="tick">
      <text :x="x(tick)" :y="height - 15" text-anchor="middle" class="chart-tick">{{ Math.round(tick) }}</text>
    </g>
    <g v-if="inputPoints" data-testid="input-waveform">
      <!-- One unit taller than the plot on each side, so a line lying exactly on 0 or on the axis maximum keeps its full width. -->
      <clipPath :id="clipId"><rect :x="pad.left" :y="pad.top - 1" :width="width - pad.left - pad.right" :height="height - pad.top - pad.bottom + 2" /></clipPath>
      <polyline :points="inputPoints" :clip-path="`url(#${clipId})`" fill="none" stroke="var(--theme-trace-gold, #8c6417)" stroke-width="1.2" stroke-linejoin="round" />
    </g>
    <path v-for="trace in paths" :key="trace.id" :d="trace.path" fill="none" :stroke="trace.color" stroke-width="2.7" :stroke-dasharray="trace.dash ?? (trace.id === 'tau' ? '8 5' : trace.id === 'silenced' ? '2 5' : undefined)" />
    <line :x1="x(cursorMs)" :x2="x(cursorMs)" :y1="pad.top" :y2="height - pad.bottom" stroke="var(--theme-muted, #253a34)" stroke-dasharray="3 4" opacity="0.5" />
    <text :x="pad.left" y="12" class="chart-tick">{{ m.yAxis }}</text>
    <text :x="width - pad.right" :y="height - 1" text-anchor="end" class="chart-tick">{{ m.xAxis }}</text>
  </svg>
</template>

<style scoped>
.activation-chart { height: 240px; }
.chart-tick { font-size: 10px; }
</style>
