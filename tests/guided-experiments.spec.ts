import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { defaultConfig, illustrativeCircuit } from '../src/model/circuit'
import { simulate } from '../src/model/simulation'
import type { SimulationConfig, SimulationResult } from '../src/model/types'

type ExperimentId = 'stimulus' | 'connection' | 'tau'
const guidedPath = '/ogren/rehberli-deneyler'
const lessonPath = '/ogren/norondan-devreye'
const navigation = (page: Page) => page.getByRole('navigation', { name: 'Öğrenme ve deneyler', exact: true })
const guidedLink = (page: Page) => navigation(page).getByRole('link', { name: 'Rehberli deneyler', exact: true })
const lessonLink = (page: Page) => navigation(page).getByRole('link', { name: 'Nörondan devreye', exact: true })
const experimentLink = (page: Page) => navigation(page).getByRole('link', { name: 'Devre deneyleri', exact: true })
const main = (page: Page) => page.getByRole('main')
const section = (page: Page, id: ExperimentId) => main(page).locator(`#guided-${id}`)
const result = (page: Page, id: ExperimentId) => section(page, id).getByTestId(`guided-result-${id}`)
const runSettings = (page: Page, id: ExperimentId) => section(page, id).getByTestId(`guided-run-settings-${id}`)
const prediction = (page: Page, id: ExperimentId) => section(page, id).locator(`#guided-${id}-prediction`)
const cells = (page: Page) => page.getByRole('group', { name: 'İncelenecek hücre', exact: true })
const cell = (page: Page, id: string) => cells(page).getByRole('button').filter({ has: page.locator('span', { hasText: new RegExp(`^${id}$`) }) })
const view = (page: Page, id: '2D' | '3D') => page.getByRole('tab', { name: id === '2D' ? '2D · bağlantı haritası' : '3D · şematik uzay', exact: true })
const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  const attached = new WeakSet<Page>()
  const attach = (target: Page) => {
    if (attached.has(target)) return
    attached.add(target)
    target.on('pageerror', error => errors.push(error.message))
    target.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  }
  attach(page)
  page.context().on('page', attach)
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? [], 'Guided scenarios must not log browser exceptions or console errors').toEqual([])
})

async function expectGuided(page: Page) {
  await expect(page).toHaveURL(new RegExp(`${guidedPath}/?(?:[?#].*)?$`))
  await expect(page).toHaveTitle('Rehberli deneyler · Circuitiary')
  await expect(main(page)).toHaveCount(1)
  await expect(main(page)).toHaveAttribute('id', 'guided-experiments')
  await expect(main(page).getByRole('heading', { name: 'Rehberli deneyler', level: 1, exact: true })).toBeVisible()
  await expect(guidedLink(page)).toHaveAttribute('aria-current', 'page')
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

function enginePair(id: ExperimentId, options: { connectionId?: string; comparisonTauMs?: number } = {}) {
  const settings = (amplitude: number): SimulationConfig => ({ ...defaultConfig, stimulus: { ...defaultConfig.stimulus, amplitude } })
  const baseline = settings(id === 'stimulus' ? .4 : .8)
  const comparison = settings(.8)
  if (id === 'connection') comparison.silencedConnectionId = options.connectionId ?? 'I3-O1'
  if (id === 'tau') comparison.tauOverrides = { O1: options.comparisonTauMs ?? 90 }
  return {
    baseline: simulate(illustrativeCircuit, baseline),
    comparison: simulate(illustrativeCircuit, comparison),
  }
}

function metrics(simulation: SimulationResult) {
  const values = simulation.activity.O1!
  const peak = Math.max(...values)
  const peakIndex = values.indexOf(peak)
  const responseIndex = values.findIndex(value => value >= .1)
  return {
    peak,
    peakTimeMs: peak > 0 ? simulation.timesMs[peakIndex]! : null,
    responseTimeMs: responseIndex < 0 ? null : simulation.timesMs[responseIndex]!,
    responseDelayMs: responseIndex < 0 ? null : simulation.timesMs[responseIndex]! - simulation.settings.stimulus.onsetMs,
    end: values.at(-1)!,
  }
}

async function readNumber(locator: Locator) {
  const text = (await locator.textContent())?.trim() ?? ''
  const token = text.match(/[+\-−]?\d+(?:[.,]\d+)?/)?.[0]
  const value = token ? Number(token.replace('−', '-').replace(',', '.')) : Number.NaN
  expect(Number.isFinite(value), `Expected a finite numeric readout: ${text}`).toBe(true)
  return value
}

async function exported(page: Page) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: /Deney kaydını indir/ }).click()
  const path = await (await pending).path()
  expect(path).not.toBeNull()
  return JSON.parse(await readFile(path!, 'utf8'))
}

async function traceMatches(path: Locator, simulation: SimulationResult) {
  const points = await path.evaluate(element => {
    const svg = (element as SVGPathElement).ownerSVGElement
    if (!svg) throw new Error('A guided trace must be drawn in a real SVG')
    const labels = [...svg.querySelectorAll('text')]
    const one = labels.find(label => /^(?:1)(?:[.,]0+)?$/.test(label.textContent?.trim() ?? ''))
    const zero = labels.find(label => /^(?:0)(?:[.,]0+)?$/.test(label.textContent?.trim() ?? '') && label.getAttribute('x') === one?.getAttribute('x'))
    if (!one || !zero) throw new Error('The shared 0–1 axis must remain readable')
    const upperGrid = one.parentElement?.querySelector('line')
    const lowerGrid = zero.parentElement?.querySelector('line')
    const timeLabels = labels.filter(label => label.getAttribute('text-anchor') === 'middle' && /^\d+$/.test(label.textContent?.trim() ?? ''))
    const timeStart = timeLabels.find(label => label.textContent?.trim() === '0')
    const timeEnd = timeLabels.at(-1)
    const stimulus = svg.querySelector('rect')
    if (!upperGrid || !lowerGrid || !timeStart || !timeEnd || !stimulus) throw new Error('The actual grid, time labels and stimulus band must be present')
    const axis = {
      xStart: Number(lowerGrid.getAttribute('x1')), xEnd: Number(lowerGrid.getAttribute('x2')),
      yZero: Number(lowerGrid.getAttribute('y1')), yOne: Number(upperGrid.getAttribute('y1')),
      timeStart: Number(timeStart.textContent), timeEnd: Number(timeEnd.textContent),
      timeLabelStartX: Number(timeStart.getAttribute('x')), timeLabelEndX: Number(timeEnd.getAttribute('x')),
      bandX: Number(stimulus.getAttribute('x')), bandWidth: Number(stimulus.getAttribute('width')),
    }
    const pairs = [...(element.getAttribute('d') ?? '').matchAll(/[ML]\s*([-+\d.e]+)\s*,\s*([-+\d.e]+)/gi)].map(match => ({ x: Number(match[1]), y: Number(match[2]) }))
    return { axis, pairs }
  })
  const axis = points.axis
  const height = axis.yZero - axis.yOne
  const width = axis.xEnd - axis.xStart
  expect(height).toBeGreaterThan(0)
  expect(width).toBeGreaterThan(0)
  expect(axis.timeStart).toBe(0)
  expect(axis.timeEnd).toBe(simulation.timesMs.at(-1)!)
  expect(axis.timeLabelStartX).toBeCloseTo(axis.xStart, 10)
  expect(axis.timeLabelEndX).toBeCloseTo(axis.xEnd, 10)
  expect(axis.bandX).toBeCloseTo(axis.xStart + simulation.settings.stimulus.onsetMs / axis.timeEnd * width, 10)
  expect(axis.bandWidth).toBeCloseTo(simulation.settings.stimulus.durationMs / axis.timeEnd * width, 10)
  expect(points.pairs).toHaveLength(simulation.timesMs.length)
  let maximumActivityError = 0
  let maximumTimeError = 0
  const nonfinite: number[] = []
  simulation.activity.O1!.forEach((value, index) => {
    const point = points.pairs[index]!
    if (!(Number.isFinite(point.x) && Number.isFinite(point.y))) nonfinite.push(index)
    maximumActivityError = Math.max(maximumActivityError, Math.abs((axis.yZero - point.y) / height - value))
    maximumTimeError = Math.max(maximumTimeError, Math.abs(point.x - (axis.xStart + simulation.timesMs[index]! / axis.timeEnd * width)))
  })
  expect(nonfinite).toEqual([])
  expect(maximumActivityError, 'Every plotted O1 sample must match the existing engine on the shared 0–1 axis').toBeLessThan(.0002)
  expect(maximumTimeError, 'Every plotted x coordinate must match the actual sampled model time').toBeLessThan(.02)
}

async function run(page: Page, id: ExperimentId, runNumber: number) {
  const button = section(page, id).getByRole('button', { name: runNumber === 1 ? 'Deneyi çalıştır' : 'Yeniden çalıştır', exact: true })
  await expect(button).toHaveAttribute('aria-controls', `guided-result-region-${id}`)
  await button.click()
  await expect(result(page, id)).toBeVisible()
  await expect(result(page, id)).toHaveAttribute('data-run-number', String(runNumber))
  await expect(result(page, id)).toHaveAttribute('data-stale', 'false')
  await expect(section(page, id).getByTestId(`guided-status-${id}`)).toHaveAttribute('aria-live', 'polite')
  await expect(section(page, id).getByTestId(`guided-status-${id}`)).toHaveAttribute('role', 'status')
  await expect(section(page, id).getByTestId(`guided-status-${id}`)).toHaveAttribute('aria-atomic', 'true')
  await expect(section(page, id).getByTestId(`guided-status-${id}`)).toContainText(`Koşul kaydı #${runNumber} hazır`)
}

async function expectEngineResult(page: Page, id: ExperimentId, options: { connectionId?: string; comparisonTauMs?: number } = {}) {
  const pair = enginePair(id, options)
  const settings = runSettings(page, id)
  await expect(settings).toHaveAttribute('data-baseline-amplitude', String(pair.baseline.settings.stimulus.amplitude))
  await expect(settings).toHaveAttribute('data-comparison-amplitude', String(pair.comparison.settings.stimulus.amplitude))
  await expect(settings).toHaveAttribute('data-baseline-o1-tau', '30')
  await expect(settings).toHaveAttribute('data-comparison-o1-tau', String(pair.comparison.settings.tauOverrides?.O1 ?? pair.comparison.settings.tauMs))
  await expect(settings).toHaveAttribute('data-silenced-connection', pair.comparison.settings.silencedConnectionId ?? '')
  for (const condition of ['baseline', 'comparison'] as const) {
    const summary = metrics(pair[condition])
    for (const [metric, value] of Object.entries({ peak: summary.peak, 'peak-time': summary.peakTimeMs, 'response-time': summary.responseTimeMs, 'response-delay': summary.responseDelayMs, end: summary.end })) {
      const readout = section(page, id).getByTestId(`guided-${id}-${condition}-${metric}`)
      if (value === null) {
        await expect(readout).toHaveAttribute('data-value', 'null')
        await expect(readout).toHaveText('—')
      } else {
        expect(Number(await readout.getAttribute('data-value'))).toBeCloseTo(value, 12)
        if (metric === 'peak' || metric === 'end') expect(await readNumber(readout)).toBeCloseTo(value, 3)
        else await expect(readout).toHaveText(`${value} ms`)
      }
    }
    await traceMatches(result(page, id).locator(`[data-guided-trace="${condition}"]`), pair[condition])
  }
  await expect(result(page, id).getByRole('img', { name: /O1 için iki koşulun boyutsuz aktivite grafiği/ })).toBeVisible()
  const delta = pair.comparison.activity.O1!.reduce((peak, value) => Math.max(peak, value), 0)
    - pair.baseline.activity.O1!.reduce((peak, value) => Math.max(peak, value), 0)
  const difference = section(page, id).getByTestId(`guided-peak-difference-${id}`)
  expect(Number(await difference.getAttribute('data-value'))).toBeCloseTo(delta, 12)
  expect(await readNumber(difference)).toBeCloseTo(delta, 3)
  await expect(result(page, id)).toContainText('biyolojik ateşleme eşiği değildir')
}

test('guided direct load and reload expose accessible unrun cards, keyboard focus and a bounded mobile layout', async ({ page }, testInfo) => {
  await page.goto(guidedPath)
  await expectGuided(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.locator('#amplitude')).toHaveCount(0)
  await expect(main(page).locator('section[data-experiment-id]')).toHaveCount(3)
  for (const id of ['stimulus', 'connection', 'tau'] as const) {
    await expect(section(page, id)).toHaveAttribute('data-experiment-id', id)
    await expect(prediction(page, id)).toHaveValue('')
    await expect(section(page, id).getByRole('button', { name: 'Deneyi çalıştır', exact: true })).toBeEnabled()
    await expect(result(page, id)).toHaveCount(0)
  }
  const unlabelled = await main(page).evaluate(element => [...element.querySelectorAll('input,select,textarea')].filter(control => {
    const native = control as HTMLInputElement
    return !([...(native.labels ?? [])].some(label => label.textContent?.trim()) || control.getAttribute('aria-label')?.trim() || control.getAttribute('aria-labelledby')?.trim().split(/\s+/).every(id => document.getElementById(id)?.textContent?.trim()))
  }).map(control => control.id))
  expect(unlabelled).toEqual([])
  await expect(section(page, 'stimulus').getByRole('combobox', { name: 'O1’in tepe değeri nasıl değişebilir?', exact: true })).toBeVisible()
  await expect(section(page, 'connection').getByRole('combobox', { name: 'Seçtiğin bağlantı kaldırıldığında O1’in tepe değeri ne yapabilir?', exact: true })).toBeVisible()
  await expect(section(page, 'tau').getByRole('combobox', { name: 'O1’in zaman sabiti artınca tepe değeri nasıl değişebilir?', exact: true })).toBeVisible()
  await expect(section(page, 'connection').getByRole('combobox', { name: 'Kaldırılacak bağlantı', exact: true })).toBeVisible()
  await expect(section(page, 'tau').getByRole('slider', { name: /^O1’in yeni zaman sabiti/ })).toBeVisible()
  await expect(page.getByTestId('guided-progress')).toHaveText('0/3 deney çalıştırıldı')
  const skip = page.getByRole('link', { name: 'İçeriğe geç', exact: true })
  await expect(skip).toHaveAttribute('href', '#guided-experiments')
  await skip.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`${guidedPath}#guided-experiments$`))
  await expect(main(page)).toBeFocused()
  await expectNoOverflow(page)
  await page.reload()
  await expectGuided(page)
  await expect(page.getByTestId('guided-progress')).toHaveText('0/3 deney çalıştırıldı')
  await expectNoOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('guided-unrun.png'), fullPage: true })
})

test('optional or wrong predictions still run the real stimulus engine and preserve the recorded prediction until rerun', async ({ page }) => {
  await page.goto(guidedPath)
  await expectGuided(page)
  await prediction(page, 'stimulus').focus()
  const keyboardRun = section(page, 'stimulus').getByRole('button', { name: 'Deneyi çalıştır', exact: true })
  await keyboardRun.focus()
  await page.keyboard.press('Enter')
  await expect(result(page, 'stimulus')).toHaveAttribute('data-run-number', '1')
  await expect(section(page, 'stimulus').getByRole('button', { name: 'Yeniden çalıştır', exact: true })).toBeFocused()
  await expect(page.getByTestId('guided-status-stimulus')).toHaveAttribute('role', 'status')
  await expect(page.getByTestId('guided-status-stimulus')).toHaveAttribute('aria-live', 'polite')
  await expect(page.getByTestId('guided-status-stimulus')).toHaveAttribute('aria-atomic', 'true')
  await expect(page.getByTestId('guided-status-stimulus')).toContainText('Koşul kaydı #1 hazır')
  await expectEngineResult(page, 'stimulus')
  await expect(page.getByTestId('guided-recorded-prediction-stimulus')).toContainText('Tahmin eklenmedi')
  const paths = result(page, 'stimulus').locator('[data-guided-trace]')
  const before = await paths.evaluateAll(elements => elements.map(element => element.getAttribute('d')))
  await prediction(page, 'stimulus').selectOption('decrease')
  await expect(result(page, 'stimulus')).toHaveAttribute('data-run-number', '1')
  await expect(result(page, 'stimulus')).toHaveAttribute('data-stale', 'false')
  await expect(page.getByTestId('guided-recorded-prediction-stimulus')).toContainText('Tahmin eklenmedi')
  await expect(section(page, 'stimulus').locator('.prediction-note')).toBeVisible()
  expect(await paths.evaluateAll(elements => elements.map(element => element.getAttribute('d')))).toEqual(before)
  await run(page, 'stimulus', 2)
  await expectEngineResult(page, 'stimulus')
  await expect(page.getByTestId('guided-recorded-prediction-stimulus')).toContainText('Daha düşük olabilir')
  await expect(page.getByTestId('guided-prediction-feedback-stimulus')).toContainText('farklı')
  await expect(page.getByTestId('guided-progress')).toHaveText('1/3 deney çalıştırıldı')
  await page.reload()
  await expectGuided(page)
  await expect(result(page, 'stimulus')).toHaveCount(0)
  await expect(prediction(page, 'stimulus')).toHaveValue('')
  await expect(page.getByTestId('guided-progress')).toHaveText('0/3 deney çalıştırıldı')
  await expectNoOverflow(page)
})

test('lesson answers and controls and guided snapshots survive route changes and native history independently', async ({ page }, testInfo) => {
  await page.goto(lessonPath)
  await expect(main(page)).toHaveAttribute('id', 'neuron-lesson')
  await page.locator('#lesson-stimulus').fill('0.82')
  await page.locator('#lesson-threshold').fill('0.42')
  await page.getByRole('group', { name: 'Nöronun parçaları', exact: true }).getByRole('button', { name: 'Akson', exact: true }).click()
  await page.locator('input[name="q1"][value="receive"]').check()
  await page.locator('input[name="q8"][value="diverse"]').check()
  const expectLessonState = async () => {
    await expect(main(page)).toHaveCount(1)
    await expect(main(page)).toHaveAttribute('id', 'neuron-lesson')
    await expect(page).toHaveTitle('Nörondan devreye · Circuitiary')
    await expect(page.locator('#lesson-stimulus')).toHaveValue('0.82')
    await expect(page.locator('#lesson-threshold')).toHaveValue('0.42')
    await expect(page.getByTestId('neuron-part-title')).toHaveText('Akson')
    await expect(page.locator('input[name="q1"][value="receive"]')).toBeChecked()
    await expect(page.locator('input[name="q8"][value="diverse"]')).toBeChecked()
    await expect(page.getByTestId('quiz-feedback-q1')).toHaveAttribute('data-correct', 'true')
    await expect(page.getByTestId('quiz-feedback-q8')).toHaveAttribute('data-correct', 'true')
  }
  await guidedLink(page).click()
  await expectGuided(page)
  await expect(page.locator('#guided-title')).toBeFocused()
  await prediction(page, 'stimulus').selectOption('unsure')
  await run(page, 'stimulus', 1)
  await expectEngineResult(page, 'stimulus')
  await expect(page.getByTestId('guided-recorded-prediction-stimulus')).toContainText('Emin değilim')
  await expect(page.getByTestId('guided-prediction-feedback-stimulus')).toContainText('Emin değilim')
  await expectNoOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('guided-stimulus-result.png'), fullPage: true })
  await lessonLink(page).click()
  await expectLessonState()
  await expect(page.locator('#lesson-title')).toBeFocused()
  await expect(page.locator('#guided-experiments')).not.toBeVisible()
  await page.goBack()
  await expectGuided(page)
  await expect(prediction(page, 'stimulus')).toHaveValue('unsure')
  await expect(result(page, 'stimulus')).toHaveAttribute('data-run-number', '1')
  await expectEngineResult(page, 'stimulus')
  await page.goForward()
  await expectLessonState()
  await guidedLink(page).click()
  await expectGuided(page)
  await expect(result(page, 'stimulus')).toHaveAttribute('data-run-number', '1')
  await page.getByRole('button', { name: 'Rehberli deneyleri sıfırla', exact: true }).click()
  await expect(page.getByTestId('guided-progress')).toHaveText('0/3 deney çalıştırıldı')
  await lessonLink(page).click()
  await expectLessonState()
  await expectNoOverflow(page)
})

test('guided comparisons preserve the original toy experiment and the real anatomy, 3D view and complete simulation record', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.circuit-canvas canvas').first()).toBeVisible()
  await page.locator('#amplitude').fill('0.55')
  await page.locator('#changed-tau').fill('180')
  await page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true }).fill('400')
  await cell(page, 'O2').click()
  await page.getByRole('button', { name: 'C Zaman sabiti değişti', exact: true }).click()
  const toyBefore = await exported(page)
  await guidedLink(page).click()
  await expectGuided(page)
  await expect(page.locator('#amplitude')).not.toBeVisible()
  await run(page, 'stimulus', 1)
  await expectEngineResult(page, 'stimulus')
  await experimentLink(page).click()
  await expect(main(page)).toHaveCount(1)
  await expect(main(page)).toHaveAttribute('id', 'top')
  await expect(page).toHaveTitle('Circuitiary · Devre deneyleri')
  await expect(page.locator('#amplitude')).toHaveValue('0.55')
  await expect(page.locator('#changed-tau')).toHaveValue('180')
  await expect(page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true })).toHaveValue('400')
  await expect(cell(page, 'O2')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'C Zaman sabiti değişti', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(view(page, '2D')).toHaveAttribute('aria-selected', 'true')
  expect(await exported(page)).toEqual(toyBefore)

  await page.getByRole('group', { name: 'Devre modu', exact: true }).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true }).click()
  await expect(cells(page).getByRole('button')).toHaveCount(30)
  await page.locator('#chemical-gain').fill('0.5')
  await page.locator('#gap-gain').fill('0.4')
  await page.locator('#amplitude').fill('0.6')
  await cell(page, 'AVAR').click()
  await view(page, '3D').click()
  await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready', { timeout: 15_000 })
  const realBefore = await exported(page)
  await guidedLink(page).click()
  await expectGuided(page)
  await expect(result(page, 'stimulus')).toHaveAttribute('data-run-number', '1')
  await run(page, 'tau', 1)
  await expectEngineResult(page, 'tau')
  await page.locator('#guided-tau-value').fill('140')
  await expect(result(page, 'tau')).toHaveAttribute('data-stale', 'true')
  await page.getByRole('button', { name: 'Rehberli deneyleri sıfırla', exact: true }).click()
  await experimentLink(page).click()
  await expect(cells(page).getByRole('button')).toHaveCount(30)
  await expect(view(page, '3D')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready')
  await expect(page.locator('.circuit-3d')).toHaveAttribute('data-node-count', '30')
  await expect(page.locator('canvas.circuit-3d-canvas')).toBeVisible()
  await expect(cell(page, 'AVAR')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#chemical-gain')).toHaveValue('0.5')
  await expect(page.locator('#gap-gain')).toHaveValue('0.4')
  await expect(page.locator('#amplitude')).toHaveValue('0.6')
  await expect(page.getByRole('region', { name: 'Gerçek veri kaynağı ve sınırları', exact: true })).toBeVisible()
  expect(await exported(page)).toEqual(realBefore)
  await expectNoOverflow(page)
})

test('guided navigation preserves old hashes and browser history and supports native touch, modified and middle clicks', async ({ page, isMobile }) => {
  await page.goto('/#assumptions')
  await expect(page.locator('#assumptions')).toBeVisible()
  await expect(page.locator('#assumptions')).toBeInViewport()
  await expect(guidedLink(page)).toHaveAttribute('href', guidedPath)
  await expect(guidedLink(page)).not.toHaveAttribute('role', 'button')
  await guidedLink(page).click()
  await expectGuided(page)
  await expect(page.locator('#guided-title')).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(/\/#assumptions$/)
  await expect(main(page)).toHaveCount(1)
  await expect(main(page)).toHaveAttribute('id', 'top')
  await expect(page.locator('#assumptions')).toBeInViewport()
  await page.goForward()
  await expectGuided(page)
  await page.getByRole('navigation', { name: 'Rehberli deney adımları', exact: true }).locator('a[href="#guided-tau"]').click()
  await expect(page).toHaveURL(new RegExp(`${guidedPath}#guided-tau$`))
  await expect(section(page, 'tau')).toBeInViewport()
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`${guidedPath}$`))
  await expectGuided(page)
  await experimentLink(page).click()
  await page.getByRole('link', { name: /Modeli anlamak/ }).click()
  await expect(page).toHaveURL(/\/#assumptions$/)
  await expect(page.locator('#assumptions')).toBeInViewport()
  const sourceUrl = page.url()
  if (isMobile) {
    await guidedLink(page).tap()
    await expectGuided(page)
    await experimentLink(page).tap()
    await expect(page).toHaveURL(/\/$/)
    await expect(main(page)).toHaveAttribute('id', 'top')
    await expectNoOverflow(page)
    return
  }
  // A native link tab can lack an opener. BrowserContext.page observes the
  // actual new tab without changing the genuine Cmd/Ctrl or middle click.
  const context = page.context()
  expect(context.pages()).toHaveLength(1)
  const modifiedTab = context.waitForEvent('page')
  await guidedLink(page).click({ modifiers: ['ControlOrMeta'] })
  const modified = await modifiedTab
  expect(modified).not.toBe(page)
  expect(context.pages()).toHaveLength(2)
  await expectGuided(modified)
  await expect(page).toHaveURL(sourceUrl)
  await modified.close()
  expect(context.pages()).toHaveLength(1)
  const middleTab = context.waitForEvent('page')
  await guidedLink(page).click({ button: 'middle' })
  const middle = await middleTab
  expect(middle).not.toBe(page)
  expect(context.pages()).toHaveLength(2)
  await expectGuided(middle)
  await expect(page).toHaveURL(sourceUrl)
  await middle.close()
  expect(context.pages()).toHaveLength(1)
  await expectNoOverflow(page)
})

test('connection and O1 tau drafts leave old results intact, reruns match the engine and resets stay scoped', async ({ page }) => {
  await page.goto(guidedPath)
  await prediction(page, 'connection').selectOption('increase')
  await run(page, 'connection', 1)
  await expectEngineResult(page, 'connection')
  await expect(page.getByTestId('guided-no-peak-connection')).toBeVisible()
  await expect(page.getByTestId('guided-no-response-connection')).toBeVisible()
  const edgePaths = result(page, 'connection').locator('[data-guided-trace]')
  const initialEdge = await edgePaths.evaluateAll(elements => elements.map(element => element.getAttribute('d')))
  await page.locator('#guided-connection-edge').selectOption('I4-O1')
  await expect(result(page, 'connection')).toHaveAttribute('data-stale', 'true')
  await expect(page.getByTestId('guided-stale-connection')).toHaveAttribute('role', 'status')
  await expect(runSettings(page, 'connection')).toHaveAttribute('data-silenced-connection', 'I3-O1')
  expect(await edgePaths.evaluateAll(elements => elements.map(element => element.getAttribute('d')))).toEqual(initialEdge)
  await expectEngineResult(page, 'connection')
  await run(page, 'connection', 2)
  await expectEngineResult(page, 'connection', { connectionId: 'I4-O1' })
  await expect(page.getByTestId('guided-no-peak-connection')).toHaveCount(0)
  await prediction(page, 'tau').selectOption('unsure')
  await run(page, 'tau', 1)
  await expectEngineResult(page, 'tau')
  const tauPaths = result(page, 'tau').locator('[data-guided-trace]')
  const initialTau = await tauPaths.evaluateAll(elements => elements.map(element => element.getAttribute('d')))
  const slider = page.locator('#guided-tau-value')
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(slider).toHaveValue('100')
  await page.keyboard.press('Home')
  await expect(slider).toHaveValue('40')
  await page.keyboard.press('End')
  await expect(slider).toHaveValue('180')
  await expect(result(page, 'tau')).toHaveAttribute('data-stale', 'true')
  await expect(page.getByTestId('guided-stale-tau')).toContainText('önceki çalıştırmaya ait')
  await expect(runSettings(page, 'tau')).toHaveAttribute('data-comparison-o1-tau', '90')
  expect(await tauPaths.evaluateAll(elements => elements.map(element => element.getAttribute('d')))).toEqual(initialTau)
  await expectEngineResult(page, 'tau')
  await run(page, 'tau', 2)
  await expectEngineResult(page, 'tau', { comparisonTauMs: 180 })
  await expect(page.getByTestId('guided-explanation-tau')).toContainText('Diğer yedi hücre 30 ms')
  await expect(page.getByTestId('guided-progress')).toHaveText('2/3 deney çalıştırıldı')
  await section(page, 'connection').getByRole('button', { name: 'Bu deneyi sıfırla', exact: true }).click()
  await expect(page.getByTestId('guided-status-connection')).toContainText('Bu deney sıfırlandı')
  await expect(result(page, 'connection')).toHaveCount(0)
  await expect(page.locator('#guided-connection-edge')).toHaveValue('I3-O1')
  await expect(result(page, 'tau')).toHaveAttribute('data-run-number', '2')
  await expectEngineResult(page, 'tau', { comparisonTauMs: 180 })
  await expect(page.getByTestId('guided-progress')).toHaveText('1/3 deney çalıştırıldı')
  await page.getByRole('button', { name: 'Rehberli deneyleri sıfırla', exact: true }).click()
  for (const id of ['stimulus', 'connection', 'tau'] as const) {
    await expect(result(page, id)).toHaveCount(0)
    await expect(prediction(page, id)).toHaveValue('')
  }
  await expect(slider).toHaveValue('90')
  await expect(page.getByTestId('guided-progress')).toHaveText('0/3 deney çalıştırıldı')
  await expectNoOverflow(page)
})
