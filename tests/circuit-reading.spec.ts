import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { AnatomicalChemicalEdge, AnatomicalGapEdge, RealConnectome, SimulationResult, SourceReference } from '../src/model/types'

const readingPath = '/ogren/devreyi-okumak'
const lessonPath = '/ogren/norondan-devreye'
const guidedPath = '/ogren/rehberli-deneyler'
const navigation = (page: Page) => page.getByRole('navigation', { name: 'Öğrenme ve deneyler', exact: true })
const readingLink = (page: Page) => navigation(page).getByRole('link', { name: 'Devreyi okumak', exact: true })
const lessonLink = (page: Page) => navigation(page).getByRole('link', { name: 'Nörondan devreye', exact: true })
const guidedLink = (page: Page) => navigation(page).getByRole('link', { name: 'Rehberli deneyler', exact: true })
const experimentLink = (page: Page) => navigation(page).getByRole('link', { name: 'Devre deneyleri', exact: true })
const main = (page: Page) => page.getByRole('main')
const source = (page: Page) => main(page).locator('#reading-neuron')
const target = (page: Page) => main(page).locator('#reading-target')
const mode = (page: Page) => main(page).locator('#reading-mode')
const cells = (page: Page) => page.getByRole('group', { name: 'İncelenecek hücre', exact: true })
const cell = (page: Page, id: string) => cells(page).getByRole('button').filter({ has: page.locator('span', { hasText: new RegExp(`^${id}$`) }) })
const view = (page: Page, id: '2D' | '3D') => page.getByRole('tab', { name: id === '2D' ? '2D · bağlantı haritası' : '3D · şematik uzay', exact: true })

type GraphMode = 'chemical' | 'gap' | 'mixed'
interface ReferenceHop {
  edgeId: string
  kind: 'chemical' | 'gap'
  from: string
  to: string
  rawWeight: number
  sourceRef: SourceReference
  reciprocalSourceRef?: SourceReference
}

let anatomy: RealConnectome
test.beforeAll(async () => {
  // Read the actual local importer output. The browser implementation is not
  // imported into this oracle, and no derived model weight ranks a path.
  anatomy = JSON.parse(await readFile(new URL('../data/local/cook-subset.json', import.meta.url), 'utf8')) as RealConnectome
  expect(anatomy.neurons).toHaveLength(30)
  expect(anatomy.chemicalEdges).toHaveLength(196)
  expect(anatomy.chemicalEdges.filter(edge => edge.source === edge.target)).toHaveLength(5)
  expect(anatomy.gapEdges).toHaveLength(50)
})

interface BrowserDiagnostics {
  exceptions: string[]
  consoleErrors: { message: string; url: string }[]
  expectedLocalStatuses: Set<number>
}
const diagnostics = new WeakMap<Page, BrowserDiagnostics>()
test.beforeEach(async ({ page }) => {
  const record: BrowserDiagnostics = { exceptions: [], consoleErrors: [], expectedLocalStatuses: new Set() }
  diagnostics.set(page, record)
  const attached = new WeakSet<Page>()
  const attach = (current: Page) => {
    if (attached.has(current)) return
    attached.add(current)
    current.on('pageerror', error => record.exceptions.push(error.message))
    current.on('console', message => {
      if (message.type() === 'error') record.consoleErrors.push({ message: message.text(), url: message.location().url })
    })
  }
  attach(page)
  page.context().on('page', attach)
})
test.afterEach(async ({ page }) => {
  const record = diagnostics.get(page)!
  expect(record.exceptions, 'No uncaught exceptions in reading or handoff scenarios').toEqual([])
  const unexpected = record.consoleErrors.filter(error => {
    const status = /^Failed to load resource: the server responded with a status of (\d+)\b/.exec(error.message)
    return !(status && record.expectedLocalStatuses.has(Number(status[1]))
      && new URL(error.url || 'about:blank').pathname === '/api/local-connectome')
  })
  expect(unexpected, 'Only deliberately injected local GET resource errors are expected').toEqual([])
})

const lexical = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0
function compareHops(left: ReferenceHop, right: ReferenceHop) {
  return lexical(left.to, right.to)
    || (left.kind === right.kind ? 0 : left.kind === 'chemical' ? -1 : 1)
    || lexical(left.edgeId, right.edgeId)
}

function arcs(graphMode: GraphMode): ReferenceHop[] {
  const chemical: ReferenceHop[] = graphMode === 'gap' ? [] : anatomy.chemicalEdges
    .filter(edge => edge.source !== edge.target)
    .map(edge => ({ edgeId: edge.id, kind: 'chemical', from: edge.source, to: edge.target, rawWeight: edge.rawWeight, sourceRef: edge.sourceRef }))
  const electrical: ReferenceHop[] = graphMode === 'chemical' ? [] : anatomy.gapEdges.flatMap(edge => [
    { edgeId: edge.id, kind: 'gap' as const, from: edge.a, to: edge.b, rawWeight: edge.rawWeight, sourceRef: edge.sourceRef, reciprocalSourceRef: edge.reciprocalSourceRef },
    { edgeId: edge.id, kind: 'gap' as const, from: edge.b, to: edge.a, rawWeight: edge.rawWeight, sourceRef: edge.sourceRef, reciprocalSourceRef: edge.reciprocalSourceRef },
  ])
  return [...chemical, ...electrical]
}

function referenceRoute(from: string, to: string, graphMode: GraphMode): ReferenceHop[] | null {
  if (from === to) return []
  const edges = arcs(graphMode)
  // Compute distance *backwards* from the destination, independently of the
  // UI's forward BFS. Then select the ordered decreasing-distance arcs.
  const distance = new Map<string, number>([[to, 0]])
  const queue = [to]
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]!
    for (const edge of edges.filter(edge => edge.to === current)) {
      if (distance.has(edge.from)) continue
      distance.set(edge.from, distance.get(current)! + 1)
      queue.push(edge.from)
    }
  }
  if (!distance.has(from)) return null
  const hops: ReferenceHop[] = []
  let current = from
  while (current !== to) {
    const next = edges.filter(edge => edge.from === current && distance.get(edge.to) === distance.get(current)! - 1).sort(compareHops)[0]
    if (!next) throw new Error('Reference distance must produce a complete path')
    hops.push(next)
    current = next.to
  }
  return hops
}

function referenceCycle(origin: string): ReferenceHop[] | null {
  const candidates = arcs('chemical').filter(edge => edge.from === origin).flatMap(first => {
    const returning = referenceRoute(first.to, origin, 'chemical')
    return returning ? [[first, ...returning]] : []
  })
  candidates.sort((left, right) => {
    if (left.length !== right.length) return left.length - right.length
    for (let index = 0; index < left.length; index++) {
      const order = compareHops(left[index]!, right[index]!)
      if (order) return order
    }
    return 0
  })
  return candidates[0] ?? null
}

async function expectReading(page: Page, loaded = true) {
  await expect(page).toHaveURL(new RegExp(`${readingPath}/?(?:[?#].*)?$`))
  await expect(page).toHaveTitle('Devreyi okumak · Circuitiary')
  await expect(main(page)).toHaveCount(1)
  await expect(main(page)).toHaveAttribute('id', 'circuit-reading')
  await expect(main(page).getByRole('heading', { name: 'Devreyi okumak', level: 1, exact: true })).toHaveAttribute('id', 'reading-title')
  await expect(readingLink(page)).toHaveAttribute('aria-current', 'page')
  if (loaded) {
    await expect(main(page)).toHaveAttribute('data-data-state', 'ready')
    await expect(source(page)).toBeEnabled()
  }
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function exported(page: Page) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: /Deney kaydını indir/ }).click()
  const path = await (await pending).path()
  expect(path).not.toBeNull()
  return JSON.parse(await readFile(path!, 'utf8')) as ExperimentRecord
}

interface ExperimentUi {
  values: Record<string, string>
  output: string
  cursor: string
  selected: string | null
  condition: string | null
  graphView: string | null
  playing: boolean
  focusedConnections: boolean | null
  scaledChart: boolean
}

async function experimentUi(page: Page): Promise<ExperimentUi> {
  const values: Record<string, string> = {}
  for (const id of ['stimulus-target', 'amplitude', 'duration', 'silenced-edge', 'changed-neuron', 'changed-tau', 'base-tau', 'dt', 'chemical-gain', 'gap-gain']) {
    const control = page.locator(`#${id}`)
    if (await control.count()) values[id] = await control.inputValue()
  }
  const focus = page.getByRole('checkbox', { name: 'Yalnız seçili hücrenin bağlantıları', exact: true })
  return {
    values,
    output: await page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true }).inputValue(),
    cursor: await page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true }).inputValue(),
    selected: await cells(page).getByRole('button', { pressed: true }).locator('span').textContent(),
    condition: await page.getByRole('group', { name: 'Grafikte gösterilen deney koşulu', exact: true }).getByRole('button', { pressed: true }).textContent(),
    graphView: await page.getByRole('tab', { selected: true }).textContent(),
    playing: await page.getByRole('button', { name: 'Oynatmayı duraklat', exact: true }).count() === 1,
    focusedConnections: await focus.count() ? await focus.isChecked() : null,
    scaledChart: await page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true }).isChecked(),
  }
}

async function setNumericDraft(page: Page) {
  await page.locator('#amplitude').fill('0.55')
  await page.locator('#duration').fill('350')
  await page.locator('#base-tau').fill('45')
  await page.locator('#changed-tau').fill('150')
  await page.locator('#dt').selectOption('0.5')
  await page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true }).fill('400')
  await page.getByRole('group', { name: 'Grafikte gösterilen deney koşulu', exact: true })
    .getByRole('button', { name: 'C Zaman sabiti değişti', exact: true }).click()
}

interface ExperimentRecord {
  schemaVersion: number
  display?: { selectedNeuron: string; graphView: string; [key: string]: unknown }
  results: Record<'baseline' | 'silenced' | 'tau', SimulationResult>
  observedOutput: string
  [key: string]: unknown
}

async function expectReference(row: Locator, reference: SourceReference, reciprocal = false, readable = true) {
  const prefix = reciprocal ? 'data-reciprocal-source-' : 'data-source-'
  await expect(row).toHaveAttribute(`${prefix}sheet`, reference.sheet)
  await expect(row).toHaveAttribute(`${prefix}row`, String(reference.row))
  await expect(row).toHaveAttribute(`${prefix}column`, String(reference.column))
  await expect(row).toHaveAttribute(`${prefix}cell`, reference.cell)
  if (readable) await expect(row).toContainText(reference.cell)
}

async function expectEdgeList(page: Page, listId: string, records: (AnatomicalChemicalEdge | AnatomicalGapEdge)[]) {
  const list = page.getByTestId(listId)
  const rows = list.locator('[data-edge-id]')
  await expect(rows).toHaveCount(records.length)
  const ids = await rows.evaluateAll(elements => elements.map(element => element.getAttribute('data-edge-id')).sort())
  expect(ids).toEqual(records.map(record => record.id).sort())
  for (const record of records) {
    const row = list.locator(`[data-edge-id="${record.id}"]`)
    await expect(row).toHaveAttribute('data-raw-weight', String(record.rawWeight))
    await expect(row.locator('.edge-heading > span')).toHaveText(`${record.rawWeight} EM kesiti`)
    await expectReference(row, record.sourceRef)
    if ('a' in record) await expectReference(row, (record as AnatomicalGapEdge).reciprocalSourceRef, true)
  }
}

async function expectNeighbours(page: Page, id: string) {
  await expect(source(page)).toHaveValue(id)
  await expectEdgeList(page, 'reading-incoming', anatomy.chemicalEdges.filter(edge => edge.target === id && edge.source !== id))
  await expectEdgeList(page, 'reading-outgoing', anatomy.chemicalEdges.filter(edge => edge.source === id && edge.target !== id))
  await expectEdgeList(page, 'reading-gaps', anatomy.gapEdges.filter(edge => edge.a === id || edge.b === id))
  await expectEdgeList(page, 'reading-self-loops', anatomy.chemicalEdges.filter(edge => edge.source === id && edge.target === id))
}

async function expectHopRows(container: Locator, expected: ReferenceHop[], readableReferences = false) {
  const rows = container.locator('[data-edge-id]')
  await expect(rows).toHaveCount(expected.length)
  expect(await rows.evaluateAll(elements => elements.map(element => element.getAttribute('data-edge-id')))).toEqual(expected.map(hop => hop.edgeId))
  for (let index = 0; index < expected.length; index++) {
    const hop = expected[index]!
    const row = rows.nth(index)
    await expect(row).toHaveAttribute('data-kind', hop.kind)
    await expect(row).toHaveAttribute('data-from', hop.from)
    await expect(row).toHaveAttribute('data-to', hop.to)
    await expect(row).toHaveAttribute('data-raw-weight', String(hop.rawWeight))
    await expect(row).toContainText(hop.from)
    await expect(row).toContainText(hop.to)
    await expectReference(row, hop.sourceRef, false, readableReferences)
    if (hop.reciprocalSourceRef) await expectReference(row, hop.reciprocalSourceRef, true, readableReferences)
  }
}

async function search(page: Page, from: string, to: string, graphMode: GraphMode) {
  await source(page).selectOption(from)
  await target(page).selectOption(to)
  await mode(page).selectOption(graphMode)
  await main(page).getByRole('button', { name: 'Yol bul', exact: true }).click()
  const expected = referenceRoute(from, to, graphMode)
  const path = page.getByTestId('reading-path')
  const status = expected === null ? 'unreachable' : expected.length === 0 ? 'same-cell' : 'found'
  await expect(path).toHaveAttribute('data-status', status)
  await expect(path).toHaveAttribute('data-source', from)
  await expect(path).toHaveAttribute('data-target', to)
  await expect(path).toHaveAttribute('data-mode', graphMode)
  await expectHopRows(path.locator('[data-testid="reading-path-hops"]'), expected ?? [])
  if (expected?.length) {
    expect(await page.getByTestId('reading-path-nodes').locator('strong').allTextContents()).toEqual([from, ...expected.map(hop => hop.to)])
    await expect(page.getByTestId('reading-path-length')).toContainText(`${expected.length} kenar`)
  }
  return expected
}

test('direct reading and reload show the actual local anatomy, separate self loops and auditable raw source records', async ({ page }, testInfo) => {
  await page.goto(readingPath)
  await expectReading(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.locator('#amplitude')).toHaveCount(0)
  await expect(source(page)).toHaveValue('AVER')
  await expect(target(page)).toHaveValue('AVAR')
  await expect(mode(page)).toHaveValue('chemical')
  expect(await source(page).locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).sort()))
    .toEqual(anatomy.neurons.map(neuron => neuron.id).sort())
  expect(await target(page).locator('option').count()).toBe(anatomy.neurons.length)
  const summary = page.getByTestId('reading-data-summary')
  await expect(summary.locator('strong')).toHaveText(['30', '196', '50'])
  await expect(summary).toHaveAttribute('data-self-loop-count', '5')
  await expectEdgeList(page, 'reading-all-self-loops', anatomy.chemicalEdges.filter(edge => edge.source === edge.target))
  await expect(main(page)).toContainText('seri elektron mikroskopisi (EM) kesitlerinin')
  await expect(main(page)).toContainText('sinaps')
  await expectNeighbours(page, 'AVER')
  const neuron = anatomy.neurons.find(neuron => neuron.id === 'AVER')!
  await expect(page.getByTestId('reading-selected-neuron')).toContainText(`${neuron.sourceRef.sheet} · ${neuron.sourceRef.cell} · satır ${neuron.sourceRef.row}, sütun ${neuron.sourceRef.column}`)
  await expect(page.getByTestId('reading-selected-neuron')).toContainText('Ara nöron')
  await source(page).selectOption('ASHR')
  await expectNeighbours(page, 'ASHR')
  const self = page.getByTestId('reading-self-loops').locator('[data-edge-id]')
  await expect(self).toHaveCount(1)
  await expect(self).toHaveAttribute('data-edge-id', 'chemical:ASHR->ASHR')
  const sources = page.getByTestId('reading-provenance')
  await expect(sources).toContainText(anatomy.dataset.anatomicalWeightUnit)
  await sources.getByText('Yerel veri kaynaklarının kimliğini gör', { exact: true }).click()
  for (const reference of anatomy.dataset.sources) {
    await expect(sources).toContainText(reference.sha256)
    await expect(sources.locator(`a[href="${reference.url}"]`)).toHaveCount(1)
  }
  await expect(sources).toContainText('yeniden dağıtım')
  await expect(sources).toContainText('doğrulan')
  await noOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('reading-source-records.png'), fullPage: true })
  await page.reload()
  await expectReading(page)
  await expect(source(page)).toHaveValue('AVER')
  await expect(target(page)).toHaveValue('AVAR')
  await expectNeighbours(page, 'AVER')
})

test('minimum-hop paths use the exact directed or bidirectional raw records and step controls traverse a real gap in reverse', async ({ page }, testInfo) => {
  await page.goto(readingPath)
  await expectReading(page)
  const directed = await search(page, 'RICL', 'AVBR', 'chemical')
  expect(directed?.map(hop => hop.to)).toEqual(['AVAR', 'AVBR'])
  for (const graphMode of ['chemical', 'gap', 'mixed'] as const) await search(page, 'AVER', 'AVBR', graphMode)
  const expected = await search(page, 'AVER', 'AVBR', 'gap')
  expect(expected?.map(hop => hop.to)).toEqual(['AVAR', 'AVBL', 'AVBR'])
  expect(expected?.[0]?.edgeId).toBe('gap:AVAR--AVER')
  expect(expected?.[0]?.from).toBe('AVER')
  const current = page.getByTestId('reading-active-hop')
  const previous = main(page).getByRole('button', { name: 'Önceki adım', exact: true })
  const next = main(page).getByRole('button', { name: 'Sonraki adım', exact: true })
  await expect(previous).toBeDisabled()
  for (let index = 0; index < expected!.length; index++) {
    const hop = expected![index]!
    await expect(page.getByTestId('reading-step')).toHaveAttribute('data-step-index', String(index))
    await expect(page.getByTestId('reading-step')).toHaveText(`${index + 1} / ${expected!.length}`)
    await expect(current).toHaveAttribute('data-edge-id', hop.edgeId)
    await expectReference(current, hop.sourceRef)
    await expectReference(current, hop.reciprocalSourceRef!, true)
    await expect(current).toContainText(`${hop.rawWeight} EM kesiti`)
    await expect(current).toContainText(hop.from)
    await expect(current).toContainText(hop.to)
    if (index < expected!.length - 1) {
      await next.focus()
      await page.keyboard.press('Enter')
    }
  }
  await expect(next).toBeDisabled()
  await previous.click()
  await expect(page.getByTestId('reading-step')).toHaveAttribute('data-step-index', '1')
  await expect(current).toContainText('AVBL')
  await noOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('reading-gap-route.png'), fullPage: true })
})

test('unreachable and same-cell results remain distinct from chemical self loops and the globally shortest directed cycle', async ({ page }) => {
  await page.goto(readingPath)
  await expectReading(page)
  expect(await search(page, 'AVBR', 'RICL', 'chemical')).toBeNull()
  await expect(page.getByTestId('reading-path')).toContainText('alt graf')
  expect(await search(page, 'AVAR', 'AIZL', 'gap')).toBeNull()
  const boundary = page.getByTestId('reading-external-boundary')
  const omitted = anatomy.selection.omittedByNeuron.find(entry => entry.neuronId === 'AVAR')!
  for (const [id, count, weight] of [
    ['incoming', omitted.chemicalIncomingCount, omitted.chemicalIncomingWeight],
    ['outgoing', omitted.chemicalOutgoingCount, omitted.chemicalOutgoingWeight],
    ['gaps', omitted.gapCount, omitted.gapWeight],
  ] as const) {
    const value = boundary.getByTestId(`reading-omitted-${id}`)
    await expect(value).toHaveAttribute('data-count', String(count))
    await expect(value).toContainText(`${weight} EM kesiti`)
  }
  expect(await search(page, 'RIS', 'RIS', 'mixed')).toEqual([])
  await expect(page.getByTestId('reading-path')).toContainText('0')
  await expectNeighbours(page, 'RIS')
  const expected = referenceCycle('RIS')
  expect(expected?.map(hop => hop.to)).toEqual(['AVER', 'AVAL', 'PVCL', 'RIS'])
  await expectHopRows(page.getByTestId('reading-cycle-hops'), expected!, true)
  await mode(page).selectOption('gap')
  await expectHopRows(page.getByTestId('reading-cycle-hops'), expected!, true)
  expect(expected!.every(hop => hop.kind === 'chemical' && hop.from !== hop.to)).toBe(true)
  await source(page).selectOption('RICL')
  expect(referenceCycle('RICL')).toBeNull()
  await expect(page.getByTestId('reading-cycle').locator('[data-edge-id]')).toHaveCount(0)
  await expect(page.getByTestId('reading-cycle')).toContainText('döngü')
  await noOverflow(page)
})

test('an explicit real-mode inspection changes only the selected neuron and preserves playing time, every setting, 3D view and complete numerical record', async ({ page }) => {
  const epoch = new Date('2030-01-01T00:00:00Z')
  await page.clock.install({ time: epoch })
  await page.clock.pauseAt(new Date(epoch.getTime() + 1000))
  await page.goto('/')
  await page.getByRole('group', { name: 'Devre modu', exact: true }).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true }).click()
  await expect(cells(page).getByRole('button')).toHaveCount(30)
  await setNumericDraft(page)
  await page.locator('#chemical-gain').fill('1.1')
  await page.locator('#gap-gain').fill('0.4')
  await page.locator('#stimulus-target').selectOption('PVCL')
  await page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true }).selectOption('PVCR')
  await page.locator('#changed-neuron').selectOption('PVDL')
  await page.locator('#silenced-edge').selectOption('gap:AVAR--AVER')
  await page.getByRole('checkbox', { name: 'Yalnız seçili hücrenin bağlantıları', exact: true }).uncheck()
  await page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true }).uncheck()
  await cell(page, 'ASHR').click()
  await view(page, '3D').click()
  // Scene construction completes asynchronously while the clock is paused;
  // renderer readiness follows its first actual requestAnimationFrame render.
  await expect(page.locator('.circuit-3d')).toHaveAttribute('data-node-count', '30', { timeout: 15_000 })
  await page.clock.runFor(32)
  await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready', { timeout: 15_000 })
  const renderer = await page.locator('.circuit-3d').getAttribute('data-renderer-instance')
  expect(renderer).not.toBeNull()
  await page.getByRole('button', { name: 'Etkinliği oynat', exact: true }).click()
  await page.clock.runFor(64)
  const beforeUi = await experimentUi(page)
  expect(beforeUi.playing).toBe(true)
  expect(Number(beforeUi.cursor)).toBeGreaterThan(400)
  const before = await exported(page)
  await readingLink(page).click()
  await expectReading(page)
  await source(page).selectOption('RIS')
  await search(page, 'RIS', 'AVAR', 'mixed')
  await main(page).getByRole('button', { name: 'Ana deneyde bu hücreyi incele', exact: true }).click()
  await expect(page).toHaveURL(/\/#graph-panel-3d$/)
  await expect(main(page)).toHaveAttribute('id', 'top')
  await expect(view(page, '3D')).toHaveAttribute('aria-selected', 'true')
  await expect(cell(page, 'RIS')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready')
  await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-instance', renderer!)
  expect(await experimentUi(page)).toEqual({ ...beforeUi, selected: 'RIS' })
  const after = await exported(page)
  expect(after).toEqual({ ...before, display: { ...before.display, selectedNeuron: 'RIS' } })
  await page.clock.runFor(64)
  expect(Number(await page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true }).inputValue())).toBeGreaterThan(Number(beforeUi.cursor))
  await expect(page.getByRole('button', { name: 'Oynatmayı duraklat', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Oynatmayı duraklat', exact: true }).click()
  await noOverflow(page)
})

test('first real inspection adapts only invalid toy identities and the original toy mode button restores the complete previous draft', async ({ page }) => {
  await page.goto('/')
  await expect(cells(page).getByRole('button')).toHaveCount(8)
  await setNumericDraft(page)
  await page.locator('#stimulus-target').selectOption('S2')
  await page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true }).selectOption('O2')
  await page.locator('#changed-neuron').selectOption('I4')
  await page.locator('#silenced-edge').selectOption('I4-O1')
  await page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true }).check()
  await cell(page, 'O2').click()
  await view(page, '3D').click()
  await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready', { timeout: 15_000 })
  const beforeUi = await experimentUi(page)
  const before = await exported(page)
  expect(before.schemaVersion).toBe(1)
  await readingLink(page).click()
  await expectReading(page)
  await source(page).selectOption('RIS')
  await main(page).getByRole('button', { name: 'Ana deneyde bu hücreyi incele', exact: true }).click()
  await expect(page).toHaveURL(/\/#graph-panel-3d$/)
  await expect(cells(page).getByRole('button')).toHaveCount(30)
  await expect(cell(page, 'RIS')).toHaveAttribute('aria-pressed', 'true')
  const adaptedUi = await experimentUi(page)
  for (const id of ['amplitude', 'duration', 'base-tau', 'changed-tau', 'dt']) expect(adaptedUi.values[id]).toBe(beforeUi.values[id])
  expect(adaptedUi).toMatchObject({ cursor: beforeUi.cursor, condition: beforeUi.condition, graphView: beforeUi.graphView, playing: beforeUi.playing, scaledChart: beforeUi.scaledChart })
  expect(adaptedUi.values).toMatchObject({ 'stimulus-target': 'AVER', 'changed-neuron': 'AVAR', 'silenced-edge': 'chemical:AVER->AVAR' })
  expect(adaptedUi.output).toBe('AVAR')
  const real = await exported(page)
  expect(real.schemaVersion).toBe(2)
  expect(real.results.baseline.settings).toEqual({ ...before.results.baseline.settings, stimulus: { ...before.results.baseline.settings.stimulus, target: 'AVER' } })
  expect(real.results.silenced.settings.silencedConnectionId).toBe('chemical:AVER->AVAR')
  expect(real.results.tau.settings.tauOverrides).toEqual({ AVAR: 150 })
  expect(real.observedOutput).toBe('AVAR')
  await readingLink(page).click()
  await expectReading(page)
  await expect(source(page)).toHaveValue('RIS')
  await experimentLink(page).click()
  await expect(cell(page, 'RIS')).toHaveAttribute('aria-pressed', 'true')
  // The existing mode action consumes the saved toy draft; ordinary page
  // navigation above must neither reset it nor silently restore the toy.
  await page.getByRole('group', { name: 'Devre modu', exact: true }).getByRole('button', { name: 'Sekiz hücreli örnek', exact: true }).click()
  await expect(cells(page).getByRole('button')).toHaveCount(8)
  await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready')
  expect(await experimentUi(page)).toEqual(beforeUi)
  expect(await exported(page)).toEqual(before)
  await noOverflow(page)
})

test('failed and canceled first-real inspections stay explicit and cannot commit changes to a hidden toy experiment', async ({ page }) => {
  diagnostics.get(page)!.expectedLocalStatuses = new Set([503])
  let getCount = 0
  let held = false
  let releaseHeld!: () => void
  const gate = new Promise<void>(resolve => { releaseHeld = resolve })
  await page.route('**/api/local-connectome', async route => {
    expect(route.request().method()).toBe('GET')
    getCount += 1
    if (getCount === 1) await route.fulfill({ status: 200, json: anatomy })
    else if (getCount === 2) await route.fulfill({ status: 503, json: { error: 'Deliberate inspection failure' } })
    else {
      held = true
      await gate
      await route.fulfill({ status: 200, json: anatomy })
    }
  })
  await page.goto('/')
  await setNumericDraft(page)
  await cell(page, 'O2').click()
  const beforeUi = await experimentUi(page)
  const before = await exported(page)
  await readingLink(page).click()
  await expectReading(page)
  await source(page).selectOption('RIS')
  const inspect = () => main(page).getByRole('button', { name: 'Ana deneyde bu hücreyi incele', exact: true })
  await inspect().click()
  await expect(page.getByTestId('reading-handoff-error')).toBeVisible()
  await expect(page.getByTestId('reading-handoff-error')).toHaveAttribute('role', 'alert')
  await expect(page).toHaveURL(new RegExp(`${readingPath}$`))
  await expect(source(page)).toBeEnabled()
  await expect(source(page)).toHaveValue('RIS')
  await expectNeighbours(page, 'RIS')
  await experimentLink(page).click()
  await expect(cells(page).getByRole('button')).toHaveCount(8)
  expect(await experimentUi(page)).toEqual(beforeUi)
  expect(await exported(page)).toEqual(before)
  await readingLink(page).click()
  await inspect().click()
  await expect.poll(() => held).toBe(true)
  await expect(source(page)).toBeDisabled()
  await lessonLink(page).click()
  await expect(main(page)).toHaveAttribute('id', 'neuron-lesson')
  const response = page.waitForResponse(value => value.url().endsWith('/api/local-connectome') && value.status() === 200)
  releaseHeld()
  await response
  await expect(page.locator('#reading-neuron')).toBeEnabled()
  await expect(page).toHaveURL(new RegExp(`${lessonPath}$`))
  await experimentLink(page).click()
  await expect(cells(page).getByRole('button')).toHaveCount(8)
  expect(await experimentUi(page)).toEqual(beforeUi)
  expect(await exported(page)).toEqual(before)
  expect(getCount).toBe(3)
  await noOverflow(page)
})

test('loading, local GET failure and malformed source data never fabricate an empty connectome, and explicit retry recovers', async ({ page }) => {
  diagnostics.get(page)!.expectedLocalStatuses = new Set([503, 404])
  let releaseFirst!: () => void
  const gate = new Promise<void>(resolve => { releaseFirst = resolve })
  const methods: string[] = []
  const malformed = structuredClone(anatomy)
  // Preserve the real schema except for a source coordinate inconsistency.
  // Recovery therefore exercises the actual parser, not just JSON decoding.
  malformed.chemicalEdges[0]!.sourceRef.cell = 'A1'
  await page.route('**/api/local-connectome', async route => {
    methods.push(route.request().method())
    if (methods.length === 1) {
      await gate
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Deliberate local test failure' }) })
    } else if (methods.length === 2) await route.fulfill({ status: 404, json: { error: 'Deliberately unavailable local file' } })
    else if (methods.length === 3) await route.fulfill({ status: 200, json: malformed })
    else await route.fulfill({ status: 200, json: anatomy })
  })
  await page.goto(readingPath)
  await expectReading(page, false)
  const loading = page.getByTestId('reading-load-status')
  await expect(loading).toHaveAttribute('data-state', 'loading')
  await expect(loading.getByRole('status')).toContainText('yükleniyor')
  await expect(page.getByTestId('reading-incoming')).toHaveCount(0)
  releaseFirst()
  const retry = main(page).getByRole('button', { name: 'Tekrar dene', exact: true })
  await expect(main(page).getByRole('alert')).toBeVisible()
  await expect(main(page)).toHaveAttribute('data-data-state', 'error')
  await expect(retry).toBeEnabled()
  await expect(page.getByTestId('reading-path')).toHaveCount(0)
  await retry.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => methods.length).toBe(2)
  await expect(main(page)).toHaveAttribute('data-data-state', 'missing')
  await expect(main(page).getByRole('alert')).toContainText('bulunamadı')
  await expect(page.getByTestId('reading-incoming')).toHaveCount(0)
  await retry.click()
  await expect.poll(() => methods.length).toBe(3)
  await expect(main(page)).toHaveAttribute('data-data-state', 'invalid')
  await expect(main(page).getByRole('alert')).toBeVisible()
  await expect(page.getByTestId('reading-incoming')).toHaveCount(0)
  await expect(retry).toBeEnabled()
  await retry.click()
  await expectReading(page)
  await expect(main(page).getByRole('alert')).toHaveCount(0)
  await expect(loading).toHaveAttribute('data-state', 'ready')
  expect(methods).toEqual(['GET', 'GET', 'GET', 'GET'])
  await expectNeighbours(page, 'AVER')
  await search(page, 'RICL', 'AVBR', 'chemical')
  await noOverflow(page)
})

test('reading retains its own route drafts and leaves the first two learning pages and their completed results unchanged', async ({ page }) => {
  await page.goto(lessonPath)
  await expect(main(page)).toHaveAttribute('id', 'neuron-lesson')
  await page.locator('#lesson-stimulus').fill('0.4')
  await page.locator('#lesson-threshold').fill('0.9')
  await page.locator('#lesson-circuit-stimulus').fill('0.3')
  const lessonValues = ['#lesson-stimulus', '#lesson-threshold', '#lesson-circuit-stimulus']
  const lessonBefore = await Promise.all(lessonValues.map(id => page.locator(id).inputValue()))
  await guidedLink(page).click()
  await expect(page).toHaveURL(new RegExp(`${guidedPath}$`))
  await expect(main(page)).toHaveAttribute('id', 'guided-experiments')
  await page.locator('#guided-stimulus-prediction').selectOption('unsure')
  await main(page).locator('#guided-stimulus').getByRole('button', { name: 'Deneyi çalıştır', exact: true }).click()
  const guided = page.getByTestId('guided-result-stimulus')
  await expect(guided).toHaveAttribute('data-run-number', '1')
  const guidedBefore = await guided.locator('[data-guided-trace]').evaluateAll(paths => paths.map(path => path.getAttribute('d')))
  expect(guidedBefore).toHaveLength(2)
  const metricsBefore = await guided.locator('[data-value]').evaluateAll(values => values.map(value => ({ id: value.getAttribute('data-testid'), value: value.getAttribute('data-value'), text: value.textContent })))
  expect(metricsBefore.length).toBeGreaterThan(8)
  await readingLink(page).click()
  await expectReading(page)
  await expect(page.locator('#reading-title')).toBeFocused()
  await search(page, 'AVER', 'AVBR', 'gap')
  await main(page).getByRole('button', { name: 'Sonraki adım', exact: true }).click()
  await expect(page.getByTestId('reading-step')).toHaveAttribute('data-step-index', '1')
  await lessonLink(page).click()
  await expect(page.locator('#lesson-title')).toBeFocused()
  expect(await Promise.all(lessonValues.map(id => page.locator(id).inputValue()))).toEqual(lessonBefore)
  await expect(page.locator('#circuit-reading')).not.toBeVisible()
  await guidedLink(page).click()
  await expect(page.locator('#guided-stimulus-prediction')).toHaveValue('unsure')
  await expect(guided).toHaveAttribute('data-run-number', '1')
  await expect.poll(() => guided.locator('[data-guided-trace]').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(guidedBefore)
  expect(await guided.locator('[data-value]').evaluateAll(values => values.map(value => ({ id: value.getAttribute('data-testid'), value: value.getAttribute('data-value'), text: value.textContent })))).toEqual(metricsBefore)
  await page.goBack()
  await expect(main(page)).toHaveAttribute('id', 'neuron-lesson')
  await page.goBack()
  await expectReading(page)
  await expect(source(page)).toHaveValue('AVER')
  await expect(target(page)).toHaveValue('AVBR')
  await expect(mode(page)).toHaveValue('gap')
  await expectHopRows(page.getByTestId('reading-path-hops'), referenceRoute('AVER', 'AVBR', 'gap')!)
  await expect(page.getByTestId('reading-step')).toHaveAttribute('data-step-index', '1')
  await page.goForward()
  await expect(main(page)).toHaveAttribute('id', 'neuron-lesson')
  expect(await Promise.all(lessonValues.map(id => page.locator(id).inputValue()))).toEqual(lessonBefore)
  await noOverflow(page)
})

test('native hashes, history and keyboard or touch navigation reach the reading content while desktop modified links open actual tabs', async ({ page, isMobile }) => {
  await page.goto(`${readingPath}#reading-provenance`)
  await expectReading(page)
  await expect(page.locator('#reading-provenance')).toBeInViewport()
  await expect(page.locator('#reading-provenance')).toBeFocused()
  await experimentLink(page).click()
  await expect(main(page)).toHaveAttribute('id', 'top')
  await page.getByRole('link', { name: /Modeli anlamak/ }).click()
  await expect(page).toHaveURL(/\/#assumptions$/)
  await expect(page.locator('#assumptions')).toBeInViewport()
  // Keep the native history entry's scroll position while assigning keyboard
  // focus: Locator.focus() would otherwise scroll this top navigation into view.
  await readingLink(page).evaluate(link => (link as HTMLElement).focus({ preventScroll: true }))
  await expect(readingLink(page)).toBeFocused()
  await expect(page.locator('#assumptions')).toBeInViewport()
  const assumptionsScroll = await page.evaluate(() => window.scrollY)
  await page.keyboard.press('Enter')
  await expectReading(page)
  await expect(page.locator('#reading-title')).toBeFocused()
  const skip = page.getByRole('link', { name: 'İçeriğe geç', exact: true })
  await expect(skip).toHaveAttribute('href', '#circuit-reading')
  await skip.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`${readingPath}#circuit-reading$`))
  await expect(main(page)).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`${readingPath}$`))
  await page.goBack()
  await expect(page).toHaveURL(/\/#assumptions$/)
  await expect(page.locator('#assumptions')).toBeInViewport()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(assumptionsScroll)
  await page.goForward()
  await expectReading(page)
  await experimentLink(page).click()
  const originalUrl = page.url()
  await expect(readingLink(page)).toHaveAttribute('href', readingPath)
  if (isMobile) {
    await readingLink(page).tap()
    await expectReading(page)
    await experimentLink(page).tap()
    await expect(page).toHaveURL(originalUrl)
  } else {
    const context = page.context()
    expect(context.pages()).toHaveLength(1)
    const actions: Parameters<Locator['click']>[0][] = [{ modifiers: ['ControlOrMeta'] }, { button: 'middle' }]
    for (const options of actions) {
      // BrowserContext.page includes native tabs that lack an opener relation.
      const pending = context.waitForEvent('page')
      await readingLink(page).click(options)
      const tab = await pending
      expect(tab).not.toBe(page)
      expect(context.pages()).toHaveLength(2)
      await expectReading(tab)
      await expect(page).toHaveURL(originalUrl)
      await tab.close()
      expect(context.pages()).toHaveLength(1)
    }
  }
  await noOverflow(page)
})
