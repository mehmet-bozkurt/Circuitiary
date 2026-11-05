<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { decimal } from '../format'

export interface LessonTrace {
  id: string
  label: string
  color: string
  values: number[]
  dashed?: boolean
}

const props = withDefaults(defineProps<{
  times: number[]
  traces: LessonTrace[]
  title: string
  yLabel?: string
  markerTime?: number
}>(), { yLabel: 'Göreli düzey' })
const svg = ref<SVGSVGElement | null>(null)
const width = ref(560)
const height = 240
const left = 46
const top = 18
const bottom = 44
const right = 18
let observer: ResizeObserver | undefined
const lastTime = computed(() => props.times.at(-1) ?? 1)
const plotWidth = computed(() => width.value - left - right)
const plotHeight = height - top - bottom
const x = (time: number) => left + time / (lastTime.value || 1) * plotWidth.value
const y = (value: number) => top + (1 - value) * plotHeight
const ticks = [0, .25, .5, .75, 1]
const paths = computed(() => props.traces.map(trace => ({ ...trace, path: trace.values.map((value, index) => `${index ? 'L' : 'M'}${x(props.times[index] ?? 0).toFixed(2)},${y(value).toFixed(2)}`).join(' ') })))
onMounted(() => {
  const measure = () => { if (svg.value) width.value = Math.max(280, Math.round(svg.value.clientWidth)) }
  measure()
  if (typeof ResizeObserver !== 'undefined' && svg.value) {
    observer = new ResizeObserver(measure)
    observer.observe(svg.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <figure class="lesson-plot">
    <figcaption>{{ title }}</figcaption>
    <div class="plot-legend" aria-label="Grafik çizgileri">
      <span v-for="trace in traces" :key="trace.id"><i :style="{ borderColor: trace.color, borderStyle: trace.dashed ? 'dashed' : 'solid' }"></i>{{ trace.label }}</span>
    </div>
    <svg ref="svg" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="`${title}. Dikey eksen ${yLabel}, 0 ile 1 arasında. Yatay eksen öğretici zaman; biyolojik zaman birimi değildir.`">
      <g v-for="tick in ticks" :key="tick">
        <line :x1="left" :x2="width - right" :y1="y(tick)" :y2="y(tick)" stroke="var(--theme-border, #dce1d3)" :stroke-dasharray="tick ? '3 5' : undefined" />
        <text :x="left - 9" :y="y(tick) + 3" text-anchor="end">{{ decimal(tick, 2) }}</text>
      </g>
      <g v-for="fraction in [0, .25, .5, .75, 1]" :key="fraction">
        <text :x="x(lastTime * fraction)" :y="height - bottom + 18" text-anchor="middle">{{ decimal(lastTime * fraction, 2) }}</text>
      </g>
      <text :x="left" y="11" class="axis-name">{{ yLabel }}</text>
      <text :x="left + plotWidth / 2" :y="height - 5" text-anchor="middle" class="axis-name">Öğretici zaman · boyutsuz</text>
      <line v-if="markerTime !== undefined" :x1="x(markerTime)" :x2="x(markerTime)" :y1="top" :y2="height - bottom" stroke="var(--theme-muted, #7a7864)" stroke-dasharray="2 4" />
      <path v-for="trace in paths" :key="trace.id" :d="trace.path" fill="none" :stroke="trace.color" stroke-width="2.8" :stroke-dasharray="trace.dashed ? '7 5' : undefined" stroke-linejoin="round" />
    </svg>
  </figure>
</template>

<style scoped>
.lesson-plot{margin:22px 0 0;min-width:0}.lesson-plot figcaption{font-size:13px;font-weight:600;line-height:1.6;margin-bottom:10px}.plot-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;line-height:1.8;margin-bottom:8px}.plot-legend span{display:flex;align-items:center;gap:7px}.plot-legend i{width:22px;border-top-width:3px}.lesson-plot svg{display:block;width:100%;height:240px;overflow:visible}.lesson-plot text{fill:var(--theme-muted, #59695f);font:10px var(--mono,monospace)}.lesson-plot .axis-name{font-family:inherit;font-size:10px}
</style>
