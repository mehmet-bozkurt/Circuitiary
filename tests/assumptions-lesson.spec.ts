import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { exportRecord } from './support/export'
import { cell, cells, experimentLink, experimentUi, expectNoHorizontalOverflow, main, navLabels, navLink, view } from './support/ui'
import { buildRealCircuit, parseRealConnectome } from '../src/model/realConnectome'
import { simulate } from '../src/model/simulation'
import type { RealConnectome, SimulationConfig, SimulationResult, SourceReference } from '../src/model/types'

const lessonPath = '/ogren/gercek-veri-ve-varsayimlar'
const neuronPath = '/ogren/norondan-devreye'
const guidedPath = '/ogren/rehberli-deneyler'
const readingPath = '/ogren/devreyi-okumak'
const lessonLink = (page: Page) => navLink(page, navLabels.assumptions)
const variable = (page: Page) => main(page).locator('#assumptions-variable')
const comparisonValue = (page: Page) => main(page).locator('#assumptions-comparison-value')
const result = (page: Page) => main(page).getByTestId('assumptions-result')
type Variable = 'chemical-gain' | 'gap-gain' | 'time-constant'

let anatomy: RealConnectome
test.beforeAll(async () => {
  anatomy = JSON.parse(await readFile(new URL('../data/local/cook-subset.json', import.meta.url), 'utf8')) as RealConnectome
  expect(anatomy.neurons).toHaveLength(30)
  expect(anatomy.chemicalEdges).toHaveLength(196)
  expect(anatomy.chemicalEdges.filter(edge => edge.source === edge.target)).toHaveLength(5)
  expect(anatomy.gapEdges).toHaveLength(50)
})

interface Diagnostics {
  exceptions: string[]
  consoleErrors: { message: string; url: string }[]
  expectedStatuses: Set<number>
}
const diagnostics = new WeakMap<Page, Diagnostics>()
test.beforeEach(async ({ page }) => {
  const record: Diagnostics = { exceptions: [], consoleErrors: [], expectedStatuses: new Set() }
  diagnostics.set(page, record)
  const attached = new WeakSet<Page>()
  const attach = (target: Page) => {
    if (attached.has(target)) return
    attached.add(target)
    target.on('pageerror', error => record.exceptions.push(error.message))
    target.on('console', message => {
      if (message.type() === 'error') record.consoleErrors.push({ message: message.text(), url: message.location().url })
    })
  }
  attach(page)
  page.context().on('page', attach)
})
test.afterEach(async ({ page }) => {
  const record = diagnostics.get(page)!
  expect(record.exceptions, 'No uncaught exceptions in the real-data assumptions lesson').toEqual([])
  const unexpected = record.consoleErrors.filter(error => {
    const status = /^Failed to load resource: the server responded with a status of (\d+)\b/.exec(error.message)
    return !(status && record.expectedStatuses.has(Number(status[1]))
      && new URL(error.url || 'about:blank').pathname === '/api/local-connectome')
  })
  expect(unexpected, 'Only deliberate local GET failures may produce resource errors').toEqual([])
})

async function expectLesson(page: Page, loaded = true) {
  await expect(page).toHaveURL(new RegExp(`${lessonPath}/?(?:[?#].*)?$`))
  await expect(page).toHaveTitle('Gerçek veri ve varsayımlar · Circuitiary')
  await expect(main(page)).toHaveCount(1)
  await expect(main(page)).toHaveAttribute('id', 'real-assumptions')
  await expect(main(page).getByRole('heading', { name: 'Gerçek veri ve varsayımlar', level: 1, exact: true })).toHaveAttribute('id', 'assumptions-title')
  await expect(lessonLink(page)).toHaveAttribute('aria-current', 'page')
  if (loaded) {
    await expect(main(page)).toHaveAttribute('data-data-state', 'ready')
    await expect(variable(page)).toBeEnabled()
  }
}

function enginePair(controlled: Variable, value: number) {
  // Deliberately use only the pre-existing parser, circuit builder and engine.
  // Never import the new lesson controller or its metric/snapshot helpers.
  const data = parseRealConnectome(anatomy)
  const baselineParameters = { chemicalGain: .8, gapGain: .2 }
  const comparisonParameters = {
    chemicalGain: controlled === 'chemical-gain' ? value : .8,
    gapGain: controlled === 'gap-gain' ? value : .2,
  }
  const config = (tauMs: number): SimulationConfig => ({
    durationMs: 700, dtMs: 1, tauMs,
    stimulus: { target: 'AVER', onsetMs: 100, durationMs: 200, amplitude: .8 },
  })
  const baselineCircuit = buildRealCircuit(data, baselineParameters)
  const comparisonCircuit = buildRealCircuit(data, comparisonParameters)
  return {
    baselineParameters, comparisonParameters, baselineCircuit, comparisonCircuit,
    baseline: simulate(baselineCircuit, config(30)),
    comparison: simulate(comparisonCircuit, config(controlled === 'time-constant' ? value : 30)),
  }
}

function metrics(simulation: SimulationResult) {
  const values = simulation.activity.AVAR!
  const peak = Math.max(...values)
  return { peak, 'peak-time': peak > 0 ? simulation.timesMs[values.indexOf(peak)]! : null, end: values.at(-1)! }
}

async function readNumber(locator: Locator) {
  const text = (await locator.textContent())?.trim() ?? ''
  const token = text.match(/[+\-−]?\d+(?:[.,]\d+)?(?:[eE][+\-−]?\d+)?/)?.[0]
  const value = token ? Number(token.replaceAll('−', '-').replace(',', '.')) : Number.NaN
  expect(Number.isFinite(value), `Expected a finite visible numeric value: ${text}`).toBe(true)
  return value
}

async function expectVisibleNumber(locator: Locator, expected: number) {
  const actual = await readNumber(locator)
  if (expected === 0) expect(actual).toBe(0)
  else {
    expect(actual, 'A nonzero model result must remain nonzero in the visible numeric readout').not.toBe(0)
    expect(Math.abs(actual - expected) / Math.abs(expected), 'Visible decimal/scientific notation preserves at least meaningful relative precision').toBeLessThanOrEqual(.005)
  }
}

async function readDataNumber(locator: Locator) {
  await expect(locator).toHaveAttribute('data-value', /\S+/)
  const value = Number(await locator.getAttribute('data-value'))
  expect(Number.isFinite(value), 'Recorded numeric metadata must be present and finite, including exact zero').toBe(true)
  return value
}

async function traceMatches(path: Locator, simulation: SimulationResult) {
  const points = await path.evaluate(element => {
    const svg = (element as SVGPathElement).ownerSVGElement
    if (!svg) throw new Error('The assumption trace must be a real SVG path')
    const yLabels = [...svg.querySelectorAll('text[data-axis="y"]')]
    const zero = yLabels.find(label => label.getAttribute('data-value') === '0')
    const upper = yLabels.at(-1)
    const upperGrid = upper?.parentElement?.querySelector('line')
    const lowerGrid = zero?.parentElement?.querySelector('line')
    const timeLabels = [...svg.querySelectorAll('text[data-axis="x"]')]
    const timeStart = timeLabels.find(label => label.textContent?.trim() === '0')
    const timeEnd = timeLabels.at(-1)
    const stimulus = svg.querySelector('rect')
    if (!upperGrid || !lowerGrid || !timeStart || !timeEnd || !stimulus) throw new Error('Readable shared 0–1 axis, sampled time and stimulus band are required')
    return {
      axis: {
        xStart: Number(lowerGrid.getAttribute('x1')), xEnd: Number(lowerGrid.getAttribute('x2')),
        yZero: Number(lowerGrid.getAttribute('y1')), yOne: Number(upperGrid.getAttribute('y1')),
        timeStart: Number(timeStart.textContent), timeEnd: Number(timeEnd.textContent),
        bandX: Number(stimulus.getAttribute('x')), bandWidth: Number(stimulus.getAttribute('width')),
        yMax: Number(svg.getAttribute('data-y-max')), topLabelValue: Number(upper?.getAttribute('data-value')),
        timeLabelStartX: Number(timeStart.getAttribute('x')), timeLabelEndX: Number(timeEnd.getAttribute('x')),
      },
      yLabels: yLabels.map(label => ({ value: Number(label.getAttribute('data-value')), text: label.textContent?.trim() ?? '' })),
      pairs: [...(element.getAttribute('d') ?? '').matchAll(/[ML]\s*([-+\d.e]+)\s*,\s*([-+\d.e]+)/gi)]
        .map(match => ({ x: Number(match[1]), y: Number(match[2]) })),
    }
  })
  const { axis } = points
  const height = axis.yZero - axis.yOne
  const width = axis.xEnd - axis.xStart
  expect(height).toBeGreaterThan(0)
  expect(width).toBeGreaterThan(0)
  expect(axis.timeStart).toBe(0)
  expect(axis.timeEnd).toBe(700)
  expect(axis.yMax).toBeGreaterThan(0)
  expect(axis.topLabelValue).toBe(axis.yMax)
  expect(axis.timeLabelStartX).toBeCloseTo(axis.xStart, 10)
  expect(axis.timeLabelEndX).toBeCloseTo(axis.xEnd, 10)
  expect(points.yLabels).toHaveLength(5)
  for (const [index, label] of points.yLabels.entries()) {
    expect(label.value).toBeCloseTo(axis.yMax * index / 4, 12)
    // The interface writes a decimal comma; data-value keeps the machine-readable number.
    const displayed = Number(label.text.replace(',', '.'))
    expect(Number.isFinite(displayed), 'Every visible vertical tick must be numeric').toBe(true)
    expect(label.text, 'Visible ticks use the Turkish decimal comma').not.toContain('.')
    const fractionalDigits = label.text.split(',')[1]?.length ?? 0
    expect(Math.abs(displayed - label.value), 'Visible y-axis labels must match the actual shared axis within their displayed rounding')
      .toBeLessThanOrEqual(.5 * 10 ** -fractionalDigits + Number.EPSILON)
  }
  expect(axis.bandX).toBeCloseTo(axis.xStart + 100 / 700 * width, 10)
  expect(axis.bandWidth).toBeCloseTo(200 / 700 * width, 10)
  expect(simulation.timesMs).toHaveLength(701)
  expect(points.pairs).toHaveLength(701)
  let maximumActivityError = 0
  let maximumTimeError = 0
  const nonfinite: number[] = []
  simulation.activity.AVAR!.forEach((value, index) => {
    const point = points.pairs[index]!
    if (!(Number.isFinite(point.x) && Number.isFinite(point.y))) nonfinite.push(index)
    maximumActivityError = Math.max(maximumActivityError, Math.abs((axis.yZero - point.y) / height * axis.yMax - value))
    maximumTimeError = Math.max(maximumTimeError, Math.abs(point.x - (axis.xStart + simulation.timesMs[index]! / 700 * width)))
  })
  expect(nonfinite).toEqual([])
  expect(maximumActivityError, 'All 701 AVAR samples retain their actual activity units on the shared axis').toBeLessThan(axis.yMax * .0002)
  expect(maximumTimeError, 'All 701 plotted sample times match the actual 1 ms integration').toBeLessThan(.02)
}

async function run(page: Page, number: number) {
  const button = main(page).getByRole('button', { name: number === 1 ? 'Deneyi çalıştır' : 'Yeniden çalıştır', exact: true })
  await expect(button).toHaveAttribute('aria-controls', 'assumptions-result-region')
  await button.click()
  await expect(result(page)).toHaveAttribute('data-run-number', String(number))
  await expect(result(page)).toHaveAttribute('data-stale', 'false')
  const status = main(page).getByTestId('assumptions-run-status')
  await expect(status).toHaveAttribute('role', 'status')
  await expect(status).toHaveAttribute('aria-live', 'polite')
  await expect(status).toHaveAttribute('aria-atomic', 'true')
  await expect(status).toContainText(`Koşul kaydı #${number} hazır`)
}

async function capturedResult(page: Page) {
  return result(page).evaluate(element => ({
    traces: [...element.querySelectorAll('[data-assumption-trace]')].map(path => ({ condition: path.getAttribute('data-assumption-trace'), d: path.getAttribute('d') })),
    values: [...element.querySelectorAll('[data-value]')].map(value => ({ id: value.getAttribute('data-testid'), value: value.getAttribute('data-value'), text: value.textContent })),
    settings: [...element.querySelectorAll('[data-testid="assumptions-run-settings"]')].map(node => ({ attributes: [...node.attributes].map(attribute => [attribute.name, attribute.value]), text: node.textContent })),
    examples: [...(element.closest('main')?.querySelectorAll('[data-testid^="assumptions-example-"]') ?? [])]
      .map(node => ({ attributes: [...node.attributes].map(attribute => [attribute.name, attribute.value]), text: node.textContent })),
  }))
}

async function expectReference(row: Locator, reference: SourceReference, reciprocal = false) {
  const prefix = reciprocal ? 'data-reciprocal-source-' : 'data-source-'
  for (const field of ['sheet', 'row', 'column', 'cell'] as const) await expect(row).toHaveAttribute(`${prefix}${field}`, String(reference[field]))
  await expect(row).toContainText(reference.cell)
}

async function expectEngineResult(page: Page, controlled: Variable, value: number) {
  const pair = enginePair(controlled, value)
  const settings = result(page).getByTestId('assumptions-run-settings')
  await expect(settings).toHaveAttribute('data-variable', controlled)
  await expect(settings).toHaveAttribute('data-comparison-value', String(value))
  await expect(settings).toHaveAttribute('data-scope', controlled === 'time-constant' ? 'all-neurons' : controlled === 'chemical-gain' ? 'chemical-edges' : 'physical-gap-pairs')
  for (const [name, expected] of Object.entries({
    'stimulus-target': 'AVER', 'output-id': 'AVAR', amplitude: .8, 'onset-ms': 100,
    'stimulus-duration-ms': 200, 'duration-ms': 700, 'dt-ms': 1,
    'baseline-chemical-gain': .8, 'baseline-gap-gain': .2, 'baseline-tau': 30,
    'comparison-chemical-gain': pair.comparisonParameters.chemicalGain,
    'comparison-gap-gain': pair.comparisonParameters.gapGain,
    'comparison-tau': pair.comparison.settings.tauMs,
    'baseline-tau-override-count': 0, 'comparison-tau-override-count': 0,
    'baseline-edge-count': 246, 'comparison-edge-count': 246,
  })) await expect(settings).toHaveAttribute(`data-${name}`, String(expected))
  const summary = main(page).getByTestId('assumptions-source-summary')
  for (const [name, count] of Object.entries({ neuron: 30, chemical: 196, gap: 50, 'self-loop': 5 })) await expect(summary).toHaveAttribute(`data-${name}-count`, String(count))
  for (const condition of ['baseline', 'comparison'] as const) {
    for (const [metric, expected] of Object.entries(metrics(pair[condition]))) {
      const readout = result(page).getByTestId(`assumptions-${condition}-${metric}`)
      if (expected === null) {
        await expect(readout).toHaveAttribute('data-value', 'null')
        await expect(readout).toHaveText('—')
      } else {
        expect(await readDataNumber(readout)).toBeCloseTo(expected, 12)
        if (metric === 'peak-time') {
          expect(await readNumber(readout)).toBe(expected)
          await expect(readout).toContainText('ms')
        }
        else await expectVisibleNumber(readout, expected)
      }
    }
    await traceMatches(result(page).locator(`[data-assumption-trace="${condition}"]`), pair[condition])
  }
  let allCellDifference = 0
  for (const { id } of anatomy.neurons) {
    pair.baseline.activity[id]!.forEach((activity, index) => {
      allCellDifference = Math.max(allCellDifference, Math.abs(activity - pair.comparison.activity[id]![index]!))
    })
  }
  const before = metrics(pair.baseline)
  const after = metrics(pair.comparison)
  for (const [name, expected] of Object.entries({ 'peak-difference': after.peak - before.peak, 'end-difference': after.end - before.end, 'max-trace-difference': allCellDifference })) {
    const readout = result(page).getByTestId(`assumptions-${name}`)
    expect(await readDataNumber(readout)).toBeCloseTo(expected, 12)
    await expectVisibleNumber(readout, expected)
  }
  await expectRawExamples(page, pair.comparisonParameters)
  const plot = result(page).getByTestId('assumptions-result-plot')
  await expect(plot).toHaveAttribute('data-scale-mode', /^(response|unit)$/)
  const mode = await plot.getAttribute('data-scale-mode')
  const peak = Math.max(before.peak, after.peak)
  const expectedScale = mode === 'response' && peak > 0 ? Math.min(1, peak * 1.1) : 1
  expect(Number(await plot.getAttribute('data-y-max'))).toBeCloseTo(expectedScale, 12)
  const axisLimit = result(page).getByTestId('assumptions-axis-limit')
  expect(await readDataNumber(axisLimit)).toBeCloseTo(expectedScale, 12)
  const axisText = (await axisLimit.textContent())?.match(/0[–-](\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?)/)?.[1]
  expect(axisText, 'The visible axis description must show the same shared scale').toBeDefined()
  expect(Math.abs(Number(axisText?.replace(',', '.')) - expectedScale) / expectedScale).toBeLessThanOrEqual(.005)
  await expect(plot).toHaveAttribute('role', 'img')
  await expect(plot).toHaveAccessibleName(/AVAR.*boyutsuz model aktivitesi/)
}

async function expectRawExamples(page: Page, parameters: { chemicalGain: number; gapGain: number }) {
  const chemical = anatomy.chemicalEdges.find(edge => edge.id === 'chemical:AVER->AVAR')!
  const gap = anatomy.gapEdges.find(edge => edge.id === 'gap:AVAR--AVER')!
  const incoming = anatomy.chemicalEdges.filter(edge => edge.target === chemical.target).reduce((sum, edge) => sum + edge.rawWeight, 0)
  const incident = (id: string) => anatomy.gapEdges.filter(edge => edge.a === id || edge.b === id).reduce((sum, edge) => sum + edge.rawWeight, 0)
  const examples = [
    { id: 'chemical', edge: chemical, baseline: .8 * chemical.rawWeight / Math.max(1, incoming), comparison: parameters.chemicalGain * chemical.rawWeight / Math.max(1, incoming) },
    { id: 'gap', edge: gap, baseline: .2 * gap.rawWeight / Math.max(1, incident(gap.a), incident(gap.b)), comparison: parameters.gapGain * gap.rawWeight / Math.max(1, incident(gap.a), incident(gap.b)) },
  ]
  for (const example of examples) {
    const row = main(page).getByTestId(`assumptions-example-${example.id}`)
    await expect(row).toHaveAttribute('data-edge-id', example.edge.id)
    await expect(row).toHaveAttribute('data-raw-weight', String(example.edge.rawWeight))
    await expect(row).toContainText(`${example.edge.rawWeight} EM kesiti`)
    await expectReference(row, example.edge.sourceRef)
    if (example.id === 'gap') await expectReference(row, gap.reciprocalSourceRef, true)
    for (const condition of ['baseline', 'comparison'] as const) {
      const weight = row.getByTestId(`assumptions-example-${example.id}-${condition}-weight`)
      expect(await readDataNumber(weight)).toBeCloseTo(example[condition], 12)
      await expectVisibleNumber(weight, example[condition])
    }
  }
}

test('the local anatomy, units, provenance and accessible unrun controls load directly and survive reload without claiming synapse counts or a verified data license', async ({ page }) => {
  await page.goto(lessonPath)
  await expectLesson(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.locator('#amplitude')).toHaveCount(0)
  for (const id of ['data', 'model', 'experiment', 'validation', 'provenance']) await expect(main(page).locator(`#assumptions-${id}`)).toHaveCount(1)
  await expect(variable(page)).toHaveValue('chemical-gain')
  await expect(comparisonValue(page)).toHaveValue('1.2')
  await expect(comparisonValue(page)).toHaveAttribute('min', '0')
  await expect(comparisonValue(page)).toHaveAttribute('max', '1.5')
  await expect(result(page)).toHaveCount(0)
  const unlabelled = await main(page).evaluate(element => [...element.querySelectorAll('input,select,textarea')].filter(control => {
    const native = control as HTMLInputElement
    return !([...(native.labels ?? [])].some(label => label.textContent?.trim()) || control.getAttribute('aria-label')?.trim() || control.getAttribute('aria-labelledby')?.trim().split(/\s+/).every(id => document.getElementById(id)?.textContent?.trim()))
  }).map(control => control.id))
  expect(unlabelled).toEqual([])
  const summary = main(page).getByTestId('assumptions-source-summary')
  for (const [name, count] of Object.entries({ neuron: 30, chemical: 196, gap: 50, 'self-loop': 5 })) {
    await expect(summary).toHaveAttribute(`data-${name}-count`, String(count))
  }
  const counts = summary.locator('strong')
  await expect(counts).toHaveText(['30', '196', '50'])
  for (const count of await counts.all()) await expect(count).toBeVisible()
  await expect(summary.locator('p').filter({ hasText: 'Kimyasal kayıtlardan' })).toContainText('5 tanesi öz döngüdür')
  await expect(summary).toHaveAttribute('data-synapse-count', 'not-provided')
  await expect(main(page).locator('#assumptions-data')).toContainText('ayrı bir sinaps sayısı vermiyor')
  await expect(main(page).locator('#assumptions-data')).toContainText('EM')
  await expect(main(page).getByTestId('assumptions-source-examples')).toHaveCount(0)
  const provenance = main(page).locator('#assumptions-provenance')
  await expect(provenance).toContainText('yeniden dağıtım izni doğrulanmış değildir')
  await expect(provenance).toHaveAttribute('data-license-status', anatomy.dataset.license.status)
  await expect(provenance).toHaveAttribute('data-source-unit', anatomy.dataset.anatomicalWeightUnit)
  await expect(provenance).toContainText(anatomy.dataset.title)
  await expect(provenance).toContainText(anatomy.dataset.version)
  await expect(provenance).toContainText(anatomy.dataset.anatomicalWeightUnit)
  await expect(provenance).toContainText(anatomy.dataset.license.status)
  await expect(provenance.locator(`a[href="${anatomy.dataset.doi}"]`)).toHaveCount(1)
  const selection = provenance.getByTestId('assumptions-subset-selection')
  await expect(selection).toHaveAttribute('data-algorithm', anatomy.selection.algorithm)
  await expect(selection).toHaveAttribute('data-seeds', anatomy.selection.seeds.join(','))
  await expect(selection).toHaveAttribute('data-limit', String(anatomy.selection.limit))
  await expect(selection).toContainText(anatomy.selection.algorithm)
  await expect(selection).toContainText(`Başlangıç hücreleri: ${anatomy.selection.seeds.join(', ')}.`)
  await expect(selection).toContainText(`Hücre sınırı: ${anatomy.selection.limit}.`)
  const sourceDetails = provenance.locator('details')
  await sourceDetails.locator('summary').click()
  for (const source of anatomy.dataset.sources) {
    await expect(sourceDetails.locator(`a[href="${source.url}"]`)).toHaveCount(1)
    await expect(sourceDetails).toContainText(source.sha256)
    await expect(sourceDetails).toContainText(source.downloadedAtUtc)
  }
  await expectNoHorizontalOverflow(page)
  await page.reload()
  await expectLesson(page)
  await expect(result(page)).toHaveCount(0)
  await expect(comparisonValue(page)).toHaveValue('1.2')
  await expectNoHorizontalOverflow(page)
})


test('draft changes preserve the recorded chemical comparison until explicit rerun, including decreased, zero and equal gains', async ({ page }) => {
  await page.goto(lessonPath)
  await expectLesson(page)
  await expect(variable(page)).toHaveValue('chemical-gain')
  await expect(comparisonValue(page)).toHaveValue('1.2')
  await expect(result(page)).toHaveCount(0)
  await comparisonValue(page).fill('0.3')
  await expect(result(page)).toHaveCount(0)
  await comparisonValue(page).fill('1.2')
  await run(page, 1)
  await expectEngineResult(page, 'chemical-gain', 1.2)
  await expect(main(page).getByTestId('assumptions-explanation')).toContainText('Karşılaştırma çarpanı 1’in üstünde')
  const scale = result(page).locator('#assumptions-focus-scale')
  const plot = result(page).getByTestId('assumptions-result-plot')
  await expect(scale).toBeChecked()
  await expect(plot).toHaveAttribute('data-scale-mode', 'response')
  // The 1.2 comparison peaks near 0.98; the zoomed axis stops at the activity limit instead of 1.075.
  await expect(plot).toHaveAttribute('data-y-max', '1')
  const pair = enginePair('chemical-gain', 1.2)
  await scale.uncheck()
  await expect(plot).toHaveAttribute('data-scale-mode', 'unit')
  await expect(plot).toHaveAttribute('data-y-max', '1')
  for (const condition of ['baseline', 'comparison'] as const) await traceMatches(result(page).locator(`[data-assumption-trace="${condition}"]`), pair[condition])
  await expect(result(page)).toHaveAttribute('data-run-number', '1')
  await expect(result(page)).toHaveAttribute('data-stale', 'false')
  await scale.check()
  await expect(plot).toHaveAttribute('data-scale-mode', 'response')
  const recorded = await capturedResult(page)
  await comparisonValue(page).fill('0.3')
  await expect(result(page)).toHaveAttribute('data-stale', 'true')
  await expect(result(page).getByTestId('assumptions-stale')).toHaveAttribute('role', 'status')
  expect(await capturedResult(page)).toEqual(recorded)
  await expect(result(page)).toHaveAttribute('data-run-number', '1')
  await run(page, 2)
  await expectEngineResult(page, 'chemical-gain', .3)
  await expect(main(page).getByTestId('assumptions-explanation')).not.toContainText('1’in üstünde')
  await comparisonValue(page).fill('0')
  await run(page, 3)
  await expectEngineResult(page, 'chemical-gain', 0)
  await comparisonValue(page).fill('0.8')
  await run(page, 4)
  await expectEngineResult(page, 'chemical-gain', .8)
  const equal = await result(page).locator('[data-assumption-trace]').evaluateAll(paths => paths.map(path => path.getAttribute('d')))
  expect(equal).toHaveLength(2)
  expect(equal[0]).toBe(equal[1])
  await expectNoHorizontalOverflow(page)
})

test('physical gap gain changes only its model contribution while zero, decrease and reference equality retain the same raw records', async ({ page }) => {
  await page.goto(lessonPath)
  await expectLesson(page)
  await variable(page).selectOption('gap-gain')
  await expect(comparisonValue(page)).toHaveValue('0.6')
  await expect(comparisonValue(page)).toHaveAttribute('min', '0')
  await expect(comparisonValue(page)).toHaveAttribute('max', '1')
  await run(page, 1)
  await expectEngineResult(page, 'gap-gain', .6)
  for (const [index, value] of [.1, 0, .2].entries()) {
    await comparisonValue(page).fill(String(value))
    await run(page, index + 2)
    await expectEngineResult(page, 'gap-gain', value)
  }
  await expectNoHorizontalOverflow(page)
})

test('the time-constant experiment changes every cell globally while gains, anatomy, pulse, integration and readout remain fixed', async ({ page }) => {
  await page.goto(lessonPath)
  await expectLesson(page)
  await variable(page).selectOption('time-constant')
  await expect(comparisonValue(page)).toHaveValue('90')
  await expect(comparisonValue(page)).toHaveAttribute('min', '15')
  await expect(comparisonValue(page)).toHaveAttribute('max', '120')
  await expect(comparisonValue(page)).toHaveAttribute('aria-valuetext', '90 model ms')
  await comparisonValue(page).focus()
  await page.keyboard.press('ArrowRight')
  await expect(comparisonValue(page)).toHaveValue('95')
  await expect(comparisonValue(page)).toHaveAttribute('aria-valuetext', '95 model ms')
  await run(page, 1)
  await expectEngineResult(page, 'time-constant', 95)
  const recorded = await capturedResult(page)
  await variable(page).selectOption('gap-gain')
  await expect(result(page)).toHaveAttribute('data-stale', 'true')
  expect(await capturedResult(page)).toEqual(recorded)
  await variable(page).selectOption('time-constant')
  await comparisonValue(page).fill('30')
  await run(page, 2)
  await expectEngineResult(page, 'time-constant', 30)
  await comparisonValue(page).fill('15')
  await run(page, 3)
  await expectEngineResult(page, 'time-constant', 15)
  await expectNoHorizontalOverflow(page)
})

test('loading, unavailable local files and malformed source coordinates stay explicit, disable running and recover only through retry', async ({ page }) => {
  diagnostics.get(page)!.expectedStatuses = new Set([503, 404])
  let releaseFirst!: () => void
  const gate = new Promise<void>(resolve => { releaseFirst = resolve })
  const methods: string[] = []
  const malformed = structuredClone(anatomy)
  malformed.chemicalEdges[0]!.sourceRef.cell = 'A1'
  await page.route('**/api/local-connectome', async route => {
    methods.push(route.request().method())
    if (methods.length === 1) {
      await gate
      await route.fulfill({ status: 503, json: { error: 'Deliberate local test failure' } })
    } else if (methods.length === 2) await route.fulfill({ status: 404, json: { error: 'Deliberately unavailable local file' } })
    else if (methods.length === 3) await route.fulfill({ status: 200, json: malformed })
    else await route.fulfill({ status: 200, json: anatomy })
  })
  await page.goto(lessonPath)
  await expectLesson(page, false)
  const loading = main(page).getByTestId('assumptions-load-status')
  await expect(loading).toHaveAttribute('data-state', 'loading')
  await expect(loading.getByRole('status')).toContainText('yükleniyor')
  const runButton = main(page).getByRole('button', { name: 'Deneyi çalıştır', exact: true })
  await expect(runButton).toBeDisabled()
  await expect(result(page)).toHaveCount(0)
  releaseFirst()
  const retry = main(page).getByRole('button', { name: 'Tekrar dene', exact: true })
  for (const [index, state] of ['error', 'missing', 'invalid'].entries()) {
    await expect(main(page)).toHaveAttribute('data-data-state', state)
    await expect(main(page).getByRole('alert')).toBeVisible()
    await expect(runButton).toBeDisabled()
    await expect(result(page)).toHaveCount(0)
    await expect(main(page).getByTestId('assumptions-source-summary')).toHaveCount(0)
    await expect.poll(() => methods.length).toBe(index + 1)
    if (index === 0) {
      await retry.focus()
      await page.keyboard.press('Enter')
    } else await retry.click()
  }
  await expectLesson(page)
  await expect(main(page).getByRole('alert')).toHaveCount(0)
  expect(methods).toEqual(['GET', 'GET', 'GET', 'GET'])
  await run(page, 1)
  await expectEngineResult(page, 'chemical-gain', 1.2)
  await expectNoHorizontalOverflow(page)
})

test('the fourth lesson keeps its draft and recorded run independently, and its reset preserves completed work on the first three pages', async ({ page }) => {
  await page.goto(neuronPath)
  await page.locator('#lesson-stimulus').fill('0.4')
  await page.locator('#lesson-threshold').fill('0.9')
  await page.locator('#lesson-circuit-stimulus').fill('0.3')
  const neuronIds = ['#lesson-stimulus', '#lesson-threshold', '#lesson-circuit-stimulus']
  const neuronBefore = await Promise.all(neuronIds.map(id => page.locator(id).inputValue()))
  await navLink(page, navLabels.guided).click()
  await expect(page).toHaveURL(new RegExp(`${guidedPath}$`))
  await page.locator('#guided-stimulus-prediction').selectOption('unsure')
  await main(page).locator('#guided-stimulus').getByRole('button', { name: 'Deneyi çalıştır', exact: true }).click()
  const guided = page.getByTestId('guided-result-stimulus')
  await expect(guided).toHaveAttribute('data-run-number', '1')
  const guidedBefore = await guided.evaluate(element => ({
    paths: [...element.querySelectorAll('[data-guided-trace]')].map(path => path.getAttribute('d')),
    values: [...element.querySelectorAll('[data-value]')].map(value => [value.getAttribute('data-testid'), value.getAttribute('data-value'), value.textContent]),
  }))
  expect(guidedBefore.paths).toHaveLength(2)
  expect(guidedBefore.values.length).toBeGreaterThan(8)
  await navLink(page, navLabels.reading).click()
  await expect(page).toHaveURL(new RegExp(`${readingPath}$`))
  await expect(main(page)).toHaveAttribute('data-data-state', 'ready')
  await page.locator('#reading-neuron').selectOption('AVER')
  await page.locator('#reading-target').selectOption('AVBR')
  await page.locator('#reading-mode').selectOption('gap')
  await main(page).getByRole('button', { name: 'Yol bul', exact: true }).click()
  await main(page).getByRole('button', { name: 'Sonraki adım', exact: true }).click()
  await expect(page.getByTestId('reading-step')).toHaveAttribute('data-step-index', '1')
  const readingBefore = await page.getByTestId('reading-path-hops').locator('[data-edge-id]').evaluateAll(hops => hops.map(hop => hop.getAttribute('data-edge-id')))
  expect(readingBefore).toEqual(['gap:AVAR--AVER', 'gap:AVAR--AVBL', 'gap:AVBL--AVBR'])
  await lessonLink(page).click()
  await expectLesson(page)
  await variable(page).selectOption('time-constant')
  await run(page, 1)
  const fourthBefore = await capturedResult(page)
  await comparisonValue(page).fill('60')
  await navLink(page, navLabels.neuron).click()
  expect(await Promise.all(neuronIds.map(id => page.locator(id).inputValue()))).toEqual(neuronBefore)
  await lessonLink(page).click()
  await expect(variable(page)).toHaveValue('time-constant')
  await expect(comparisonValue(page)).toHaveValue('60')
  await expect(result(page)).toHaveAttribute('data-run-number', '1')
  await expect(result(page)).toHaveAttribute('data-stale', 'true')
  await expect.poll(() => capturedResult(page)).toEqual(fourthBefore)
  await main(page).getByRole('button', { name: 'Varsayım deneyini sıfırla', exact: true }).click()
  await expect(result(page)).toHaveCount(0)
  await expect(variable(page)).toHaveValue('chemical-gain')
  await expect(comparisonValue(page)).toHaveValue('1.2')
  await navLink(page, navLabels.guided).click()
  await expect(page.locator('#guided-stimulus-prediction')).toHaveValue('unsure')
  await expect(guided).toHaveAttribute('data-run-number', '1')
  await expect.poll(() => guided.evaluate(element => ({
    paths: [...element.querySelectorAll('[data-guided-trace]')].map(path => path.getAttribute('d')),
    values: [...element.querySelectorAll('[data-value]')].map(value => [value.getAttribute('data-testid'), value.getAttribute('data-value'), value.textContent]),
  }))).toEqual(guidedBefore)
  await navLink(page, navLabels.reading).click()
  await expect(page.locator('#reading-neuron')).toHaveValue('AVER')
  await expect(page.locator('#reading-target')).toHaveValue('AVBR')
  await expect(page.locator('#reading-mode')).toHaveValue('gap')
  await expect(page.getByTestId('reading-step')).toHaveAttribute('data-step-index', '1')
  expect(await page.getByTestId('reading-path-hops').locator('[data-edge-id]').evaluateAll(hops => hops.map(hop => hop.getAttribute('data-edge-id')))).toEqual(readingBefore)
  await navLink(page, navLabels.neuron).click()
  expect(await Promise.all(neuronIds.map(id => page.locator(id).inputValue()))).toEqual(neuronBefore)
  await expectNoHorizontalOverflow(page)
})

for (const experimentMode of ['toy', 'real'] as const) {
  test(`running and resetting the fourth lesson preserves all ${experimentMode} experiment controls, ${experimentMode === 'toy' ? '2D' : '3D'} view, playing time and full numerical JSON`, async ({ page }) => {
    const epoch = new Date('2030-01-01T00:00:00Z')
    await page.clock.install({ time: epoch })
    await page.clock.pauseAt(new Date(epoch.getTime() + 1000))
    await page.goto('/')
    if (experimentMode === 'real') {
      await page.getByRole('group', { name: 'Devre modu', exact: true }).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true }).click()
      await expect(cells(page).getByRole('button')).toHaveCount(30)
      await page.locator('#chemical-gain').fill('1.1')
      await page.locator('#gap-gain').fill('0.4')
      await page.locator('#stimulus-target').selectOption('PVCL')
      await page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true }).selectOption('PVCR')
      await page.locator('#changed-neuron').selectOption('PVDL')
      await page.locator('#silenced-edge').selectOption('gap:AVAR--AVER')
      await page.getByRole('checkbox', { name: 'Yalnız seçili hücrenin bağlantıları', exact: true }).uncheck()
      await cell(page, 'ASHR').click()
    } else {
      await expect(cells(page).getByRole('button')).toHaveCount(8)
      await page.locator('#stimulus-target').selectOption('S2')
      await page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true }).selectOption('O2')
      await page.locator('#changed-neuron').selectOption('I4')
      await page.locator('#silenced-edge').selectOption('I4-O1')
      await cell(page, 'O2').click()
    }
    await page.locator('#amplitude').fill('0.55')
    await page.locator('#duration').fill('350')
    await page.locator('#base-tau').fill('45')
    await page.locator('#changed-tau').fill('150')
    await page.locator('#dt').selectOption('0.5')
    await page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true }).fill('400')
    await page.getByRole('group', { name: 'Grafikte gösterilen deney koşulu', exact: true }).getByRole('button', { name: 'C Zaman sabiti değişti', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true }).check()
    let renderer: string | null = null
    if (experimentMode === 'real') {
      await view(page, '3D').click()
      await expect(page.locator('.circuit-3d')).toHaveAttribute('data-node-count', '30', { timeout: 15_000 })
      await page.clock.runFor(32)
      await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready', { timeout: 15_000 })
      renderer = await page.locator('.circuit-3d').getAttribute('data-renderer-instance')
      expect(renderer).not.toBeNull()
    } else await expect(view(page, '2D')).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('button', { name: 'Etkinliği oynat', exact: true }).click()
    await page.clock.runFor(64)
    const beforeUi = await experimentUi(page)
    expect(beforeUi.playing).toBe(true)
    expect(Number(beforeUi.cursor)).toBeGreaterThan(400)
    const beforeJson = await exportRecord(page)
    await lessonLink(page).click()
    await expectLesson(page)
    await expect(page.locator('#amplitude')).not.toBeVisible()
    await variable(page).selectOption('gap-gain')
    await comparisonValue(page).fill('0')
    await run(page, 1)
    await expectEngineResult(page, 'gap-gain', 0)
    await main(page).getByRole('button', { name: 'Varsayım deneyini sıfırla', exact: true }).click()
    await experimentLink(page).click()
    await expect(main(page)).toHaveAttribute('id', 'top')
    await expect(cells(page).getByRole('button')).toHaveCount(experimentMode === 'toy' ? 8 : 30)
    expect(await experimentUi(page)).toEqual(beforeUi)
    expect(await exportRecord(page)).toEqual(beforeJson)
    if (renderer) {
      await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-instance', renderer)
      await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready')
    }
    await expectNoHorizontalOverflow(page)
  })
}

test('native deep fragments, reload, keyboard, scroll restoration and touch or real modified-link tabs preserve browser semantics', async ({ page, isMobile }) => {
  await page.goto(`${lessonPath}#assumptions-provenance`)
  await expectLesson(page)
  await expect(page.locator('#assumptions-provenance')).toBeFocused()
  await expect(page.locator('#assumptions-provenance')).toBeInViewport()
  await page.reload()
  await expectLesson(page)
  await expect(page.locator('#assumptions-provenance')).toBeFocused()
  await expect(page.locator('#assumptions-provenance')).toBeInViewport()
  await experimentLink(page).click()
  await page.getByRole('link', { name: /Modeli anlamak/ }).click()
  await expect(page).toHaveURL(/\/#assumptions$/)
  await expect(page.locator('#assumptions')).toBeInViewport()
  // Assign genuine keyboard focus without overwriting the saved native scroll.
  await lessonLink(page).evaluate(link => (link as HTMLElement).focus({ preventScroll: true }))
  await expect(lessonLink(page)).toBeFocused()
  await expect(page.locator('#assumptions')).toBeInViewport()
  const departureScroll = await page.evaluate(() => window.scrollY)
  await page.keyboard.press('Enter')
  await expectLesson(page)
  await expect(page.locator('#assumptions-title')).toBeFocused()
  const skip = page.getByRole('link', { name: 'İçeriğe geç', exact: true })
  await expect(skip).toHaveAttribute('href', '#real-assumptions')
  await skip.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`${lessonPath}#real-assumptions$`))
  await expect(main(page)).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`${lessonPath}$`))
  await page.goBack()
  await expect(page).toHaveURL(/\/#assumptions$/)
  await expect(page.locator('#assumptions')).toBeInViewport()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(departureScroll)
  await page.goForward()
  await expectLesson(page)
  await experimentLink(page).click()
  const originalUrl = page.url()
  await expect(lessonLink(page)).toHaveAttribute('href', lessonPath)
  if (isMobile) {
    await lessonLink(page).tap()
    await expectLesson(page)
    await experimentLink(page).tap()
    await expect(page).toHaveURL(originalUrl)
  } else {
    const context = page.context()
    expect(context.pages()).toHaveLength(1)
    const actions: Parameters<Locator['click']>[0][] = [{ modifiers: ['ControlOrMeta'] }, { button: 'middle' }]
    for (const options of actions) {
      const pending = context.waitForEvent('page')
      await lessonLink(page).click(options)
      const tab = await pending
      expect(tab).not.toBe(page)
      expect(context.pages()).toHaveLength(2)
      await expectLesson(tab)
      await expect(page).toHaveURL(originalUrl)
      await tab.close()
      expect(context.pages()).toHaveLength(1)
    }
  }
  await expectNoHorizontalOverflow(page)
})
