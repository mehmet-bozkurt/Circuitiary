<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { decimal } from '../format'
import { TICK_FRACTIONS, bandWidth, plotX, plotY, tracePath, useChartWidth } from '../learning/plotBox'
import {
  CELL_IDS, LIMITS, LINK_TYPE_LABELS, REPORT_LEVEL, blankDraft, cellIds, cloneDraft, draftKey, linkLabel, presetById, presets,
  runDraft, strengthLimits, validateDraft,
  type BuilderLink, type BuilderPreset, type BuilderProblem, type BuilderRun, type CellId, type LinkType,
} from '../learning/circuitBuilder'

const emit = defineEmits<{ ready: [] }>()
onMounted(async () => { await nextTick(); emit('ready') })

const draft = reactive(blankDraft())
const linkTypes = Object.keys(LINK_TYPE_LABELS) as LinkType[]
let counter = 0
const newLinkId = () => `n${++counter}`

const status = ref('')
const loadedPreset = ref<BuilderPreset | null>(null)
let loadedKey = ''
const recorded = ref<BuilderRun | null>(null)
const recordedKey = ref('')
const runNumber = ref(0)
const engineProblems = ref<BuilderProblem[]>([])

const cells = computed(() => cellIds(draft.cellCount))
const problems = computed(() => validateDraft(draft))
const invalidLinks = computed(() => new Set(problems.value.map(problem => problem.linkId)))
const stale = computed(() => recorded.value !== null && draftKey(draft) !== recordedKey.value)
const presetEdited = computed(() => loadedPreset.value !== null && draftKey(draft) !== loadedKey)
const canAddLink = computed(() => draft.links.length < LIMITS.links.max)

function replaceDraft(next: typeof draft) {
  draft.cellCount = next.cellCount
  draft.links = next.links
  draft.stimulus = next.stimulus
}

function loadPreset(id: BuilderPreset['id']) {
  const preset = presetById(id)
  replaceDraft(cloneDraft(preset.draft))
  loadedPreset.value = preset
  loadedKey = draftKey(draft)
  recorded.value = null
  engineProblems.value = []
  status.value = `“${preset.title}” örneği yüklendi. İstersen değiştir, sonra çalıştır.`
}

function reset() {
  replaceDraft(blankDraft())
  loadedPreset.value = null
  recorded.value = null
  runNumber.value = 0
  engineProblems.value = []
  status.value = 'Devre sıfırlandı: 3 hücre, bağlantı yok. Önceki sonuç temizlendi.'
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
  status.value = removedCells.length
    ? `${removedCells.join(', ')} çıkarıldı; ona bağlı ${dropped} bağlantı silindi. Hücre sayısı ${count}.`
    : `Hücre sayısı ${count} oldu (${cells.value[0]}–${cells.value.at(-1)}).`
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
  status.value = `Bağlantı ${draft.links.length} eklendi: ${linkLabel(link)}. Kaynağı, hedefi, türü ve gücü seçebilirsin.`
  focusSoon(`link-${link.id}-type`)
}

function removeLink(id: string) {
  const index = draft.links.findIndex(link => link.id === id)
  if (index < 0) return
  const [removed] = draft.links.splice(index, 1)
  status.value = `Bağlantı ${index + 1} kaldırıldı (${linkLabel(removed!)}). ${draft.links.length} bağlantı kaldı.`
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
    status.value = 'Hesap tamamlanamadı.'
    return
  }
  engineProblems.value = []
  recorded.value = outcome.run
  recordedKey.value = draftKey(draft)
  runNumber.value += 1
  status.value = `Hesaplandı (kayıt #${runNumber.value}). ${outcome.run.cells.length} hücrenin eğrisi ve tablosu sonuç bölümünde.`
}

const sliderText = (value: number, digits: number) => decimal(value, digits)
const ms = (value: number | null) => value === null ? '—' : `${decimal(value, 0)} ms`
const fieldLabel = (link: BuilderLink, side: 'source' | 'target') => link.type === 'gap' ? (side === 'source' ? 'Hücre 1' : 'Hücre 2') : (side === 'source' ? 'Kaynak' : 'Hedef')

// Chart: one line per cell on a shared 0-1 axis. Colour, dash pattern and the legend letter together identify a cell.
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
const chartLabel = computed(() => recorded.value
  ? `Her hücrenin boyutsuz model aktivitesi, ${recorded.value.cells.map(cell => cell.id).join(', ')}. Dikey eksen 0 ile 1 arası; yatay eksen model zamanı, milisaniye. Sayılar aşağıdaki tabloda.`
  : '')
</script>

<template>
  <main id="circuit-builder" tabindex="-1" class="builder-page">
    <header class="builder-intro">
      <p class="builder-eyebrow">CIRCUITIARY / ATÖLYE</p>
      <h1 tabindex="-1">Devre kur</h1>
      <p class="builder-summary">2–6 hücrelik küçük bir devre kur, bir hücreyi uyar ve her hücrenin ne yaptığını gör. Hazır bir örnekle başlayabilir ya da boş devreden kendin kurabilirsin.</p>
    </header>

    <div class="builder-boundary" data-testid="builder-boundary">
      <strong>Bu bir oyuncak model.</strong>
      <p>Kurduğun devre gerçek bir devre değildir ve sonuç bir tahmin değildir. A–F yalnızca etikettir; bağlantı güçleri ve hücre zaman sabiti (τ = 30 model ms) senin seçtiğin boyutsuz varsayımlardır. Hesap, projenin sürekli etkinlik modelini kullanır: aktivite 0–1 arasında boyutsuz bir değerdir; voltaj, ateşleme hızı, kalsiyum ya da davranış değildir.</p>
    </div>

    <div class="builder-grid">
      <div class="builder-setup">
        <section aria-labelledby="builder-presets-title" class="builder-card">
          <h2 id="builder-presets-title">Hazır örnekler</h2>
          <p class="builder-help">Her örnek tek bir şey öğretir. Birini yükle, sonra çalıştır; ardından “Dene” önerisini uygula.</p>
          <div class="preset-buttons" role="group" aria-label="Hazır örnekler">
            <button v-for="preset in presets" :key="preset.id" type="button" class="preset-button" :data-preset="preset.id" @click="loadPreset(preset.id)">
              <strong>{{ preset.title }}</strong><span>{{ preset.teaches }}</span>
            </button>
          </div>
          <section v-if="loadedPreset" class="preset-note" aria-labelledby="preset-note-title" data-testid="builder-preset-note" :data-preset="loadedPreset.id">
            <h3 id="preset-note-title">{{ loadedPreset.title }}</h3>
            <p><strong>Ne öğretiyor?</strong> {{ loadedPreset.teaches }}</p>
            <p><strong>Neye bak?</strong> {{ loadedPreset.look }}</p>
            <p><strong>Dene:</strong> {{ loadedPreset.tryThis }}</p>
            <p><strong>Sınır:</strong> {{ loadedPreset.boundary }}</p>
            <p v-if="presetEdited" class="builder-help" data-testid="builder-preset-edited">Bu örneği değiştirdin; açıklama yüklenen örnek içindir.</p>
          </section>
        </section>

        <section aria-labelledby="builder-cells-title" class="builder-card">
          <h2 id="builder-cells-title">1. Hücreler ve uyaran</h2>
          <div class="field-grid">
            <div class="field">
              <label for="builder-cell-count">Hücre sayısı</label>
              <select id="builder-cell-count" :value="draft.cellCount" @change="setCellCount">
                <option v-for="count in LIMITS.cells.max - LIMITS.cells.min + 1" :key="count" :value="count + LIMITS.cells.min - 1">{{ count + LIMITS.cells.min - 1 }} hücre ({{ CELL_IDS[0] }}–{{ CELL_IDS[count + LIMITS.cells.min - 2] }})</option>
              </select>
            </div>
            <div class="field">
              <label for="builder-stim-target">Uyarılan hücre</label>
              <select id="builder-stim-target" v-model="draft.stimulus.target">
                <option v-for="id in cells" :key="id" :value="id">Hücre {{ id }}</option>
              </select>
            </div>
            <div class="field">
              <div class="field-head"><label for="builder-amplitude">Uyaran genliği</label><output for="builder-amplitude" data-testid="builder-amplitude-output">{{ sliderText(draft.stimulus.amplitude, 2) }}</output></div>
              <input id="builder-amplitude" v-model.number="draft.stimulus.amplitude" type="range" :min="LIMITS.amplitude.min" :max="LIMITS.amplitude.max" :step="LIMITS.amplitude.step" :aria-valuetext="sliderText(draft.stimulus.amplitude, 2)" />
            </div>
            <div class="field">
              <div class="field-head"><label for="builder-onset">Başlangıç</label><output for="builder-onset">{{ ms(draft.stimulus.onsetMs) }}</output></div>
              <input id="builder-onset" v-model.number="draft.stimulus.onsetMs" type="range" :min="LIMITS.onsetMs.min" :max="LIMITS.onsetMs.max" :step="LIMITS.onsetMs.step" :aria-valuetext="ms(draft.stimulus.onsetMs)" />
            </div>
            <div class="field">
              <div class="field-head"><label for="builder-pulse">Süre</label><output for="builder-pulse">{{ ms(draft.stimulus.durationMs) }}</output></div>
              <input id="builder-pulse" v-model.number="draft.stimulus.durationMs" type="range" :min="LIMITS.pulseMs.min" :max="LIMITS.pulseMs.max" :step="LIMITS.pulseMs.step" :aria-valuetext="ms(draft.stimulus.durationMs)" />
            </div>
          </div>
          <p class="builder-help">Uyaran, seçilen hücreye başlangıçtan itibaren verilen sabit bir darbedir. Kayıt 700 model ms sürer; zaman ölçeği ölçüme kalibre edilmemiştir.</p>
        </section>

        <section aria-labelledby="builder-links-title" class="builder-card">
          <h2 id="builder-links-title">2. Bağlantılar</h2>
          <p class="builder-help">Kimyasal bağlantının yönü vardır; gücü bir hücrenin diğerine etkisinin boyutsuz model ağırlığıdır. Elektriksel (gap) bağlantı iki hücre arasında tek, simetrik bir bağlantıdır: etki iki yönde de aynı katsayıyla işler.</p>
          <p v-if="!draft.links.length" class="builder-empty" data-testid="builder-no-links">Henüz bağlantı yok. Bu hâlde yalnız uyarılan hücre yanıt verir. Bir örnek yükle ya da “Bağlantı ekle” düğmesine bas.</p>
          <ul v-else class="link-list" aria-label="Bağlantı listesi">
            <li v-for="(link, index) in draft.links" :key="link.id" class="link-row" :class="{ invalid: invalidLinks.has(link.id) }" :data-testid="`builder-link-${index + 1}`" :data-type="link.type">
              <div class="link-head">
                <p class="link-title"><span :id="`link-${link.id}-title`">Bağlantı {{ index + 1 }}</span> <span class="link-sum">{{ linkLabel(link) }}</span><span v-if="invalidLinks.has(link.id)" class="link-flag"> · Sorun var</span></p>
                <button :id="`link-${link.id}-remove`" type="button" class="secondary-button" :aria-label="`Kaldır: bağlantı ${index + 1}, ${linkLabel(link)}`" @click="removeLink(link.id)">Kaldır</button>
              </div>
              <div class="field-grid">
                <div class="field">
                  <label :id="`link-${link.id}-type-label`" :for="`link-${link.id}-type`">Tür</label>
                  <select :id="`link-${link.id}-type`" :value="link.type" :aria-labelledby="`link-${link.id}-title link-${link.id}-type-label`" @change="setType(link, $event)">
                    <option v-for="type in linkTypes" :key="type" :value="type">{{ LINK_TYPE_LABELS[type] }}</option>
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
                  <div class="field-head"><label :id="`link-${link.id}-strength-label`" :for="`link-${link.id}-strength`">Güç</label><output :for="`link-${link.id}-strength`" :data-testid="`builder-link-${index + 1}-strength-output`">{{ sliderText(link.strength, 2) }}</output></div>
                  <input :id="`link-${link.id}-strength`" v-model.number="link.strength" type="range" :min="strengthLimits(link.type).min" :max="strengthLimits(link.type).max" :step="strengthLimits(link.type).step" :aria-labelledby="`link-${link.id}-title link-${link.id}-strength-label`" :aria-valuetext="sliderText(link.strength, 2)" />
                </div>
              </div>
              <p v-if="link.type === 'gap'" class="builder-help">İki yönde aynı etki: bir hücre diğerinin aktivitesine doğru çekilir. Tek kayıt, tek katsayı.</p>
              <p v-else-if="link.type === 'inhibitory'" class="builder-help">Baskılayıcı: hedefe gelen toplam girdiden {{ sliderText(link.strength, 2) }} × kaynak aktivitesi çıkarılır.</p>
            </li>
          </ul>
          <button id="builder-add-link" type="button" class="secondary-button add-button" :disabled="!canAddLink" @click="addLink">Bağlantı ekle</button>
          <p v-if="!canAddLink" class="builder-help">En fazla {{ LIMITS.links.max }} bağlantı ekleyebilirsin.</p>
        </section>

        <section aria-labelledby="builder-run-title" class="builder-card">
          <h2 id="builder-run-title">3. Çalıştır</h2>
          <div id="builder-validity" class="validity" role="status" aria-live="polite" data-testid="builder-validity" :data-valid="problems.length === 0">
            <p v-if="!problems.length">Devre geçerli. Çalıştırabilirsin.</p>
            <template v-else>
              <p>Çalıştır düğmesi şu sorunlar giderilene kadar kapalı:</p>
              <ul><li v-for="(problem, index) in problems" :key="index" :data-code="problem.code">{{ problem.message }}</li></ul>
            </template>
          </div>
          <div class="builder-actions">
            <button type="button" class="primary-button" data-testid="builder-run" :disabled="problems.length > 0" aria-describedby="builder-validity" @click="runCircuit">{{ recorded ? 'Yeniden çalıştır' : 'Çalıştır' }}</button>
            <button type="button" class="secondary-button" data-testid="builder-reset" @click="reset">Sıfırla</button>
          </div>
          <p class="builder-status" role="status" aria-live="polite" data-testid="builder-status">{{ status }}</p>
          <ul v-if="engineProblems.length" class="engine-problems" role="alert"><li v-for="problem in engineProblems" :key="problem.code">{{ problem.message }}</li></ul>
        </section>
      </div>

      <section aria-labelledby="builder-result-title" class="builder-card builder-results" tabindex="0">
        <h2 id="builder-result-title">Sonuç</h2>
        <div ref="plotHost">
        <div v-if="!recorded" class="not-run" data-testid="builder-not-run">
          <p>Sonuç henüz hesaplanmadı.</p>
          <p>Devreyi kurup “Çalıştır” düğmesine bas. Her hücre için bir eğri ve bir tablo satırı görünecek.</p>
        </div>
        <div v-else data-testid="builder-result" :data-run-number="runNumber" :data-stale="stale">
          <p v-if="stale" class="stale-warning" role="status" data-testid="builder-stale">Ayar değişti. Aşağıdaki eğriler ve sayılar önceki çalıştırmaya ait. Yeni devrenin sonucunu görmek için yeniden çalıştır.</p>
          <p class="record-settings" data-testid="builder-run-settings" :data-cells="recorded.draft.cellCount" :data-links="recorded.draft.links.length" :data-target="settings!.target" :data-amplitude="settings!.amplitude" :data-onset="settings!.onsetMs" :data-pulse="settings!.durationMs">
            Kayıt #{{ runNumber }}: {{ recorded.draft.cellCount }} hücre, {{ recorded.draft.links.length }} bağlantı. {{ settings!.target }} hücresine {{ decimal(settings!.amplitude, 2) }} genlikli darbe, {{ decimal(settings!.onsetMs, 0) }}–{{ decimal(settings!.onsetMs + settings!.durationMs, 0) }} model ms.
          </p>
          <figure class="trace-figure">
            <figcaption>Her hücrenin zaman içindeki model aktivitesi</figcaption>
            <ul class="trace-legend" aria-label="Grafik çizgileri">
              <li v-for="path in paths" :key="path.id"><svg class="swatch" width="30" height="10" viewBox="0 0 30 10" aria-hidden="true"><line x1="0" y1="5" x2="30" y2="5" :stroke="path.style.color" stroke-width="3" :stroke-dasharray="path.style.dash" /></svg>{{ path.id }}<template v-if="path.id === settings!.target"> (uyarılan)</template></li>
              <li><span class="band-swatch" aria-hidden="true"></span>Uyaran açık</li>
            </ul>
            <svg data-testid="builder-plot" role="img" :aria-label="chartLabel" :viewBox="`0 0 ${width} ${height}`">
              <rect data-testid="builder-pulse-band" :x="x(settings!.onsetMs)" :y="pad.top" :width="bandWidth(x, settings!.onsetMs, settings!.durationMs, maxTime)" :height="height - pad.top - pad.bottom" class="pulse-band" />
              <g v-for="tick in TICK_FRACTIONS" :key="`y${tick}`"><line :x1="pad.left" :x2="width - pad.right" :y1="y(tick)" :y2="y(tick)" class="grid-line" :stroke-dasharray="tick ? '3 5' : undefined" /><text :x="pad.left - 8" :y="y(tick) + 4" text-anchor="end">{{ decimal(tick, 2) }}</text></g>
              <g v-for="fraction in TICK_FRACTIONS" :key="`x${fraction}`"><text :x="x(maxTime * fraction)" :y="height - pad.bottom + 18" text-anchor="middle">{{ Math.round(maxTime * fraction) }}</text></g>
              <text :x="pad.left" y="12">Boyutsuz model aktivitesi</text>
              <text :x="pad.left + (width - pad.left - pad.right) / 2" :y="height - 6" text-anchor="middle">Model zamanı · ms</text>
              <path v-for="path in paths" :key="path.id" :data-trace="path.id" :d="path.d" fill="none" :stroke="path.style.color" stroke-width="2.6" stroke-linejoin="round" :stroke-dasharray="path.style.dash" />
            </svg>
            <p class="plot-note">Bütün çizgiler aynı 0–1 ölçeğini kullanır. Renk, çizgi biçimi ve gösterge harfi birlikte hücreyi belirtir.</p>
          </figure>
          <table class="metrics-table" data-testid="builder-table">
            <caption>Hücre başına hesaplanan ölçütler · bu kayıt</caption>
            <thead><tr><th scope="col">Hücre</th><th scope="col">Tepe</th><th scope="col">Tepe zamanı</th><th scope="col">{{ decimal(REPORT_LEVEL, 2) }} düzeyine ulaşma</th><th scope="col">{{ decimal(recorded.result.timesMs.at(-1)!, 0) }} ms’de</th></tr></thead>
            <tbody>
              <tr v-for="cell in recorded.cells" :key="cell.id" :data-testid="`builder-row-${cell.id}`">
                <th scope="row">{{ cell.id }}<template v-if="cell.id === settings!.target"> · uyarılan</template></th>
                <td :data-testid="`builder-peak-${cell.id}`" :data-value="cell.peak">{{ decimal(cell.peak, 3) }}</td>
                <td :data-testid="`builder-peak-time-${cell.id}`" :data-value="cell.peakTimeMs ?? 'null'">{{ ms(cell.peakTimeMs) }}</td>
                <td :data-testid="`builder-reach-${cell.id}`" :data-value="cell.reachMs ?? 'null'">{{ ms(cell.reachMs) }}</td>
                <td :data-testid="`builder-final-${cell.id}`" :data-value="cell.finalValue">{{ decimal(cell.finalValue, 3) }}</td>
              </tr>
            </tbody>
          </table>
          <p class="plot-note">“—”, ilgili ölçütün oluşmadığını gösterir. {{ decimal(REPORT_LEVEL, 2) }} bir raporlama düzeyidir, biyolojik eşik değildir. Tepe zamanı bir olay başlangıcı ya da iletim gecikmesi değildir; son değer kararlı durum iddiası değildir.</p>
          <div class="facts" data-testid="builder-facts">
            <h3>Bu sayılar ne söylüyor?</h3>
            <ul><li v-for="fact in recorded.facts" :key="fact">{{ fact }}</li></ul>
            <p>Bunlar yalnız kurduğun oyuncak modelin çıktısıdır. Gerçek bir hücrenin ya da devrenin böyle davrandığını göstermez.</p>
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
.preset-buttons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.preset-button { display: grid; gap: 6px; align-content: start; text-align: left; min-height: 44px; padding: 12px 14px; border: 1px solid var(--b-border); border-radius: 6px; background: var(--b-soft); color: var(--b-text); font-size: 13px; line-height: 1.6; }
.preset-button strong { font-size: 14px; font-weight: 600; }
.preset-button span { color: var(--b-muted); font-size: 12px; line-height: 1.6; }
.preset-button:hover { border-color: var(--b-muted); }
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
  .preset-buttons { grid-template-columns: minmax(0, 1fr); }
  .metrics-table { font-size: 12px; }
  .metrics-table th, .metrics-table td { padding: 8px 4px; }
  .metrics-table thead th { font-size: 11px; }
  .builder-actions .primary-button, .builder-actions .secondary-button { flex: 1 1 140px; }
}
@media (prefers-reduced-motion: reduce) { .builder-page * { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
</style>
