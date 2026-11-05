<script setup lang="ts">
import { computed, useId } from 'vue'
import { decimal } from '../format'
import { sampleRows, type TableSeries } from '../chartTableRows'

interface Column extends TableSeries { label: string; short: string }
// The same `times` and `traces` the activation chart plots, and the same peaks the peak row shows.
const props = withDefaults(defineProps<{
  times: number[]
  traces: Column[]
  peaks: Record<string, number>
  /** Id of the observed cell, for the caption. */
  output: string
  everyMs?: number
}>(), { everyMs: 10 })

const captionId = useId()
const noteId = useId()
const rows = computed(() => sampleRows(props.times, props.traces, props.everyMs))
const cell = (value: number | null) => value === null ? '—' : decimal(value, 3)
</script>

<template>
  <details class="chart-table">
    <summary><span>Grafiğin veri tablosu</span><small>{{ rows.length }} satır · her {{ everyMs }} ms</small></summary>
    <p :id="noteId" class="chart-table-note">Grafikle aynı hesaplanmış değerler; ayarlar değişince birlikte güncellenir. Satırlar, kayıtlı {{ times.length }} örnekten her {{ everyMs }} ms'deki {{ rows.length }} tanesidir; aradaki örnekler tabloda yok. Tepe satırı ise tablodaki satırlardan değil, kayıtlı örneklerin hepsinden alınır. Değerler 0–1 arasında boyutsuz model etkinliğidir, ölçülmüş bir yanıt değildir.</p>
    <div class="chart-table-scroll" role="region" tabindex="0" :aria-labelledby="captionId">
      <table :aria-describedby="noteId">
        <caption :id="captionId">{{ output }} hücresinin model etkinliği · üç koşul</caption>
        <thead><tr><th scope="col">Zaman (ms)</th><th v-for="trace in traces" :key="trace.id" scope="col">{{ trace.short }} · {{ trace.label }}</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.timeMs"><th scope="row">{{ decimal(row.timeMs, 0) }}</th><td v-for="(value, index) in row.values" :key="traces[index]!.id">{{ cell(value) }}</td></tr>
        </tbody>
        <tfoot><tr><th scope="row">Tepe etkinlik</th><td v-for="trace in traces" :key="trace.id">{{ cell(peaks[trace.id] ?? null) }}</td></tr></tfoot>
      </table>
    </div>
  </details>
</template>

<style scoped>
.chart-table { border-top: 1px solid var(--line); margin-top: 20px; }
.chart-table summary { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px 16px; min-height: 44px; cursor: pointer; font-size: 12px; color: var(--theme-text, #263b35); }
.chart-table summary::before { content: '▸'; flex: none; width: 16px; }
.chart-table[open] > summary::before { content: '▾'; }
.chart-table summary > span { flex: 1; min-width: 0; }
.chart-table summary small { font-family: var(--mono); font-size: 10px; color: var(--muted); }
.chart-table-note { font-size: 10px; line-height: 1.8; color: var(--muted); margin: 4px 0 12px; }
.chart-table-scroll { max-height: 340px; overflow: auto; border: 1px solid var(--line); border-radius: 5px; background: var(--theme-surface, #fafbf5); }
.chart-table-scroll:focus-visible { outline: 3px solid var(--theme-focus, #b78231); outline-offset: 3px; }
table { width: 100%; min-width: 480px; margin: 0; border-collapse: separate; border-spacing: 0; font-size: 11px; font-family: var(--mono); }
caption { padding: 10px 12px; text-align: left; font-family: var(--serif); font-size: 12px; color: var(--theme-text, #263b35); }
th, td { padding: 7px 12px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); line-height: 1.5; color: var(--theme-text, #263b35); }
td:last-child { color: var(--theme-text, #263b35); }
thead th { position: sticky; top: 0; background: var(--theme-surface-soft, #eef1e7); white-space: normal; font-weight: 500; color: var(--theme-text, #263b35); }
tbody th, tfoot th { font-weight: 400; }
thead th:first-child, tbody th, tfoot th { text-align: left; }
tfoot th, tfoot td { position: sticky; bottom: 0; background: var(--theme-surface-soft, #eef1e7); font-weight: 500; border-top: 1px solid var(--line); border-bottom: 0; }
tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
</style>
