<script setup lang="ts">
import { computed, ref } from 'vue'
import { decimal } from '../format'
import { TICK_FRACTIONS, bandWidth, plotX, plotY, tracePath, useChartWidth } from '../learning/plotBox'

interface Trace { id: string; label: string; color: string; values: number[] }
const props = withDefaults(defineProps<{
  times: number[]
  traces: Trace[]
  cursorMs: number
  stimulus: { onsetMs: number; durationMs: number }
  /** Shared upper bound in the original dimensionless units, never per trace. */
  yMax?: number
}>(), { yMax: 1 })
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
const paths = computed(() => props.traces.map(trace => ({ ...trace, path: tracePath(trace.values, props.times, x, y) })))

function seek(event: MouseEvent) {
  const rect = event.currentTarget instanceof SVGElement ? event.currentTarget.getBoundingClientRect() : null
  if (!rect || rect.width <= 0) return
  const localX = (event.clientX - rect.left) / rect.width * width.value
  emit('seek', Math.max(0, Math.min(maxTime.value, (localX - pad.left) / (width.value - pad.left - pad.right) * maxTime.value)))
}
</script>

<template>
  <svg ref="chart" class="activation-chart" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="`Üç koşulun boyutsuz etkinlik değerlerini zamana göre karşılaştıran grafik. Ortak dikey eksen 0–${decimal(axisMax, tickDecimals)}.`" @click="seek">
    <rect :x="x(stimulus.onsetMs)" :y="pad.top" :width="bandWidth(x, stimulus.onsetMs, stimulus.durationMs, maxTime)" :height="height - pad.top - pad.bottom" fill="#d9b977" opacity="0.13" />
    <g v-for="tick in tickValues" :key="tick">
      <line :x1="pad.left" :x2="width - pad.right" :y1="y(tick)" :y2="y(tick)" stroke="var(--theme-border, #e1e4db)" />
      <text :x="pad.left - 10" :y="y(tick) + 4" text-anchor="end" class="chart-tick">{{ decimal(tick, tickDecimals) }}</text>
    </g>
    <g v-for="tick in tickTimes" :key="tick">
      <text :x="x(tick)" :y="height - 15" text-anchor="middle" class="chart-tick">{{ Math.round(tick) }}</text>
    </g>
    <path v-for="trace in paths" :key="trace.id" :d="trace.path" fill="none" :stroke="trace.color" stroke-width="2.7" :stroke-dasharray="trace.id === 'tau' ? '8 5' : trace.id === 'silenced' ? '2 5' : undefined" />
    <line :x1="x(cursorMs)" :x2="x(cursorMs)" :y1="pad.top" :y2="height - pad.bottom" stroke="var(--theme-muted, #253a34)" stroke-dasharray="3 4" opacity="0.5" />
    <text :x="pad.left" y="12" class="chart-tick">boyutsuz etkinlik</text>
    <text :x="width - pad.right" :y="height - 1" text-anchor="end" class="chart-tick">zaman · ms</text>
  </svg>
</template>

<style scoped>
.activation-chart { height: 240px; }
.chart-tick { font-size: 10px; }
</style>
