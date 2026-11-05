<script setup lang="ts">
import { computed, ref } from 'vue'
import { decimal } from '../format'
import { TICK_FRACTIONS, plotX, plotY, tracePath, useChartWidth } from './plotBox'

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
const width = useChartWidth(svg, { initial: 560 })
const height = 240
const pad = { left: 46, right: 18, top: 18, bottom: 44 }
const lastTime = computed(() => props.times.at(-1) ?? 1)
const plotWidth = computed(() => width.value - pad.left - pad.right)
const x = (time: number) => plotX(time, lastTime.value, width.value, pad)
const y = (value: number) => plotY(value, 1, height, pad)
const paths = computed(() => props.traces.map(trace => ({ ...trace, path: tracePath(trace.values, props.times, x, y) })))
</script>

<template>
  <figure class="lesson-plot">
    <figcaption>{{ title }}</figcaption>
    <div class="plot-legend" role="group" aria-label="Grafik çizgileri">
      <span v-for="trace in traces" :key="trace.id"><i :style="{ borderColor: trace.color, borderStyle: trace.dashed ? 'dashed' : 'solid' }"></i>{{ trace.label }}</span>
    </div>
    <svg ref="svg" :viewBox="`0 0 ${width} ${height}`" role="img" :aria-label="`${title}. Dikey eksen ${yLabel}, 0 ile 1 arasında. Yatay eksen öğretici zaman; biyolojik zaman birimi değildir.`">
      <g v-for="tick in TICK_FRACTIONS" :key="tick">
        <line :x1="pad.left" :x2="width - pad.right" :y1="y(tick)" :y2="y(tick)" stroke="var(--theme-border, #dce1d3)" :stroke-dasharray="tick ? '3 5' : undefined" />
        <text :x="pad.left - 9" :y="y(tick) + 3" text-anchor="end">{{ decimal(tick, 2) }}</text>
      </g>
      <g v-for="fraction in TICK_FRACTIONS" :key="fraction">
        <text :x="x(lastTime * fraction)" :y="height - pad.bottom + 18" text-anchor="middle">{{ decimal(lastTime * fraction, 2) }}</text>
      </g>
      <text :x="pad.left" y="11" class="axis-name">{{ yLabel }}</text>
      <text :x="pad.left + plotWidth / 2" :y="height - 5" text-anchor="middle" class="axis-name">Öğretici zaman · boyutsuz</text>
      <line v-if="markerTime !== undefined" :x1="x(markerTime)" :x2="x(markerTime)" :y1="pad.top" :y2="height - pad.bottom" stroke="var(--theme-muted, #7a7864)" stroke-dasharray="2 4" />
      <path v-for="trace in paths" :key="trace.id" :d="trace.path" fill="none" :stroke="trace.color" stroke-width="2.8" :stroke-dasharray="trace.dashed ? '7 5' : undefined" stroke-linejoin="round" />
    </svg>
  </figure>
</template>

<style scoped>
.lesson-plot{margin:22px 0 0;min-width:0}.lesson-plot figcaption{font-size:13px;font-weight:600;line-height:1.6;margin-bottom:10px}.plot-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;line-height:1.8;margin-bottom:8px}.plot-legend span{display:flex;align-items:center;gap:7px}.plot-legend i{width:22px;border-top-width:3px}.lesson-plot svg{display:block;width:100%;height:240px;overflow:visible}.lesson-plot text{fill:var(--theme-muted, #59695f);font:10px var(--mono,monospace)}.lesson-plot .axis-name{font-family:inherit;font-size:10px}
</style>
