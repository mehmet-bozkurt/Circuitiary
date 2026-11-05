import { expect, test, type Page } from '@playwright/test'
import { decimal } from '../src/format'
import { illustrativeCircuit, defaultConfig } from '../src/model/circuit'
import { simulate } from '../src/model/simulation'
import type { SimulationConfig, SimulationResult } from '../src/model/types'
import { experimentLink, expectNoHorizontalOverflow, main, navLabels, navLink } from './support/ui'

const timeSlider = (page: Page) => page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true })
const playButton = (page: Page) => page.getByRole('button', { name: 'Etkinliği oynat', exact: true })
const pauseButton = (page: Page) => page.getByRole('button', { name: 'Oynatmayı duraklat', exact: true })
const status = (page: Page) => page.getByTestId('shortcut-status')
const tableSummary = (page: Page) => page.locator('summary', { hasText: 'Grafiğin veri tablosu' })
const tableRegion = (page: Page) => page.getByRole('region', { name: /hücresinin model etkinliği/ })
const dataTable = (page: Page) => tableRegion(page).getByRole('table')

async function openTable(page: Page) {
  await tableSummary(page).click()
  await expect(dataTable(page)).toBeVisible()
}

interface Controls { amplitude?: number; edge?: string; tauNeuron?: string; tau?: number; dtMs?: number }
/** The three conditions computed straight from the model, the oracle for what the chart and table must show. */
function conditions(controls: Controls = {}): SimulationResult[] {
  const base: SimulationConfig = { ...defaultConfig, dtMs: controls.dtMs ?? defaultConfig.dtMs, stimulus: { ...defaultConfig.stimulus, amplitude: controls.amplitude ?? defaultConfig.stimulus.amplitude } }
  return [
    simulate(illustrativeCircuit, base),
    simulate(illustrativeCircuit, { ...base, silencedConnectionId: controls.edge ?? 'I3-O1' }),
    simulate(illustrativeCircuit, { ...base, tauOverrides: { [controls.tauNeuron ?? 'O1']: controls.tau ?? 90 } }),
  ]
}
function expectedRows(output: string, runs: SimulationResult[]): string[][] {
  return Array.from({ length: 71 }, (_, step) => {
    const time = step * 10
    return [decimal(time, 0), ...runs.map(run => decimal(run.activity[output]![Math.round(time / (run.timesMs[1]! - run.timesMs[0]!))]!, 3))]
  })
}
const expectedPeaks = (output: string, runs: SimulationResult[]) => runs.map(run => decimal(Math.max(...run.activity[output]!), 3))

const bodyRows = (page: Page) => dataTable(page).locator('tbody tr').evaluateAll(rows => rows.map(row => Array.from(row.children, cell => cell.textContent ?? '')))
const peakCells = (page: Page) => dataTable(page).locator('tfoot td').allTextContents()

test.describe('chart data table', () => {
  test('is a real table under the chart with a caption, scoped headers and the sampling note', async ({ page }) => {
    await page.goto('/')
    // Closed until asked for, directly after the chart's scale row.
    await expect(tableSummary(page)).toBeVisible()
    await expect(dataTable(page)).toBeHidden()
    expect(await page.evaluate(() => document.querySelector('.chart-scale')?.nextElementSibling?.matches('details.chart-table'))).toBe(true)
    await openTable(page)
    await expect(dataTable(page).locator('caption')).toHaveText('O1 hücresinin model etkinliği · üç koşul')
    await expect(dataTable(page).locator('thead th[scope="col"]')).toHaveText(['Zaman (ms)', 'A · Referans', 'B · Bağlantı susturuldu', 'C · Zaman sabiti değişti'])
    expect(await dataTable(page).locator('tbody th[scope="row"]').count()).toBe(71)
    await expect(dataTable(page).locator('tfoot th[scope="row"]')).toHaveText('Tepe etkinlik')
    const note = page.locator('.chart-table-note')
    await expect(note).toContainText('701 örnekten her 10 ms')
    await expect(note).toContainText('71 tanesidir')
    await expect(note).toContainText('hepsinden alınır')
    await expect(dataTable(page)).toHaveAttribute('aria-describedby', (await note.getAttribute('id'))!)
    await expect(tableSummary(page).locator('small')).toHaveText('71 satır · her 10 ms')
  })

  test('cells equal the values the model computes for the chart, and the peaks match the peak row', async ({ page }) => {
    await page.goto('/')
    await openTable(page)
    const runs = conditions()
    expect(await bodyRows(page)).toEqual(expectedRows('O1', runs))
    expect(await peakCells(page)).toEqual(expectedPeaks('O1', runs))
    // The same numbers as the peak row above the chart.
    expect(await peakCells(page)).toEqual(await Promise.all(['baseline', 'silenced', 'tau'].map(id => page.getByTestId(`peak-${id}`).innerText())))
    // The decimal comma, never a dot, in every cell.
    expect((await dataTable(page).locator('td').allTextContents()).every(text => /^\d,\d{3}$/.test(text))).toBe(true)
  })

  test('follows every control that feeds the chart', async ({ page }) => {
    await page.goto('/')
    await openTable(page)
    const before = await bodyRows(page)

    await page.locator('#amplitude').fill('0.4')
    let rows = await bodyRows(page)
    expect(rows).toEqual(expectedRows('O1', conditions({ amplitude: 0.4 })))
    expect(rows).not.toEqual(before)
    expect(await peakCells(page)).toEqual(expectedPeaks('O1', conditions({ amplitude: 0.4 })))

    await page.locator('#amplitude').fill('0.8')
    await page.locator('#changed-tau').fill('150')
    rows = await bodyRows(page)
    expect(rows).toEqual(expectedRows('O1', conditions({ tau: 150 })))
    // Only the tau column moved.
    expect(rows.map(row => row.slice(0, 3))).toEqual(before.map(row => row.slice(0, 3)))
    expect(rows.map(row => row[3])).not.toEqual(before.map(row => row[3]))

    await page.locator('#changed-neuron').selectOption('I4')
    expect(await bodyRows(page)).toEqual(expectedRows('O1', conditions({ tau: 150, tauNeuron: 'I4' })))

    await page.locator('#silenced-edge').selectOption('I4-O1')
    rows = await bodyRows(page)
    expect(rows).toEqual(expectedRows('O1', conditions({ tau: 150, tauNeuron: 'I4', edge: 'I4-O1' })))
    expect(await peakCells(page)).toEqual(expectedPeaks('O1', conditions({ tau: 150, tauNeuron: 'I4', edge: 'I4-O1' })))

    // A viewing choice: another observed cell changes the caption and every column.
    await page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true }).selectOption('O2')
    await expect(dataTable(page).locator('caption')).toHaveText('O2 hücresinin model etkinliği · üç koşul')
    expect(await bodyRows(page)).toEqual(expectedRows('O2', conditions({ tau: 150, tauNeuron: 'I4', edge: 'I4-O1' })))

    // A finer time step keeps the 10 ms rows and reads the value at that exact sample.
    await page.locator('#dt').selectOption('0.25')
    expect(await bodyRows(page)).toEqual(expectedRows('O2', conditions({ tau: 150, tauNeuron: 'I4', edge: 'I4-O1', dtMs: 0.25 })))
    await expect(page.locator('.chart-table-note')).toContainText('2801 örnekten her 10 ms')

    // Reset restores the starting table, time step included.
    await page.getByRole('button', { name: /Sıfırla/ }).click()
    expect(await bodyRows(page)).toEqual(expectedRows('O1', conditions()))
    await expect(page.locator('.chart-table-note')).toContainText('701 örnekten her 10 ms')
  })

  test('scrolls inside its own focusable region and never widens the page', async ({ page, isMobile }) => {
    await page.goto('/')
    await openTable(page)
    const region = tableRegion(page)
    await expect(region).toHaveAttribute('tabindex', '0')
    await region.focus()
    await expect(region).toBeFocused()
    const scrolls = await region.evaluate(element => element.scrollWidth > element.clientWidth)
    await page.keyboard.press('ArrowRight')
    if (isMobile) {
      expect(scrolls).toBe(true)
      // Keyboard scrolling is animated; wait for it to land.
      await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
    }
    // The arrow key belongs to the focused region, not to the time cursor.
    await expect(timeSlider(page)).toHaveValue('250')
    await expectNoHorizontalOverflow(page)
    // The long table is scrolled in the region, not the page.
    expect(await region.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  })
})

test.describe('keyboard shortcuts', () => {
  test('Space, arrows and Home work with focus on the page body', async ({ page }) => {
    await page.goto('/')
    await expect(timeSlider(page)).toHaveValue('250')
    await page.keyboard.press('ArrowRight')
    await expect(timeSlider(page)).toHaveValue('260')
    await expect(status(page)).toHaveText('Zaman 260 ms.')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(timeSlider(page)).toHaveValue('280')
    await page.keyboard.press('ArrowLeft')
    await expect(timeSlider(page)).toHaveValue('270')
    await page.keyboard.press('Home')
    await expect(timeSlider(page)).toHaveValue('0')
    await expect(status(page)).toHaveText('Zaman 0 ms.')
    await page.keyboard.press('ArrowLeft')
    await expect(timeSlider(page)).toHaveValue('0')

    await page.keyboard.press('Space')
    await expect(pauseButton(page)).toBeVisible()
    await expect(status(page)).toHaveText('Oynatılıyor.')
    // Space is taken: the page does not scroll.
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await page.keyboard.press('Space')
    await expect(playButton(page)).toBeVisible()
    await expect(status(page)).toHaveText('Duraklatıldı.')

    // An arrow step pauses a running playback and lands on the 10 ms grid.
    await page.keyboard.press('Space')
    await expect(pauseButton(page)).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(playButton(page)).toBeVisible()
    expect(Number(await timeSlider(page).inputValue()) % 10).toBe(0)

    // The recording ends at 700 ms and the cursor stops there.
    for (let press = 0; press < 80; press++) await page.keyboard.press('ArrowRight')
    await expect(timeSlider(page)).toHaveValue('700')
    await page.keyboard.press('ArrowRight')
    await expect(timeSlider(page)).toHaveValue('700')
  })

  test('Ctrl, Cmd, Alt and Shift combinations are left alone', async ({ page }) => {
    await page.goto('/')
    for (const combination of ['Control+ArrowRight', 'Meta+ArrowRight', 'Alt+ArrowLeft', 'Shift+ArrowRight', 'Control+Space', 'Alt+Space', 'Shift+Home', 'Control+Home']) {
      await page.keyboard.press(combination)
    }
    await expect(timeSlider(page)).toHaveValue('250')
    await expect(playButton(page)).toBeVisible()
    await expect(status(page)).toHaveText('')
  })

  test('do nothing while a slider, select, checkbox, button or summary has focus', async ({ page }) => {
    await page.goto('/')
    // A slider keeps its own arrows and Home; the time cursor does not move.
    await page.locator('#amplitude').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('#amplitude')).toHaveValue('0.75')
    await page.keyboard.press('Home')
    await expect(page.locator('#amplitude')).toHaveValue('0')
    await page.keyboard.press('Space')
    await expect(timeSlider(page)).toHaveValue('250')
    await expect(playButton(page)).toBeVisible()
    // The time slider itself steps by its own step (1 ms), not the 10 ms shortcut step.
    await timeSlider(page).focus()
    await page.keyboard.press('ArrowRight')
    await expect(timeSlider(page)).toHaveValue('251')
    // A select, a checkbox and the play button act on themselves exactly once.
    await page.locator('#stimulus-target').focus()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    await expect(timeSlider(page)).toHaveValue('251')
    const scale = page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true })
    await scale.focus()
    await page.keyboard.press('Space')
    await expect(scale).toBeChecked()
    await expect(playButton(page)).toBeVisible()
    await playButton(page).focus()
    await page.keyboard.press('Space')
    await expect(pauseButton(page)).toBeVisible()
    await page.keyboard.press('Space')
    await expect(playButton(page)).toBeVisible()
    // The shortcut list's own summary opens with Space and does not start playback.
    const help = page.locator('details.shortcut-help')
    await help.locator('summary').focus()
    await page.keyboard.press('Space')
    await expect(help).toHaveJSProperty('open', true)
    await expect(playButton(page)).toBeVisible()
    await expect(status(page)).toHaveText('')
  })

  test('do nothing while the term card is open or focus is in an editable field', async ({ page }) => {
    await page.goto('/')
    await page.locator('.term-trigger').first().focus()
    const card = page.getByRole('dialog')
    await expect(card).toBeVisible()
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home']) await page.keyboard.press(key)
    await expect(timeSlider(page)).toHaveValue('250')
    // Focus inside the card (ArrowDown moves to its first control) is just as quiet.
    await page.keyboard.press('ArrowDown')
    await expect(card.locator(':focus')).toHaveCount(1)
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home']) await page.keyboard.press(key)
    await expect(timeSlider(page)).toHaveValue('250')
    await expect(playButton(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(card).toHaveCount(0)
    // Fields that do not exist on the page today still keep their keys.
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<textarea id="probe-text"></textarea><div id="probe-edit" contenteditable="true">x</div><div id="probe-dialog" role="dialog" aria-label="probe"><span id="probe-inside" tabindex="-1">y</span></div>')
    })
    for (const id of ['probe-text', 'probe-edit', 'probe-inside']) {
      await page.locator(`#${id}`).focus()
      for (const key of ['ArrowRight', 'Home']) await page.keyboard.press(key)
      await expect(timeSlider(page)).toHaveValue('250')
    }
    // Control: once focus is back on the page body the same keys act.
    await page.evaluate(() => (document.activeElement as HTMLElement).blur())
    await page.keyboard.press('ArrowRight')
    await expect(timeSlider(page)).toHaveValue('260')
  })

  test('do nothing while another lesson page is shown', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('ArrowRight')
    await expect(timeSlider(page)).toHaveValue('260')
    await page.keyboard.press('Space')
    await expect(pauseButton(page)).toBeVisible()
    await navLink(page, navLabels.neuron).click()
    await expect(page.locator('#neuron-lesson')).toBeVisible()
    await expect(page.locator('#top')).toBeHidden()
    for (const key of ['Home', 'ArrowLeft', 'ArrowLeft', 'Space', 'Space', 'Space']) await page.keyboard.press(key)
    await experimentLink(page).click()
    await expect(main(page)).toHaveAttribute('id', 'top')
    // Still playing, and not rewound to the start by the keys pressed on the lesson page.
    await expect(pauseButton(page)).toBeVisible()
    expect(Number(await timeSlider(page).inputValue())).toBeGreaterThanOrEqual(260)
    // Back on the experiment page the keys act again.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Home')
    await expect(timeSlider(page)).toHaveValue('0')
    await expect(playButton(page)).toBeVisible()
  })

  test('the shortcut list sits under the playback controls and names every key', async ({ page }) => {
    await page.goto('/')
    const help = page.locator('details.shortcut-help')
    await expect(help.locator('summary')).toHaveText('Klavye kısayolları')
    const slider = await timeSlider(page).boundingBox()
    const summary = await help.locator('summary').boundingBox()
    expect(summary!.y).toBeGreaterThan(slider!.y)
    expect(summary!.y - slider!.y).toBeLessThan(120)
    await help.locator('summary').click()
    await expect(help.locator('kbd')).toHaveText(['Boşluk', '←', '→', 'Home'])
    await expect(help).toContainText('Oynat / duraklat')
    await expect(help).toContainText('10 ms geri / ileri')
    await expect(help).toContainText('Başa dön (0 ms)')
    expect(await help.locator('summary').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    await expectNoHorizontalOverflow(page)
  })
})
