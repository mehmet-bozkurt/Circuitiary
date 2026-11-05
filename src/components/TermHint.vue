<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import type { GlossaryTerm } from '../terms/glossary'
import { activeHint } from '../terms/activeHint'

const props = defineProps<{ term: GlossaryTerm; label: string }>()
const id = `term-${useId()}`
const wrapper = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()
const open = computed(() => activeHint.value === id)
const position = ref({ left: '12px', top: '12px', visibility: 'hidden' as 'hidden' | 'visible' })
let pinned = false
let restoringFocus = false
let closeTimer: ReturnType<typeof setTimeout> | undefined

function clearClose() { if (closeTimer) clearTimeout(closeTimer); closeTimer = undefined }
function show() {
  clearClose()
  if (restoringFocus) return
  if (!open.value) { pinned = false; position.value.visibility = 'hidden'; activeHint.value = id }
}
function close(restoreFocus = false) {
  clearClose()
  pinned = false
  if (!open.value) return
  activeHint.value = null
  if (restoreFocus) {
    restoringFocus = true
    trigger.value?.focus({ preventScroll: true })
    restoringFocus = false
  }
}
function toggle() {
  if (open.value && pinned) close()
  else { show(); pinned = true }
}
function leave() {
  clearClose()
  closeTimer = setTimeout(() => {
    if (!pinned && !wrapper.value?.contains(document.activeElement)) close()
  }, 200)
}
function focusOut(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && wrapper.value?.contains(event.relatedTarget)) return
  pinned = false
  leave()
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !wrapper.value?.contains(event.target)) close()
}
function escape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  close(Boolean(panel.value?.contains(document.activeElement)))
}
function place() {
  if (!open.value || !trigger.value || !panel.value) return
  const anchor = trigger.value.getBoundingClientRect()
  if (anchor.bottom < 0 || anchor.top > innerHeight) { close(); return }
  const rect = panel.value.getBoundingClientRect()
  const margin = 12
  const below = anchor.bottom + 10
  const top = below + rect.height <= innerHeight - margin ? below : Math.max(margin, anchor.top - rect.height - 10)
  position.value = {
    left: `${Math.max(margin, Math.min(anchor.left, innerWidth - rect.width - margin))}px`,
    top: `${Math.max(margin, Math.min(top, innerHeight - rect.height - margin))}px`,
    visibility: 'visible',
  }
}
function scrollChanged(event: Event) {
  if (event.target instanceof Node && panel.value?.contains(event.target)) return
  place()
}
function removeListeners() {
  document.removeEventListener('pointerdown', outside, true)
  document.removeEventListener('keydown', escape, true)
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', scrollChanged, true)
}
watch(open, async visible => {
  removeListeners()
  if (!visible) { clearClose(); pinned = false; return }
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('keydown', escape, true)
  window.addEventListener('resize', place)
  window.addEventListener('scroll', scrollChanged, true)
  await nextTick()
  place()
})
watch(() => props.label, () => close())
onBeforeUnmount(() => { close(); clearClose(); removeListeners() })
</script>

<template>
  <span ref="wrapper" class="term-hint" @pointerenter="event => { if (event.pointerType === 'mouse') show() }" @pointerleave="leave" @focusout="focusOut">
    <button ref="trigger" type="button" class="term-trigger" :data-term="term.id" aria-haspopup="dialog" :aria-expanded="open" :aria-controls="open ? id : undefined" @focus="show" @click.stop="toggle" @keydown.arrow-down.prevent="panel?.querySelector<HTMLButtonElement>('button')?.focus()">{{ label }}</button>
    <span v-if="open" :id="id" ref="panel" class="term-popover" role="dialog" :aria-labelledby="`${id}-title`" :style="position" @pointerenter="clearClose" @click.stop>
      <span class="term-popover-kicker">SÖZCÜĞÜ TANI</span>
      <span :id="`${id}-title`" class="term-popover-title">{{ term.title }}</span>
      <button type="button" class="term-close" aria-label="Terim açıklamasını kapat" @click="close(true)">×</button>
      <span class="term-popover-section"><strong>Anlamı</strong><span>{{ term.meaning }}</span></span>
      <span class="term-popover-section"><strong>Sözcük kökeni</strong><span>{{ term.origin }}</span></span>
      <span v-if="term.context" class="term-popover-section"><strong>Projede</strong><span>{{ term.context }}</span></span>
      <span class="term-sources"><strong>Kaynaklar</strong><a v-for="source in term.sources" :key="source.url" class="term-source-link" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.title }} <span aria-hidden="true">↗</span></a></span>
    </span>
  </span>
</template>

<style scoped>
.term-hint { display: inline; }
.term-trigger { all: unset; display: inline; font: inherit; color: inherit; cursor: help; text-decoration: underline dotted; text-decoration-color: var(--theme-muted, #68766e); text-underline-offset: .2em; border-radius: 2px; }
.term-trigger:hover, .term-trigger[aria-expanded="true"] { text-decoration-style: solid; }
.term-trigger:focus-visible { outline: 2px solid var(--theme-focus, #b78231); outline-offset: 3px; }
.term-popover { position: fixed; z-index: 1000; display: block; width: min(370px, calc(100vw - 24px)); max-height: min(510px, calc(100dvh - 24px)); overflow-y: auto; overscroll-behavior: contain; padding: 22px; border: 1px solid var(--theme-border, #bdc9b6); border-radius: 10px; background: var(--theme-surface, #fafbf5); color: var(--theme-text, #263b35); box-shadow: 0 12px 44px #0003; font: 13px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: normal; text-transform: none; white-space: normal; text-align: left; cursor: auto; }
.term-popover-kicker { display: block; font: 9px/1.7 var(--mono); letter-spacing: 1.2px; color: var(--muted); padding-right: 28px; }
.term-popover-title { display: block; font: 400 26px/1.3 var(--serif); margin: 7px 30px 18px 0; color: var(--green); }
.term-close { position: absolute; top: 12px; right: 12px; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; border: 1px solid var(--line); border-radius: 5px; background: transparent; color: var(--green); font: 24px/1 sans-serif; cursor: pointer; }
.term-popover-section { display: block; margin-top: 13px; }
.term-popover-section > strong, .term-sources > strong { display: block; font: 600 11px/1.8 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin-bottom: 4px; color: var(--green); }
.term-popover-section > span { display: block; color: var(--muted); font-size: 12px; }
.term-sources { display: block; border-top: 1px solid var(--line); padding-top: 13px; margin-top: 16px; }
.term-sources .term-source-link { display: block; padding: 5px 0; color: var(--green); text-decoration: underline; text-underline-offset: 3px; font: 11px/1.8 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overflow-wrap: anywhere; border: 0; background: transparent; }
@media (max-width: 760px) { .term-popover { padding: 19px; } .term-close { width: 40px; height: 40px; } .term-sources .term-source-link { min-height: 36px; } }
</style>
