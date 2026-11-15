import { expect, test, type Page } from '@playwright/test'
import { visitStates } from './support/page-states'
import { experimentUi, navLabels, navLink } from './support/ui'

/**
 * Turkish is the default language; English is chosen with the picker or `?lang=en`
 * (src/i18n.ts, docs/i18n.md). The language changes in place, so the page-wide
 * scan below enters every audited state in Turkish, switches to English without a
 * reload and looks for text that stayed Turkish: a string that was never
 * translated, or one that was fixed in a language when it was produced.
 */
const picker = (page: Page) => page.locator('#language-preference')

/** Words with Turkish letters that are correct in English text. */
const allowedWords = new Set([
  'Türkçe', // the picker's own option, named in its language
  'française', // Académie française, a source of the glossary
  'SİNAPS', // the search text the glossary state typed, echoed in the result line
])

async function leftoverTurkish(page: Page): Promise<string[]> {
  const found = await page.evaluate(() => {
    const letters = /[ğĞşŞıİçÇöÖüÜ]/
    const word = /[\p{L}\p{M}’'-]*[ğĞşŞıİçÇöÖüÜ][\p{L}\p{M}’'-]*/gu
    // A Turkish decimal comma between digits; English digit grouping (139,255) is fine.
    const commaNumber = /(?<![\w.,])\d+,\d+(?![\w,])/g
    const hits: Array<{ where: string; word: string; text: string }> = []
    const scan = (where: string, text: string) => {
      if (letters.test(text)) for (const match of text.matchAll(word)) hits.push({ where, word: match[0], text })
      for (const match of text.matchAll(commaNumber)) if (!/^[1-9]\d{0,2},\d{3}$/.test(match[0])) hits.push({ where, word: match[0], text })
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement
      if (!element || element.closest('script, style')) continue
      // Hidden pages of the shell keep their own state and are scanned on their own route.
      if (!element.closest('option, title') && !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      if (element.closest('.view-page') && !(element.closest('.view-page') as HTMLElement).checkVisibility()) continue
      scan(element.tagName.toLowerCase() + (element.classList[0] ? `.${element.classList[0]}` : ''), node.textContent ?? '')
    }
    const attributes = ['aria-label', 'aria-valuetext', 'aria-description', 'title', 'placeholder', 'alt']
    document.querySelectorAll(attributes.map(name => `[${name}]`).join(', ')).forEach(element => {
      const region = element.closest('.view-page')
      if (region && !(region as HTMLElement).checkVisibility()) return
      for (const name of attributes) {
        const value = element.getAttribute(name)
        if (value) scan(`[${name}]`, value)
      }
    })
    scan('document.title', document.title)
    return hits
  })
  const excerpt = (hit: { word: string; text: string }) => {
    const at = hit.text.indexOf(hit.word)
    return hit.text.slice(Math.max(0, at - 30), at + hit.word.length + 30).replace(/\s+/g, ' ')
  }
  return [...new Set(found.filter(hit => !allowedWords.has(hit.word)).map(hit => `${hit.where}: “${hit.word}” in “${excerpt(hit)}”`))]
}

test('the app opens in Turkish whatever the browser language is', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(picker(page)).toHaveValue('tr')
  await expect(page.getByRole('combobox', { name: 'Dil', exact: true })).toBeVisible()
  await expect(navLink(page, navLabels.experiments)).toBeVisible()
  await expect(page).toHaveTitle('Circuitiary · Devre deneyleri')
  await context.close()
})

test('the picker changes the language in place and the choice survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.locator('#amplitude').fill('0.55')
  await page.locator('#changed-tau').fill('150')
  const before = await experimentUi(page)
  const curves = () => page.locator('.activation-chart path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))
  const curvesBefore = await curves()
  await expect(page.getByTestId('peak-baseline')).toContainText(',')

  await picker(page).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page).toHaveTitle('Circuitiary · Circuit experiments')
  await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveValue('en')
  await expect(page.getByRole('navigation', { name: 'Learning and experiments', exact: true }).getByRole('link', { name: 'Glossary', exact: true })).toBeVisible()
  // The experiment is the same experiment: controls, selection and curves are untouched.
  for (const id of ['amplitude', 'changed-tau', 'duration', 'base-tau', 'dt', 'stimulus-target', 'silenced-edge', 'changed-neuron']) {
    await expect(page.locator(`#${id}`)).toHaveValue(before.values[id]!)
  }
  expect(await curves()).toEqual(curvesBefore)
  // Numbers follow the language: a decimal point in English.
  await expect(page.getByTestId('peak-baseline')).toHaveText(/^\d\.\d{3}$/)

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(picker(page)).toHaveValue('en')
  await expect(page).toHaveTitle('Circuitiary · Circuit experiments')

  await picker(page).selectOption('tr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(navLink(page, navLabels.glossary)).toBeVisible()
  await expect(page.getByTestId('peak-baseline')).toHaveText(/^\d,\d{3}$/)
  await page.reload()
  await expect(picker(page)).toHaveValue('tr')
})

test('?lang=en opens in English, keeps a shared experiment, and the picker then drops it from the address', async ({ page }) => {
  await page.goto('/?am=0.55&lang=en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(picker(page)).toHaveValue('en')
  await expect(page.locator('#amplitude')).toHaveValue('0.55')
  // The language key is not part of a shared experiment: nothing is reported as ignored.
  await expect(page.getByTestId('share-notice')).not.toContainText(/ignored|yok sayılan/)
  // Later pages of the same visit stay English, and so does the next visit.
  await page.getByRole('link', { name: 'Glossary', exact: true }).click()
  await expect(page).toHaveTitle('Glossary · Circuitiary')
  await page.goto('/')
  await expect(picker(page)).toHaveValue('en')
  await page.goto('/?am=0.55&lang=en')
  await picker(page).selectOption('tr')
  expect(new URL(page.url()).searchParams.has('lang')).toBe(false)
  expect(new URL(page.url()).searchParams.get('am')).toBe('0.55')
  await page.reload()
  await expect(picker(page)).toHaveValue('tr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
})

test('an unsupported ?lang= value is ignored', async ({ page }) => {
  await page.goto('/?lang=de')
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(picker(page)).toHaveValue('tr')
})

test('every page and state is fully English after an in-place switch, and Turkish again after switching back', async ({ page }) => {
  test.setTimeout(300_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const found: Record<string, string[]> = {}
  await visitStates(page, async label => {
    const turkishTitle = await page.title()
    await picker(page).selectOption('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.evaluate(() => document.querySelectorAll('details').forEach(details => { details.open = true }))
    const hits = await leftoverTurkish(page)
    if (hits.length) found[label] = hits
    // Back to Turkish for the next state, whose steps look elements up by Turkish names.
    await picker(page).selectOption('tr')
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
    await expect(page).toHaveTitle(turkishTitle)
  })
  expect(found).toEqual({})
})

test('the language picker fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/')
  await expect(picker(page)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await picker(page).selectOption('en')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const box = await picker(page).boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
})
