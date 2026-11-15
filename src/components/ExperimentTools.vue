<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { downloadFile } from '../exportData'
import type { ExportFile } from '../exportData'
import { useMessages } from '../i18n'
import { messages } from './ExperimentTools.messages'

const m = useMessages(messages)

// The experiment page owns the state; this panel only copies a link and hands files to the browser.
const props = defineProps<{
  url: string
  /** What happened when the page was opened from a link; empty when it was not. */
  notice: string
  conditionLabel: string
  outputCell: string
  csvFile: () => ExportFile
  jsonFile: () => ExportFile
}>()

const field = ref<HTMLInputElement>()
// Kept as a function, so the line follows a later change of language.
const status = ref<(() => string) | null>(null)

// The same sentence twice would not be announced again, so the line is cleared first.
async function announce(text: () => string) {
  status.value = null
  await nextTick()
  status.value = text
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.url)
    await announce(() => m.value.copied)
    return
  } catch { /* No clipboard permission, or an insecure address: select the field and try the old route. */ }
  const input = field.value
  if (input) {
    input.focus()
    input.select()
    input.setSelectionRange(0, props.url.length)
    try {
      if (document.execCommand('copy')) { await announce(() => m.value.copied); return }
    } catch { /* Selected text is still there for a manual copy. */ }
  }
  await announce(() => m.value.copyFailed)
}

async function save(make: () => ExportFile, kind: string) {
  try {
    const file = make()
    downloadFile(file)
    await announce(() => m.value.fileReady(kind, file.name))
  } catch {
    await announce(() => m.value.fileFailed(kind))
  }
}
</script>

<template>
  <div class="experiment-tools">
    <p class="link-notice" role="status" data-testid="share-notice">{{ notice }}</p>
    <div class="tools-heading">
      <span class="eyebrow">{{ m.kicker }}</span>
      <h2>{{ m.heading }}</h2>
    </div>
    <div class="tools-grid">
      <div class="tool-card">
        <h3>{{ m.shareTitle }}</h3>
        <p>{{ m.shareBody }}</p>
        <label class="field-label" for="share-url">{{ m.shareLabel }}</label>
        <input id="share-url" ref="field" class="share-url" type="text" readonly :value="url" data-testid="share-url" spellcheck="false" autocomplete="off" @focus="($event.target as HTMLInputElement).select()">
        <button type="button" class="tool-button primary" @click="copyLink">{{ m.copy }}</button>
        <p class="tool-note">{{ m.shareNote }}</p>
      </div>
      <div class="tool-card">
        <h3>{{ m.exportTitle }}</h3>
        <p>{{ m.exportBody }}</p>
        <div class="tool-buttons">
          <button type="button" class="tool-button" @click="save(csvFile, 'CSV')"><strong>{{ m.csv }}</strong><span>{{ m.csvHint(conditionLabel) }}</span></button>
          <button type="button" class="tool-button" @click="save(jsonFile, 'JSON')"><strong>{{ m.json }}</strong><span>{{ m.jsonHint(outputCell) }}</span></button>
        </div>
        <p class="tool-note">{{ m.exportNote }}</p>
      </div>
    </div>
    <p class="tools-status" role="status" data-testid="share-status">{{ status?.() }}</p>
  </div>
</template>

<style scoped>
.experiment-tools { margin-top: 22px; padding: 23px; border: 1px solid var(--theme-border, #daddd2); border-radius: 7px; background: var(--theme-surface-soft, #ecefe5); color: var(--theme-text, #263b35); }
.link-notice { margin-bottom: 18px; padding: 14px; border: 1px solid var(--theme-border, #bdcdbd); border-left-width: 3px; border-radius: 5px; background: var(--theme-surface, #fafbf5); font-size: 12px; line-height: 1.8; }
/* Empty live regions stay rendered (display: none would drop them from the accessibility tree, and text added later may go unannounced). */
.link-notice:empty, .tools-status:empty { height: 0; margin: 0; padding: 0; border: 0; overflow: hidden; }
.tools-heading .eyebrow { color: var(--theme-muted, #5d6962); margin-bottom: 6px; }
.tools-heading h2 { font-size: 24px; }
.tools-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 20px; }
.tool-card { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 20px; border: 1px solid var(--theme-border, #daddd2); border-radius: 9px; background: var(--theme-surface, #fafbf5); }
.tool-card h3 { margin: 0; font-family: var(--serif); font-size: 18px; font-weight: 400; }
.tool-card p { font-size: 12px; line-height: 1.8; }
.tool-card .tool-note { font-size: 11px; color: var(--theme-muted, #5d6962); margin-top: auto; }
.field-label { font-size: 11px; margin-bottom: -4px; }
.share-url { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--theme-border, #daddd2); border-radius: 5px; background: var(--theme-surface-soft, #ecefe5); color: var(--theme-text, #263b35); font-family: var(--mono); font-size: 11px; text-overflow: ellipsis; }
.tool-buttons { display: grid; gap: 10px; }
.tool-button { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-height: 44px; padding: 11px 15px; border: 1px solid var(--theme-text, #263b35); border-radius: 5px; background: transparent; color: var(--theme-text, #263b35); font-size: 12px; text-align: left; }
.tool-button strong { font-weight: 500; }
.tool-button span { font-size: 11px; color: var(--theme-muted, #5d6962); line-height: 1.6; }
.tool-button.primary { align-items: center; justify-content: center; background: var(--theme-text, #263b35); color: var(--theme-surface, #fafbf5); }
.tool-button:hover { background: var(--theme-surface-soft, #e6ebdf); }
.tool-button.primary:hover { background: var(--theme-text, #263b35); opacity: .9; }
.tools-status { margin-top: 14px; padding: 12px 14px; border-left: 3px solid var(--theme-text, #263b35); background: var(--theme-surface, #fafbf5); font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
@media (max-width: 760px) {
  .tools-grid { grid-template-columns: minmax(0, 1fr); }
  .tool-card { padding: 18px; }
}
</style>
