<script setup lang="ts">
import { computed, ref } from 'vue'
import { decimal } from '../format'
import { TICK_FRACTIONS, plotX, plotY, tracePath, useChartWidth } from './plotBox'
import type { CompletedPoint, SweepPoint } from './thresholdSweep'

const props = defineProps<{ points: readonly SweepPoint[]; thresholdGain: number }>()
const chart = ref<SVGSVGElement | null>(null)
const width = useChartWidth(chart, { initial: 600 })
const height = 270
const pad = { top: 26, bottom: 48, left: 58, right: 18 }
const marker = 4.5

const gains = computed(() => props.points.map(point => point.gain))
const xMin = computed(() => Math.min(...gains.value))
const xSpan = computed(() => Math.max(...gains.value) - xMin.value)
const x = (gain: number) => plotX(gain - xMin.value, xSpan.value, width.value, pad)
// Activity is bounded by 1, so one fixed 0–1 axis shows both series without zooming a small response.
const y = (value: number) => plotY(value, 1, height, pad)
const completed = computed(() => props.points.filter((point): point is CompletedPoint => point.ok))
const failed = computed(() => props.points.filter(point => !point.ok))
/** Consecutive completed multipliers form one line; a failed multiplier breaks it instead of being bridged. */
const segments = computed(() => {
  const runs: CompletedPoint[][] = []
  let open = false
  for (const point of props.points) {
    if (!point.ok) { open = false; continue }
    if (open) runs.at(-1)!.push(point)
    else { runs.push([point]); open = true }
  }
  return runs
})
const path = (segment: CompletedPoint[], key: 'peak' | 'endValue') => tracePath(segment.map(point => point[key]), segment.map(point => point.gain), x, y)
/** Tick labels every 0,2 between the first and last multiplier. */
const ticks = computed(() => {
  const first = Math.ceil(xMin.value * 5 - 1e-9)
  const last = Math.floor((xMin.value + xSpan.value) * 5 + 1e-9)
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => (first + index) / 5)
})
const thresholdInside = computed(() => props.thresholdGain >= xMin.value && props.thresholdGain <= xMin.value + xSpan.value)
const rightEdge = computed(() => width.value - pad.right)
const label = computed(() => `Kimyasal model çarpanına göre AVAR’ın tepe ve kayıt sonu aktivitesi. Yatay eksen çarpan, ${decimal(xMin.value, 1)}–${decimal(xMin.value + xSpan.value, 1)}; dikey eksen boyutsuz aktivite, 0–1. Eşik ${decimal(props.thresholdGain, 1)} çarpanında işaretli. Ayrıntılı sayılar aşağıdaki tabloda.`)
</script>

<template>
  <figure class="sweep-plot">
    <figcaption>AVAR’ın tepe ve kayıt sonu aktivitesi · çarpana göre</figcaption>
    <div class="sweep-legend"><span><i class="peak-key"></i>Kayıt içindeki tepe</span><span><i class="end-key"></i>Son örnekte aktivite (700 model ms)</span><span><b></b>Eşiğin üstü</span><span v-if="failed.length"><u aria-hidden="true">×</u>Hesaplanamadı</span></div>
    <svg ref="chart" data-testid="sweep-plot" :data-point-count="completed.length" :data-threshold-x="x(thresholdGain)" role="img" :aria-label="label" :viewBox="`0 0 ${width} ${height}`">
      <rect v-if="thresholdInside" data-testid="sweep-above-band" :x="x(thresholdGain)" :y="pad.top" :width="Math.max(0, rightEdge - x(thresholdGain))" :height="height - pad.top - pad.bottom" fill="var(--theme-warning-bg, #e7d7ad)" opacity=".5" />
      <g v-for="fraction in TICK_FRACTIONS" :key="fraction"><line :x1="pad.left" :x2="rightEdge" :y1="y(fraction)" :y2="y(fraction)" stroke="var(--theme-border, #dce2d3)" :stroke-dasharray="fraction ? '3 5' : undefined" /><text data-axis="y" :data-value="fraction" :x="pad.left - 8" :y="y(fraction) + 3" text-anchor="end">{{ decimal(fraction, 2) }}</text></g>
      <text :x="pad.left" y="12">Boyutsuz AVAR aktivitesi</text>
      <g v-for="tick in ticks" :key="tick"><line :x1="x(tick)" :x2="x(tick)" :y1="y(0)" :y2="y(0) + 4" stroke="var(--theme-muted, #5a6a5f)" /><text data-axis="x" :data-value="tick" :x="x(tick)" :y="height - pad.bottom + 18" text-anchor="middle">{{ decimal(tick, 1) }}</text></g>
      <text :x="pad.left + (rightEdge - pad.left) / 2" :y="height - 6" text-anchor="middle">Kimyasal model çarpanı · boyutsuz</text>
      <g v-if="thresholdInside"><line data-testid="sweep-threshold-line" :x1="x(thresholdGain)" :x2="x(thresholdGain)" :y1="pad.top" :y2="y(0)" stroke="var(--theme-warning, #7a5a30)" stroke-width="2" stroke-dasharray="5 4" /><text data-testid="sweep-threshold-label" :x="x(thresholdGain) - 6" :y="pad.top + 11" text-anchor="end" class="threshold-label">eşik: {{ decimal(thresholdGain, 1) }}</text></g>
      <g v-for="(segment, index) in segments" :key="index">
        <path data-sweep-series="end" :d="path(segment, 'endValue')" fill="none" stroke="var(--theme-trace-green, #35694f)" stroke-width="2.5" stroke-dasharray="7 4" stroke-linejoin="round" />
        <path data-sweep-series="peak" :d="path(segment, 'peak')" fill="none" stroke="var(--theme-trace-blue, #456e91)" stroke-width="2.5" stroke-linejoin="round" />
      </g>
      <rect v-for="point in completed" :key="`end-${point.gain}`" data-sweep-marker="end" :data-gain="point.gain" :data-value="point.endValue" :x="x(point.gain) - marker" :y="y(point.endValue) - marker" :width="marker * 2" :height="marker * 2" fill="var(--theme-surface, #fafbf4)" stroke="var(--theme-trace-green, #35694f)" stroke-width="2" />
      <circle v-for="point in completed" :key="`peak-${point.gain}`" data-sweep-marker="peak" :data-gain="point.gain" :data-value="point.peak" :cx="x(point.gain)" :cy="y(point.peak)" :r="marker - 1" fill="var(--theme-trace-blue, #456e91)" />
      <path v-for="point in failed" :key="`failed-${point.gain}`" data-sweep-marker="failed" :data-gain="point.gain" :d="`M${x(point.gain) - 5},${y(0) - 10} l10,10 m-10,0 l10,-10`" fill="none" stroke="var(--theme-danger, #92574b)" stroke-width="2.5" />
    </svg>
    <p>Noktalar hesaplanan çarpanlardır. Aralarındaki çizgiler yalnız gözü yönlendirir; hesaplanmamış değerleri göstermez. Dikey eksen sabit 0–1 aralığıdır.</p>
  </figure>
</template>

<style scoped>
.sweep-plot{margin:23px 0 0;min-width:0}.sweep-plot figcaption{font-size:14px;line-height:1.8;font-weight:500;margin-bottom:12px}.sweep-legend{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:11px;line-height:1.8;margin-bottom:11px}.sweep-legend>span{display:flex;gap:7px;align-items:center}.sweep-legend i{width:23px;height:11px;flex:none;border-top:3px solid var(--theme-trace-blue, #456e91);position:relative}.sweep-legend i::after{content:"";position:absolute;left:7px;top:-8px;width:9px;height:9px;border-radius:50%;background:var(--theme-trace-blue, #456e91)}.sweep-legend i.end-key{border-top-style:dashed;border-top-color:var(--theme-trace-green, #35694f)}.sweep-legend i.end-key::after{border-radius:1px;background:var(--theme-surface, #fafbf4);border:2px solid var(--theme-trace-green, #35694f);width:10px;height:10px;top:-9px;left:6px}.sweep-legend b{width:13px;height:10px;background:var(--theme-warning-bg, #e7d7ad);flex:none}.sweep-legend u{text-decoration:none;font-weight:700;color:var(--theme-danger, #92574b);width:13px;text-align:center;flex:none}.sweep-plot svg{display:block;width:100%;height:270px;overflow:visible}.sweep-plot text{fill:var(--theme-muted, #5a6a5f);font:10px var(--mono,monospace)}.sweep-plot text.threshold-label{fill:var(--theme-warning, #7a5a30)}.sweep-plot>p{font-size:11px;line-height:1.9;color:var(--theme-muted, #5e6a56);margin-top:8px}
</style>
