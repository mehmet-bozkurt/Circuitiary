import { expect, test } from '@playwright/test'
import { visitStates } from './support/page-states'

/**
 * An aria-label on an element with no role (a plain div, span or p) is not exposed
 * as its accessible name, so the label silently does nothing. Labelled wrappers
 * need a role such as group, or the label belongs on a different element.
 */
const roleless = ['div', 'span', 'p', 'b', 'i', 'em', 'strong', 'small'].map(tag => `${tag}[aria-label]:not([role])`).join(', ')

test('no aria-label sits on an element without a role on any page or state', async ({ page }) => {
  test.setTimeout(180_000)
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  const found: Record<string, string[]> = {}
  await visitStates(page, async label => {
    const hits = await page.locator(roleless).evaluateAll(elements => elements
      .filter(element => !element.closest('[aria-hidden="true"]'))
      .map(element => `${element.tagName.toLowerCase()}.${element.className}: ${element.getAttribute('aria-label')}`))
    if (hits.length) found[label] = [...new Set(hits)]
  })
  expect(found).toEqual({})
})
