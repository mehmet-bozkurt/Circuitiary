<script setup lang="ts">
import TermText from './TermText.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { parseRealConnectome } from '../model/realConnectome'
import type { DeepReadonly, ReadonlyRealConnectome, SourceReference } from '../model/types'
import { createReadingGraph, findChemicalCycle, findShortestRoute, inspectNeuron } from '../learning/circuitReading'
import type { ReadingGraph, ReadingHop, ReadingMode, ReadingRoute } from '../learning/circuitReading'
import { readingNotes, readingPrompts, readingSources } from '../learning/readingContent'

withDefaults(defineProps<{ handoffLoading?: boolean; handoffError?: string }>(), { handoffLoading: false, handoffError: '' })
const emit = defineEmits<{ ready: []; inspect: [payload: { neuronId: string }] }>()
type LoadState = 'loading' | 'ready' | 'missing' | 'invalid' | 'error'
const loadState = ref<LoadState>('loading')
const loadMessage = ref('Yerel bağlantı verisi yükleniyor…')
const errorMessage = ref('')
const data = shallowRef<ReadonlyRealConnectome | null>(null)
const graph = shallowRef<ReadingGraph | null>(null)
const selectedNeuron = ref('AVER')
const targetNeuron = ref('AVAR')
const mode = ref<ReadingMode>('chemical')
const route = shallowRef<ReadingRoute | null>(null)
const stepIndex = ref(0)
const pathAnnouncement = ref('')
let request: AbortController | null = null
let requestTimer: ReturnType<typeof setTimeout> | undefined
let requestVersion = 0
let disposed = false

const selected = computed(() => graph.value?.neuronIds.includes(selectedNeuron.value) ? inspectNeuron(graph.value, selectedNeuron.value) : null)
const cycle = computed(() => graph.value && selected.value ? findChemicalCycle(graph.value, selectedNeuron.value) : null)
const activeHop = computed(() => route.value?.hops[stepIndex.value] ?? null)
const neighborGroups = computed(() => selected.value ? [
  { id: 'incoming', title: 'Kimyasal girişler', symbol: '→', description: 'Başka hücre → seçili hücre', hops: selected.value.incomingChemical },
  { id: 'outgoing', title: 'Kimyasal çıkışlar', symbol: '→', description: 'Seçili hücre → başka hücre', hops: selected.value.outgoingChemical },
  { id: 'gaps', title: 'Elektriksel bağlantılar', symbol: '↔', description: 'Bir kez tutulan fiziksel çiftler', hops: selected.value.gaps },
  { id: 'self-loops', title: 'Kimyasal öz döngüler', symbol: '↺', description: 'Aynı kaynak ve hedef; ayrı kayıt', hops: selected.value.selfLoops },
] : [])
const allSelfLoops = computed<ReadingHop[]>(() => (graph.value?.chemicalEdges ?? []).filter(edge => edge.source === edge.target).map(edge => ({ edgeId: edge.id, kind: 'chemical', from: edge.source, to: edge.target, rawWeight: edge.rawWeight, sourceRef: edge.sourceRef })))
const typeLabels = { sensory: 'Duyusal nöron', interneuron: 'Ara nöron', motorneuron: 'Motor nöron', neuron: 'Nöron' } as const
const modeLabel = computed(() => mode.value === 'chemical' ? 'kimyasal' : mode.value === 'gap' ? 'elektriksel' : 'karma')
const sourceText = (source: DeepReadonly<SourceReference>) => `${source.sheet} · ${source.cell} · satır ${source.row}, sütun ${source.column}`
const symbol = (hop: ReadingHop) => hop.kind === 'gap' ? '↔' : '→'
function hopAttributes(hop: ReadingHop) {
  return {
    'data-edge-id': hop.edgeId, 'data-kind': hop.kind, 'data-from': hop.from, 'data-to': hop.to, 'data-raw-weight': hop.rawWeight,
    'data-source-sheet': hop.sourceRef.sheet, 'data-source-row': hop.sourceRef.row, 'data-source-column': hop.sourceRef.column, 'data-source-cell': hop.sourceRef.cell,
    'data-reciprocal-source-sheet': hop.reciprocalSourceRef?.sheet, 'data-reciprocal-source-row': hop.reciprocalSourceRef?.row, 'data-reciprocal-source-column': hop.reciprocalSourceRef?.column, 'data-reciprocal-source-cell': hop.reciprocalSourceRef?.cell,
  }
}
watch([selectedNeuron, targetNeuron, mode], () => {
  route.value = null
  stepIndex.value = 0
  pathAnnouncement.value = 'Seçim değişti. Yeni koşullar için yol bulabilirsin.'
})
function searchRoute() {
  if (!graph.value) return
  route.value = findShortestRoute(graph.value, selectedNeuron.value, targetNeuron.value, mode.value)
  stepIndex.value = 0
  pathAnnouncement.value = route.value.status === 'same-cell'
    ? 'Kaynak ve hedef aynı hücre. Sıfır bağlantılı yol; bir etkileşim kanıtı değildir.'
    : route.value.status === 'unreachable'
      ? 'Bu 30 hücrelik alt grafikte seçilen bağlantı türünde yol bulunamadı.'
      : `${route.value.hops.length} bağlantılı anatomik yol bulundu. İlk adım gösteriliyor.`
}
function selectStep(index: number) {
  if (!route.value || index < 0 || index >= route.value.hops.length) return
  stepIndex.value = index
  pathAnnouncement.value = `${index + 1}. adım: ${route.value.hops[index]!.from}, ${route.value.hops[index]!.kind === 'gap' ? 'elektriksel çift üzerinden' : 'kimyasal kayıt yönünde'}, ${route.value.hops[index]!.to}.`
}
function indirectExample() {
  if (!graph.value?.neuronIds.includes('RICL') || !graph.value.neuronIds.includes('AVBR')) return
  selectedNeuron.value = 'RICL'
  targetNeuron.value = 'AVBR'
  mode.value = 'chemical'
}
async function loadData() {
  const version = ++requestVersion
  request?.abort()
  if (requestTimer !== undefined) clearTimeout(requestTimer)
  const controller = new AbortController()
  request = controller
  let timedOut = false
  let phase: 'request' | 'parse' = 'request'
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 10_000)
  requestTimer = timer
  loadState.value = 'loading'
  loadMessage.value = 'Yerel bağlantı verisi yükleniyor…'
  errorMessage.value = ''
  data.value = null
  graph.value = null
  route.value = null
  stepIndex.value = 0
  pathAnnouncement.value = ''
  try {
    const response = await fetch('/api/local-connectome', { cache: 'no-store', signal: controller.signal })
    if (disposed || version !== requestVersion) return
    if (response.status === 404) {
      loadState.value = 'missing'
      loadMessage.value = ''
      errorMessage.value = 'Yerel bağlantı verisi bulunamadı. Bu sayfa gerçek veri dosyası olmadan örnek sonuç üretmez. Veri hazır olduğunda tekrar deneyebilirsin.'
      return
    }
    if (!response.ok) throw new Error('Local data request failed')
    phase = 'parse'
    const parsed = parseRealConnectome(await response.json())
    const readingGraph = createReadingGraph(parsed)
    if (disposed || version !== requestVersion) return
    selectedNeuron.value = readingGraph.neuronIds.includes(selectedNeuron.value) ? selectedNeuron.value : readingGraph.neuronIds[0]!
    targetNeuron.value = readingGraph.neuronIds.includes(targetNeuron.value) ? targetNeuron.value : readingGraph.neuronIds[0]!
    data.value = parsed
    graph.value = readingGraph
    loadState.value = 'ready'
    loadMessage.value = `${readingGraph.neurons.length} hücre, ${readingGraph.chemicalEdges.length} kimyasal kayıt ve ${readingGraph.gapEdges.length} fiziksel elektriksel çift yüklendi.`
  } catch {
    if (disposed || version !== requestVersion) return
    loadMessage.value = ''
    loadState.value = timedOut || phase === 'request' ? 'error' : 'invalid'
    errorMessage.value = timedOut
      ? 'Yerel veri 10 saniyede yanıt vermedi. Tekrar deneyebilirsin.'
      : phase === 'parse'
        ? 'Yerel dosya beklenen bağlantı şemasına uymuyor veya okunabilir JSON içermiyor. Bu veriyle anatomik sonuç gösterilmiyor.'
        : 'Yerel bağlantı verisi okunamadı. Bağlantı yeniden hazır olduğunda tekrar deneyebilirsin.'
  } finally {
    clearTimeout(timer)
    if (version === requestVersion) { request = null; requestTimer = undefined }
    if (!disposed && version === requestVersion) {
      await nextTick()
      if (!disposed && version === requestVersion) emit('ready')
    }
  }
}
onMounted(() => { emit('ready'); void loadData() })
onBeforeUnmount(() => {
  disposed = true
  requestVersion += 1
  request?.abort()
  if (requestTimer !== undefined) clearTimeout(requestTimer)
})
</script>

<template>
  <main id="circuit-reading" tabindex="-1" class="reading-page" :data-data-state="loadState">
    <header class="reading-intro"><p class="reading-eyebrow">CIRCUITIARY / ÖĞRENME NOTLARI / 03</p><h1 id="reading-title" tabindex="-1">Devreyi okumak</h1><p class="reading-summary">Bir hücreyi seç. Girişini, çıkışını ve komşusunu ayır. Sonra bir anatomik yolun ne gösterdiğini, neyi kanıtlamak için ek veri gerektiğini anlat.</p><p class="reading-meta">Gerçek yerel veri · 30 hücrelik alt ağ · Yeni bir dinamik simülasyon çalıştırılmaz</p></header>
    <div class="reading-boundary"><strong>Bağlantı kaydı ile işlevsel etkiyi ayır.</strong><p><TermText :text="readingNotes.function" /></p></div>
    <nav class="reading-navigation" aria-label="Devreyi okumak dersinin bölümleri"><a href="#reading-data">01 · Veriyi tanı</a><a href="#reading-neighbours">02 · Komşuları ayır</a><a href="#reading-path">03 · Yolu izle</a><a href="#reading-cycles">04 · Döngüyü ve sınırı oku</a><a href="#reading-provenance">Kaynaklar</a></nav>

    <section id="reading-data" tabindex="-1" aria-labelledby="reading-data-title" class="reading-section">
      <p class="reading-eyebrow">01 / KAYDI TANI</p><h2 id="reading-data-title">Anatominin kaydı nasıl tutuluyor?</h2><p class="reading-paragraph"><TermText :text="readingNotes.anatomy" /></p><p class="reading-paragraph"><TermText :text="readingNotes.weight" /></p>
      <div data-testid="reading-load-status" :data-state="loadState" class="reading-load-state"><p role="status" aria-live="polite" aria-atomic="true">{{ loadMessage }}</p><div v-if="errorMessage" role="alert" class="reading-error"><p>{{ errorMessage }}</p><button type="button" @click="loadData">Tekrar dene</button></div></div>
      <div v-if="graph" data-testid="reading-data-summary" :data-neuron-count="graph.neurons.length" :data-chemical-count="graph.chemicalEdges.length" :data-gap-count="graph.gapEdges.length" :data-self-loop-count="allSelfLoops.length" class="reading-data-summary"><div><span>Hücre</span><strong>{{ graph.neurons.length }}</strong></div><div><span>Kimyasal kayıt</span><strong>{{ graph.chemicalEdges.length }}</strong></div><div><span>Fiziksel elektriksel çift</span><strong>{{ graph.gapEdges.length }}</strong></div><p><TermText :text="graph.chemicalEdges.length" /> kimyasal kaydın <TermText :text="allSelfLoops.length" /> tanesi öz döngüdür. Elektriksel çiftler iki kez sayılmaz.</p><p>Ham birim: seri EM kesiti ağırlığı.</p></div>
      <p class="reading-model-note">Ham kayıtları okuyoruz; burada bağlantılara uyarıcı/baskılayıcı işaret, dinamik ağırlık veya etkinlik değeri atanmıyor.</p>
    </section>

    <section id="reading-neighbours" tabindex="-1" aria-labelledby="reading-neighbours-title" class="reading-section">
      <p class="reading-eyebrow">02 / HÜCRENİN ÇEVRESİ</p><h2 id="reading-neighbours-title">Gelen, giden ve çift yönlü okunan bağlantı</h2><p class="reading-paragraph"><TermText :text="readingNotes.neighbours" /></p>
      <div v-if="graph && selected" class="neuron-reading">
        <div class="neuron-selector"><label for="reading-neuron">İncelenen hücre / yolun kaynağı</label><select id="reading-neuron" v-model="selectedNeuron" :disabled="handoffLoading"><option v-for="neuron in graph.neurons" :key="neuron.id" :value="neuron.id">{{ neuron.id }}</option></select></div>
        <div data-testid="reading-selected-neuron" class="selected-neuron"><h3><TermText :text="selected.neuron.id" /></h3><p>Kaynak hücre sınıfı: <strong><TermText :text="typeLabels[selected.neuron.cellType]" /></strong></p><p class="source-reference">Hücre listesi: <TermText :text="sourceText(selected.neuron.sourceRef)" /></p><p>Bu sınıf, burada atanmış bir girdi/çıktı rolü değildir.</p></div>
        <div class="neighbor-grid">
          <div v-for="group in neighborGroups" :key="group.id" :data-testid="`reading-${group.id}`" class="neighbor-group"><h3><TermText :text="group.title" /> <span><TermText :text="group.hops.length" /></span></h3><p class="group-description"><TermText :text="group.description" /></p><p v-if="!group.hops.length" class="empty-records">Bu alt ağda bu tür kayıt yok.</p><ul v-else class="edge-list"><li v-for="hop in group.hops" :key="hop.edgeId" v-bind="hopAttributes(hop)"><div class="edge-heading"><strong><TermText :text="hop.from" /> <span aria-hidden="true">{{ hop.kind === 'gap' ? '↔' : '→' }}</span><span class="sr-only"><TermText :text="hop.kind === 'gap' ? 'ile fiziksel çift' : 'hücresinden hedef'" /></span> <TermText :text="hop.to" /></strong><span><TermText :text="hop.rawWeight" /> EM kesiti</span></div><p class="source-reference">Kaynak: <TermText :text="sourceText(hop.sourceRef)" /></p><p v-if="hop.reciprocalSourceRef" class="source-reference">Karşılıklı matris kaydı: <TermText :text="sourceText(hop.reciprocalSourceRef)" /></p></li></ul></div>
        </div>
        <p class="reading-model-note"><TermText :text="readingNotes.gap" /></p>
        <div class="reading-handoff"><p><TermText :text="readingNotes.handoff" /></p><button type="button" :disabled="handoffLoading" @click="emit('inspect', { neuronId: selectedNeuron })">{{ handoffLoading ? 'Ana deney hazırlanıyor…' : 'Ana deneyde bu hücreyi incele' }}</button><p v-if="handoffError" data-testid="reading-handoff-error" role="alert">{{ handoffError }}</p></div>
      </div>
      <p v-else class="waiting-for-data">Hücre seçimi ve bağlantı listeleri, yerel veri başarıyla yüklendiğinde açılır.</p>
    </section>

    <section id="reading-path" tabindex="-1" aria-labelledby="reading-path-title" class="reading-section">
      <p class="reading-eyebrow">03 / DOĞRUDAN VE DOLAYLI</p><h2 id="reading-path-title">En az kenarlı anatomik yolu izle</h2><p class="reading-paragraph"><TermText :text="readingNotes.route" /></p><p class="reading-paragraph"><TermText :text="readingNotes.direct" /></p>
      <div v-if="graph" class="route-workspace">
        <div class="route-controls"><div><label for="reading-target">Yolun hedef hücresi</label><select id="reading-target" v-model="targetNeuron"><option v-for="neuron in graph.neurons" :key="neuron.id" :value="neuron.id">{{ neuron.id }}</option></select></div><div><label for="reading-mode">Okunacak bağlantı türü</label><select id="reading-mode" v-model="mode"><option value="chemical">Kimyasal · yönlü</option><option value="gap">Elektriksel · çift yönlü okuma</option><option value="mixed">Karma · her ikisi</option></select></div></div>
        <p class="source-choice">Kaynak: <strong><TermText :text="selectedNeuron" /></strong>. Kaynağı üstteki hücre seçiminden değiştirebilirsin.</p>
        <div class="route-actions"><button type="button" class="reading-primary" aria-controls="reading-route-region" @click="searchRoute">Yol bul <span aria-hidden="true">→</span></button><button type="button" class="reading-secondary" :disabled="handoffLoading" @click="indirectExample">Dolaylı yol örneği: RICL → AVBR</button></div>
        <p data-testid="reading-path-status" role="status" aria-live="polite" aria-atomic="true" class="path-announcement">{{ pathAnnouncement }}</p>
        <div id="reading-route-region" data-testid="reading-path" :data-status="route?.status ?? 'not-searched'" :data-source="selectedNeuron" :data-target="targetNeuron" :data-mode="mode" role="region" aria-label="Anatomik yol aramasının sonucu" class="route-result">
          <p v-if="!route" class="not-searched">Kaynak, hedef ve bağlantı türünü seç; “Yol bul” ile bu alt grafiği ara. Sonuç yalnız seçilen anatomik kayıtları kullanır.</p>
          <template v-else-if="route.status === 'same-cell'"><h3>Sıfır bağlantılı yol</h3><p data-testid="reading-same-cell"><TermText :text="selectedNeuron" /> ile <TermText :text="targetNeuron" /> aynı hücre. Arada 0 kenar var; bu sonuç bir öz döngü veya etkileşim kanıtı değildir.</p></template>
          <template v-else-if="route.status === 'unreachable'"><h3>Bu alt grafikte yol bulunamadı</h3><p data-testid="reading-no-path"><TermText :text="selectedNeuron" /> → <TermText :text="targetNeuron" /> için <TermText :text="modeLabel" /> modda bu 30 hücrelik alt grafikte yol yok. Hayvanın tüm ağında bağlantı veya yol olmadığını söylemeyiz.</p></template>
          <template v-else>
            <h3><TermText :text="route.hops.length === 1 ? 'Doğrudan komşuluk' : 'Dolaylı anatomik yol'" /></h3><p class="route-length" data-testid="reading-path-length"><TermText :text="route.hops.length" /> kenar · <TermText :text="route.hops.length === 1 ? 'Arada başka hücre yok' : `${route.hops.length - 1} ara hücre`" /></p>
            <div class="written-route" data-testid="reading-path-nodes" aria-label="Yolun hücre sırası"><template v-for="(node, index) in route.nodes" :key="`${index}-${node}`"><span v-if="index" class="route-symbol" aria-hidden="true">{{ symbol(route.hops[index - 1]!) }}</span><strong>{{ node }}</strong></template></div>
            <p class="scheme-note">Hücre sırası yazılı bir şemadır; anatomik konum, mesafe veya sinyal animasyonu değildir.</p>
            <div class="route-step-controls"><button type="button" :disabled="stepIndex === 0" @click="selectStep(stepIndex - 1)">Önceki adım</button><span data-testid="reading-step" :data-step-index="stepIndex">{{ stepIndex + 1 }} / {{ route.hops.length }}</span><button type="button" :disabled="stepIndex >= route.hops.length - 1" @click="selectStep(stepIndex + 1)">Sonraki adım</button></div>
            <ol data-testid="reading-path-hops" class="path-hop-list"><li v-for="(hop, index) in route.hops" :key="hop.edgeId" v-bind="hopAttributes(hop)"><button type="button" :aria-pressed="stepIndex === index" @click="selectStep(index)"><span>{{ index + 1 }}.</span> {{ hop.from }} {{ symbol(hop) }} {{ hop.to }} <small>{{ hop.kind === 'chemical' ? 'Kimyasal' : 'Elektriksel çift' }}</small></button></li></ol>
            <div v-if="activeHop" data-testid="reading-active-hop" v-bind="hopAttributes(activeHop)" class="active-hop"><p class="reading-eyebrow"><TermText :text="stepIndex + 1" />. KAYDI İNCELE</p><h4><TermText :text="activeHop.from" /> <TermText :text="symbol(activeHop)" /> <TermText :text="activeHop.to" /></h4><dl><div><dt>Bağlantı türü</dt><dd><TermText :text="activeHop.kind === 'chemical' ? 'Yönlü kimyasal kayıt' : 'Tek fiziksel elektriksel çift; bu adımda okuma yönü'" /></dd></div><div><dt>Ham anatomik ağırlık</dt><dd><TermText :text="activeHop.rawWeight" /> EM kesiti</dd></div><div><dt>Kaynak tablo hücresi</dt><dd><TermText :text="sourceText(activeHop.sourceRef)" /></dd></div><div v-if="activeHop.reciprocalSourceRef"><dt>Karşılıklı tablo hücresi</dt><dd><TermText :text="sourceText(activeHop.reciprocalSourceRef)" /></dd></div></dl><p v-if="activeHop.kind === 'gap'">Çiftin kaynak referansları kanonik kayıttan korunur; grafikte ters yönde okumak yeni bir fiziksel bağlantı üretmez.</p></div>
          </template>
          <p v-if="route" class="visited-count" data-testid="reading-visited-count">Aramada keşfedilen farklı hücre: <TermText :text="route.visitedCount" />. Bu sayı hücre etkinliği veya sinyal yayılımı değildir.</p>
        </div>
        <p class="reading-model-note"><TermText :text="readingNotes.routeLimit" /></p>
      </div>
      <p v-else class="waiting-for-data">Yol arama, doğrulanmış yerel bağlantı verisi yüklendiğinde açılır.</p>
    </section>

    <section id="reading-cycles" tabindex="-1" aria-labelledby="reading-cycles-title" class="reading-section">
      <p class="reading-eyebrow">04 / DÖNGÜ VE SINIR</p><h2 id="reading-cycles-title">Başlangıca dönmek, ağı tamamlamak değildir</h2><p class="reading-paragraph"><TermText :text="readingNotes.cycle" /></p>
      <div v-if="graph && selected" class="cycle-boundary-grid"><div data-testid="reading-cycle" :data-found="Boolean(cycle)" class="reading-card"><h3><TermText :text="selectedNeuron" /> için kimyasal döngü</h3><template v-if="cycle"><p>Bu alt grafikte en az iki hücreli yönlü döngü:</p><div class="written-route" data-testid="reading-cycle-nodes"><template v-for="(node, index) in cycle.nodes" :key="`${index}-${node}`"><span v-if="index" class="route-symbol" aria-hidden="true">→</span><strong>{{ node }}</strong></template></div><ol data-testid="reading-cycle-hops" class="cycle-hop-list"><li v-for="hop in cycle.hops" :key="hop.edgeId" v-bind="hopAttributes(hop)"><strong><TermText :text="hop.from" /> → <TermText :text="hop.to" /></strong><span><TermText :text="hop.rawWeight" /> EM kesiti</span><p class="source-reference"><TermText :text="sourceText(hop.sourceRef)" /></p></li></ol></template><p v-else data-testid="reading-no-cycle">Seçili hücreden başlayıp geri dönen, öz döngü dışındaki kimyasal döngü bu alt grafikte bulunamadı.</p></div><div class="reading-card" data-testid="reading-all-self-loops"><h3>Alt ağdaki kimyasal öz döngüler <span><TermText :text="allSelfLoops.length" /></span></h3><p>A→A kayıtları; en az iki hücreli döngülerden ayrıdır.</p><ul class="edge-list"><li v-for="hop in allSelfLoops" :key="hop.edgeId" v-bind="hopAttributes(hop)"><div class="edge-heading"><strong><TermText :text="hop.from" /> → <TermText :text="hop.to" /></strong><span><TermText :text="hop.rawWeight" /> EM kesiti</span></div><p class="source-reference"><TermText :text="sourceText(hop.sourceRef)" /></p></li></ul></div></div>
      <p class="reading-paragraph"><TermText :text="readingNotes.boundary" /></p>
      <div v-if="selected" data-testid="reading-external-boundary" class="external-boundary"><h3><TermText :text="selectedNeuron" /> için dışarıda kalan kayıtlar</h3><dl><div><dt>Kimyasal giriş</dt><dd data-testid="reading-omitted-incoming" :data-count="selected.omittedExternal.chemicalIncomingCount"><TermText :text="selected.omittedExternal.chemicalIncomingCount" /> kayıt <span>· <TermText :text="selected.omittedExternal.chemicalIncomingWeight" /> EM kesiti</span></dd></div><div><dt>Kimyasal çıkış</dt><dd data-testid="reading-omitted-outgoing" :data-count="selected.omittedExternal.chemicalOutgoingCount"><TermText :text="selected.omittedExternal.chemicalOutgoingCount" /> kayıt <span>· <TermText :text="selected.omittedExternal.chemicalOutgoingWeight" /> EM kesiti</span></dd></div><div><dt>Elektriksel çift</dt><dd data-testid="reading-omitted-gaps" :data-count="selected.omittedExternal.gapCount"><TermText :text="selected.omittedExternal.gapCount" /> çift <span>· <TermText :text="selected.omittedExternal.gapWeight" /> EM kesiti</span></dd></div></dl><p v-if="selected.excludedGapSelfEntries.length" class="reading-model-note">Kaynak matrisindeki <TermText :text="selected.excludedGapSelfEntries.length" /> elektriksel köşegen kaydı metadata olarak korunur; fiziksel öz bağlantı olarak çizilmez veya yol aramasına katılmaz.</p></div>
      <div class="reading-prompts"><h3>Kendi cümlenle açıkla</h3><ul><li v-for="prompt in readingPrompts" :key="prompt"><TermText :text="prompt" /></li></ul></div>
    </section>

    <section id="reading-provenance" tabindex="-1" aria-labelledby="reading-provenance-title" data-testid="reading-provenance" class="reading-section">
      <p class="reading-eyebrow">KAYNAĞI İZLE</p><h2 id="reading-provenance-title">Kaynak, sürüm ve yerel kullanım</h2><p class="reading-paragraph"><TermText :text="readingNotes.dataset" /></p><p class="reading-paragraph"><TermText :text="readingNotes.local" /></p>
      <dl v-if="data" class="provenance-facts"><div><dt>Yerel veri başlığı</dt><dd><TermText :text="data.dataset.title" /></dd></div><div><dt>Sürüm</dt><dd><TermText :text="data.dataset.version" /></dd></div><div><dt>Kaynakta kayıtlı ham birim</dt><dd><TermText :text="data.dataset.anatomicalWeightUnit" /></dd></div><div><dt>Yön / kayıt düzeni</dt><dd><TermText :text="data.dataset.orientation" /></dd></div><div><dt>Dosya lisansı durumu</dt><dd>Doğrulanmadı · yalnız yerel kullanım <code>{{ data.dataset.license.status }}</code></dd></div></dl>
      <details v-if="data" class="source-files"><summary>Yerel veri kaynaklarının kimliğini gör</summary><div v-for="source in data.dataset.sources" :key="source.sha256"><a :href="source.url">{{ source.name }}</a><p>Yerel veri kaydındaki edinim zamanı: <TermText :text="source.downloadedAtUtc" /></p><p>SHA-256: <code>{{ source.sha256 }}</code></p></div></details>
      <ul class="primary-sources"><li v-for="source in readingSources" :key="source.id"><a :href="source.url">{{ source.title }} <span aria-hidden="true">↗</span></a></li></ul>
    </section>
    <div class="reading-next"><a href="/ogren/rehberli-deneyler">Rehberli deneylere dön <span aria-hidden="true">←</span></a><a href="/" class="reading-primary">Devre deneyine geç <span aria-hidden="true">→</span></a></div>
  </main>
</template>

<style scoped>
.reading-page{padding-bottom:64px;outline:none}.reading-intro{padding:51px 0 30px}.reading-eyebrow{font:10px/1.8 var(--mono,monospace);letter-spacing:1.2px;color:var(--theme-muted, #596b55)}.reading-intro h1{font:400 62px/1.1 var(--serif,Georgia,serif);letter-spacing:-2px;margin:18px 0 23px}.reading-summary{max-width:780px;font-size:17px;line-height:1.9}.reading-meta{font-size:12px;line-height:1.8;color:var(--theme-muted, #5d6a57);margin-top:17px}.reading-boundary{border-left:3px solid #7e9673;background:var(--theme-surface-soft, #eaf0e1);padding:17px 21px;font-size:13px;line-height:1.9}.reading-boundary strong{font-weight:500}.reading-boundary p{margin-top:6px}.reading-navigation{display:flex;gap:10px;flex-wrap:wrap;margin:27px 0 31px}.reading-navigation a{font-size:11px;line-height:1.7;border:1px solid var(--theme-border, #cbd4c0);padding:11px 14px;min-height:44px;border-radius:5px;background:var(--theme-surface, #f8f9ef)}.reading-navigation a:hover{background:var(--theme-surface-soft, #e9efdf)}.reading-section{border-top:1px solid var(--theme-border, #daddd2);padding:34px 0 39px;scroll-margin-top:25px;outline:none}.reading-section h2{font:400 31px/1.4 var(--serif,Georgia,serif);letter-spacing:-.6px;margin:12px 0 20px}.reading-paragraph{font-size:14px;line-height:2;color:var(--theme-muted, #486049);max-width:880px;margin:16px 0}.reading-model-note{font-size:12px;line-height:1.95;border-left:2px solid #a0b68d;padding:0 0 0 15px;margin:23px 0 0;color:var(--theme-muted, #586c4f);max-width:930px}.reading-load-state{font-size:12px;line-height:1.9;margin:23px 0 0;color:var(--theme-muted, #546d49)}.reading-error{border-left:3px solid #af7c41;border-radius:3px;background:var(--theme-surface-soft, #f4eddd);color:var(--theme-warning, #7c5c31);padding:16px 19px;max-width:820px}.reading-error button{margin-top:13px;background:var(--theme-warning-bg, #efe4c9);border:1px solid #bdae87;border-radius:5px;padding:11px 16px;color:var(--theme-warning, #725a31);min-height:44px;font-size:12px}.reading-data-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px 25px;background:var(--theme-surface-soft, #eef3e5);border:1px solid var(--theme-border, #cad6bd);border-radius:7px;padding:23px;margin-top:19px}.reading-data-summary>div{display:flex;justify-content:space-between;align-items:center;gap:15px}.reading-data-summary span{font-size:12px;line-height:1.9}.reading-data-summary strong{font:28px/1.3 var(--serif,Georgia,serif);font-weight:400}.reading-data-summary>p{grid-column:1/-1;font-size:11px;line-height:1.8;color:var(--theme-muted, #596c51)}.neuron-reading{margin-top:27px}.neuron-selector{display:flex;align-items:center;gap:24px;max-width:570px}.neuron-selector label{font-size:13px;line-height:1.8}.neuron-selector select{min-width:145px;font-size:13px;min-height:45px}.selected-neuron{border:1px solid var(--theme-border, #cbd5be);border-radius:7px;background:var(--theme-surface-soft, #eff3e7);padding:21px;margin-top:19px}.selected-neuron h3{font:400 25px var(--serif,Georgia,serif);margin:0 0 12px}.selected-neuron p{font-size:12px;line-height:1.9;margin-top:7px}.selected-neuron strong{font-weight:500}.source-reference{font:10px/1.9 var(--mono,monospace)!important;color:var(--theme-muted, #5d6b54);overflow-wrap:anywhere}.neighbor-grid{display:grid;grid-template-columns:1fr 1fr;gap:19px;margin-top:21px;align-items:start}.neighbor-group,.reading-card{padding:21px;border:1px solid var(--theme-border, #cdd7c2);border-radius:8px;background:var(--theme-surface, #fafbf4);min-width:0}.neighbor-group h3,.reading-card h3,.external-boundary h3,.reading-prompts h3{font:400 24px/1.5 var(--serif,Georgia,serif);letter-spacing:-.3px;margin:0 0 12px}.neighbor-group h3 span,.reading-card h3 span{font:12px var(--mono,monospace);color:var(--theme-muted, #5b6c4e);margin-left:12px}.group-description{font-size:11px;line-height:1.9;color:var(--theme-muted, #5e6a52);margin:0 0 17px}.empty-records{font-size:12px;line-height:1.9;color:var(--theme-muted, #5c6b53);padding:10px 0}.edge-list{list-style:none;padding:0;margin:0}.edge-list>li{border-top:1px solid var(--theme-border, #dde3d5);padding:14px 0}.edge-list>li:last-child{padding-bottom:0}.edge-heading{display:flex;justify-content:space-between;gap:12px;align-items:baseline;font-size:12px;line-height:1.9}.edge-heading strong{font:12px/1.9 var(--mono,monospace);font-weight:500}.edge-heading>span{font-size:11px;white-space:nowrap;color:var(--theme-muted, #586c4c)}.edge-list .source-reference{margin-top:8px}.reading-handoff{border:1px solid var(--theme-border, #c9d5bd);padding:23px;border-radius:7px;background:var(--theme-surface-soft, #e9efde);margin-top:28px}.reading-handoff>p{font-size:12px;line-height:1.95;color:var(--theme-muted, #576c4d);max-width:870px}.reading-handoff button,.reading-primary{background:#35593c;color:#faf8e8;font-size:12px;line-height:1.8;padding:12px 17px;border-radius:5px;min-height:44px}.reading-handoff button{margin-top:17px}.reading-handoff button:disabled{opacity:.65;cursor:wait}.reading-handoff p[role=alert]{color:var(--theme-danger, #8b5a3b);background:var(--theme-warning-bg, #f2e5d7);padding:12px 14px;margin-top:14px}.waiting-for-data{font-size:12px;line-height:1.9;color:var(--theme-muted, #5d6a53);border:1px dashed var(--theme-border, #c8d3ba);padding:20px;border-radius:5px;margin-top:23px}.route-workspace{padding:25px;border:1px solid var(--theme-border, #cbd5bd);border-radius:8px;background:var(--theme-surface, #fafbf4);margin-top:26px}.route-controls{display:grid;grid-template-columns:1fr 1fr;gap:22px;max-width:800px}.route-controls label{display:block;font-size:12px;line-height:1.8;margin-bottom:9px}.route-controls select{width:100%;font-size:12px;min-height:45px}.source-choice{font-size:12px;line-height:1.9;color:var(--theme-muted, #586c51);margin-top:16px}.source-choice strong{font-family:var(--mono,monospace);font-weight:500}.route-actions{display:flex;flex-wrap:wrap;gap:13px;margin-top:20px}.reading-primary span{margin-left:12px}.reading-secondary{background:var(--theme-surface-soft, #eaf0df);border:1px solid var(--theme-border, #bdcfad);border-radius:5px;color:var(--theme-muted, #526d48);min-height:44px;padding:11px 15px;font-size:11px;line-height:1.8}.reading-secondary:disabled{opacity:.65}.path-announcement{font-size:11px;line-height:1.9;color:var(--theme-muted, #556d48);min-height:21px;margin-top:17px}.route-result{border-top:1px solid var(--theme-border, #d6dfca);margin-top:19px;padding-top:20px}.route-result h3{font:400 25px/1.5 var(--serif,Georgia,serif);margin:0 0 13px}.route-result>p{font-size:13px;line-height:1.95;color:var(--theme-muted, #536d49)}.not-searched{padding:10px 0}.route-length{font:12px/1.9 var(--mono,monospace)!important}.written-route{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:18px}.written-route strong{border:1px solid var(--theme-border, #b7caab);background:var(--theme-surface-soft, #ecf2e3);border-radius:5px;padding:9px 13px;font:13px/1.8 var(--mono,monospace);font-weight:500}.route-symbol{font-size:19px;color:var(--theme-muted, #576c4c)}.scheme-note{font-size:11px!important;color:var(--theme-muted, #5f6a55)!important;margin-top:15px}.route-step-controls{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin:24px 0 18px}.route-step-controls button{background:var(--theme-surface-soft, #eaf0e1);border:1px solid var(--theme-border, #bdcdae);color:var(--theme-muted, #536e46);border-radius:4px;min-height:44px;font-size:11px;padding:10px 14px}.route-step-controls button:disabled{opacity:.5;cursor:default}.route-step-controls span{font:12px var(--mono,monospace);color:var(--theme-muted, #576d49)}.path-hop-list{padding:0;list-style:none;margin:0;display:flex;gap:10px;flex-wrap:wrap}.path-hop-list button{background:var(--theme-surface, #f2f5ec);border:1px solid var(--theme-border, #c5d2ba);border-radius:5px;color:var(--theme-muted, #536e47);padding:12px 15px;min-height:44px;font:12px/1.8 var(--mono,monospace);text-align:left}.path-hop-list button>span{font-size:10px;margin-right:6px}.path-hop-list small{display:block;font:10px/1.8 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin-top:6px}.path-hop-list button[aria-pressed=true]{border-color:#507746;background:#3b6041;color:#f7f8e8}.active-hop{padding:20px 23px;border-radius:6px;background:var(--theme-surface-soft, #e9f0df);border:1px solid var(--theme-border, #c4d5b7);margin-top:19px;max-width:850px}.active-hop h4{font:22px/1.5 var(--mono,monospace);font-weight:400;margin:13px 0}.active-hop dl{margin:0}.active-hop dl>div{display:grid;grid-template-columns:180px 1fr;gap:17px;font-size:12px;line-height:1.9;border-top:1px solid var(--theme-border, #d2dfc6);padding:11px 0}.active-hop dt{color:var(--theme-muted, #536e49)}.active-hop dd{margin:0;overflow-wrap:anywhere}.active-hop>p:last-child:not(:first-child){font-size:11px;line-height:1.95;color:var(--theme-muted, #546e47);margin-top:14px}.visited-count{font-size:11px!important;line-height:1.95!important;color:var(--theme-muted, #5b6b4f)!important;margin-top:22px}.cycle-boundary-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:27px;align-items:start}.reading-card>p{font-size:12px;line-height:1.9;color:var(--theme-muted, #596c4e)}.cycle-hop-list{padding-left:20px;margin:20px 0 0}.cycle-hop-list>li{font-size:12px;line-height:1.9;border-top:1px solid var(--theme-border, #dbe3d1);padding:12px 0 9px}.cycle-hop-list strong{font:12px/1.9 var(--mono,monospace);font-weight:500;margin-right:14px}.cycle-hop-list>li>span{font-size:11px;white-space:nowrap}.cycle-hop-list .source-reference{margin-top:6px}.reading-card .edge-list{margin-top:18px}.external-boundary{background:var(--theme-surface-soft, #eff1e5);border:1px solid var(--theme-border, #cdd5bd);padding:23px;border-radius:7px;margin-top:24px}.external-boundary dl{margin:19px 0 0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:19px}.external-boundary dt{font-size:12px;line-height:1.9;color:var(--theme-muted, #596c51)}.external-boundary dd{font:16px/1.8 var(--mono,monospace);margin:9px 0 0}.external-boundary dd span{display:block;font:10px/1.9 var(--mono,monospace);color:var(--theme-muted, #5d6a55);margin-top:5px}.reading-prompts{margin-top:29px}.reading-prompts ul{padding-left:20px;margin:18px 0 0}.reading-prompts li{font-size:12px;line-height:1.95;color:var(--theme-muted, #586c51);padding-left:5px;margin-bottom:12px}.provenance-facts{margin:25px 0 0;max-width:940px}.provenance-facts>div{display:grid;grid-template-columns:210px minmax(0,1fr);gap:20px;font-size:12px;line-height:1.95;border-top:1px solid var(--theme-border, #daddd2);padding:13px 0}.provenance-facts dt{font-weight:500;color:var(--theme-muted, #566d4e)}.provenance-facts dd{margin:0;overflow-wrap:anywhere}.provenance-facts code{display:block;font:10px/1.9 var(--mono,monospace);color:var(--theme-muted, #606a55);margin-top:6px}.source-files{border-top:1px solid var(--theme-border, #daddd2);margin-top:24px;padding-top:17px;max-width:940px}.source-files summary{font-size:12px;line-height:1.9;min-height:38px;cursor:pointer}.source-files>div{padding:16px 0;border-top:1px solid var(--theme-border, #daddd2);font-size:11px;line-height:1.9}.source-files p{margin-top:10px;overflow-wrap:anywhere}.source-files code{font:10px/1.9 var(--mono,monospace)}.primary-sources{padding-left:20px;margin:24px 0 0}.primary-sources li{font-size:12px;line-height:1.95;margin-bottom:12px;overflow-wrap:anywhere}.primary-sources a,.source-files a{text-decoration:underline;text-decoration-color:var(--theme-border, #b0c19e);text-underline-offset:3px}.reading-next{display:flex;justify-content:space-between;gap:20px;align-items:center;border:1px solid var(--theme-border, #cbd5be);border-radius:7px;background:var(--theme-surface-soft, #e9efde);padding:25px}.reading-next a{font-size:12px;line-height:1.9;padding:11px 4px}.reading-next a.reading-primary{padding:12px 17px}.reading-next span{margin-left:11px}
@media(max-width:1050px){.reading-intro h1{font-size:55px}.neighbor-group,.reading-card{padding:18px}.route-workspace{padding:22px}.neighbor-grid{gap:16px}.reading-data-summary{gap:14px}.reading-data-summary>div{flex-direction:column;align-items:flex-start;gap:8px}.active-hop dl>div{grid-template-columns:160px 1fr;gap:13px}}
@media(max-width:760px){.reading-intro{padding:34px 0 26px}.reading-intro h1{font-size:46px;letter-spacing:-1.5px;margin:16px 0 20px}.reading-summary{font-size:15px}.reading-meta{font-size:11px}.reading-boundary{padding:15px 17px;font-size:12px}.reading-navigation{gap:7px;margin:23px 0 26px}.reading-navigation a{font-size:10px;padding:10px 11px}.reading-section{padding:28px 0 33px}.reading-section h2{font-size:28px}.reading-paragraph{font-size:13px}.reading-data-summary{padding:19px;grid-template-columns:1fr;gap:12px}.reading-data-summary>div{flex-direction:row;align-items:center;gap:15px}.reading-data-summary strong{font-size:25px}.reading-data-summary span{font-size:11px}.neuron-selector{display:block}.neuron-selector label{display:block;font-size:12px;margin-bottom:10px}.neuron-selector select{width:100%}.selected-neuron{padding:19px}.selected-neuron p{font-size:11px}.neighbor-grid,.cycle-boundary-grid{grid-template-columns:1fr;gap:15px}.neighbor-group,.reading-card{padding:19px 15px}.neighbor-group h3,.reading-card h3,.external-boundary h3,.reading-prompts h3{font-size:23px}.edge-heading{gap:8px}.edge-heading strong{font-size:11px}.edge-heading>span{font-size:10px}.source-reference{font-size:9px!important}.reading-handoff{padding:19px}.reading-handoff p{font-size:11px}.reading-handoff button{width:100%;font-size:11px}.reading-model-note{font-size:11px;padding-left:12px}.route-workspace{padding:20px 14px}.route-controls{grid-template-columns:1fr;gap:17px}.route-controls select{font-size:11px}.route-actions{gap:10px}.route-actions>button{width:100%;font-size:11px}.route-result h3{font-size:24px}.route-result>p{font-size:12px}.written-route{gap:8px}.written-route strong{font-size:12px;padding:8px 10px}.route-symbol{font-size:17px}.route-step-controls{gap:10px;justify-content:space-between}.route-step-controls button{font-size:10px;padding:10px 11px}.route-step-controls span{font-size:11px}.path-hop-list{display:grid;grid-template-columns:1fr;width:100%}.path-hop-list button{width:100%;font-size:11px}.active-hop{padding:18px 14px}.active-hop h4{font-size:20px}.active-hop dl>div{grid-template-columns:1fr;gap:6px;font-size:11px}.external-boundary{padding:20px}.external-boundary dl{grid-template-columns:1fr;gap:15px}.external-boundary dl>div{border-top:1px solid var(--theme-border, #d5deca);padding-top:13px}.external-boundary dd{margin-top:7px;font-size:15px}.external-boundary dd span{display:inline;margin-left:9px}.provenance-facts>div{grid-template-columns:1fr;gap:7px;font-size:11px;padding:14px 0}.primary-sources li{font-size:11px}.reading-next{flex-direction:column;align-items:stretch;padding:21px;gap:10px}.reading-next a{text-align:center;font-size:11px}}
@media(prefers-reduced-motion:reduce){.reading-page *{scroll-behavior:auto!important}}
</style>
