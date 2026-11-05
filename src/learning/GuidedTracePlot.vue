<script setup lang="ts">
import { computed, ref } from 'vue'
import { decimal } from '../format'
import { TICK_FRACTIONS, bandWidth, plotX, plotY, tracePath, useChartWidth } from './plotBox'

const props = defineProps<{
  timesMs: readonly number[]
  baseline: readonly number[]
  changed: readonly number[]
  baselineLabel: string
  changedLabel: string
  onsetMs: number
  stimulusDurationMs: number
}>()
const chart = ref<SVGSVGElement | null>(null)
const width = useChartWidth(chart, { initial: 600 })
const height = 250
const pad = { left: 46, right: 18, top: 23, bottom: 44 }
const maxTime = computed(() => props.timesMs.at(-1) ?? 1)
const x = (time: number) => plotX(time, maxTime.value, width.value, pad)
const y = (value: number) => plotY(value, 1, height, pad)
const baselinePath = computed(() => tracePath(props.baseline, props.timesMs, x, y))
const changedPath = computed(() => tracePath(props.changed, props.timesMs, x, y))
</script>

<template>
  <figure class="guided-trace-figure">
    <figcaption>O1’in zaman içindeki model aktivitesi</figcaption>
    <div class="guided-trace-legend"><span><i></i>{{ baselineLabel }}</span><span><i class="changed-line"></i>{{ changedLabel }}</span><span><b></b>Uyaran açık</span></div>
    <svg ref="chart" data-testid="guided-result-plot" role="img" :aria-label="`O1 için iki koşulun boyutsuz aktivite grafiği. ${baselineLabel} düz çizgi; ${changedLabel} kesikli çizgi. Ortak dikey eksen 0 ile 1. Yatay eksen model zamanı, milisaniye.`" :viewBox="`0 0 ${width} ${height}`">
      <rect :x="x(onsetMs)" :y="pad.top" :width="bandWidth(x, onsetMs, stimulusDurationMs, maxTime)" :height="height - pad.top - pad.bottom" fill="#d9b977" opacity=".17" />
      <g v-for="tick in TICK_FRACTIONS" :key="tick"><line :x1="pad.left" :x2="width - pad.right" :y1="y(tick)" :y2="y(tick)" stroke="var(--theme-border, #dce2d3)" :stroke-dasharray="tick ? '3 5' : undefined" /><text :x="pad.left - 8" :y="y(tick) + 3" text-anchor="end">{{ decimal(tick, 2) }}</text></g>
      <text :x="pad.left" y="12">Boyutsuz model aktivitesi</text>
      <g v-for="fraction in TICK_FRACTIONS" :key="fraction"><text :x="x(maxTime * fraction)" :y="height - pad.bottom + 17" text-anchor="middle">{{ Math.round(maxTime * fraction) }}</text></g>
      <text :x="pad.left + (width - pad.left - pad.right) / 2" :y="height - 5" text-anchor="middle">Model zamanı · ms</text>
      <path data-guided-trace="baseline" :d="baselinePath" fill="none" stroke="var(--theme-trace-neutral, #7b806d)" stroke-width="3" stroke-linejoin="round" />
      <path data-guided-trace="comparison" :d="changedPath" fill="none" stroke="var(--theme-trace-green, #3a7652)" stroke-width="3" stroke-dasharray="8 5" stroke-linejoin="round" />
    </svg>
    <p>İki eğri aynı ölçekle gösterilir. Tepe değerleri, tepe zamanları ve son değerler aşağıdaki tablodadır.</p>
  </figure>
</template>

<style scoped>
.guided-trace-figure{margin:25px 0 0;min-width:0}.guided-trace-figure figcaption{font-size:14px;line-height:1.8;font-weight:500;margin-bottom:12px}.guided-trace-legend{display:flex;flex-wrap:wrap;gap:12px 19px;font-size:11px;line-height:1.8;margin-bottom:11px}.guided-trace-legend>span{display:flex;align-items:center;gap:7px}.guided-trace-legend i{width:23px;border-top:3px solid var(--theme-trace-neutral, #7b806d)}.guided-trace-legend i.changed-line{border-color:var(--theme-trace-green, #3a7652);border-style:dashed}.guided-trace-legend b{width:13px;height:10px;background:var(--theme-warning-bg, #e7d7ad)}.guided-trace-figure svg{display:block;width:100%;height:250px;overflow:visible}.guided-trace-figure text{fill:var(--theme-muted, #5a6a5f);font:10px var(--mono,monospace)}.guided-trace-figure>p{font-size:11px;line-height:1.9;color:var(--theme-muted, #5e6a56);margin-top:8px}
</style>
