<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  timesMs: readonly number[]
  baseline: readonly number[]
  comparison: readonly number[]
  baselineLabel: string
  comparisonLabel: string
  yMax: number
  responseScale: boolean
  onsetMs: number
  stimulusDurationMs: number
}>()
const chart = ref<SVGSVGElement | null>(null)
const width = ref(600)
const height = 250
const pad = { top: 23, bottom: 44, left: 58, right: 18 }
let observer: ResizeObserver | undefined
const maxTime = computed(() => props.timesMs.at(-1) ?? 1)
const axisMax = computed(() => props.yMax > 0 && Number.isFinite(props.yMax) ? props.yMax : 1)
const x = (time: number) => pad.left + time / (maxTime.value || 1) * (width.value - pad.left - pad.right)
const y = (value: number) => pad.top + (1 - value / axisMax.value) * (height - pad.top - pad.bottom)
const path = (values: readonly number[]) => values.map((value, index) => `${index ? 'L' : 'M'}${x(props.timesMs[index] ?? 0).toFixed(2)},${y(value).toFixed(2)}`).join(' ')
const baselinePath = computed(() => path(props.baseline))
const comparisonPath = computed(() => path(props.comparison))
const decimals = computed(() => axisMax.value < .1 ? 4 : axisMax.value < 1 ? 3 : 2)
onMounted(() => {
  const measure = () => { if (chart.value) width.value = Math.max(280, Math.round(chart.value.clientWidth)) }
  measure()
  if (typeof ResizeObserver !== 'undefined' && chart.value) {
    observer = new ResizeObserver(measure)
    observer.observe(chart.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <figure class="assumption-trace">
    <figcaption>AVAR’ın iki hesaplanan yanıtı</figcaption>
    <div class="assumption-trace-legend"><span><i></i>{{ baselineLabel }}</span><span><i class="comparison-line"></i>{{ comparisonLabel }}</span><span><b></b>AVER darbesi açık</span></div>
    <svg ref="chart" data-testid="assumptions-result-plot" :data-y-max="axisMax" :data-scale-mode="responseScale ? 'response' : 'unit'" role="img" :aria-label="`AVAR’ın iki koşuldaki boyutsuz model aktivitesi. Ortak dikey eksen 0–${axisMax.toFixed(5)}; yatay eksen model zamanı, milisaniye. Temel koşul düz, değişiklik kesikli çizgi.`" :viewBox="`0 0 ${width} ${height}`">
      <rect data-testid="assumptions-pulse-band" :x="x(onsetMs)" :y="pad.top" :width="Math.max(0, x(Math.min(maxTime, onsetMs + stimulusDurationMs)) - x(onsetMs))" :height="height - pad.top - pad.bottom" fill="#d9b977" opacity=".17" />
      <g v-for="fraction in [0, .25, .5, .75, 1]" :key="fraction"><line :x1="pad.left" :x2="width - pad.right" :y1="y(axisMax * fraction)" :y2="y(axisMax * fraction)" stroke="var(--theme-border, #dce2d3)" :stroke-dasharray="fraction ? '3 5' : undefined" /><text data-axis="y" :data-value="axisMax * fraction" :x="pad.left - 8" :y="y(axisMax * fraction) + 3" text-anchor="end">{{ (axisMax * fraction).toFixed(decimals) }}</text></g>
      <text :x="pad.left" y="12">Boyutsuz AVAR aktivitesi</text>
      <g v-for="fraction in [0, .25, .5, .75, 1]" :key="fraction"><text data-axis="x" :data-value="maxTime * fraction" :x="x(maxTime * fraction)" :y="height - pad.bottom + 17" text-anchor="middle">{{ Math.round(maxTime * fraction) }}</text></g>
      <text :x="pad.left + (width - pad.left - pad.right) / 2" :y="height - 5" text-anchor="middle">Model zamanı · ms</text>
      <path data-assumption-trace="baseline" :d="baselinePath" fill="none" stroke="var(--theme-trace-neutral, #7b806d)" stroke-width="3" stroke-linejoin="round" />
      <path data-assumption-trace="comparison" :d="comparisonPath" fill="none" stroke="var(--theme-trace-green, #3a7652)" stroke-width="3" stroke-dasharray="8 5" stroke-linejoin="round" />
    </svg>
    <p>Çizgiler aynı dikey ölçeği kullanır; aktivite değerleri ayrı ayrı 1’e normalleştirilmez. Ölçeği değiştirmek hesaplanan değerleri değiştirmez.</p>
  </figure>
</template>

<style scoped>
.assumption-trace{margin:23px 0 0;min-width:0}.assumption-trace figcaption{font-size:14px;line-height:1.8;font-weight:500;margin-bottom:12px}.assumption-trace-legend{display:flex;flex-wrap:wrap;gap:12px 18px;font-size:11px;line-height:1.8;margin-bottom:11px}.assumption-trace-legend>span{display:flex;gap:7px;align-items:center}.assumption-trace-legend i{width:23px;border-top:3px solid var(--theme-trace-neutral, #7b806d);flex:none}.assumption-trace-legend i.comparison-line{border-style:dashed;border-color:var(--theme-trace-green, #3a7652)}.assumption-trace-legend b{width:13px;height:10px;background:var(--theme-warning-bg, #e7d7ad);flex:none}.assumption-trace svg{display:block;width:100%;height:250px;overflow:visible}.assumption-trace text{fill:var(--theme-muted, #5a6a5f);font:10px var(--mono,monospace)}.assumption-trace>p{font-size:11px;line-height:1.9;color:var(--theme-muted, #5e6a56);margin-top:8px}
</style>
