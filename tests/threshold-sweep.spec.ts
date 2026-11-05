import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { expectNoHorizontalOverflow, main, navLabels, navLink } from './support/ui'
import { buildRealCircuit, parseRealConnectome } from '../src/model/realConnectome'
import { simulate } from '../src/model/simulation'
import type { RealConnectome } from '../src/model/types'

const lessonPath = '/ogren/gercek-veri-ve-varsayimlar'
const gains = Array.from({ length: 15 }, (_, index) => (index + 2) / 10)
const section = (page: Page) => main(page).getByTestId('assumptions-sweep')
const runButton = (page: Page) => section(page).getByTestId('sweep-run')
const result = (page: Page) => section(page).getByTestId('sweep-result')
const rows = (page: Page) => section(page).getByTestId('sweep-row')
const plot = (page: Page) => section(page).getByTestId('sweep-plot')
const prediction = (page: Page) => section(page).locator('#sweep-prediction')
const feedback = (page: Page) => section(page).getByTestId('sweep-feedback')

let anatomy: RealConnectome
test.beforeAll(async () => {
  anatomy = JSON.parse(await readFile(new URL('../data/local/cook-subset.json', import.meta.url), 'utf8')) as RealConnectome
})

test.beforeEach(async ({ page }) => {
  const exceptions: string[] = []
  page.on('pageerror', error => exceptions.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !/status of 404/.test(message.text())) exceptions.push(message.text()) })
  ;(page as Page & { exceptions: string[] }).exceptions = exceptions
})
test.afterEach(async ({ page }) => {
  expect((page as Page & { exceptions: string[] }).exceptions).toEqual([])
})

async function openLesson(page: Page) {
  await page.goto(lessonPath)
  await expect(main(page)).toHaveAttribute('data-data-state', 'ready')
}

async function runSweep(page: Page) {
  await runButton(page).click()
  await expect(result(page)).toBeVisible()
}

/** Independent oracle: only the pre-existing parser, builder and engine, never the sweep module. */
function oracle(gain: number) {
  const data = parseRealConnectome(anatomy)
  const trace = simulate(buildRealCircuit(data, { chemicalGain: gain, gapGain: .2 }), {
    durationMs: 700, dtMs: 1, tauMs: 30, stimulus: { target: 'AVER', onsetMs: 100, durationMs: 200, amplitude: .8 },
  }).activity.AVAR!
  const peak = Math.max(...trace)
  return { peak, peakTime: peak > 0 ? trace.indexOf(peak) : null, end: trace.at(-1)! }
}

async function visibleNumber(locator: Locator) {
  const text = (await locator.textContent())?.trim() ?? ''
  expect(text, 'a visible number uses the decimal comma, never a point').not.toMatch(/\d\.\d/)
  return Number(text.replace(',', '.'))
}

test('the sweep section is in the lesson navigation, explains the threshold honestly and starts unrun', async ({ page }) => {
  await openLesson(page)
  const link = main(page).getByRole('navigation', { name: 'Gerçek veri ve varsayımlar dersinin bölümleri' }).getByRole('link', { name: '03b · Eşik taraması', exact: true })
  await expect(link).toHaveAttribute('href', '#assumptions-sweep')
  await expect(section(page).getByRole('heading', { level: 2, name: 'Kimyasal çarpan 1’i geçerken ne olur?', exact: true })).toBeVisible()
  await expect(section(page)).toHaveAttribute('aria-labelledby', 'assumptions-sweep-title')
  await expect(section(page)).toContainText('Ölçülmüş biyolojik bir eşik veya bulgu değildir.')
  await expect(section(page).getByTestId('sweep-fixed-conditions')).toContainText('0,2–1,6 arası 15 değer')
  await expect(runButton(page)).toBeEnabled()
  await expect(runButton(page)).toHaveText(/^Taramayı çalıştır/)
  await expect(section(page).getByRole('region', { name: 'Eşik taramasının hesaplanan sonucu', exact: true })).toContainText('Tarama henüz hesaplanmadı')
  await expect(plot(page)).toHaveCount(0)
  await expect(rows(page)).toHaveCount(0)
  await expect(prediction(page)).toHaveValue('')
  await link.click()
  await expect(page).toHaveURL(/#assumptions-sweep$/)
  await expect(section(page)).toBeInViewport()
})

test('the existing lesson hooks and the original comparison still work beside the sweep', async ({ page }) => {
  await openLesson(page)
  await expect(page.locator('#assumptions-variable, #assumptions-comparison-value')).toHaveCount(2)
  await main(page).getByRole('button', { name: 'Deneyi çalıştır', exact: true }).click()
  await expect(main(page).getByTestId('assumptions-result')).toHaveAttribute('data-stale', 'false')
  await expect(main(page).getByTestId('assumptions-peak-difference')).toBeVisible()
  await expect(rows(page)).toHaveCount(0)
})

test('running the sweep shows 15 engine-exact rows with decimal commas and a threshold row', async ({ page }) => {
  await openLesson(page)
  await runSweep(page)
  await expect(result(page)).toHaveAttribute('data-completed', '15')
  await expect(result(page)).toHaveAttribute('data-failed', '0')
  await expect(page.getByTestId('sweep-status')).toContainText('Tarama kaydı #1 hazır: 15 çarpanın 15’i hesaplandı')
  await expect(rows(page)).toHaveCount(15)
  const table = section(page).getByTestId('sweep-table')
  await expect(table.locator('caption')).toContainText('her satır ayrı bir hesap')
  await expect(table.locator('thead th[scope="col"]')).toHaveCount(4)
  await expect(table.locator('tbody th[scope="row"]')).toHaveCount(15)
  for (const [index, gain] of gains.entries()) {
    const row = rows(page).nth(index)
    const expected = oracle(gain)
    await expect(row).toHaveAttribute('data-gain', String(gain))
    await expect(row.locator('th')).toContainText(gain.toFixed(1).replace('.', ','))
    expect(Number(await row.getAttribute('data-peak'))).toBe(expected.peak)
    expect(Number(await row.getAttribute('data-end'))).toBe(expected.end)
    expect(await row.getAttribute('data-peak-time')).toBe(String(expected.peakTime))
    const cells = row.locator('td')
    for (const [cell, value] of [[cells.nth(0), expected.peak], [cells.nth(2), expected.end]] as const) {
      const shown = await visibleNumber(cell)
      expect(Math.abs(shown - value) / value, `visible value at ${gain}`).toBeLessThan(.005)
    }
    await expect(cells.nth(1)).toHaveText(String(expected.peakTime))
  }
  await expect(rows(page).nth(8)).toHaveAttribute('data-regime', 'at')
  await expect(rows(page).nth(8).locator('th')).toContainText('eşik')
  await expect(rows(page).nth(7)).toHaveAttribute('data-regime', 'below')
  await expect(rows(page).nth(9)).toHaveAttribute('data-regime', 'above')
})

test('the plot places both series on a fixed 0–1 axis, marks the threshold at multiplier 1 and has an accessible name', async ({ page }) => {
  await openLesson(page)
  await runSweep(page)
  const svg = plot(page)
  await expect(svg).toHaveAttribute('role', 'img')
  await expect(svg).toHaveAttribute('aria-label', /0,2–1,6.*0–1.*Eşik 1,0/)
  const geometry = await svg.evaluate(element => {
    const number = (target: Element | null, name: string) => Number(target?.getAttribute(name))
    const yLabels = [...element.querySelectorAll('text[data-axis="y"]')]
    const grid = (value: string) => yLabels.find(label => label.getAttribute('data-value') === value)?.parentElement?.querySelector('line') ?? null
    const xLabels = [...element.querySelectorAll('text[data-axis="x"]')].map(label => ({ value: Number(label.getAttribute('data-value')), x: number(label, 'x'), text: label.textContent?.trim() }))
    return {
      yZero: number(grid('0'), 'y1'), yOne: number(grid('1'), 'y1'),
      yTexts: yLabels.map(label => label.textContent?.trim()),
      xLabels,
      threshold: { x: number(element.querySelector('[data-testid="sweep-threshold-line"]'), 'x1'), label: element.querySelector('[data-testid="sweep-threshold-label"]')?.textContent?.trim() },
      band: { x: number(element.querySelector('[data-testid="sweep-above-band"]'), 'x'), width: number(element.querySelector('[data-testid="sweep-above-band"]'), 'width') },
      peak: [...element.querySelectorAll('circle[data-sweep-marker="peak"]')].map(marker => ({ gain: number(marker, 'data-gain'), value: number(marker, 'data-value'), cx: number(marker, 'cx'), cy: number(marker, 'cy') })),
      end: [...element.querySelectorAll('rect[data-sweep-marker="end"]')].map(marker => ({ gain: number(marker, 'data-gain'), value: number(marker, 'data-value'), cx: number(marker, 'x') + number(marker, 'width') / 2, cy: number(marker, 'y') + number(marker, 'height') / 2 })),
      pathCount: { peak: element.querySelectorAll('path[data-sweep-series="peak"]').length, end: element.querySelectorAll('path[data-sweep-series="end"]').length },
      peakPath: element.querySelector('path[data-sweep-series="peak"]')?.getAttribute('d') ?? '',
    }
  })
  expect(geometry.yTexts).toEqual(['0,00', '0,25', '0,50', '0,75', '1,00'])
  expect(geometry.xLabels.map(label => label.text)).toEqual(['0,2', '0,4', '0,6', '0,8', '1,0', '1,2', '1,4', '1,6'])
  expect(geometry.peak).toHaveLength(15)
  expect(geometry.end).toHaveLength(15)
  expect(geometry.pathCount).toEqual({ peak: 1, end: 1 })
  expect(geometry.peakPath.match(/[ML]/g)).toHaveLength(15)
  const left = geometry.peak[0]!.cx
  const right = geometry.peak.at(-1)!.cx
  for (const marker of [...geometry.peak, ...geometry.end]) {
    const fraction = (marker.gain - .2) / 1.4
    expect(marker.cx, `x of multiplier ${marker.gain}`).toBeCloseTo(left + fraction * (right - left), 1)
    expect(marker.cy, `y of value ${marker.value}`).toBeCloseTo(geometry.yZero + marker.value * (geometry.yOne - geometry.yZero), 1)
  }
  for (const [index, gain] of gains.entries()) {
    const expected = oracle(gain)
    expect(geometry.peak[index]!.gain).toBe(gain)
    expect(geometry.peak[index]!.value).toBe(expected.peak)
    expect(geometry.end[index]!.value).toBe(expected.end)
  }
  // The threshold line stands exactly on multiplier 1, at the marker x of the gain-1 point and the 1,0 tick.
  expect(geometry.threshold.x).toBeCloseTo(geometry.peak[8]!.cx, 1)
  expect(geometry.threshold.x).toBeCloseTo(geometry.xLabels.find(label => label.value === 1)!.x, 1)
  expect(geometry.threshold.label).toBe('eşik: 1,0')
  expect(geometry.band.x).toBeCloseTo(geometry.threshold.x, 1)
  expect(geometry.band.x + geometry.band.width).toBeCloseTo(right, 1)
})

test('the end value stays near zero below the threshold and jumps across it, shown in the table and the crossing summary', async ({ page }) => {
  await openLesson(page)
  await runSweep(page)
  const end = (index: number) => visibleNumber(rows(page).nth(index).locator('td').nth(2))
  for (const index of [0, 3, 6, 7]) expect(await end(index), `row ${index}`).toBeLessThan(.01)
  expect(await end(10)).toBeGreaterThan(.2)
  for (const index of [10, 11, 12, 13, 14]) expect(await end(index)).toBeGreaterThan(.2)
  expect(await end(11)).toBeGreaterThan(.9)
  const crossing = section(page).getByTestId('sweep-crossing')
  await expect(crossing).toHaveAttribute('data-below-gain', '0.9')
  await expect(crossing).toHaveAttribute('data-above-gain', '1.1')
  await expect(crossing).toHaveAttribute('data-trend', 'steep')
  expect(Number(await crossing.getAttribute('data-below-end'))).toBe(oracle(.9).end)
  expect(Number(await crossing.getAttribute('data-above-end'))).toBe(oracle(1.1).end)
  await expect(section(page).getByTestId('sweep-window-end')).toContainText('1,1 · 1,2 · 1,3 · 1,4 · 1,5 · 1,6 olan 6 hesapta')
  await expect(section(page)).toContainText('Eşiğin hemen üstünde yükselme 700 model ms’den uzun sürebilir')
})

test('a prediction is recorded with the run and judged against the computed rise, without changing numbers', async ({ page }) => {
  await openLesson(page)
  await expect(prediction(page).locator('option')).toHaveText(['Tahmin eklemeden devam et', 'Çarpanla aynı mertebede, yaklaşık orantılı artar', 'Çarpandan çok daha hızlı, birkaç kat artar', 'Hemen hiç değişmez', 'Emin değilim; önce taramaya bakacağım'])
  await prediction(page).selectOption('steep')
  await runSweep(page)
  await expect(feedback(page)).toContainText('Kaydettiğin tahmin sonuçla örtüşüyor.')
  await expect(feedback(page)).toContainText('Çarpan 0,9 → 1,1 (≈1,2 kat) olurken AVAR’ın son değeri')
  await expect(feedback(page)).toContainText('kat). Bu, eşiğin çevresindeki rejim değişimidir')
  await expect(feedback(page)).toContainText('ölçülmüş biyolojik bir eşik değildir')
  const before = await section(page).getByTestId('sweep-table').innerText()
  // Changing the draft keeps the recorded prediction until the next run.
  await prediction(page).selectOption('flat')
  await expect(section(page).getByTestId('sweep-prediction-changed')).toBeVisible()
  await expect(feedback(page)).toContainText('Kaydettiğin tahmin sonuçla örtüşüyor.')
  await runButton(page).click()
  await expect(section(page).getByTestId('sweep-prediction-changed')).toHaveCount(0)
  await expect(feedback(page)).toContainText('Kaydettiğin tahmin bu sonuçtan farklı çıktı.')
  await expect(result(page)).toHaveAttribute('data-run-number', '2')
  expect(await section(page).getByTestId('sweep-table').innerText()).toBe(before)
  await prediction(page).selectOption('unsure')
  await runButton(page).click()
  await expect(feedback(page)).toContainText('Emin olmamak iyi bir başlangıçtı.')
  await prediction(page).selectOption('')
  await runButton(page).click()
  await expect(feedback(page)).toContainText('Bu taramaya tahmin eklenmedi; sonuç yine hesaplandı.')
  await expect(runButton(page)).toHaveText(/^Taramayı yeniden çalıştır/)
})

test('the sweep and its prediction work from the keyboard alone', async ({ page }) => {
  await openLesson(page)
  // The prediction is a native select, operated by the browser's own keyboard handling; selectOption stands in for its popup.
  await expect(section(page).getByLabel('Kimyasal çarpan 0,9’dan 1,1’e çıkınca AVAR’ın 700 model ms’deki son değeri nasıl değişir?')).toBeEnabled()
  await prediction(page).selectOption('steep')
  await runButton(page).focus()
  await expect(runButton(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(result(page)).toBeVisible()
  await expect(page.getByTestId('sweep-status')).toHaveAttribute('role', 'status')
  await page.keyboard.press('Space')
  await expect(result(page)).toHaveAttribute('data-run-number', '2')
})

test('a multiplier whose run fails is marked, the line is not bridged across it and the other points stay', async ({ page }) => {
  await openLesson(page)
  // The sweep clones the baseline config once per multiplier; make the 4th clone (multiplier 0,5) throw.
  await page.evaluate(() => {
    const original = structuredClone
    let calls = 0
    ;(window as unknown as { structuredClone: unknown }).structuredClone = (value: unknown) => { calls += 1; if (calls === 4) throw new Error('forced failure'); return original(value) }
    ;(window as unknown as { restoreClone: () => void }).restoreClone = () => { (window as unknown as { structuredClone: unknown }).structuredClone = original }
  })
  await runSweep(page)
  await expect(result(page)).toHaveAttribute('data-completed', '14')
  await expect(result(page)).toHaveAttribute('data-failed', '1')
  await expect(section(page).getByTestId('sweep-failed-note')).toContainText('1 çarpan için hesap tamamlanamadı')
  await expect(rows(page)).toHaveCount(15)
  const failedRow = rows(page).nth(3)
  await expect(failedRow).toHaveAttribute('data-gain', '0.5')
  await expect(failedRow).toHaveAttribute('data-ok', 'false')
  await expect(failedRow).toContainText('hesaplanamadı')
  await expect(failedRow.locator('td')).toHaveCount(1)
  await expect(rows(page).nth(4)).toHaveAttribute('data-ok', 'true')
  await expect(plot(page)).toHaveAttribute('data-point-count', '14')
  await expect(plot(page).locator('[data-sweep-marker="failed"]')).toHaveCount(1)
  await expect(plot(page).locator('[data-sweep-marker="failed"]')).toHaveAttribute('data-gain', '0.5')
  await expect(plot(page).locator('[data-sweep-marker="peak"]')).toHaveCount(14)
  await expect(plot(page).locator('path[data-sweep-series="peak"]')).toHaveCount(2)
  await expect(plot(page).locator('path[data-sweep-series="end"]')).toHaveCount(2)
  const segments = await plot(page).locator('path[data-sweep-series="peak"]').evaluateAll(paths => paths.map(path => (path.getAttribute('d') ?? '').match(/[ML]/g)!.length))
  expect(segments).toEqual([3, 11])
  await expect(section(page).locator('.sweep-legend')).toContainText('Hesaplanamadı')
  // Values of the other points are the real engine values.
  expect(Number(await rows(page).nth(4).getAttribute('data-end'))).toBe(oracle(.6).end)
  await page.evaluate(() => (window as unknown as { restoreClone: () => void }).restoreClone())
  await runButton(page).click()
  await expect(result(page)).toHaveAttribute('data-failed', '0')
  await expect(result(page)).toHaveAttribute('data-run-number', '2')
  await expect(section(page).getByTestId('sweep-failed-note')).toHaveCount(0)
  await expect(section(page).locator('.sweep-legend')).not.toContainText('Hesaplanamadı')
})

test('a sweep that fails everywhere reports an error and never replaces the previous record', async ({ page }) => {
  await openLesson(page)
  await runSweep(page)
  const before = await section(page).getByTestId('sweep-table').innerText()
  await page.evaluate(() => { (window as unknown as { structuredClone: unknown }).structuredClone = () => { throw new Error('forced failure') } })
  await runButton(page).click()
  await expect(section(page).getByTestId('sweep-error')).toContainText('hiçbir çarpanı için hesap tamamlanamadı')
  await expect(result(page)).toHaveAttribute('data-run-number', '1')
  expect(await section(page).getByTestId('sweep-table').innerText()).toBe(before)
})

test('without local data the section degrades like the rest of the lesson: text stays, the sweep cannot run', async ({ page }) => {
  await page.route('**/api/local-connectome', route => route.fulfill({ status: 404, json: { error: 'Deliberately unavailable local file' } }))
  await page.goto(lessonPath)
  await expect(main(page)).toHaveAttribute('data-data-state', 'missing')
  await expect(section(page).getByRole('heading', { level: 2 })).toBeVisible()
  await expect(runButton(page)).toBeDisabled()
  await expect(section(page)).toContainText('Tarama, doğrulanmış yerel veri yüklendiğinde açılır.')
  await expect(plot(page)).toHaveCount(0)
  await expect(rows(page)).toHaveCount(0)
  await expect(result(page)).toHaveCount(0)
})

test('the page reset clears the sweep together with the comparison', async ({ page }) => {
  await openLesson(page)
  await prediction(page).selectOption('steep')
  await runSweep(page)
  await main(page).getByRole('button', { name: 'Varsayım deneyini sıfırla', exact: true }).click()
  await expect(result(page)).toHaveCount(0)
  await expect(prediction(page)).toHaveValue('')
  await expect(runButton(page)).toHaveText(/^Taramayı çalıştır/)
  await runSweep(page)
  await expect(result(page)).toHaveAttribute('data-run-number', '1')
  await expect(feedback(page)).toContainText('Bu taramaya tahmin eklenmedi')
})

test('the plot, table and notes fit the viewport without horizontal overflow and the plot follows the container width', async ({ page }) => {
  await openLesson(page)
  await runSweep(page)
  await expectNoHorizontalOverflow(page)
  const box = await plot(page).boundingBox()
  const viewport = page.viewportSize()!
  expect(box!.width).toBeGreaterThan(200)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
  const tableBox = await section(page).getByTestId('sweep-table').boundingBox()
  expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(viewport.width)
  for (const control of [runButton(page), prediction(page)]) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  const viewBox = (await plot(page).getAttribute('viewBox'))!.split(' ').map(Number)
  expect(Math.abs(viewBox[2]! - box!.width)).toBeLessThan(2)
  await page.setViewportSize({ width: 360, height: 800 })
  await expectNoHorizontalOverflow(page)
  await expect.poll(async () => Number((await plot(page).getAttribute('viewBox'))!.split(' ')[2])).toBeLessThan(viewBox[2]! + 1)
})

test('the page title and active navigation are unchanged by the sweep section', async ({ page }) => {
  await openLesson(page)
  await expect(page).toHaveTitle('Gerçek veri ve varsayımlar · Circuitiary')
  await expect(navLink(page, navLabels.assumptions)).toHaveAttribute('aria-current', 'page')
})
