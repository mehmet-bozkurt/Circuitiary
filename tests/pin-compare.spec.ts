import { expect, test, type Page } from '@playwright/test'

/**
 * Pin and compare: the curve of the condition shown is kept on the chart as a
 * record while the settings change (src/pinnedCurve.ts, PinnedComparison.vue).
 */
const curves = (page: Page) => page.locator('.activation-chart path')
const paths = (page: Page) => curves(page).evaluateAll(all => all.map(path => path.getAttribute('d')))
const pin = (page: Page) => page.getByTestId('pin-curve')
const number = async (page: Page, id: string) => Number((await page.getByTestId(id).textContent())!.replace(',', '.').replace('−', '-'))

test('a pinned curve stays as it was while a setting changes, and the difference is the difference of the two peaks', async ({ page }) => {
  await page.goto('/')
  await expect(curves(page)).toHaveCount(3)
  await expect(page.getByTestId('pin-summary')).toHaveCount(0)
  const [baselineBefore] = await paths(page)
  const peakBefore = await number(page, 'peak-baseline')

  await pin(page).click()
  await expect(curves(page)).toHaveCount(4)
  await expect(page.getByTestId('pin-status')).toHaveText('A · Referans koşulunun O1 eğrisi sabitlendi.')
  await expect(page.getByTestId('pinned-key')).toHaveText('◆ Sabitlenen (A, O1)')
  await expect(page.getByTestId('pin-no-changes')).toBeVisible()
  await expect(page.getByTestId('pin-difference')).toHaveText('0,000')
  // Pinned and current are the same curve until something changes.
  expect((await paths(page))[3]).toBe(baselineBefore)
  await expect(page.locator('.activation-chart')).toHaveAttribute('aria-label', /Sabitlenen eğri de çizilir\.$/)

  await page.locator('#amplitude').fill('0.5')
  const after = await paths(page)
  expect(after[3]).toBe(baselineBefore)
  expect(after[0]).not.toBe(baselineBefore)
  await expect(page.getByTestId('pin-changes').locator('li')).toHaveText(['Uyaran gücü: 0,80 → 0,50'])
  await expect(page.getByTestId('pin-pinned')).toContainText('A · Referans · O1 · tepe')
  const peakAfter = await number(page, 'peak-baseline')
  // Each of the three numbers is rounded to three digits on its own, so they agree to within one unit of the last digit.
  expect(Math.abs(await number(page, 'pin-difference') - (peakAfter - peakBefore))).toBeLessThan(0.0015)
  await expect(page.getByTestId('pin-difference')).toHaveText(/^-0,\d{3}$/)

  // Another condition and another output cell are listed as changes too; the pinned record does not move.
  await page.getByRole('button', { name: 'B Bağlantı susturuldu', exact: true }).click()
  await expect(page.getByTestId('pin-changes').locator('li')).toHaveText(['Gösterilen koşul: A · Referans → B · Bağlantı susturuldu', 'Uyaran gücü: 0,80 → 0,50'])
  // The silenced connection counts once one of the two curves is the silenced condition.
  await page.locator('#silenced-edge').selectOption('I4-O1')
  await expect(page.getByTestId('pin-changes').locator('li[data-field="selectedEdge"]')).toHaveText('Susturulan bağlantı: I3 → O1 → I4 → O1')
  await page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true }).selectOption('O2')
  await expect(page.getByTestId('pin-changes').locator('li[data-field="outputNeuron"]')).toHaveText('Okunan hücre: O1 → O2')
  expect((await paths(page))[3]).toBe(baselineBefore)
  await expect(page.getByTestId('pinned-key')).toHaveText('◆ Sabitlenen (A, O1)')

  await page.getByTestId('unpin-curve').click()
  await expect(curves(page)).toHaveCount(3)
  await expect(page.getByTestId('pin-summary')).toHaveCount(0)
  await expect(page.getByTestId('pin-status')).toHaveText('Sabitlenen eğri kaldırıldı.')
  await expect(page.locator('.activation-chart')).toHaveAttribute('aria-label', /Ortak dikey eksen 0–1,00\.$/)
})

test('a curve pinned at one time step is drawn and tabulated at its own times after the step changes', async ({ page }) => {
  await page.goto('/')
  await pin(page).click()
  const pinnedPath = (await paths(page))[3]!
  await page.locator('#dt').selectOption('0.25')
  // The record keeps its 701 samples; the current curves now have 2801.
  const after = await paths(page)
  expect(after[3]).toBe(pinnedPath)
  expect(after[3]!.split('L')).toHaveLength(701)
  expect(after[0]!.split('L')).toHaveLength(2801)
  await expect(page.getByTestId('pin-changes').locator('li')).toHaveText(['Zaman adımı: 1 ms → 0,25 ms'])
  // In the table both columns are read at the same moments, so the two stay close row by row.
  await page.locator('details.chart-table > summary').click()
  const table = page.locator('details.chart-table table')
  await expect(table.locator('caption')).toHaveText('O1 hücresinin model etkinliği · üç koşul ve sabitlenen eğri')
  await expect(table.locator('thead th')).toHaveText(['Zaman (ms)', 'A · Referans', 'B · Bağlantı susturuldu', 'C · Zaman sabiti değişti', '◆ · Sabitlenen (A, O1)'])
  const cells = await table.locator('tbody tr').nth(30).locator('th, td').allTextContents()
  expect(cells[0]).toBe('300')
  const value = (text: string) => Number(text.replace(',', '.'))
  expect(Math.abs(value(cells[1]!) - value(cells[4]!))).toBeLessThan(0.01)
  expect(value(cells[4]!)).toBeGreaterThan(0)
  await expect(table.locator('tfoot td').nth(3)).toHaveText(/^0,\d{3}$/)
})

test('the pinned curve is kept on reset, stays out of the share link, and the response scale leaves room for it', async ({ page }) => {
  await page.goto('/')
  await page.locator('#amplitude').fill('1')
  await pin(page).click()
  const share = await page.getByTestId('share-url').inputValue()
  await page.locator('#amplitude').fill('0.2')
  // With the response scale on, the axis still has room for the larger pinned curve.
  await page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true }).check()
  const pinnedPeak = Number((await page.getByTestId('pin-pinned').textContent())!.match(/tepe (\d,\d{3})/)![1]!.replace(',', '.'))
  const axisMax = Number((await page.getByTestId('chart-y-max').textContent())!.replace(',', '.'))
  expect(axisMax).toBeGreaterThanOrEqual(pinnedPeak)
  // Pinning added nothing to the link: only the amplitude differs from the link read before the change.
  expect(await page.getByTestId('share-url').inputValue()).toBe(share.replace('am=1', 'am=0.2').replace('sc=0', 'sc=1'))
  await page.getByRole('button', { name: /^Sıfırla/ }).click()
  await expect(curves(page)).toHaveCount(4)
  await expect(page.getByTestId('pin-summary')).toBeVisible()
})

test('pin and compare follows the language in place', async ({ page }) => {
  await page.goto('/')
  await pin(page).click()
  await page.locator('#amplitude').fill('0.5')
  await page.locator('#language-preference').selectOption('en')
  await expect(page.getByRole('heading', { name: 'Pin and compare', exact: true })).toBeVisible()
  await expect(page.getByTestId('pin-status')).toHaveText('The O1 curve of condition A · Reference is pinned.')
  await expect(page.getByTestId('pinned-key')).toHaveText('◆ Pinned (A, O1)')
  await expect(page.getByTestId('pin-changes').locator('li')).toHaveText(['Stimulus strength: 0.80 → 0.50'])
  await expect(page.getByTestId('pin-difference')).toHaveText(/^-0\.\d{3}$/)
  await expect(curves(page)).toHaveCount(4)
})
