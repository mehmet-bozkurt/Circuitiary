<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { glossaryAlphabetical, termAnchorId, type GlossaryTerm } from '../terms/glossary'
import { foldTurkish, resultsMessage, searchGlossary, termIdFromHash } from '../terms/glossarySearch'

const emit = defineEmits<{ ready: [] }>()
const query = ref('')
const root = ref<HTMLElement>()
const searchInput = ref<HTMLInputElement>()
const results = computed(() => searchGlossary(glossaryAlphabetical, query.value))
const status = computed(() => resultsMessage(query.value, results.value.length, glossaryAlphabetical.length))
// Aliases that only repeat the title are not shown; the others explain why a search found the term.
const otherForms = (term: GlossaryTerm) => term.aliases.filter(alias => foldTurkish(alias) !== foldTurkish(term.title))

function clearSearch() {
  query.value = ''
  searchInput.value?.focus()
}

// A fragment that points at a term hidden by the search clears the search first, then lands on the term.
async function revealHashTerm() {
  const id = termIdFromHash(location.hash)
  if (!id || results.value.some(term => term.id === id)) return
  query.value = ''
  await nextTick()
  const target = document.getElementById(termAnchorId(id))
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({ block: 'start', behavior: 'auto' })
}

// The page stays mounted while another page is open, so an in-app link (no hashchange) can arrive with an old search still in place.
// Showing the page again counts as arriving.
let shown: IntersectionObserver | undefined
window.addEventListener('hashchange', revealHashTerm)
onBeforeUnmount(() => { window.removeEventListener('hashchange', revealHashTerm); shown?.disconnect() })
onMounted(async () => {
  if (root.value && 'IntersectionObserver' in window) {
    shown = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void revealHashTerm() })
    shown.observe(root.value)
  }
  await nextTick()
  emit('ready')
})
</script>

<template>
  <main id="glossary-page" ref="root" tabindex="-1" class="glossary-page">
    <header class="glossary-intro">
      <p class="glossary-eyebrow">CIRCUITIARY / SÖZLÜK</p>
      <h1>Sözlük</h1>
      <p class="glossary-summary">Derslerde ve devre ekranında noktalı altı çizili görünen sözcüklerin hepsi burada. Her sözcük için kısa anlamını, adının hangi eski sözcüğe dayandığını ve bunları nereden özetlediğimizi oku.</p>
    </header>
    <div class="glossary-boundary">
      <strong>Bu sözlük bir öğrenme notudur, bilimsel bir tanım kaynağı değil.</strong>
      <p>Anlamlar ve kökenler her sözcüğün altındaki kaynaklardan özetlenmiştir. Köken, sözcüğün tarihini anlatır; sözcüğün Türkçeye hangi dilden ve hangi yoldan girdiğini iddia etmez. “Bu projede” notları ise Circuitiary’nin modelinin sınırlarını söyler, kaynakların sözü değildir. Kaynak bağlantıları yeni sekmede açılır.</p>
    </div>

    <form class="glossary-search" role="search" @submit.prevent>
      <label for="glossary-search">Sözcük ara</label>
      <div class="glossary-search-row">
        <input id="glossary-search" ref="searchInput" v-model="query" type="search" autocomplete="off" spellcheck="false" aria-describedby="glossary-search-hint glossary-status" />
        <button v-if="query" type="button" class="glossary-clear" @click="clearSearch">Aramayı temizle</button>
      </div>
      <p id="glossary-search-hint" class="glossary-hint">Sözcüğün adında, başka biçimlerinde ve anlamında aranır. Türkçe harfleri yazmasan da bulunur: “noron” yazınca Nöron da çıkar.</p>
      <p id="glossary-status" class="glossary-status" role="status" data-testid="glossary-status">{{ status }}</p>
    </form>

    <div v-if="!results.length" class="glossary-empty" data-testid="glossary-empty">
      <p>Eşleşen sözcük yok. Aramayı kısaltmayı ya da sözcüğü başka bir yazılışla yazmayı dene. Köken ve kaynak metinlerinde arama yapılmaz.</p>
      <button type="button" class="glossary-clear" @click="clearSearch">Aramayı temizle, bütün sözcükleri göster</button>
    </div>

    <ul class="glossary-list" data-testid="glossary-list">
      <li v-for="term in results" :key="term.id">
        <article :id="termAnchorId(term.id)" class="glossary-term" tabindex="-1" :data-term-id="term.id" :aria-labelledby="`${termAnchorId(term.id)}-title`">
          <div class="glossary-term-head">
            <div class="glossary-title-row">
              <h2 :id="`${termAnchorId(term.id)}-title`">{{ term.title }}</h2>
              <a class="glossary-permalink" :href="`#${termAnchorId(term.id)}`" :aria-label="`${term.title} sözcüğünün kalıcı bağlantısı`"><span aria-hidden="true">#</span></a>
            </div>
            <p v-if="otherForms(term).length" class="glossary-forms">Başka biçimler: {{ otherForms(term).join(', ') }}</p>
          </div>
          <dl class="glossary-facts">
            <div><dt>Anlamı</dt><dd>{{ term.meaning }}</dd></div>
            <div><dt>Sözcük kökeni</dt><dd>{{ term.origin }}</dd></div>
            <div v-if="term.context"><dt>Bu projede</dt><dd>{{ term.context }}</dd></div>
            <div>
              <dt>Kaynaklar</dt>
              <dd><ul class="glossary-sources"><li v-for="source in term.sources" :key="source.url"><a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.title }} <span aria-hidden="true">↗</span></a></li></ul></dd>
            </div>
          </dl>
        </article>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.glossary-page { padding-bottom: 64px; outline: none; }
.glossary-intro { padding: 51px 0 28px; }
.glossary-eyebrow { font: 10px/1.8 var(--mono, monospace); letter-spacing: 1.2px; color: var(--muted); }
.glossary-intro h1 { font: 400 59px/1.13 var(--serif, Georgia, serif); letter-spacing: -1.8px; margin: 18px 0 22px; }
.glossary-summary { font-size: 17px; line-height: 1.9; max-width: 760px; }
.glossary-boundary { border-left: 3px solid #7f9871; background: var(--theme-surface-soft, #eaf0e1); padding: 17px 21px; font-size: 13px; line-height: 1.9; max-width: 920px; }
.glossary-boundary strong { font-weight: 600; }
.glossary-boundary p { margin-top: 6px; }
.glossary-search { display: grid; gap: 10px; margin: 32px 0 0; max-width: 760px; }
.glossary-search label { font-size: 13px; font-weight: 600; }
.glossary-search-row { display: flex; gap: 10px; align-items: stretch; }
.glossary-search input { flex: 1; min-width: 0; min-height: 48px; padding: 10px 14px; border: 1px solid var(--muted); border-radius: 5px; background: var(--theme-surface, #fbfcf7); color: var(--green); font-size: 16px; }
.glossary-search input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.glossary-clear { min-height: 48px; padding: 10px 16px; border: 1px solid var(--muted); border-radius: 5px; background: var(--theme-surface-soft, #eef2e5); color: var(--green); font-size: 13px; line-height: 1.5; }
.glossary-hint, .glossary-status { font-size: 12px; line-height: 1.8; color: var(--muted); }
.glossary-status { font-size: 13px; color: var(--green); min-height: 23px; }
.glossary-empty { display: grid; justify-items: start; gap: 14px; margin-top: 20px; padding: 20px 22px; max-width: 760px; border: 1px solid var(--line); border-radius: 8px; background: var(--theme-surface-soft, #eef2e5); font-size: 14px; line-height: 1.8; }
.glossary-list { list-style: none; margin: 28px 0 0; padding: 0; }
.glossary-term { display: grid; grid-template-columns: minmax(0, .38fr) minmax(0, 1fr); gap: 12px 40px; padding: 30px 16px; border-top: 1px solid var(--line); scroll-margin-top: 24px; }
.glossary-term:target { background: var(--theme-surface-soft, #eef2e5); }
.glossary-term:focus { outline: 3px solid var(--theme-focus, #b78231); outline-offset: 2px; }
.glossary-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.glossary-term h2 { font: 400 31px/1.3 var(--serif, Georgia, serif); letter-spacing: -.6px; overflow-wrap: anywhere; }
.glossary-permalink { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; border: 1px solid var(--line); border-radius: 5px; font: 16px/1 var(--mono, monospace); color: var(--muted); }
.glossary-permalink:hover { background: var(--theme-surface-soft, #eaf0e0); color: var(--green); }
.glossary-forms { font-size: 12px; line-height: 1.8; color: var(--muted); margin-top: 6px; overflow-wrap: anywhere; }
.glossary-facts { margin: 0; min-width: 0; }
.glossary-facts > div { padding: 0 0 14px; font-size: 14px; line-height: 1.9; }
.glossary-facts > div:last-child { padding-bottom: 0; }
.glossary-facts dt { font: 600 11px/1.8 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .4px; text-transform: uppercase; color: var(--muted); }
.glossary-facts dd { margin: 0; overflow-wrap: anywhere; }
.glossary-sources { list-style: none; margin: 0; padding: 0; }
.glossary-sources a { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; font-size: 13px; text-decoration: underline; text-decoration-color: var(--muted); text-underline-offset: 3px; }
@media (max-width: 760px) {
  .glossary-intro { padding: 34px 0 22px; }
  .glossary-intro h1 { font-size: 44px; letter-spacing: -1.4px; margin: 16px 0 20px; }
  .glossary-summary { font-size: 15px; }
  .glossary-boundary { padding: 15px 17px; font-size: 12px; }
  .glossary-search-row { flex-direction: column; }
  .glossary-search-row .glossary-clear { align-self: flex-start; }
  .glossary-term { grid-template-columns: 1fr; gap: 10px; padding: 26px 10px; }
  .glossary-term h2 { font-size: 28px; }
  .glossary-facts > div { font-size: 13px; }
}
@media (prefers-reduced-motion: reduce) { .glossary-page * { scroll-behavior: auto !important; } }
</style>
