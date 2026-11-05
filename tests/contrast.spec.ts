import { expect, test, type Page } from '@playwright/test'
import { visitStates } from './support/page-states'

interface LowContrast { text: string; element: string; color: string; background: string; ratio: number; fontSize: number }

/**
 * WCAG 2.2 AA text contrast of every rendered text node, including decorative
 * aria-hidden text that is still visible. Disabled controls are exempt. The
 * background is composited through translucent ancestors and the text alpha
 * includes ancestor opacity; SVG text size is measured as drawn on screen.
 */
async function lowContrastText(page: Page): Promise<LowContrast[]> {
  return page.evaluate(() => {
    type Rgba = [number, number, number, number]
    const parse = (value: string): Rgba | null => {
      const match = value.match(/^rgba?\(([^)]+)\)$/)
      if (!match) return null
      const parts = match[1]!.split(/[\s,/]+/).filter(Boolean).map(Number)
      return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1]
    }
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      const alpha = top[3] + bottom[3] * (1 - top[3])
      if (alpha === 0) return [0, 0, 0, 0]
      const mix = (index: number) => (top[index]! * top[3] + bottom[index]! * bottom[3] * (1 - top[3])) / alpha
      return [mix(0), mix(1), mix(2), alpha]
    }
    const luminance = ([r, g, b]: Rgba) => {
      const channel = (value: number) => { const s = value / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const background = (element: Element): Rgba => {
      const layers: Rgba[] = []
      for (let node: Element | null = element; node; node = node.parentElement) {
        const color = parse(getComputedStyle(node).backgroundColor)
        if (color && color[3] > 0) layers.push(color)
        if (color && color[3] === 1) break
      }
      return layers.reduceRight<Rgba>((below, layer) => over(layer, below), [255, 255, 255, 1])
    }
    const opacity = (element: Element) => {
      let product = 1
      for (let node: Element | null = element; node; node = node.parentElement) product *= Number(getComputedStyle(node).opacity)
      return product
    }
    const hex = ([r, g, b]: Rgba) => `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`
    const found = new Map<string, LowContrast>()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim()
      const element = node.parentElement
      if (!text || !element || element.closest('script, style, [disabled], [aria-disabled="true"]')) continue
      if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const box = range.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) continue
      const style = getComputedStyle(element)
      const foreground = parse(element instanceof SVGElement ? style.fill : style.color)
      if (!foreground) continue
      foreground[3] *= opacity(element)
      const behind = background(element)
      const painted = over(foreground, behind)
      const [lighter, darker] = [luminance(painted), luminance(behind)].sort((a, b) => b - a)
      const ratio = (lighter! + 0.05) / (darker! + 0.05)
      const scale = element instanceof SVGGraphicsElement ? Math.abs(element.getScreenCTM()?.a ?? 1) : 1
      const fontSize = parseFloat(style.fontSize) * scale
      const large = fontSize >= 24 || (fontSize >= 18.66 && Number(style.fontWeight) >= 700)
      if (ratio >= (large ? 3 : 4.5)) continue
      const name = `${element.tagName.toLowerCase()}${element.classList.length ? '.' + [...element.classList].join('.') : ''}`
      const key = `${name}|${hex(painted)}|${hex(behind)}`
      if (!found.has(key)) found.set(key, { text: text.slice(0, 40), element: name, color: hex(painted), background: hex(behind), ratio: Math.round(ratio * 100) / 100, fontSize: Math.round(fontSize * 10) / 10 })
    }
    return [...found.values()]
  })
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`all rendered text meets WCAG AA contrast in the ${colorScheme} theme`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    const failures: Record<string, LowContrast[]> = {}
    await visitStates(page, async label => {
      const low = await lowContrastText(page)
      if (low.length) failures[label] = low
    })
    expect(failures).toEqual({})
  })
}
