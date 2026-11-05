import { expect, test, type Page } from '@playwright/test'
import { visitStates } from './support/page-states'

/**
 * The interface is Turkish, so every number shown to the learner uses a decimal
 * comma. A dot is correct inside identifiers, versions, DOIs and licences; those
 * are listed below. Machine-readable data-* attributes and SVG path data are not
 * scanned: only visible text and accessible names (aria-label, aria-valuetext,
 * title). A range input whose native value has a decimal point must also carry an
 * aria-valuetext, because assistive technology otherwise announces the dotted value.
 */
const allowedContexts: RegExp[] = [
  /CC BY(?:-SA|-NC)? \d\.\d/,
  // The FlyWire connectivity-archive version is a dotted identifier in the source record.
  /\d+\.\d+ bağlantı arşivi/,
  /bağlantı arşivi \d+\.\d+/,
]

interface Hit { where: string; text: string; start: number; end: number }

async function dottedDecimals(page: Page): Promise<string[]> {
  const hits = await page.evaluate(() => {
    // A decimal point between digits that is not part of a longer identifier, version
    // or path. Exponent notation (1.2340e-5) still counts as a decimal.
    const decimal = /(?<![\w./:#-])[+−-]?\d+\.\d+(?!(?![eE][+−-]?\d)[\w/:-]|\.\d)/g
    const found: Array<{ where: string; text: string; start: number; end: number }> = []
    const scan = (where: string, text: string) => {
      for (const match of text.matchAll(decimal)) {
        // Turkish digit grouping (139.255 = 139255): a non-zero integer part with exactly three digits after the dot.
        if (/^[1-9]\d{0,2}\.\d{3}$/.test(match[0])) continue
        found.push({ where, text, start: match.index!, end: match.index! + match[0].length })
      }
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement
      if (!element || element.closest('script, style') || !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      scan(element.tagName.toLowerCase() + (element.classList[0] ? `.${element.classList[0]}` : ''), node.textContent ?? '')
    }
    document.querySelectorAll('[aria-label], [aria-valuetext], [title]').forEach(element => {
      for (const attribute of ['aria-label', 'aria-valuetext', 'title']) {
        const value = element.getAttribute(attribute)
        if (value) scan(`[${attribute}]`, value)
      }
    })
    document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(input => {
      if (input.value.includes('.') && !input.hasAttribute('aria-valuetext')) {
        found.push({ where: 'input[type=range] without aria-valuetext', text: input.id || input.getAttribute('aria-label') || input.value, start: 0, end: 0 })
      }
    })
    return found
  })
  // An allowed pattern must cover the dotted number itself, not merely appear near it.
  const covered = (hit: Hit) => allowedContexts.some(allowed => [...hit.text.matchAll(new RegExp(allowed.source, 'g'))].some(context => context.index! <= hit.start && context.index! + context[0].length >= hit.end))
  const excerpt = (hit: Hit) => hit.text.slice(Math.max(0, hit.start - 28), hit.end + 16).replace(/\s+/g, ' ')
  return [...new Set(hits.filter(hit => !covered(hit)).map(hit => `${hit.where}: ${excerpt(hit)}`))]
}

test('shown numbers use the Turkish decimal comma on every page and state', async ({ page }) => {
  test.setTimeout(180_000)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  const found: Record<string, string[]> = {}
  await visitStates(page, async label => {
    const hits = await dottedDecimals(page)
    if (hits.length) found[label] = hits
  })
  expect(found).toEqual({})
})
