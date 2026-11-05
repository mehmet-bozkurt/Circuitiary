import { onBeforeUnmount, onMounted } from 'vue'

export type ShortcutAction = 'toggle-playback' | 'step-back' | 'step-forward' | 'to-start'

/** One arrow press moves the time cursor by this many model ms, the same spacing as the chart data table rows. */
export const SHORTCUT_STEP_MS = 10

/** What is focused when a key is pressed; read from the DOM by describeFocus, decided on by shortcutAction. */
export interface FocusInfo {
  /** Lower-case tag name of the event target ('body' when nothing but the page is focused). */
  tag: string
  /** First token of the role attribute, lower case. */
  role: string | null
  editable: boolean
  insideDialog: boolean
  /** An explicit tab stop (tabindex >= 0): a custom widget or scroll region that keeps its own keys. */
  tabStop: boolean
}

export interface ShortcutInput {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  repeat: boolean
  isComposing: boolean
  defaultPrevented: boolean
  /** The experiment page is hidden behind another lesson page. */
  suspended: boolean
  focus: FocusInfo
}

const NATIVE_CONTROLS = new Set(['input', 'select', 'textarea', 'button', 'a', 'summary', 'dialog', 'option'])
const CONTROL_ROLES = new Set([
  'slider', 'button', 'link', 'tab', 'checkbox', 'radio', 'switch', 'combobox', 'listbox', 'option', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'textbox', 'searchbox', 'spinbutton', 'scrollbar', 'dialog', 'alertdialog',
])

/** True when the focused element handles these keys itself, so the page shortcuts must stay out of its way. */
export function focusKeepsKeys(focus: FocusInfo): boolean {
  return NATIVE_CONTROLS.has(focus.tag) || (focus.role !== null && CONTROL_ROLES.has(focus.role)) || focus.editable || focus.insideDialog || focus.tabStop
}

/** The single place that decides which key does what; null means the key is left alone. */
export function shortcutAction(input: ShortcutInput): ShortcutAction | null {
  if (input.suspended || input.defaultPrevented || input.isComposing) return null
  if (input.ctrlKey || input.metaKey || input.altKey || input.shiftKey) return null
  if (focusKeepsKeys(input.focus)) return null
  switch (input.key) {
    // A held Space would flip playback on and off at the key-repeat rate.
    case ' ': return input.repeat ? null : 'toggle-playback'
    case 'ArrowLeft': return 'step-back'
    case 'ArrowRight': return 'step-forward'
    case 'Home': return 'to-start'
    default: return null
  }
}

/** Next multiple of `step` in the given direction, clamped to [0, max]; an off-grid time snaps to the grid first. */
export function stepTime(current: number, direction: 1 | -1, max: number, step: number = SHORTCUT_STEP_MS): number {
  const slot = current / step
  const next = direction > 0 ? Math.floor(slot + 1e-9) + 1 : Math.ceil(slot - 1e-9) - 1
  return Math.min(max, Math.max(0, next * step))
}

/** The parts of an Element describeFocus reads; a structural type so unit tests need no DOM. */
export interface FocusSource {
  tagName: string
  isContentEditable?: boolean
  getAttribute(name: string): string | null
  closest(selector: string): unknown
}

const isFocusSource = (target: unknown): target is FocusSource =>
  typeof target === 'object' && target !== null && typeof (target as FocusSource).tagName === 'string' && typeof (target as FocusSource).closest === 'function'

export function describeFocus(target: unknown): FocusInfo {
  if (!isFocusSource(target)) return { tag: 'body', role: null, editable: false, insideDialog: false, tabStop: false }
  const tabindex = target.getAttribute('tabindex')
  const editable = target.getAttribute('contenteditable')
  return {
    tag: target.tagName.toLowerCase(),
    role: target.getAttribute('role')?.trim().split(/\s+/)[0]?.toLowerCase() || null,
    editable: target.isContentEditable === true || (editable !== null && editable.toLowerCase() !== 'false'),
    insideDialog: target.closest('dialog, [role="dialog"], [role="alertdialog"]') !== null,
    tabStop: tabindex !== null && Number.isInteger(Number(tabindex)) && tabindex.trim() !== '' && Number(tabindex) >= 0,
  }
}

export interface ShortcutOptions {
  suspended: () => boolean
  onAction: (action: ShortcutAction) => void
}

/** Adds the one keydown listener and returns the function that removes it. */
export function attachShortcuts(target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>, options: ShortcutOptions): () => void {
  const listener = (event: Event) => {
    const key = event as KeyboardEvent
    const action = shortcutAction({
      key: key.key, ctrlKey: key.ctrlKey, metaKey: key.metaKey, altKey: key.altKey, shiftKey: key.shiftKey,
      repeat: key.repeat, isComposing: key.isComposing, defaultPrevented: key.defaultPrevented,
      suspended: options.suspended(), focus: describeFocus(key.target),
    })
    if (!action) return
    key.preventDefault()
    options.onAction(action)
  }
  target.addEventListener('keydown', listener)
  return () => target.removeEventListener('keydown', listener)
}

/** Component glue: one document-level listener while the component is mounted. */
export function useExperimentShortcuts(options: ShortcutOptions): void {
  let detach: (() => void) | undefined
  onMounted(() => { detach = attachShortcuts(document, options) })
  onBeforeUnmount(() => { detach?.(); detach = undefined })
}
