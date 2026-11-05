import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAssumptionExperiment } from '../src/learning/assumptionExperiments'
import { createReadingGraph, findShortestRoute, inspectNeuron } from '../src/learning/circuitReading'
import { runGuidedExperiment, type GuidedExperimentId } from '../src/learning/guidedExperiments'
import { chemicalLesson, gapLesson, smallCircuitLesson, thresholdLesson } from '../src/learning/lessonMath'
import { atlasDefaults, atlasRecords } from '../src/learning/speciesAtlas'
import { parseRealConnectome } from '../src/model/realConnectome'
import { simulate } from '../src/model/simulation'
import type { Circuit, RealConnectome, SimulationResult } from '../src/model/types'

/*
 * Reproducible cross-page evidence. Every profile in playwright.config.ts runs
 * these scenarios: desktop and mobile on the dev server, a 320 px reduced-motion
 * profile, and desktop/mobile against the production preview of dist/. Each test
 * checks layout invariants, compares the displayed numbers with the source
 * engine in Node, saves screenshots and writes an evidence.json record.
 */

interface SurfaceFacts { name: string; overflow: boolean; duplicateIds: string[]; reducedMotion: boolean; width: number; screenshot: string }
interface Evidence {
  route: string; project: string; baseURL: string; viewport: unknown; reducedMotion: boolean; browser: string
  git: { head: string; dirty: boolean } | null; states: SurfaceFacts[]; values: Record<string, unknown>
}

const root = fileURLToPath(new URL('..', import.meta.url))
const git = (() => {
  try {
    const run = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
    return { head: run('rev-parse', 'HEAD'), dirty: run('status', '--porcelain').length > 0 }
  } catch { return null }
})()
const main = (page: Page) => page.getByRole('main')
const isProduction = (testInfo: TestInfo) => testInfo.project.name.startsWith('production')
const trNumber = (value: number, digits = 3) => value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

function startEvidence(page: Page, testInfo: TestInfo, route: string, browserVersion: string) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const evidence: Evidence = {
    route, project: testInfo.project.name, baseURL: String(testInfo.project.use.baseURL), viewport: testInfo.project.use.viewport,
    reducedMotion: testInfo.project.use.reducedMotion === 'reduce', browser: browserVersion, git, states: [], values: {},
  }
  return { errors, evidence }
}

/** Layout invariants of the current state, plus a screenshot of the region in view. */
async function surface(page: Page, testInfo: TestInfo, evidence: Evidence, name: string, focus?: Locator) {
  if (focus) await focus.scrollIntoViewIfNeeded()
  const facts = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id)
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      width: window.innerWidth,
    }
  })
  expect(facts.overflow, `${name}: no horizontal page overflow`).toBe(false)
  expect(facts.duplicateIds, `${name}: element ids are unique`).toEqual([])
  expect(facts.reducedMotion, `${name}: reduced-motion preference reaches the page`).toBe(evidence.reducedMotion)
  const screenshot = `${testInfo.project.name}-${name}.png`
  await page.screenshot({ path: testInfo.outputPath(screenshot) })
  evidence.states.push({ name, ...facts, screenshot })
}

async function finish(testInfo: TestInfo, evidence: Evidence, errors: string[]) {
  expect(errors, 'no page errors or console errors').toEqual([])
  const path = testInfo.outputPath('evidence.json')
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`)
  await testInfo.attach('evidence', { path, contentType: 'application/json' })
}

/** A section link inside the page opens directly and survives a reload at the same target. */
async function fragmentReload(page: Page, route: string, evidence: Evidence) {
  const href = await main(page).getByRole('navigation').first().locator('a[href^="#"]').first().getAttribute('href')
  expect(href).toMatch(/^#[\w-]+$/)
  await page.goto(`${route}${href}`)
  await page.reload()
  await expect(page).toHaveURL(new RegExp(`${href}$`))
  const target = page.locator(href!)
  await expect(target).toBeVisible()
  await expect.poll(() => target.evaluate(element => { const top = element.getBoundingClientRect().top; return top >= -1 && top < window.innerHeight })).toBe(true)
  evidence.values.fragmentReload = href
}

async function localSource(page: Page): Promise<RealConnectome> {
  const response = await page.request.get('/api/local-connectome')
  expect(response.status(), 'the local anatomy endpoint is served by this server').toBe(200)
  return await response.json() as RealConnectome
}

/** The downloaded record re-simulates to identical traces in Node, and the shown peaks match them. */
async function exportedResults(page: Page, fileName: string) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Deney kaydını indir/ }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe(fileName)
  const record = JSON.parse(await readFile((await file.path())!, 'utf8')) as { circuit: Circuit; observedOutput: string; results: Record<'baseline' | 'silenced' | 'tau', SimulationResult> }
  const peaks: Record<string, number> = {}
  for (const condition of ['baseline', 'silenced', 'tau'] as const) {
    const result = record.results[condition]
    expect(simulate(record.circuit, result.settings), `${condition} matches the source engine`).toEqual(result)
    peaks[condition] = Math.max(...result.activity[record.observedOutput]!)
    await expect(page.getByTestId(`peak-${condition}`)).toHaveText(trNumber(peaks[condition]))
  }
  return { observedOutput: record.observedOutput, neurons: record.circuit.neurons.length, peaks }
}

async function expectDataValue(locator: Locator, expected: number | null, label: string) {
  const value = await locator.getAttribute('data-value')
  if (expected === null) expect(value, label).toBe('null')
  else expect(Number(value), label).toBeCloseTo(expected, 12)
}

test('main experiment: illustrative and real modes, 2D and 3D, term card and dark theme', async ({ page, browser }, testInfo) => {
  test.setTimeout(120_000)
  const { errors, evidence } = startEvidence(page, testInfo, '/', browser.version())
  const requests: string[] = []
  page.on('request', request => requests.push(new URL(request.url()).pathname))
  await page.goto('/')
  await expect(page.getByTestId('peak-baseline')).toBeVisible()
  await surface(page, testInfo, evidence, 'toy-top')

  const skip = page.getByRole('link', { name: 'İçeriğe geç', exact: true })
  await skip.focus()
  const focused = await skip.boundingBox()
  const height = page.viewportSize()!.height
  expect(focused && focused.y >= 0 && focused.y + focused.height <= height, 'skip link is on screen when focused').toBe(true)
  await skip.blur()
  await expect.poll(async () => (await skip.boundingBox())!.y + (await skip.boundingBox())!.height <= 0).toBe(true)

  evidence.values.toy = await exportedResults(page, 'circuitiary-experiment.json')
  await surface(page, testInfo, evidence, 'toy-2d', page.locator('.chart-panel'))

  await page.locator('.term-trigger').first().focus()
  await expect(page.getByRole('dialog')).toBeVisible()
  await surface(page, testInfo, evidence, 'term-card', page.getByRole('dialog'))
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('tab', { name: '3D · şematik uzay', exact: true }).click()
  const renderer = page.locator('.circuit-3d')
  await expect(renderer).toHaveAttribute('data-renderer-status', 'ready', { timeout: 15_000 })
  await expect(renderer).toHaveAttribute('data-node-count', '8')
  await surface(page, testInfo, evidence, 'toy-3d', renderer)

  await page.getByRole('group', { name: 'Devre modu', exact: true }).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Gerçek veri kaynağı ve sınırları', exact: true })).toBeVisible()
  await expect(renderer).toHaveAttribute('data-node-count', '30')
  await expect(renderer).toHaveAttribute('data-renderer-status', 'ready')
  await surface(page, testInfo, evidence, 'real-3d', renderer)
  await page.getByRole('tab', { name: '2D · bağlantı haritası', exact: true }).click()
  evidence.values.real = await exportedResults(page, 'circuitiary-cook2019-local-experiment.json')
  await surface(page, testInfo, evidence, 'real-2d', page.locator('.chart-panel'))

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await surface(page, testInfo, evidence, 'real-2d-dark', page.locator('.chart-panel'))

  if (isProduction(testInfo)) {
    // The preview serves the hashed production bundle, never the dev module graph.
    expect(requests.filter(path => path.startsWith('/src/') || path.startsWith('/@vite') || path.startsWith('/node_modules/'))).toEqual([])
    expect(requests.some(path => /^\/assets\/index-[\w-]+\.js$/.test(path)), 'hashed entry bundle').toBe(true)
    expect(requests.some(path => /^\/assets\/three\.module-[\w-]+\.js$/.test(path)), '3D bundle is loaded on demand').toBe(true)
    // Real data stays out of the bundle: no JSON/XLSX in dist/ and no data path served from it.
    const files = readdirSync(join(root, 'dist'), { recursive: true, encoding: 'utf8' })
    expect(files.filter(file => ['.json', '.xlsx'].includes(extname(file)))).toEqual([])
    for (const path of ['/data/local/cook-subset.json', '/data/raw/cook2019-si5-corrected-july2020.xlsx']) {
      expect(await (await page.request.get(path)).text(), path).not.toContain('AVAR')
    }
    evidence.values.productionBundle = requests.filter(path => path.startsWith('/assets/'))
  }
  await finish(testInfo, evidence, errors)
})

test('neuron lesson: lesson numbers match the lesson math and the circuit can be cut', async ({ page, browser }, testInfo) => {
  const route = '/ogren/norondan-devreye'
  const { errors, evidence } = startEvidence(page, testInfo, route, browser.version())
  await page.goto(route)
  await expect(main(page).getByRole('heading', { level: 1, name: 'Nörondan devreye', exact: true })).toBeVisible()
  await surface(page, testInfo, evidence, 'top')

  const threshold = thresholdLesson(.38, .6)
  await expect(page.getByTestId('threshold-status')).toHaveText(threshold.fired ? 'Tek olay oluştu' : 'Olay oluşmadı')
  await expect(page.getByTestId('threshold-peak')).toHaveText((threshold.fired ? 1 : 0).toFixed(2))
  const chemical = chemicalLesson(.65, .25)
  await expect(page.getByTestId('chemical-activity')).toHaveText(chemical.activity.toFixed(2))
  const gap = gapLesson(.6)
  await expect(page.getByTestId('gap-a-value')).toHaveText(gap.a[50]!.toFixed(3))
  await expect(page.getByTestId('gap-b-value')).toHaveText(gap.b[50]!.toFixed(3))
  const intact = smallCircuitLesson({ stimulus: .8, inhibitory: false, ablated: false })
  await expect(page.getByTestId('circuit-max')).toHaveText(intact.outputMaximum.toFixed(3))

  await main(page).getByRole('checkbox', { name: /B→C bağlantısını kaldır/ }).check()
  const cut = smallCircuitLesson({ stimulus: .8, inhibitory: false, ablated: true })
  await expect(page.getByTestId('circuit-min')).toHaveText(cut.outputMinimum.toFixed(3))
  await expect(page.getByTestId('circuit-max')).toHaveText(cut.outputMaximum.toFixed(3))
  await surface(page, testInfo, evidence, 'circuit-cut', page.getByTestId('circuit-max'))
  evidence.values = { thresholdFired: threshold.fired, chemicalActivity: chemical.activity, intactMax: intact.outputMaximum, cutMax: cut.outputMaximum }
  await fragmentReload(page, route, evidence)
  await finish(testInfo, evidence, errors)
})

test('guided experiments: all three runs match the source engine', async ({ page, browser }, testInfo) => {
  const route = '/ogren/rehberli-deneyler'
  const { errors, evidence } = startEvidence(page, testInfo, route, browser.version())
  await page.goto(route)
  await expect(page.getByTestId('guided-progress')).toHaveText('0/3 deney çalıştırıldı')
  await surface(page, testInfo, evidence, 'top')
  const options: Record<GuidedExperimentId, Parameters<typeof runGuidedExperiment>[2]> = { stimulus: {}, connection: { connectionId: 'I3-O1' }, tau: { comparisonTauMs: 90 } }
  for (const id of ['stimulus', 'connection', 'tau'] as const) {
    const section = main(page).locator(`#guided-${id}`)
    await section.getByRole('button', { name: 'Deneyi çalıştır', exact: true }).click()
    await expect(section.getByTestId(`guided-result-${id}`)).toHaveAttribute('data-run-number', '1')
    const expected = runGuidedExperiment(id, 1, options[id])
    for (const condition of ['baseline', 'comparison'] as const) {
      const metrics = expected[condition].metrics
      const values = { peak: metrics.peak, 'peak-time': metrics.peakTimeMs, 'response-time': metrics.responseTimeMs, 'response-delay': metrics.responseDelayMs, end: expected[condition].result.activity.O1!.at(-1)! }
      for (const [metric, value] of Object.entries(values)) await expectDataValue(page.getByTestId(`guided-${id}-${condition}-${metric}`), value, `${id} ${condition} ${metric}`)
    }
    await expectDataValue(page.getByTestId(`guided-peak-difference-${id}`), expected.delta.peak, `${id} peak difference`)
    evidence.values[id] = { baselinePeak: expected.baseline.metrics.peak, comparisonPeak: expected.comparison.metrics.peak }
    await surface(page, testInfo, evidence, `${id}-result`, section.getByTestId(`guided-result-${id}`))
  }
  await expect(page.getByTestId('guided-progress')).toHaveText('3/3 deney çalıştırıldı')
  await fragmentReload(page, route, evidence)
  await finish(testInfo, evidence, errors)
})

test('circuit reading: counts, neighbours and a route match the reading graph', async ({ page, browser }, testInfo) => {
  const route = '/ogren/devreyi-okumak'
  const { errors, evidence } = startEvidence(page, testInfo, route, browser.version())
  const graph = createReadingGraph(parseRealConnectome(await localSource(page)))
  await page.goto(route)
  await expect(main(page)).toHaveAttribute('data-data-state', 'ready')
  const summary = page.getByTestId('reading-data-summary')
  await expect(summary).toHaveAttribute('data-neuron-count', String(graph.neuronIds.length))
  await expect(summary).toHaveAttribute('data-chemical-count', String(graph.chemicalEdges.length))
  await expect(summary).toHaveAttribute('data-gap-count', String(graph.gapEdges.length))
  await surface(page, testInfo, evidence, 'summary', summary)
  const aver = inspectNeuron(graph, 'AVER')
  await expect(page.getByTestId('reading-incoming').locator('[data-edge-id]')).toHaveCount(aver.incomingChemical.length)
  await expect(page.getByTestId('reading-outgoing').locator('[data-edge-id]')).toHaveCount(aver.outgoingChemical.length)
  await expect(page.getByTestId('reading-gaps').locator('[data-edge-id]')).toHaveCount(aver.gaps.length)
  await surface(page, testInfo, evidence, 'neighbours', page.getByTestId('reading-incoming'))
  await main(page).getByRole('button', { name: 'Dolaylı yol örneği: RICL → AVBR', exact: true }).click()
  await main(page).getByRole('button', { name: 'Yol bul', exact: true }).click()
  const expected = findShortestRoute(graph, 'RICL', 'AVBR', 'chemical')
  await expect(page.getByTestId('reading-path')).toHaveAttribute('data-status', expected.status)
  await expect(page.getByTestId('reading-path-length')).toContainText(`${expected.hops.length} kenar`)
  await expect(page.getByTestId('reading-path-hops').locator('[data-edge-id]')).toHaveCount(expected.hops.length)
  await surface(page, testInfo, evidence, 'route', page.getByTestId('reading-path'))
  evidence.values = { neurons: graph.neuronIds.length, chemical: graph.chemicalEdges.length, gaps: graph.gapEdges.length, averIncoming: aver.incomingChemical.length, route: expected.nodes }
  await fragmentReload(page, route, evidence)
  await finish(testInfo, evidence, errors)
})

test('real data and assumptions: the default comparison matches the source engine', async ({ page, browser }, testInfo) => {
  const route = '/ogren/gercek-veri-ve-varsayimlar'
  const { errors, evidence } = startEvidence(page, testInfo, route, browser.version())
  const data = parseRealConnectome(await localSource(page))
  await page.goto(route)
  await expect(main(page)).toHaveAttribute('data-data-state', 'ready')
  await surface(page, testInfo, evidence, 'top')
  await main(page).getByRole('button', { name: 'Deneyi çalıştır', exact: true }).click()
  const result = main(page).getByTestId('assumptions-result')
  await expect(result).toHaveAttribute('data-run-number', '1')
  const expected = runAssumptionExperiment(data, 1, { variable: 'chemical-gain', comparisonValue: 1.2 })
  for (const condition of ['baseline', 'comparison'] as const) {
    const metrics = expected[condition].metrics
    await expectDataValue(page.getByTestId(`assumptions-${condition}-peak`), metrics.peak, `${condition} peak`)
    await expectDataValue(page.getByTestId(`assumptions-${condition}-peak-time`), metrics.peakTimeMs, `${condition} peak time`)
    await expectDataValue(page.getByTestId(`assumptions-${condition}-end`), metrics.endValue, `${condition} end`)
  }
  await expectDataValue(page.getByTestId('assumptions-max-trace-difference'), expected.delta.maxAbsTraceDifference, 'max trace difference')
  await surface(page, testInfo, evidence, 'result', result)
  evidence.values = { baselinePeak: expected.baseline.metrics.peak, comparisonPeak: expected.comparison.metrics.peak }
  await fragmentReload(page, route, evidence)
  await finish(testInfo, evidence, errors)
})

test('species atlas: the static catalogue renders without any data request', async ({ page, browser }, testInfo) => {
  const route = '/ogren/turler-atlasi'
  const { errors, evidence } = startEvidence(page, testInfo, route, browser.version())
  const origin = new URL(String(testInfo.project.use.baseURL)).origin
  const dataRequests: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.protocol !== 'data:' && (url.origin !== origin || url.pathname === '/api/local-connectome')) dataRequests.push(request.url())
  })
  await page.goto(route)
  await expect(main(page)).toHaveAttribute('data-catalog-kind', 'static-reference')
  await expect(page.getByTestId('atlas-selected-record')).toHaveAttribute('data-record-id', atlasDefaults.selectedRecordId)
  await expect(main(page).locator('[data-source-record-id]')).toHaveCount(atlasRecords.length)
  await surface(page, testInfo, evidence, 'top')
  await surface(page, testInfo, evidence, 'comparison', page.getByTestId('atlas-comparison'))
  expect(dataRequests, 'the atlas loads no local dataset and no remote resource').toEqual([])
  evidence.values = { records: atlasRecords.length }
  await fragmentReload(page, route, evidence)
  await finish(testInfo, evidence, errors)
})
