<script setup lang="ts">
import { defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ExperimentPage from './App.vue'
import { useTheme } from './theme'
import { activeHint } from './terms/activeHint'

const { preference: themePreference, changeTheme } = useTheme()

type Page = 'experiment' | 'lesson' | 'guided' | 'reading' | 'assumptions' | 'atlas'
const lessonPath = '/ogren/norondan-devreye'
const guidedPath = '/ogren/rehberli-deneyler'
const readingPath = '/ogren/devreyi-okumak'
const assumptionsPath = '/ogren/gercek-veri-ve-varsayimlar'
const atlasPath = '/ogren/turler-atlasi'
const originalTitle = document.title
const pageTitles: Record<Page, string> = {
  experiment: 'Circuitiary · Devre deneyleri',
  lesson: 'Nörondan devreye · Circuitiary',
  guided: 'Rehberli deneyler · Circuitiary',
  reading: 'Devreyi okumak · Circuitiary',
  assumptions: 'Gerçek veri ve varsayımlar · Circuitiary',
  atlas: 'Türler atlası · Circuitiary',
}
const mainIds: Record<Page, string> = { experiment: 'top', lesson: 'neuron-lesson', guided: 'guided-experiments', reading: 'circuit-reading', assumptions: 'real-assumptions', atlas: 'species-atlas' }
function pageFor(pathname: string): Page {
  const path = pathname.replace(/\/$/, '')
  if (path === lessonPath) return 'lesson'
  if (path === guidedPath) return 'guided'
  if (path === readingPath) return 'reading'
  if (path === assumptionsPath) return 'assumptions'
  if (path === atlasPath) return 'atlas'
  return 'experiment'
}
const page = ref<Page>(pageFor(location.pathname))
const experimentMounted = ref(page.value === 'experiment')
const lessonMounted = ref(page.value === 'lesson')
const guidedMounted = ref(page.value === 'guided')
const readingMounted = ref(page.value === 'reading')
const assumptionsMounted = ref(page.value === 'assumptions')
const atlasMounted = ref(page.value === 'atlas')
const experimentPage = ref<InstanceType<typeof ExperimentPage>>()
const experimentRegion = ref<HTMLDivElement>()
const lessonRegion = ref<HTMLDivElement>()
const guidedRegion = ref<HTMLDivElement>()
const readingRegion = ref<HTMLDivElement>()
const assumptionsRegion = ref<HTMLDivElement>()
const atlasRegion = ref<HTMLDivElement>()
const NeuronLearningPage = defineAsyncComponent(() => import('./components/NeuronLearningPage.vue'))
const GuidedExperimentsPage = defineAsyncComponent(() => import('./components/GuidedExperimentsPage.vue'))
const CircuitReadingPage = defineAsyncComponent(() => import('./components/CircuitReadingPage.vue'))
const AssumptionsLearningPage = defineAsyncComponent(() => import('./components/AssumptionsLearningPage.vue'))
const SpeciesAtlasPage = defineAsyncComponent(() => import('./components/SpeciesAtlasPage.vue'))
let pendingFocus: { page: Page; hash: string; scroll: boolean } | undefined
let inspectionToken = 0
const handoffLoading = ref(false)
const handoffError = ref('')

function updateTitle() {
  document.title = pageTitles[page.value]
}

function completeFocus() {
  if (!pendingFocus || pendingFocus.page !== page.value) return
  const region = page.value === 'experiment' ? experimentRegion.value : page.value === 'lesson' ? lessonRegion.value : page.value === 'guided' ? guidedRegion.value : page.value === 'reading' ? readingRegion.value : page.value === 'assumptions' ? assumptionsRegion.value : atlasRegion.value
  if (!region) return
  region.querySelector('main')?.setAttribute('tabindex', '-1')
  if ((page.value === 'reading' || page.value === 'assumptions') && pendingFocus.hash !== location.hash) {
    pendingFocus.hash = location.hash
    pendingFocus.scroll = Boolean(location.hash)
  }
  let id = ''
  try { id = decodeURIComponent(pendingFocus.hash.slice(1)) } catch { /* A malformed fragment falls back to the heading. */ }
  const fragment = id ? document.getElementById(id) : null
  // Local anatomy data changes the height above deep lesson fragments.
  // Complete their requested scroll after the first load has settled.
  if (id && (page.value === 'reading' || page.value === 'assumptions') && region.querySelector(`#${mainIds[page.value]}`)?.getAttribute('data-data-state') === 'loading') return
  const target = fragment && region.contains(fragment) ? fragment : region.querySelector('h1')
  if (!(target instanceof HTMLElement)) return
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  if (pendingFocus.scroll) {
    if (fragment && region.contains(fragment)) target.scrollIntoView({ block: 'start', behavior: 'auto' })
    else window.scrollTo({ top: 0, behavior: 'auto' })
  }
  pendingFocus = undefined
}

function showPage(url: URL, scroll: boolean) {
  activeHint.value = null
  inspectionToken++
  handoffError.value = ''
  page.value = pageFor(url.pathname)
  if (page.value === 'experiment') experimentMounted.value = true
  else if (page.value === 'lesson') lessonMounted.value = true
  else if (page.value === 'guided') guidedMounted.value = true
  else if (page.value === 'reading') readingMounted.value = true
  else if (page.value === 'assumptions') assumptionsMounted.value = true
  else atlasMounted.value = true
  pendingFocus = { page: page.value, hash: url.hash, scroll }
  updateTitle()
  void nextTick(completeFocus)
}

function navigateClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || (link.target && link.target !== '_self')) return
  const url = new URL(link.href, location.href)
  if (url.origin !== location.origin || !['/', lessonPath, `${lessonPath}/`, guidedPath, `${guidedPath}/`, readingPath, `${readingPath}/`, assumptionsPath, `${assumptionsPath}/`, atlasPath, `${atlasPath}/`].includes(url.pathname)) return
  // Existing same-page anchors retain native fragment and history behavior.
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return
  event.preventDefault()
  if (url.href !== location.href) history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`)
  showPage(url, true)
}

async function inspectFromReading(request: { neuronId: string }) {
  if (handoffLoading.value) return
  const token = ++inspectionToken
  handoffLoading.value = true
  handoffError.value = ''
  try {
    experimentMounted.value = true
    await nextTick()
    const canCommit = () => page.value === 'reading' && token === inspectionToken
    if (!canCommit()) return
    const controller = experimentPage.value
    if (!controller) throw new Error('Experiment view not ready')
    const outcome = await controller.inspectAnatomicalNeuron(request.neuronId, canCommit)
    if (!canCommit() || (!outcome.ok && outcome.cancelled)) return
    if (!outcome.ok) { handoffError.value = outcome.message; return }
    const url = new URL(`/#graph-panel-${outcome.graphView}`, location.href)
    history.pushState(null, '', `${url.pathname}${url.hash}`)
    showPage(url, true)
  } catch {
    handoffError.value = 'Devre görünümü açılamadı. Seçimin korunuyor; yeniden deneyebilirsin.'
  } finally { handoffLoading.value = false }
}

function historyChanged() {
  const url = new URL(location.href)
  if (pageFor(url.pathname) !== page.value) showPage(url, false)
  // Same-page fragment traversal stays under the browser's scroll restoration.
}

onMounted(() => {
  updateTitle()
  experimentRegion.value?.querySelector('main')?.setAttribute('tabindex', '-1')
  window.addEventListener('popstate', historyChanged)
  if (page.value !== 'experiment') {
    pendingFocus = { page: page.value, hash: location.hash, scroll: Boolean(location.hash) }
    completeFocus()
  }
})
onBeforeUnmount(() => { window.removeEventListener('popstate', historyChanged); document.title = originalTitle })
</script>

<template>
  <div class="circuitiary-shell" @click="navigateClick">
    <a class="shell-skip-link" :href="`#${mainIds[page]}`">İçeriğe geç</a>
    <nav class="section-navigation" aria-label="Öğrenme ve deneyler">
      <div class="navigation-toolbar">
        <span class="navigation-kicker" aria-hidden="true">CIRCUITIARY / KEŞFET</span>
        <label class="theme-picker" for="theme-preference">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M20.5 13.3A8.6 8.6 0 0 1 10.7 3.5a8.6 8.6 0 1 0 9.8 9.8Z" /></svg>
          <span>Tema</span>
          <select id="theme-preference" :value="themePreference" @change="changeTheme">
            <option value="system">Sistem</option>
            <option value="light">Açık</option>
            <option value="dark">Karanlık</option>
          </select>
        </label>
      </div>
      <div class="section-navigation-links">
        <a href="/" :aria-current="page === 'experiment' ? 'page' : undefined">Devre deneyleri</a>
        <a :href="lessonPath" :aria-current="page === 'lesson' ? 'page' : undefined">Nörondan devreye</a>
        <a :href="guidedPath" :aria-current="page === 'guided' ? 'page' : undefined">Rehberli deneyler</a>
        <a :href="readingPath" :aria-current="page === 'reading' ? 'page' : undefined">Devreyi okumak</a>
        <a :href="assumptionsPath" :aria-current="page === 'assumptions' ? 'page' : undefined">Gerçek veri ve varsayımlar</a>
        <a :href="atlasPath" :aria-current="page === 'atlas' ? 'page' : undefined">Türler atlası</a>
      </div>
      <p class="term-help">Noktalı altı çizili sözcüklerin anlamı ve kökeni için üzerine gel veya dokun. Klavyeyle odaklanarak da okuyabilirsin.</p>
    </nav>
    <!-- First visit mounts each view. Later visits preserve its independent state. -->
    <div v-show="page === 'experiment'" ref="experimentRegion" class="view-page">
      <ExperimentPage v-if="experimentMounted" ref="experimentPage" />
    </div>
    <div v-show="page === 'lesson'" ref="lessonRegion" class="view-page">
      <NeuronLearningPage v-if="lessonMounted" @ready="completeFocus" />
    </div>
    <div v-show="page === 'guided'" ref="guidedRegion" class="view-page">
      <GuidedExperimentsPage v-if="guidedMounted" @ready="completeFocus" />
    </div>
    <div v-show="page === 'reading'" ref="readingRegion" class="view-page">
      <CircuitReadingPage v-if="readingMounted" :handoff-loading="handoffLoading" :handoff-error="handoffError" @inspect="inspectFromReading" @ready="completeFocus" />
    </div>
    <div v-show="page === 'assumptions'" ref="assumptionsRegion" class="view-page">
      <AssumptionsLearningPage v-if="assumptionsMounted" @ready="completeFocus" />
    </div>
    <div v-show="page === 'atlas'" ref="atlasRegion" class="view-page">
      <SpeciesAtlasPage v-if="atlasMounted" @ready="completeFocus" />
    </div>
  </div>
</template>

<style scoped>
.term-help { font-size: 11px; line-height: 1.8; color: var(--muted); }
.navigation-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; }
.theme-picker { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; color: var(--muted); }
.theme-picker select { min-height: 44px; padding: 8px 10px; font-size: 12px; width: 100px; }
.section-navigation { max-width: 1320px; margin: auto; padding: 16px 44px 10px; display: flex; flex-direction: column; align-items: stretch; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--theme-border, #daddd2); }
.navigation-kicker { font-family: var(--mono); font-size: 9px; letter-spacing: 1.2px; color: var(--theme-muted, #68766e); }
.section-navigation-links { display: flex; gap: 8px; flex-wrap: wrap; }
.section-navigation a { display: inline-flex; align-items: center; min-height: 44px; padding: 9px 14px; border: 1px solid var(--theme-border, #d1d9ca); border-radius: 5px; font-size: 12px; line-height: 1.5; color: var(--theme-text, #395341); }
.section-navigation a[aria-current="page"] { background: #2c483b; color: #f7f7eb; border-color: #2c483b; }
.shell-skip-link { position: fixed; left: 16px; top: -100px; z-index: 100; padding: 14px 18px; background: var(--theme-surface, #f5f4ed); color: var(--theme-text, #263b35); border: 2px solid #b78231; border-radius: 5px; }
.shell-skip-link:focus { top: 12px; }
.view-page :deep(h1[tabindex="-1"]:focus-visible) { outline: 3px solid var(--theme-focus, #b78231); outline-offset: 8px; border-radius: 3px; }
@media (max-width: 1050px) { .section-navigation { padding-left: 28px; padding-right: 28px; } }
@media (max-width: 760px) { .section-navigation { padding: 12px 18px; align-items: start; flex-direction: column; gap: 9px; } .section-navigation-links { width: 100%; } .section-navigation a { flex: 1; justify-content: center; font-size: 11px; padding: 9px 10px; } }
</style>
