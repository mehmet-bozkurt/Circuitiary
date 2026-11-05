import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow, main, navLabels, navLink } from './support/ui'
import { defaultConfig } from '../src/model/circuit'
import { simulate } from '../src/model/simulation'
import type { Circuit } from '../src/model/types'

const builderPath = '/ogren/devre-kur'
const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(builderPath)
  await expect(main(page)).toHaveAttribute('id', 'circuit-builder')
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? [], 'The builder must not log browser exceptions or console errors').toEqual([])
})

const runButton = (page: Page) => main(page).getByTestId('builder-run')
const resetButton = (page: Page) => main(page).getByTestId('builder-reset')
const addLink = (page: Page) => main(page).getByRole('button', { name: 'Bağlantı ekle', exact: true })
const preset = (page: Page, title: string) => main(page).getByRole('button', { name: new RegExp(`^${title}`) })
const linkRows = (page: Page) => main(page).locator('li[data-testid^="builder-link-"]')
const field = (page: Page, link: number, name: string) => main(page).getByRole('combobox', { name: `Bağlantı ${link} ${name}`, exact: true })
const strength = (page: Page, link: number) => main(page).getByRole('slider', { name: `Bağlantı ${link} Güç`, exact: true })
const removeButton = (page: Page, link: number) => main(page).getByRole('button', { name: new RegExp(`^Kaldır: bağlantı ${link},`) })
const cellCount = (page: Page) => main(page).getByRole('combobox', { name: 'Hücre sayısı', exact: true })
const validity = (page: Page) => main(page).getByTestId('builder-validity')
const status = (page: Page) => main(page).getByTestId('builder-status')
const result = (page: Page) => main(page).getByTestId('builder-result')
const metric = async (page: Page, kind: 'peak' | 'peak-time' | 'reach' | 'final', id: string): Promise<number | null> => {
  const raw = await main(page).getByTestId(`builder-${kind}-${id}`).getAttribute('data-value')
  return raw === 'null' ? null : Number(raw)
}
async function setRange(slider: Locator, value: number) {
  await slider.fill(String(value))
  await expect(slider).toHaveValue(String(value))
}
async function run(page: Page) {
  await expect(runButton(page)).toBeEnabled()
  await runButton(page).click()
  await expect(result(page)).toHaveAttribute('data-stale', 'false')
}

test('opens from the navigation and says plainly that this is a toy model', async ({ page }) => {
  await page.goto('/')
  await navLink(page, navLabels.builder).click()
  await expect(page).toHaveURL(new RegExp(`${builderPath}/?$`))
  await expect(page).toHaveTitle('Devre kur · Circuitiary')
  await expect(navLink(page, navLabels.builder)).toHaveAttribute('aria-current', 'page')
  await expect(main(page).getByRole('heading', { name: 'Devre kur', level: 1, exact: true })).toBeVisible()
  const boundary = main(page).getByTestId('builder-boundary')
  await expect(boundary).toContainText('Bu bir oyuncak model.')
  await expect(boundary).toContainText('gerçek bir devre değildir ve sonuç bir tahmin değildir')
  await expect(main(page).getByTestId('builder-not-run')).toBeVisible()
  await expect(runButton(page)).toBeEnabled()
  await expect(main(page).getByTestId('builder-no-links')).toBeVisible()
})

test('builds a circuit from scratch and the numbers equal an independent engine call', async ({ page }) => {
  await addLink(page).click()
  await expect(linkRows(page)).toHaveCount(1)
  await setRange(strength(page, 1), 0.9)
  await addLink(page).click()
  await expect(linkRows(page)).toHaveCount(2)
  await field(page, 2, 'Tür').selectOption('gap')
  // A gap names its two ends neutrally; they are not "source" and "target".
  await field(page, 2, 'Hücre 1').selectOption('C')
  await field(page, 2, 'Hücre 2').selectOption('B')
  await setRange(strength(page, 2), 0.4)
  await expect(main(page).getByTestId('builder-link-2-strength-output')).toHaveText('0,40')
  await expect(linkRows(page).nth(1)).toContainText('B ↔ C elektriksel')
  await run(page)

  const neurons = ['A', 'B', 'C'].map((id, index) => ({ id, label: id, role: 'unspecified' as const, description: '', position: { x: index, y: 0 } }))
  const circuit: Circuit = {
    id: 'oracle', name: 'oracle', provenance: 'oracle', neurons,
    connections: [
      { id: 'x', source: 'A', target: 'B', weight: 0.9, evidence: 'illustrative', note: '' },
      { id: 'y', source: 'B', target: 'C', weight: 0.4, evidence: 'illustrative', note: '', kind: 'gap' },
    ],
  }
  const expected = simulate(circuit, { ...defaultConfig, stimulus: { ...defaultConfig.stimulus, target: 'A' } })
  for (const id of ['A', 'B', 'C']) {
    const trace = expected.activity[id]!
    expect(await metric(page, 'peak', id)).toBeCloseTo(Math.max(...trace), 12)
    expect(await metric(page, 'final', id)).toBeCloseTo(trace.at(-1)!, 12)
  }
  expect(await metric(page, 'peak', 'C')).toBeGreaterThan(0.05)
  await expect(main(page).getByTestId('builder-row-A')).toContainText('uyarılan')
  // Decimal comma in the table and the settings sentence.
  await expect(main(page).getByTestId('builder-peak-A')).toHaveText(/^0,\d{3}$/)
  await expect(main(page).getByTestId('builder-run-settings')).toContainText('0,80 genlikli darbe, 100–300 model ms')
  // The chart draws every recorded sample of every cell.
  for (const id of ['A', 'B', 'C']) {
    const d = await main(page).locator(`[data-trace="${id}"]`).getAttribute('d')
    expect(d!.split('L')).toHaveLength(701)
  }
  await expect(main(page).getByTestId('builder-pulse-band')).toBeVisible()
  await expect(main(page).getByTestId('builder-table').getByRole('row')).toHaveCount(4)
})

test('every preset teaches the effect its text claims', async ({ page }) => {
  // Feed-forward chain: later and weaker at each step.
  await preset(page, 'İleri beslemeli zincir').click()
  await expect(main(page).getByTestId('builder-preset-note')).toHaveAttribute('data-preset', 'chain')
  await run(page)
  const reach = [await metric(page, 'reach', 'A'), await metric(page, 'reach', 'B'), await metric(page, 'reach', 'C')]
  expect(reach[0]!).toBeLessThan(reach[1]!)
  expect(reach[1]!).toBeLessThan(reach[2]!)
  const peaks = [await metric(page, 'peak', 'A'), await metric(page, 'peak', 'B'), await metric(page, 'peak', 'C')]
  expect(peaks[0]!).toBeGreaterThan(peaks[1]!)
  expect(peaks[1]!).toBeGreaterThan(peaks[2]!)

  // Excitation vs inhibition onto C: removing the inhibitory link lifts C's peak.
  await preset(page, 'Uyarma ve baskılama').click()
  await run(page)
  const inhibited = (await metric(page, 'peak', 'C'))!
  expect(inhibited).toBeLessThan((await metric(page, 'peak', 'B'))! / 2)
  await removeButton(page, 3).click()
  await run(page)
  expect((await metric(page, 'peak', 'C'))!).toBeGreaterThan(inhibited * 2)

  // Mutual inhibition: B (slightly stronger input) wins, C is suppressed; raising A→C flips the winner.
  await preset(page, 'Karşılıklı baskılama').click()
  await run(page)
  expect(await metric(page, 'peak', 'B')).toBeGreaterThan(0.65)
  expect(await metric(page, 'peak', 'C')).toBeLessThan(0.2)
  await setRange(strength(page, 2), 0.95)
  await run(page)
  expect(await metric(page, 'peak', 'C')).toBeGreaterThan(0.65)
  expect(await metric(page, 'peak', 'B')).toBeLessThan(0.25)

  // Loop at the threshold 1: still high at the end; 0.8 dies out; 1.2 saturates.
  await preset(page, 'Kendini sürdüren döngü').click()
  await run(page)
  for (const id of ['A', 'B', 'C']) expect(await metric(page, 'final', id)).toBeGreaterThan(0.9)
  await expect(main(page).getByTestId('builder-facts')).toContainText('hâlâ 0,10 düzeyinde ya da üstünde')
  for (const link of [1, 2, 3]) await setRange(strength(page, link), 0.8)
  await run(page)
  for (const id of ['A', 'B', 'C']) expect(await metric(page, 'final', id)).toBeLessThan(0.1)
  await expect(main(page).getByTestId('builder-facts')).toContainText('altına indi')
  for (const link of [1, 2, 3]) await setRange(strength(page, link), 1.2)
  await run(page)
  for (const id of ['A', 'B', 'C']) expect(await metric(page, 'final', id)).toBeGreaterThan(0.999)
})

test('a loaded preset can be edited, and the page says its note then belongs to the original', async ({ page }) => {
  await preset(page, 'İleri beslemeli zincir').click()
  await expect(main(page).getByTestId('builder-preset-edited')).toHaveCount(0)
  await expect(status(page)).toContainText('“İleri beslemeli zincir” örneği yüklendi')
  await expect(linkRows(page)).toHaveCount(2)
  await setRange(strength(page, 1), 0.5)
  await expect(main(page).getByTestId('builder-preset-edited')).toBeVisible()
  await setRange(strength(page, 1), 0.9)
  await expect(main(page).getByTestId('builder-preset-edited')).toHaveCount(0)
})

test('removing a connection removes its effect and keeps focus on a control', async ({ page }) => {
  await preset(page, 'İleri beslemeli zincir').click()
  await run(page)
  expect(await metric(page, 'peak', 'C')).toBeGreaterThan(0.5)
  await removeButton(page, 2).click()
  await expect(linkRows(page)).toHaveCount(1)
  await expect(status(page)).toContainText('Bağlantı 2 kaldırıldı (B → C uyarıcı). 1 bağlantı kaldı.')
  await expect(removeButton(page, 1)).toBeFocused()
  // The old numbers stay on screen but are marked as belonging to the earlier circuit.
  await expect(main(page).getByTestId('builder-stale')).toBeVisible()
  await expect(result(page)).toHaveAttribute('data-stale', 'true')
  await run(page)
  await expect(main(page).getByTestId('builder-stale')).toHaveCount(0)
  expect(await metric(page, 'peak', 'C')).toBe(0)
  expect(await metric(page, 'peak-time', 'C')).toBeNull()
  await expect(main(page).getByTestId('builder-row-C')).toContainText('—')
  expect(await metric(page, 'peak', 'B')).toBeGreaterThan(0.5)
  await removeButton(page, 1).click()
  await expect(linkRows(page)).toHaveCount(0)
  await expect(addLink(page)).toBeFocused()
  await expect(main(page).getByTestId('builder-no-links')).toBeVisible()
})

test('an invalid circuit disables Run and explains why in Turkish', async ({ page }) => {
  await addLink(page).click()
  await field(page, 1, 'Tür').selectOption('gap')
  await field(page, 1, 'Hücre 1').selectOption('B')
  await field(page, 1, 'Hücre 2').selectOption('B')
  await expect(runButton(page)).toBeDisabled()
  await expect(validity(page)).toHaveAttribute('data-valid', 'false')
  await expect(validity(page)).toContainText('Bağlantı 1: elektriksel (gap) bağlantı iki farklı hücre arasında kurulur.')
  await expect(linkRows(page).first()).toContainText('Sorun var')
  await field(page, 1, 'Hücre 2').selectOption('C')
  await expect(runButton(page)).toBeEnabled()
  await expect(validity(page)).toHaveAttribute('data-valid', 'true')
  await expect(validity(page)).toContainText('Devre geçerli.')

  // A second gap between the same two cells, written the other way round, is the same symmetric link.
  await addLink(page).click()
  await field(page, 2, 'Tür').selectOption('gap')
  await field(page, 2, 'Hücre 1').selectOption('C')
  await field(page, 2, 'Hücre 2').selectOption('B')
  await expect(runButton(page)).toBeDisabled()
  await expect(validity(page)).toContainText('Bağlantı 2: B ↔ C arasında elektriksel bağlantı zaten var (Bağlantı 1)')
  await removeButton(page, 2).click()
  await expect(runButton(page)).toBeEnabled()

  // Two chemical links for the same ordered pair.
  await addLink(page).click()
  await field(page, 2, 'Kaynak').selectOption('A')
  await field(page, 2, 'Hedef').selectOption('B')
  await addLink(page).click()
  await field(page, 3, 'Kaynak').selectOption('A')
  await field(page, 3, 'Hedef').selectOption('B')
  await expect(runButton(page)).toBeDisabled()
  await expect(validity(page)).toContainText('A→B için kimyasal bağlantı zaten var (Bağlantı 2)')
  // No raw exception text ever reaches the learner.
  await expect(main(page)).not.toContainText(/must|Error|undefined|NaN/)
})

test('lowering the cell count drops connections to removed cells and says so', async ({ page }) => {
  await preset(page, 'Kendini sürdüren döngü').click()
  await expect(linkRows(page)).toHaveCount(3)
  await cellCount(page).selectOption('2')
  await expect(linkRows(page)).toHaveCount(1)
  await expect(status(page)).toContainText('C çıkarıldı; ona bağlı 2 bağlantı silindi. Hücre sayısı 2.')
  await expect(main(page).getByRole('combobox', { name: 'Uyarılan hücre', exact: true }).locator('option')).toHaveCount(2)
  await cellCount(page).selectOption('6')
  await expect(main(page).getByRole('combobox', { name: 'Uyarılan hücre', exact: true }).locator('option')).toHaveCount(6)
  // If the stimulated cell disappears, the stimulus returns to A instead of pointing at nothing.
  await main(page).getByRole('combobox', { name: 'Uyarılan hücre', exact: true }).selectOption('F')
  await cellCount(page).selectOption('4')
  await expect(main(page).getByRole('combobox', { name: 'Uyarılan hücre', exact: true })).toHaveValue('A')
  await expect(runButton(page)).toBeEnabled()
})

test('Sıfırla returns to the blank circuit and clears the result', async ({ page }) => {
  await preset(page, 'Kendini sürdüren döngü').click()
  await cellCount(page).selectOption('5')
  await setRange(main(page).locator('#builder-amplitude'), 0.4)
  await run(page)
  await expect(result(page)).toBeVisible()
  await resetButton(page).click()
  await expect(linkRows(page)).toHaveCount(0)
  await expect(cellCount(page)).toHaveValue('3')
  await expect(main(page).locator('#builder-amplitude')).toHaveValue('0.8')
  await expect(main(page).getByTestId('builder-not-run')).toBeVisible()
  await expect(result(page)).toHaveCount(0)
  await expect(main(page).getByTestId('builder-preset-note')).toHaveCount(0)
  await expect(status(page)).toContainText('Devre sıfırlandı')
  await expect(runButton(page)).toHaveText('Çalıştır')
})

test('can be operated with the keyboard alone', async ({ page }) => {
  await preset(page, 'Kendini sürdüren döngü').focus()
  await page.keyboard.press('Enter')
  await expect(linkRows(page)).toHaveCount(3)
  // Tab order reaches Run from the presets without a mouse.
  let reached = false
  for (let presses = 0; presses < 80 && !reached; presses++) {
    await page.keyboard.press('Tab')
    reached = await runButton(page).evaluate(element => element === document.activeElement)
  }
  expect(reached, 'Run must be reachable with Tab').toBe(true)
  await page.keyboard.press('Enter')
  await expect(result(page)).toHaveAttribute('data-stale', 'false')
  const sustained = (await metric(page, 'final', 'A'))!
  expect(sustained).toBeGreaterThan(0.9)
  // Arrow keys change a strength slider by one step (0.05) each.
  await strength(page, 1).focus()
  for (let press = 0; press < 4; press++) await page.keyboard.press('ArrowLeft')
  await expect(strength(page, 1)).toHaveValue('0.8')
  await expect(strength(page, 1)).toHaveAttribute('aria-valuetext', '0,80')
  await expect(main(page).getByTestId('builder-stale')).toBeVisible()
  // Add a connection: focus lands in its first field; change its type with the keyboard.
  await addLink(page).focus()
  await page.keyboard.press('Enter')
  await expect(linkRows(page)).toHaveCount(4)
  await expect(field(page, 4, 'Tür')).toBeFocused()
  await page.keyboard.type('B')
  await expect(field(page, 4, 'Tür')).toHaveValue('inhibitory')
  // Remove it again; focus stays inside the list.
  await removeButton(page, 4).focus()
  await page.keyboard.press('Space')
  await expect(linkRows(page)).toHaveCount(3)
  await expect(removeButton(page, 3)).toBeFocused()
  await runButton(page).focus()
  await page.keyboard.press('Enter')
  await expect(result(page)).toHaveAttribute('data-stale', 'false')
  // One weaker link (0.8 instead of 1) lowers the level the loop holds.
  expect((await metric(page, 'final', 'A'))!).toBeLessThan(sustained - 0.3)
})

test('every control has a name and a 44 px touch target, and the page never scrolls sideways at 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(page)
  await cellCount(page).selectOption('6')
  for (let index = 0; index < 6; index++) await addLink(page).click()
  await field(page, 2, 'Tür').selectOption('gap')
  await run(page)
  await expectNoHorizontalOverflow(page)
  const small = await main(page).locator('button, select, input[type="range"]').evaluateAll(elements => elements
    .filter(element => (element as HTMLElement).checkVisibility())
    .map(element => {
      const box = element.getBoundingClientRect()
      return { name: element.getAttribute('aria-label') ?? element.id ?? element.textContent?.slice(0, 30), width: box.width, height: box.height }
    })
    .filter(item => item.height < 43.5 || item.width < 43.5))
  expect(small).toEqual([])
  const tableBox = await main(page).getByTestId('builder-table').boundingBox()
  const plotBox = await main(page).getByTestId('builder-plot').boundingBox()
  expect(tableBox!.x).toBeGreaterThanOrEqual(0)
  expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(390)
  expect(plotBox!.x + plotBox!.width).toBeLessThanOrEqual(390)
  expect(plotBox!.width).toBeGreaterThan(250)
  // Every control has an accessible name.
  const unnamed = await main(page).getByRole('combobox').evaluateAll(elements => elements.filter(element => !(element as HTMLSelectElement).labels?.length && !element.getAttribute('aria-labelledby')).map(element => element.id))
  expect(unnamed).toEqual([])
})

test('the chart redraws to the new width when the window changes', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Window resizing is exercised in the desktop project; a mobile device keeps its own layout width.')
  await preset(page, 'İleri beslemeli zincir').click()
  await run(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect.poll(async () => (await main(page).getByTestId('builder-plot').getAttribute('viewBox'))?.split(' ')[2]).not.toBe(undefined)
  const wide = Number((await main(page).getByTestId('builder-plot').getAttribute('viewBox'))!.split(' ')[2])
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => Number((await main(page).getByTestId('builder-plot').getAttribute('viewBox'))!.split(' ')[2])).toBeLessThan(wide - 100)
  await expectNoHorizontalOverflow(page)
})

test('a tall six-cell result stays reachable on a 1440 x 900 window: the stuck card scrolls inside itself', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The result card is only sticky on wide, tall windows.')
  await page.setViewportSize({ width: 1440, height: 900 })
  await preset(page, 'Kendini sürdüren döngü').click()
  await cellCount(page).selectOption('6')
  await run(page)
  await page.evaluate(() => window.scrollTo(0, 1100))
  const card = main(page).locator('.builder-results')
  const box = await card.evaluate(element => ({ height: element.getBoundingClientRect().height, scrollHeight: element.scrollHeight, viewport: window.innerHeight }))
  expect(box.height, 'A stuck card taller than the window would hide its table and sentences').toBeLessThanOrEqual(box.viewport)
  expect(box.scrollHeight).toBeGreaterThan(box.height)
  await card.evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect(main(page).getByTestId('builder-facts')).toBeInViewport()
  await card.focus()
  await expect(card).toBeFocused()
})

test('the lingering-activity sentence names a feedback loop only when the circuit has one', async ({ page }) => {
  await cellCount(page).selectOption('6')
  for (let index = 1; index <= 5; index++) {
    await addLink(page).click()
    await field(page, index, 'Kaynak').selectOption('ABCDEF'[index - 1]!)
    await field(page, index, 'Hedef').selectOption('ABCDEF'[index]!)
    await setRange(strength(page, index), 2)
  }
  await setRange(main(page).locator('#builder-onset'), 500)
  await setRange(main(page).locator('#builder-pulse'), 50)
  await setRange(main(page).locator('#builder-amplitude'), 1)
  await run(page)
  const facts = main(page).getByTestId('builder-facts')
  await expect(facts).toContainText('hâlâ 0,10 düzeyinde ya da üstünde')
  await expect(facts).toContainText('Devrede uyarıcı bir geri besleme döngüsü yok')
  await expect(facts).not.toContainText('etkinliği sürdürüyor olabilir')
  await addLink(page).click()
  await field(page, 6, 'Kaynak').selectOption('F')
  await field(page, 6, 'Hedef').selectOption('A')
  await run(page)
  await expect(facts).toContainText('Devrede uyarıcı bir geri besleme döngüsü var')
})
