import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { Circuit, RealConnectome, RealModelParameters, SimulationResult } from '../src/model/types'

const SOURCE_HASHES = [
  '1f4fdbf84746b69b49a8da0816f52787860ce349b638dce37924ba80f90c70c9',
  'f5c524407e196ba8045cfb86fb996d41730e4b899a7c24b0c525a4d2ad0a7376',
]

interface Experiment {
  schemaVersion: number
  circuit: Circuit
  anatomy?: RealConnectome
  model: {
    activityUnit: string
    biologicalDataset: RealConnectome['dataset'] | null
    biologicalValidation?: boolean
    chemicalSigns?: string
    chemicalNormalization?: string
    gapNormalization?: string
    boundary?: string
    timeScale?: string
    parameters?: RealModelParameters
  }
  display?: { focusConnections: boolean; selectedNeuron: string; affectsSimulation: boolean }
  observedOutput: string
  results: Record<'baseline' | 'silenced' | 'tau', SimulationResult>
}

const modeGroup = (page: Page) => page.getByRole('group', { name: 'Devre modu', exact: true })
const realButton = (page: Page) => modeGroup(page).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true })
const toyButton = (page: Page) => modeGroup(page).getByRole('button', { name: 'Sekiz hücreli örnek', exact: true })
const cellButtons = (page: Page) => page.getByRole('group', { name: 'İncelenecek hücre', exact: true }).getByRole('button')
const outputPicker = (page: Page) => page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true })

async function readSource(page: Page): Promise<RealConnectome> {
  const response = await page.request.get('/api/local-connectome')
  expect(response.ok(), 'Local importer output must be available in the Vite development server').toBe(true)
  return await response.json() as RealConnectome
}

async function enterRealMode(page: Page): Promise<RealConnectome> {
  const data = await readSource(page)
  await page.goto('/')
  await realButton(page).click()
  await expect(realButton(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Gerçek veri kaynağı ve sınırları', exact: true })).toBeVisible()
  await expect(cellButtons(page)).toHaveCount(data.neurons.length)
  return data
}

async function exportExperiment(page: Page, expectedName = 'circuitiary-cook2019-local-experiment.json'): Promise<Experiment> {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Deney kaydını indir/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(expectedName)
  const path = await download.path()
  expect(path).not.toBeNull()
  return JSON.parse(await readFile(path!, 'utf8')) as Experiment
}

function incidentCount(data: RealConnectome, neuron: string): number {
  return data.chemicalEdges.filter(edge => edge.source === neuron || edge.target === neuron).length
    + data.gapEdges.filter(edge => edge.a === neuron || edge.b === neuron).length
}

test('real mode exposes verified source anatomy, experiment roles and separate assumptions', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const data = await enterRealMode(page)
  expect(data.schemaVersion).toBe(1)
  expect(data.neurons.length).toBeLessThanOrEqual(30)
  expect(new Set(data.neurons.map(neuron => neuron.id)).size).toBe(data.neurons.length)
  expect(data.neurons.map(neuron => neuron.id)).toEqual(expect.arrayContaining(['AVER', 'AVAR']))
  expect(data.dataset.sources.map(source => source.sha256).sort()).toEqual([...SOURCE_HASHES].sort())

  const summary = page.getByRole('region', { name: 'Gerçek veri kaynağı ve sınırları', exact: true })
  await expect(summary).toContainText(`${data.chemicalEdges.length} yönlü kimyasal bağlantı`)
  await expect(summary).toContainText(`${data.gapEdges.length} tekil gap junction çifti`)
  await expect(summary).toContainText('seri EM kesiti ağırlığı')
  await expect(page.locator('#stimulus-target')).toHaveValue('AVER')
  await expect(outputPicker(page)).toHaveValue('AVAR')
  await expect(page.locator('.control-panel')).toContainText('duyusal veya motor hücre oldukları anlamına gelmez')
  await expect(page.getByTestId('real-assumptions')).toContainText('sinaps adedi veya sinaptik güç değildir')
  await expect(page.getByTestId('real-assumptions')).toContainText('Dış hücreler sıfıra sabitlenmez')
  await expect(page.locator('.chart-note')).toContainText('boyutsuzdur')
  await expect(page.locator('.chart-note')).toContainText('hareket, karar veya ölçülmüş nöron ateşleme hızı değildir')
  await expect(page.locator('.circuit-canvas canvas').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tüm hücreleri sığdır', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Grafiği yakınlaştır', exact: true }).click()
  await page.getByRole('button', { name: 'Tüm hücreleri sığdır', exact: true }).click()

  await page.getByText('Dosya sürümünü, bütünlüğünü ve lisans durumunu incele', { exact: true }).click()
  for (const hash of SOURCE_HASHES) await expect(page.locator('.provenance-details')).toContainText(hash)
  await expect(page.locator('.provenance-details')).toContainText('yeniden dağıtım izni doğrulanmadı')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('real-source-and-assumptions.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('connection focus changes only the view and the table retains the full anatomical subgraph', async ({ page }) => {
  const data = await enterRealMode(page)
  const totalEdges = data.chemicalEdges.length + data.gapEdges.length
  const focus = page.getByRole('checkbox', { name: 'Yalnız seçili hücrenin bağlantıları', exact: true })
  await expect(focus).toBeChecked()
  await expect(page.locator('.graph-caption')).toContainText(`${incidentCount(data, 'AVER')}/${totalEdges}`)
  const before = await exportExperiment(page)
  await focus.uncheck()
  await expect(page.locator('.graph-caption')).toContainText(`${totalEdges}/${totalEdges}`)
  const after = await exportExperiment(page)
  expect(after.results).toEqual(before.results)
  expect(after.circuit).toEqual(before.circuit)
  expect(after.display).toMatchObject({ focusConnections: false, affectsSimulation: false })

  const verticalScale = page.getByRole('checkbox', { name: 'Yanıta göre dikey ölçek', exact: true })
  await expect(verticalScale).toBeChecked()
  await expect(page.getByTestId('chart-y-max')).toHaveText('0,100')
  await verticalScale.uncheck()
  await expect(page.getByTestId('chart-y-max')).toHaveText('1')
  const fixedScale = await exportExperiment(page)
  expect(fixedScale.results).toEqual(before.results)
  await verticalScale.check()
  const chartGeometry = await page.getByRole('img', { name: /Üç koşulun/ }).evaluate(element => {
    const svg = element as SVGSVGElement
    return { boxWidth: svg.getBoundingClientRect().width, viewWidth: svg.viewBox.baseVal.width, height: svg.getBoundingClientRect().height }
  })
  expect(Math.abs(chartGeometry.boxWidth - chartGeometry.viewWidth)).toBeLessThan(2)
  expect(chartGeometry.height).toBeGreaterThanOrEqual(220)

  await focus.check()
  await cellButtons(page).filter({ has: page.locator('span', { hasText: /^AVAR$/ }) }).click()
  await expect(page.locator('.graph-caption')).toContainText(`${incidentCount(data, 'AVAR')}/${totalEdges}`)
  await expect(page.locator('.node-description')).toContainText('Deney rolü: okunan hücre')
  await page.locator('.connection-table summary').click()
  await expect(page.locator('.connection-table tbody tr')).toHaveCount(totalEdges)
  await expect(page.locator('.connection-table')).toContainText('Ham EM kesiti')
  await expect(page.locator('.connection-table')).toContainText('Model ağırlığı')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('zero stimulus and zero coupling leave the unstimulated readout at zero; gain sliders support keyboard input', async ({ page }) => {
  await enterRealMode(page)
  await page.locator('#amplitude').fill('0')
  for (const condition of ['baseline', 'silenced', 'tau']) await expect(page.getByTestId(`peak-${condition}`)).toHaveText('0,000')
  await page.getByRole('button', { name: /Sıfırla/ }).click()
  await expect(page.locator('#stimulus-target')).toHaveValue('AVER')
  await expect(outputPicker(page)).toHaveValue('AVAR')
  const initial = await exportExperiment(page)
  expect(Math.max(...initial.results.baseline.activity.AVAR!)).toBeGreaterThan(0)

  for (const id of ['chemical-gain', 'gap-gain']) {
    const slider = page.locator(`#${id}`)
    await slider.fill('0')
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveValue('0.1')
    await page.keyboard.press('ArrowLeft')
    await expect(slider).toHaveValue('0')
  }
  for (const condition of ['baseline', 'silenced', 'tau']) await expect(page.getByTestId(`peak-${condition}`)).toHaveText('0,000')
  const uncoupled = await exportExperiment(page)
  expect(uncoupled.model.parameters).toEqual({ chemicalGain: 0, gapGain: 0 })
  expect(uncoupled.circuit.connections.every(connection => connection.weight === 0)).toBe(true)
  expect(uncoupled.anatomy).toEqual(initial.anatomy)
  await page.getByRole('button', { name: /Sıfırla/ }).click()
  const reset = await exportExperiment(page)
  expect(reset.results).toEqual(initial.results)
})

test('gap ablation and tau override affect their own conditions while reference settings and traces stay unchanged', async ({ page }) => {
  const data = await enterRealMode(page)
  await page.locator('#gap-gain').fill('0.8')
  const before = await exportExperiment(page)
  const gap = data.gapEdges.find(edge => edge.a === 'AVER' || edge.b === 'AVER') ?? data.gapEdges[0]!
  expect(gap).toBeDefined()
  await page.locator('#silenced-edge').selectOption(gap.id)
  await page.getByRole('group', { name: 'Grafikte gösterilen deney koşulu', exact: true })
    .getByRole('button', { name: 'B Bağlantı susturuldu', exact: true }).click()
  await expect(page.locator('.interpretation')).toContainText('iki yönlü etkisi kaldırılıyor')
  await page.locator('#changed-neuron').selectOption('AVAR')
  await page.locator('#changed-tau').fill('180')
  const after = await exportExperiment(page)
  expect(after.results.baseline).toEqual(before.results.baseline)
  expect(after.results.silenced.settings.silencedConnectionId).toBe(gap.id)
  expect(after.results.tau.settings.tauOverrides).toEqual({ AVAR: 180 })
  expect(after.results.tau.activity.AVAR).not.toEqual(after.results.baseline.activity.AVAR)
  expect(after.anatomy).toEqual(before.anatomy)
  for (const condition of ['baseline', 'silenced', 'tau'] as const) {
    for (const trace of Object.values(after.results[condition].activity)) {
      expect(trace.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true)
    }
  }
  await page.getByRole('button', { name: /Sıfırla/ }).click()
  await expect(page.locator('#changed-tau')).toHaveValue('90')
  await expect(page.locator('#changed-neuron')).toHaveValue('AVAR')
})

test('real export preserves raw source coordinates and records separate dynamics, boundary and local license', async ({ page }) => {
  const data = await enterRealMode(page)
  const record = await exportExperiment(page)
  expect(record.schemaVersion).toBe(2)
  expect(record.anatomy).toEqual(data)
  expect(record.model.biologicalDataset).toEqual(data.dataset)
  expect(record.model.activityUnit).toBe('dimensionless')
  expect(record.model.biologicalValidation).toBe(false)
  expect(record.model.chemicalSigns).toContain('unknown in anatomy')
  expect(record.model.chemicalSigns).toContain('all positive by model assumption')
  expect(record.model.chemicalNormalization).toContain('within subset')
  expect(record.model.gapNormalization).toContain('within subset')
  expect(record.model.boundary).toContain('external gap effects not modeled')
  expect(record.model.boundary).toContain('not clamped to zero')
  expect(record.model.timeScale).toContain('not calibrated')
  expect(record.anatomy!.dataset.license.status).toBe('unverified-local-only')
  expect(record.circuit.realData!.modelAssumptions).toMatchObject({
    chemicalSign: 'unknown-assumed-positive', boundary: 'isolated-induced-subgraph', externalGapConnections: 'removed',
  })
  expect(record.circuit.connections).toHaveLength(data.chemicalEdges.length + data.gapEdges.length)
  const byId = new Map(record.circuit.connections.map(connection => [connection.id, connection]))
  for (const edge of data.chemicalEdges) {
    const modeled = byId.get(edge.id)!
    expect(modeled).toMatchObject({ source: edge.source, target: edge.target, rawWeight: edge.rawWeight, sourceRef: edge.sourceRef })
    expect(modeled.weight).toBeGreaterThanOrEqual(0)
  }
  for (const edge of data.gapEdges) {
    expect(byId.get(edge.id)).toMatchObject({
      kind: 'gap', source: edge.a, target: edge.b, rawWeight: edge.rawWeight,
      sourceRef: edge.sourceRef, reciprocalSourceRef: edge.reciprocalSourceRef,
    })
  }
  expect(record.results.baseline.settings.stimulus.target).toBe('AVER')
  expect(record.observedOutput).toBe('AVAR')
  expect(record.results.baseline.timesMs).toHaveLength(701)
  expect(Object.keys(record.results.baseline.activity)).toEqual(data.neurons.map(neuron => neuron.id))
})

test('switching between real and illustrative modes resets identities without breaking the original eight-cell experiment', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await enterRealMode(page)
  await page.locator('#amplitude').fill('0')
  await toyButton(page).click()
  await expect(toyButton(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(cellButtons(page)).toHaveCount(8)
  await expect(page.locator('#stimulus-target')).toHaveValue('S1')
  await expect(outputPicker(page)).toHaveValue('O1')
  await expect(page.locator('#silenced-edge')).toHaveValue('I3-O1')
  await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
  await expect(page.locator('#chemical-gain')).toHaveCount(0)
  const toy = await exportExperiment(page, 'circuitiary-experiment.json')
  expect(toy.schemaVersion).toBe(1)
  expect(toy.circuit.neurons).toHaveLength(8)
  expect(toy.model.biologicalDataset).toBeNull()
  expect(toy.anatomy).toBeUndefined()
  await realButton(page).click()
  await expect(page.locator('#stimulus-target')).toHaveValue('AVER')
  await expect(outputPicker(page)).toHaveValue('AVAR')
  await expect(page.locator('#amplitude')).toHaveValue('0.8')
  const time = page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true })
  await page.locator('#dt').selectOption('2')
  await time.fill('100')
  await time.focus()
  await page.keyboard.press('ArrowRight')
  await expect(time).toHaveValue('102')
  await expect(page.locator('.timeline output')).toContainText('102')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('missing local data leaves the illustrative experiment usable and a later retry can load the real source', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/local-connectome', route => route.fulfill({ status: 404, body: 'Local data unavailable' }))
  await page.goto('/')
  await realButton(page).click()
  await expect(page.getByRole('alert')).toContainText('Yerel gerçek veri yüklenemedi')
  await expect(toyButton(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(cellButtons(page)).toHaveCount(8)
  await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
  await page.locator('#amplitude').fill('0')
  await expect(page.getByTestId('peak-baseline')).toHaveText('0,000')
  await page.unroute('**/api/local-connectome')
  await realButton(page).click()
  await expect(realButton(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('#stimulus-target')).toHaveValue('AVER')
  expect(errors).toEqual([])
})

test('local anatomy API permits local GET, rejects cross-origin access and rejects mutation methods', async ({ page }) => {
  const localGet = await page.request.get('/api/local-connectome')
  expect(localGet.status()).toBe(200)
  expect(localGet.headers()['content-type']).toContain('application/json')
  const data = await localGet.json() as RealConnectome
  expect(data.schemaVersion).toBe(1)
  expect(data.neurons.map(neuron => neuron.id)).toEqual(expect.arrayContaining(['AVER', 'AVAR']))
  const crossOrigin = await page.request.get('/api/local-connectome', {
    headers: { Origin: 'https://example.invalid' },
  })
  expect(crossOrigin.status()).toBe(403)
  const post = await page.request.post('/api/local-connectome', { data: {} })
  expect(post.status()).toBe(405)
})

test('local source and derived data files are not served directly by the development server', async ({ page }) => {
  const root = process.cwd()
  const paths = [
    '/data/local/cook-subset.json',
    '/data/local/cook-subset.json?import',
    '/data/local/cook-subset.json?raw',
    '/data/local/acquisition.json',
    '/data/raw/cook2019-si5-corrected-july2020.xlsx',
    '/data/raw/cook2019-si4-cell-lists.xlsx?url',
    `/@fs${root}/data/local/cook-subset.json`,
  ]
  for (const path of paths) {
    const response = await page.request.get(path, { headers: { Origin: 'http://localhost:3000' } })
    expect(response.status(), path).toBe(403)
    expect(await response.text(), path).not.toContain('AVAR')
  }
})

test('pressing the already active mode keeps the current experiment settings', async ({ page }) => {
  await enterRealMode(page)
  await page.locator('#amplitude').fill('0.35')
  await page.locator('#chemical-gain').fill('0.6')
  const peak = await page.getByTestId('peak-baseline').textContent()
  await realButton(page).click()
  await expect(realButton(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#amplitude')).toHaveValue('0.35')
  await expect(page.locator('#chemical-gain')).toHaveValue('0.6')
  await expect(page.getByTestId('peak-baseline')).toHaveText(peak!)
  await toyButton(page).click()
  await page.locator('#amplitude').fill('0.35')
  await toyButton(page).click()
  await expect(toyButton(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#amplitude')).toHaveValue('0.35')
})

test('a delayed load cannot silently override a newer illustrative-mode selection', async ({ page }) => {
  const data = await readSource(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/local-connectome', async route => {
    await gate
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  await page.goto('/')
  await realButton(page).click()
  let isToyDisabled = false
  try {
    await expect(modeGroup(page).getByRole('button', { name: 'Veri okunuyor…', exact: true })).toBeDisabled()
    isToyDisabled = await toyButton(page).isDisabled()
    if (!isToyDisabled) await toyButton(page).click()
  } finally { release() }
  if (isToyDisabled) await expect(realButton(page)).toHaveAttribute('aria-pressed', 'true')
  else {
    await expect(realButton(page)).toBeEnabled()
    await expect(toyButton(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(cellButtons(page)).toHaveCount(8)
  }
})

test('all real cells remain runnable at the strongest coupling and fastest permitted time constants', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const data = await enterRealMode(page)
  await page.locator('#chemical-gain').fill('2')
  await page.locator('#gap-gain').fill('1')
  await page.locator('#base-tau').fill('10')
  await page.locator('#changed-tau').fill('10')
  await page.locator('#dt').selectOption('2')
  for (const neuron of data.neurons) {
    await page.locator('#stimulus-target').selectOption(neuron.id)
    await outputPicker(page).selectOption(neuron.id)
    const peak = Number((await page.getByTestId('peak-baseline').textContent())!.replace(',', '.'))
    expect(peak).toBeGreaterThan(0)
    expect(peak).toBeLessThanOrEqual(1)
  }
  const record = await exportExperiment(page)
  for (const condition of ['baseline', 'silenced', 'tau'] as const) {
    for (const trace of Object.values(record.results[condition].activity)) {
      expect(trace.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true)
    }
  }
  const convergence = Number((await page.getByTestId('convergence-error').textContent())!.replace(',', '.'))
  expect(Number.isFinite(convergence)).toBe(true)
  await expect(page.getByTestId('numerical-warning')).toBeVisible()
  await page.locator('#dt').selectOption('0.0625')
  const refined = Number((await page.getByTestId('convergence-error').textContent())!.replace(',', '.'))
  expect(Number.isFinite(refined)).toBe(true)
  expect(refined).toBeLessThan(convergence)
  expect(refined).toBeLessThan(0.01)
  await expect(page.getByTestId('numerical-warning')).toHaveCount(0)
  const time = page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true })
  await time.fill('100'); await time.focus(); await page.keyboard.press('ArrowRight')
  await expect(time).toHaveValue('100.0625')
  await expect(page.locator('.timeline output')).toContainText('100,0625')
  expect(errors).toEqual([])
})
