import { describe, expect, it } from 'vitest'
import {
  SHORTCUT_STEP_MS, attachShortcuts, describeFocus, focusKeepsKeys, shortcutAction, stepTime,
  type FocusInfo, type FocusSource, type ShortcutAction, type ShortcutInput,
} from './useExperimentShortcuts'

const bodyFocus: FocusInfo = { tag: 'body', role: null, editable: false, insideDialog: false, tabStop: false }
const press = (key: string, extra: Partial<ShortcutInput> = {}): ShortcutAction | null =>
  shortcutAction({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false, defaultPrevented: false, suspended: false, focus: bodyFocus, ...extra })
const focused = (extra: Partial<FocusInfo>): FocusInfo => ({ ...bodyFocus, ...extra })

describe('shortcutAction: keys on the page body', () => {
  it('maps the four shortcut keys', () => {
    expect(press(' ')).toBe('toggle-playback')
    expect(press('ArrowLeft')).toBe('step-back')
    expect(press('ArrowRight')).toBe('step-forward')
    expect(press('Home')).toBe('to-start')
  })

  it('leaves every other key alone', () => {
    for (const key of ['End', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab', 'a', 'A', 'p', 'k', 'PageUp', 'Spacebar', 'Space', 'constructor', '__proto__', 'toString', '']) {
      expect(press(key), key).toBeNull()
    }
  })

  it('works for a heading or the page region that took focus after navigation (tabindex -1)', () => {
    expect(press('Home', { focus: focused({ tag: 'h1' }) })).toBe('to-start')
    expect(press(' ', { focus: focused({ tag: 'main' }) })).toBe('toggle-playback')
  })

  it('ignores a held Space but accepts repeated arrows so the cursor can be scrubbed', () => {
    expect(press(' ', { repeat: true })).toBeNull()
    expect(press('ArrowRight', { repeat: true })).toBe('step-forward')
    expect(press('ArrowLeft', { repeat: true })).toBe('step-back')
  })
})

describe('shortcutAction: when the page must not react', () => {
  const keys = [' ', 'ArrowLeft', 'ArrowRight', 'Home']

  it('does nothing while the experiment page is hidden behind another lesson page', () => {
    for (const key of keys) expect(press(key, { suspended: true }), key).toBeNull()
  })

  it('does nothing with Ctrl, Meta, Alt or Shift, each on its own', () => {
    for (const key of keys) {
      for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey'] as const) expect(press(key, { [modifier]: true }), `${modifier}+${key}`).toBeNull()
    }
  })

  it('does nothing for a key another handler took or an input method composition', () => {
    for (const key of keys) {
      expect(press(key, { defaultPrevented: true }), key).toBeNull()
      expect(press(key, { isComposing: true }), key).toBeNull()
    }
  })

  it.each([
    ['input', { tag: 'input' }], ['select', { tag: 'select' }], ['textarea', { tag: 'textarea' }], ['button', { tag: 'button' }],
    ['link', { tag: 'a' }], ['details summary', { tag: 'summary' }], ['dialog element', { tag: 'dialog' }], ['option', { tag: 'option' }],
    ['slider role', { tag: 'div', role: 'slider' }], ['button role', { tag: 'span', role: 'button' }], ['link role', { tag: 'span', role: 'link' }],
    ['tab role', { tag: 'button', role: 'tab' }], ['checkbox role', { tag: 'div', role: 'checkbox' }], ['combobox role', { tag: 'div', role: 'combobox' }],
    ['textbox role', { tag: 'div', role: 'textbox' }], ['spinbutton role', { tag: 'div', role: 'spinbutton' }], ['dialog role', { tag: 'span', role: 'dialog' }],
    ['alertdialog role', { tag: 'div', role: 'alertdialog' }], ['contenteditable', { tag: 'div', editable: true }],
    ['inside a dialog', { tag: 'span', insideDialog: true }], ['explicit tab stop', { tag: 'div', tabStop: true }],
  ] satisfies Array<[string, Partial<FocusInfo>]>)('does nothing while focus is on %s', (_name, extra) => {
    for (const key of keys) expect(press(key, { focus: focused(extra) }), key).toBeNull()
  })

  it('does not treat a harmless role or tag as a control', () => {
    for (const extra of [{ tag: 'div', role: 'region' }, { tag: 'section', role: 'status' }, { tag: 'main', role: 'main' }, { tag: 'canvas' }]) {
      expect(focusKeepsKeys(focused(extra)), JSON.stringify(extra)).toBe(false)
    }
  })
})

describe('stepTime', () => {
  it('moves one step from a grid time', () => {
    expect(stepTime(250, 1, 700)).toBe(260)
    expect(stepTime(250, -1, 700)).toBe(240)
    expect(SHORTCUT_STEP_MS).toBe(10)
  })

  it('snaps an off-grid time (a paused playback position) to the next grid time in the key direction', () => {
    expect(stepTime(253.7, 1, 700)).toBe(260)
    expect(stepTime(253.7, -1, 700)).toBe(250)
    expect(stepTime(250.0000000001, 1, 700)).toBe(260)
    expect(stepTime(249.9999999999, -1, 700)).toBe(240)
  })

  it('stays inside 0 to the end of the recording', () => {
    expect(stepTime(0, -1, 700)).toBe(0)
    expect(stepTime(5, -1, 700)).toBe(0)
    expect(stepTime(700, 1, 700)).toBe(700)
    expect(stepTime(695, 1, 700)).toBe(700)
    expect(stepTime(70, 1, 75)).toBe(75)
  })

  it('accepts another step size', () => {
    expect(stepTime(250, 1, 700, 50)).toBe(300)
    expect(stepTime(250, -1, 700, 50)).toBe(200)
  })
})

describe('describeFocus', () => {
  const element = (tagName: string, attributes: Record<string, string> = {}, extra: Partial<FocusSource> = {}, inDialog = false): FocusSource => ({
    tagName, getAttribute: name => attributes[name] ?? null, closest: () => inDialog ? {} : null, ...extra,
  })

  it('reads tag, role, editability, dialog ancestry and tab stops', () => {
    expect(describeFocus(element('BUTTON'))).toEqual({ tag: 'button', role: null, editable: false, insideDialog: false, tabStop: false })
    expect(describeFocus(element('DIV', { role: ' Slider extra ' })).role).toBe('slider')
    expect(describeFocus(element('DIV', { role: '' })).role).toBeNull()
    expect(describeFocus(element('SPAN', {}, {}, true)).insideDialog).toBe(true)
  })

  it('detects contenteditable by property or attribute, but not contenteditable="false"', () => {
    expect(describeFocus(element('DIV', {}, { isContentEditable: true })).editable).toBe(true)
    expect(describeFocus(element('DIV', { contenteditable: '' })).editable).toBe(true)
    expect(describeFocus(element('DIV', { contenteditable: 'plaintext-only' })).editable).toBe(true)
    expect(describeFocus(element('DIV', { contenteditable: 'false' })).editable).toBe(false)
  })

  it('counts tabindex 0 and above as a tab stop, not -1, empty or junk', () => {
    expect(describeFocus(element('DIV', { tabindex: '0' })).tabStop).toBe(true)
    expect(describeFocus(element('DIV', { tabindex: '3' })).tabStop).toBe(true)
    expect(describeFocus(element('H1', { tabindex: '-1' })).tabStop).toBe(false)
    expect(describeFocus(element('DIV', { tabindex: '' })).tabStop).toBe(false)
    expect(describeFocus(element('DIV', { tabindex: 'abc' })).tabStop).toBe(false)
  })

  it('treats a non-element target (document, window, nothing) as the page body', () => {
    for (const target of [null, undefined, {}, new EventTarget(), 'body']) expect(describeFocus(target)).toEqual(bodyFocus)
  })
})

describe('attachShortcuts', () => {
  const keydown = (target: EventTarget, key: string, extra: Record<string, unknown> = {}) => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false }, extra)
    target.dispatchEvent(event)
    return event
  }

  it('adds exactly one keydown listener and removes that same listener', () => {
    const added: Array<[string, unknown]> = []
    const removed: Array<[string, unknown]> = []
    const detach = attachShortcuts({
      addEventListener: (type, listener) => { added.push([type, listener]) },
      removeEventListener: (type, listener) => { removed.push([type, listener]) },
    }, { suspended: () => false, onAction: () => {} })
    expect(added).toHaveLength(1)
    expect(added[0]![0]).toBe('keydown')
    expect(removed).toHaveLength(0)
    detach()
    expect(removed).toEqual(added)
  })

  it('runs the action and cancels the key default, then stops after detaching', () => {
    const target = new EventTarget()
    const seen: ShortcutAction[] = []
    const detach = attachShortcuts(target, { suspended: () => false, onAction: action => seen.push(action) })
    expect(keydown(target, ' ').defaultPrevented).toBe(true)
    keydown(target, 'ArrowRight')
    keydown(target, 'ArrowLeft')
    keydown(target, 'Home')
    expect(seen).toEqual(['toggle-playback', 'step-forward', 'step-back', 'to-start'])
    detach()
    expect(keydown(target, ' ').defaultPrevented).toBe(false)
    expect(seen).toHaveLength(4)
  })

  it('leaves ignored keys untouched: no action, default not cancelled', () => {
    const target = new EventTarget()
    const seen: ShortcutAction[] = []
    let suspended = true
    attachShortcuts(target, { suspended: () => suspended, onAction: action => seen.push(action) })
    expect(keydown(target, ' ').defaultPrevented).toBe(false)
    suspended = false
    expect(keydown(target, ' ', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(keydown(target, 'Enter').defaultPrevented).toBe(false)
    expect(seen).toEqual([])
    expect(keydown(target, 'Home').defaultPrevented).toBe(true)
    expect(seen).toEqual(['to-start'])
  })
})
