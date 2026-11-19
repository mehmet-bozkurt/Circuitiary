import { expect, type Locator, type Page } from '@playwright/test'
import { main } from './ui'

/** Locators and steps shared by the builder's motif, save/load and prediction specs. */
export const builderPath = '/ogren/devre-kur'
export const DRAFT_STORAGE_KEY = 'circuitiary-builder-draft'

const browserErrors = new WeakMap<Page, string[]>()
/** Opens the builder and records page errors; `expectNoBrowserErrors` checks them afterwards. */
export async function openBuilder(page: Page) {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(builderPath)
  await expect(main(page)).toHaveAttribute('id', 'circuit-builder')
}
export const expectNoBrowserErrors = (page: Page) =>
  expect(browserErrors.get(page) ?? [], 'The builder must not log browser exceptions or console errors').toEqual([])

export const runButton = (page: Page) => main(page).getByTestId('builder-run')
export const resetButton = (page: Page) => main(page).getByTestId('builder-reset')
export const addLink = (page: Page) => main(page).locator('#builder-add-link')
export const linkRows = (page: Page) => main(page).locator('li[data-testid^="builder-link-"]')
export const cellCount = (page: Page) => main(page).locator('#builder-cell-count')
export const stimulusTarget = (page: Page) => main(page).locator('#builder-stim-target')
export const status = (page: Page) => main(page).getByTestId('builder-status')
export const result = (page: Page) => main(page).getByTestId('builder-result')
export const card = (page: Page, id: string) => main(page).locator(`li[data-motif="${id}"]`)
export const loadMotif = (page: Page, id: string) => main(page).locator(`button[data-preset="${id}"]`)
export const removeLink = (page: Page, link: number) => linkRows(page).nth(link - 1).locator('button[id$="-remove"]')
export const strength = (page: Page, link: number) => linkRows(page).nth(link - 1).locator('input[type="range"]')
export const language = (page: Page) => page.locator('#language-preference')

export async function metric(page: Page, kind: 'peak' | 'peak-time' | 'reach' | 'final', id: string): Promise<number | null> {
  const raw = await main(page).getByTestId(`builder-${kind}-${id}`).getAttribute('data-value')
  return raw === 'null' ? null : Number(raw)
}
export async function setRange(slider: Locator, value: number) {
  await slider.fill(String(value))
  await expect(slider).toHaveValue(String(value))
}
export async function run(page: Page) {
  await expect(runButton(page)).toBeEnabled()
  await runButton(page).click()
  await expect(result(page)).toHaveAttribute('data-stale', 'false')
}
/** What the builder's controls hold right now: compared before and after something that must not change the circuit. */
export async function circuitOnPage(page: Page) {
  return {
    cells: await cellCount(page).inputValue(),
    target: await stimulusTarget(page).inputValue(),
    amplitude: await main(page).locator('#builder-amplitude').inputValue(),
    onset: await main(page).locator('#builder-onset').inputValue(),
    pulse: await main(page).locator('#builder-pulse').inputValue(),
    links: await linkRows(page).evaluateAll(rows => rows.map(row => [
      row.getAttribute('data-type'),
      ...[...row.querySelectorAll('select')].slice(1).map(select => select.value),
      row.querySelector<HTMLInputElement>('input[type="range"]')!.value,
    ].join(' '))),
  }
}
export const storedDraft = (page: Page) => page.evaluate(key => localStorage.getItem(key), DRAFT_STORAGE_KEY)
