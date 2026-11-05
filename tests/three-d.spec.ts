import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { RealConnectome, SimulationResult } from '../src/model/types'

interface Experiment {
  schemaVersion: number
  circuit: { neurons: Array<{ id: string }>; connections: unknown[] }
  anatomy?: RealConnectome
  model: { biologicalDataset: unknown; activityUnit: string }
  observedOutput: string
  results: Record<'baseline' | 'silenced' | 'tau', SimulationResult>
}

interface LifetimeMetrics {
  created: string[]
  disposed: string[]
  pendingRaf: Set<number>
  listeners: Map<EventTarget, Map<string, Set<EventListenerOrEventListenerObject>>>
  ownedCanvases: HTMLCanvasElement[]
  ownedContexts: WebGL2RenderingContext[]
}

const tabs = (page: Page) => page.getByRole('tablist', { name: 'Devre görünümü', exact: true })
const twoD = (page: Page) => tabs(page).getByRole('tab', { name: '2D · bağlantı haritası', exact: true })
const threeD = (page: Page) => tabs(page).getByRole('tab', { name: '3D · şematik uzay', exact: true })
const renderer = (page: Page) => page.locator('.circuit-3d')
const canvas = (page: Page) => page.locator('canvas.circuit-3d-canvas')
const node = (page: Page, id: string) => page.locator(`.node-label-3d[data-node-id="${id}"]`)
const cells = (page: Page) => page.getByRole('group', { name: 'İncelenecek hücre', exact: true })
const cell = (page: Page, id: string) => cells(page).getByRole('button').filter({ has: page.locator('span', { hasText: new RegExp(`^${id}$`) }) })
const timeSlider = (page: Page) => page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true })
const mode = (page: Page) => page.getByRole('group', { name: 'Devre modu', exact: true })

async function exported(page: Page, fileName = 'circuitiary-experiment.json'): Promise<Experiment> {
  const promise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Deney kaydını indir/ }).click()
  const download = await promise
  expect(download.suggestedFilename()).toBe(fileName)
  const path = await download.path()
  expect(path).not.toBeNull()
  return JSON.parse(await readFile(path!, 'utf8')) as Experiment
}

async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))))
}

async function enterThreeD(page: Page, count: number): Promise<void> {
  await threeD(page).click()
  await expect(threeD(page)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel', { name: '3D · şematik uzay', exact: true })).toBeVisible()
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'ready', { timeout: 15_000 })
  await expect(renderer(page)).toHaveAttribute('data-node-count', String(count))
  await expect(canvas(page)).toHaveCount(1)
  await expect(canvas(page)).toBeVisible()
  await expect.poll(async () => Number(await renderer(page).getAttribute('data-render-count'))).toBeGreaterThan(0)
  await settleFrames(page)
}

async function recordWebGL(page: Page, testInfo: TestInfo): Promise<void> {
  const evidence = await canvas(page).evaluate(element => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2')
    if (!gl) return null
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null
    const unmaskedRenderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : null
    return {
      version: gl.getParameter(gl.VERSION), vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
      unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
      unmaskedRenderer, programLinked: program ? gl.getProgramParameter(program, gl.LINK_STATUS) : null,
      contextLost: gl.isContextLost(),
      implementation: unmaskedRenderer && /swiftshader|llvmpipe|software|llvm/i.test(unmaskedRenderer) ? 'software'
        : unmaskedRenderer && /Apple M\d|ANGLE Metal Renderer: Apple|NVIDIA|Radeon|Intel/i.test(unmaskedRenderer) ? 'hardware' : 'unclassified',
    }
  })
  expect(evidence, 'Success tests require an actual browser WebGL2 context').not.toBeNull()
  expect(evidence!.version).toContain('WebGL 2.0')
  expect(evidence!.contextLost).toBe(false)
  expect(evidence!.programLinked, 'The rendered scene must have a genuinely linked GPU program').toBe(true)
  testInfo.annotations.push({ type: 'WebGL implementation', description: String(evidence!.unmaskedRenderer ?? evidence!.renderer) })
  await testInfo.attach('actual-webgl-renderer.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' })
}

async function withoutLabelInterception(page: Page, action: () => Promise<void>): Promise<void> {
  await page.locator('.node-label-3d').evaluateAll(elements => elements.forEach(element => (element as HTMLElement).style.pointerEvents = 'none'))
  try { await action() }
  finally { await page.locator('.node-label-3d').evaluateAll(elements => elements.forEach(element => (element as HTMLElement).style.removeProperty('pointer-events'))) }
}

async function cameraDistance(page: Page): Promise<number> {
  const position = (await renderer(page).getAttribute('data-camera-position'))!.split(',').map(Number)
  const target = (await renderer(page).getAttribute('data-camera-target'))!.split(',').map(Number)
  expect(position).toHaveLength(3)
  expect(target).toHaveLength(3)
  return Math.hypot(...position.map((value, index) => value - target[index]!))
}

async function expectActivity(label: Locator, expected: number): Promise<void> {
  await expect.poll(async () => Number(await label.getAttribute('data-activity'))).toBeCloseTo(expected, 5)
}

test('2D stays the default and adding 3D preserves existing controls, traces, weights and JSON', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(twoD(page)).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.circuit-canvas canvas').first()).toBeVisible()
  await expect(cells(page).getByRole('button')).toHaveCount(8)
  await expect(mode(page).getByRole('button', { name: 'Sekiz hücreli örnek', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(mode(page).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true })).toBeEnabled()
  await expect(page.locator('#amplitude')).toHaveValue('0.8')
  await expect(page.locator('#stimulus-target')).toHaveValue('S1')
  await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
  await expect(page.getByTestId('peak-silenced')).toHaveText('0,000')
  const plotPaths = await page.getByRole('img', { name: /Üç koşulun/ }).locator('path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))
  const before = await exported(page)
  await enterThreeD(page, 8)
  await recordWebGL(page, testInfo)
  await expect(renderer(page)).toContainText('anatomik konum/morfoloji değildir')
  const after = await exported(page)
  expect(after.results).toEqual(before.results)
  expect(after.circuit).toEqual(before.circuit)
  expect(after.model).toEqual(before.model)
  const afterPaths = await page.getByRole('img', { name: /Üç koşulun/ }).locator('path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))
  expect(afterPaths).toEqual(plotPaths)
  await page.locator('.connection-table summary').click()
  await expect(page.locator('.connection-table tbody tr')).toHaveCount(12)
  await expect(page.getByText('ÖLÇÜLMÜŞ BİYOLOJİK VERİ: YOK')).toBeVisible()
  await twoD(page).click()
  await expect(page.locator('.circuit-canvas canvas').first()).toBeVisible()
  await expect(canvas(page)).toHaveCount(0)
  await twoD(page).focus()
  await page.keyboard.press('End')
  await expect(threeD(page)).toBeFocused()
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'ready')
  await page.keyboard.press('Home')
  await expect(twoD(page)).toBeFocused()
  await expect(canvas(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('actual 3D mouse rotation and zoom change the camera and rendered canvas', async ({ page }, testInfo) => {
  await page.goto('/')
  await enterThreeD(page, 8)
  await recordWebGL(page, testInfo)
  await canvas(page).scrollIntoViewIfNeeded()
  const box = await canvas(page).boundingBox()
  expect(box).not.toBeNull()
  const initialCamera = await renderer(page).getAttribute('data-camera-position')
  const before = await canvas(page).screenshot()
  const renderCount = Number(await renderer(page).getAttribute('data-render-count'))
  await withoutLabelInterception(page, async () => {
    await page.mouse.move(box!.x + box!.width * .72, box!.y + box!.height * .3)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width * .5, box!.y + box!.height * .45, { steps: 12 })
    await page.mouse.up()
  })
  await expect.poll(() => renderer(page).getAttribute('data-camera-position')).not.toBe(initialCamera)
  await expect.poll(async () => Number(await renderer(page).getAttribute('data-render-count'))).toBeGreaterThan(renderCount)
  await settleFrames(page)
  const after = await canvas(page).screenshot()
  expect(after.equals(before), 'Camera rotation must change real rendered pixels').toBe(false)
  await testInfo.attach('3d-before-rotation.png', { body: before, contentType: 'image/png' })
  await testInfo.attach('3d-after-rotation.png', { body: after, contentType: 'image/png' })
  const distance = await cameraDistance(page)
  await canvas(page).focus()
  await page.keyboard.press('+')
  await expect.poll(() => cameraDistance(page)).not.toBeCloseTo(distance, 4)
  const rotated = await renderer(page).getAttribute('data-camera-position')
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => renderer(page).getAttribute('data-camera-position')).not.toBe(rotated)
  await page.keyboard.press('Home')
  await settleFrames(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('canvas raycasting selects the actual projected node and external keyboard buttons keep the same inspector', async ({ page }) => {
  await page.goto('/')
  await enterThreeD(page, 8)
  await expect(node(page, 'O1')).toHaveAttribute('data-visible', 'true')
  const x = Number(await node(page, 'O1').getAttribute('data-projected-x'))
  const y = Number(await node(page, 'O1').getAttribute('data-projected-y'))
  expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
  await withoutLabelInterception(page, async () => { await canvas(page).click({ position: { x, y } }) })
  await expect(cell(page, 'O1')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.node-description')).toContainText('O1 / Çıktı hücresi')
  await expect(page.locator('.spatial-selection')).toContainText('O1 / Çıktı hücresi')
  await expect(node(page, 'O1')).toHaveAttribute('aria-pressed', 'true')
  await cell(page, 'S2').focus()
  await page.keyboard.press('Enter')
  await expect(cell(page, 'S2')).toHaveAttribute('aria-pressed', 'true')
  await expect(node(page, 'S2')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.node-description')).toContainText('S2 / Giriş hücresi')
  await node(page, 'I3').click()
  await expect(cell(page, 'I3')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.node-description')).toContainText('I3 / Ara hücre')
})

test('3D node activity follows the sampled timeline and all three condition results', async ({ page }) => {
  await page.goto('/')
  await enterThreeD(page, 8)
  await cell(page, 'O1').click()
  await timeSlider(page).fill('0')
  await expectActivity(node(page, 'O1'), 0)
  await timeSlider(page).fill('250')
  const record = await exported(page)
  const index = record.results.baseline.timesMs.indexOf(250)
  expect(index).toBeGreaterThanOrEqual(0)
  await expectActivity(node(page, 'O1'), record.results.baseline.activity.O1![index]!)
  await expect(page.getByTestId('three-d-selected-activity')).toHaveText(record.results.baseline.activity.O1![index]!.toLocaleString('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }))
  const conditions = page.getByRole('group', { name: 'Grafikte gösterilen deney koşulu', exact: true })
  await conditions.getByRole('button', { name: 'B Bağlantı susturuldu', exact: true }).click()
  await expectActivity(node(page, 'O1'), record.results.silenced.activity.O1![index]!)
  await expect(page.getByTestId('three-d-selected-activity')).toHaveText('0,000')
  await conditions.getByRole('button', { name: 'C Zaman sabiti değişti', exact: true }).click()
  await expectActivity(node(page, 'O1'), record.results.tau.activity.O1![index]!)
  await page.locator('#dt').selectOption('2')
  await timeSlider(page).fill('100')
  await timeSlider(page).focus()
  await page.keyboard.press('ArrowRight')
  await expect(timeSlider(page)).toHaveValue('102')
  await expect(page.locator('.timeline output')).toContainText('102')
  const coarse = await exported(page)
  await expectActivity(node(page, 'S1'), coarse.results.tau.activity.S1![coarse.results.tau.timesMs.indexOf(102)]!)
})

test('selection, conditions, controls and ongoing playback survive 2D and 3D tab changes', async ({ page }) => {
  await page.goto('/')
  await cell(page, 'O2').click()
  await page.locator('#amplitude').fill('0.55')
  await page.getByRole('group', { name: 'Grafikte gösterilen deney koşulu', exact: true })
    .getByRole('button', { name: 'C Zaman sabiti değişti', exact: true }).click()
  const before = await exported(page)
  await enterThreeD(page, 8)
  await expect(cell(page, 'O2')).toHaveAttribute('aria-pressed', 'true')
  await expect(node(page, 'O2')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#amplitude')).toHaveValue('0.55')
  await timeSlider(page).fill('120')
  await page.getByRole('button', { name: 'Etkinliği oynat', exact: true }).click()
  await twoD(page).click()
  await expect(page.getByRole('button', { name: 'Oynatmayı duraklat', exact: true })).toBeVisible()
  await threeD(page).click()
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'ready')
  await expect(page.getByRole('button', { name: 'Oynatmayı duraklat', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Oynatmayı duraklat', exact: true }).click()
  expect(Number(await timeSlider(page).inputValue())).toBeGreaterThan(120)
  await expect(cell(page, 'O2')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('group', { name: 'Grafikte gösterilen deney koşulu', exact: true })
    .getByRole('button', { name: 'C Zaman sabiti değişti', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect((await exported(page)).results).toEqual(before.results)
})

test('both datasets support 3D without changing source metadata, anatomical weights or numerical outputs', async ({ page }, testInfo) => {
  const source = await page.request.get('/api/local-connectome')
  expect(source.ok()).toBe(true)
  const data = await source.json() as RealConnectome
  await page.goto('/')
  await enterThreeD(page, 8)
  await mode(page).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true }).click()
  await expect(threeD(page)).toHaveAttribute('aria-selected', 'true')
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'ready')
  await expect(renderer(page)).toHaveAttribute('data-node-count', String(data.neurons.length))
  await expect(cells(page).getByRole('button')).toHaveCount(data.neurons.length)
  await expect(page.locator('#stimulus-target')).toHaveValue('AVER')
  await expect(page.getByRole('combobox', { name: 'İzlenen çıktı hücresi', exact: true })).toHaveValue('AVAR')
  await expect(page.getByRole('region', { name: 'Gerçek veri kaynağı ve sınırları', exact: true })).toBeVisible()
  await expect(page.getByTestId('real-assumptions')).toContainText('sinaps adedi veya sinaptik güç değildir')
  await recordWebGL(page, testInfo)
  const before = await exported(page, 'circuitiary-cook2019-local-experiment.json')
  const focus = page.getByRole('checkbox', { name: 'Yalnız seçili hücrenin bağlantıları', exact: true })
  await focus.uncheck()
  await expect(renderer(page)).toHaveAttribute('data-visible-edge-count', String(data.chemicalEdges.length + data.gapEdges.length))
  await cell(page, 'AVAR').focus()
  await page.keyboard.press('Enter')
  await expect(node(page, 'AVAR')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.node-description')).toContainText('Deney rolü: okunan hücre')
  const after = await exported(page, 'circuitiary-cook2019-local-experiment.json')
  expect(after.anatomy).toEqual(data)
  expect(after.circuit).toEqual(before.circuit)
  expect(after.results).toEqual(before.results)
  await twoD(page).click()
  await expect(page.locator('.circuit-canvas canvas').first()).toBeVisible()
  expect((await exported(page, 'circuitiary-cook2019-local-experiment.json')).results).toEqual(before.results)
  await threeD(page).click()
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'ready')
  await mode(page).getByRole('button', { name: 'Sekiz hücreli örnek', exact: true }).click()
  await expect(renderer(page)).toHaveAttribute('data-node-count', '8')
  await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('3d-dataset-surface.png'), fullPage: true })
})

test('mobile touch rotation and pinch zoom control the real camera without scrolling the page', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Touch gestures are exercised in the mobile Chromium device project')
  await page.goto('/')
  await enterThreeD(page, 8)
  await recordWebGL(page, testInfo)
  const session = await page.context().newCDPSession(page)
  await canvas(page).scrollIntoViewIfNeeded()
  const box = await canvas(page).boundingBox()
  expect(box).not.toBeNull()
  const beforeCamera = await renderer(page).getAttribute('data-camera-position')
  const scrollY = await page.evaluate(() => window.scrollY)
  const selectedId = await cells(page).getByRole('button', { pressed: true }).locator('span').textContent()
  expect(selectedId).not.toBeNull()
  await withoutLabelInterception(page, async () => {
    const x = box!.x + box!.width * .65
    const y = box!.y + Math.min(box!.height * .35, 180)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
    for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x - step * 9, y: y + step * 4, id: 1 }],
    })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  })
  await expect.poll(() => renderer(page).getAttribute('data-camera-position')).not.toBe(beforeCamera)
  await expect(cell(page, selectedId!)).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY)
  const distance = await cameraDistance(page)
  await withoutLabelInterception(page, async () => {
    const x = box!.x + box!.width * .5
    const y = box!.y + Math.min(box!.height * .4, 200)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 28, y, id: 1 }, { x: x + 28, y, id: 2 }] })
    for (let step = 1; step <= 6; step++) await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x - 28 - step * 7, y, id: 1 }, { x: x + 28 + step * 7, y, id: 2 }],
    })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  })
  await expect.poll(() => cameraDistance(page)).not.toBeCloseTo(distance, 4)
  await expect(cell(page, selectedId!)).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await session.detach()
})

test('repeated view cycles dispose actual WebGL contexts, canvas listeners and renderer frames', async ({ page }) => {
  await page.addInitScript(() => {
    const metrics: LifetimeMetrics = { created: [], disposed: [], pendingRaf: new Set(), listeners: new Map(), ownedCanvases: [], ownedContexts: [] }
    ;(window as unknown as { __circuitiary3DLifetime: LifetimeMetrics }).__circuitiary3DLifetime = metrics
    const add = EventTarget.prototype.addEventListener
    const remove = EventTarget.prototype.removeEventListener
    const key = (type: string, options?: boolean | AddEventListenerOptions) => `${type}:${typeof options === 'boolean' ? options : Boolean(options?.capture)}`
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (listener && (this instanceof HTMLCanvasElement || this === window || this === document)) {
        const entries = metrics.listeners.get(this) ?? new Map<string, Set<EventListenerOrEventListenerObject>>()
        const listeners = entries.get(key(type, options)) ?? new Set<EventListenerOrEventListenerObject>()
        listeners.add(listener); entries.set(key(type, options), listeners); metrics.listeners.set(this, entries)
      }
      return add.call(this, type, listener, options)
    }
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      if (listener) metrics.listeners.get(this)?.get(key(type, options))?.delete(listener)
      return remove.call(this, type, listener, options)
    }
    const raf = window.requestAnimationFrame.bind(window)
    const cancel = window.cancelAnimationFrame.bind(window)
    window.requestAnimationFrame = callback => {
      const id = raf(time => { metrics.pendingRaf.delete(id); callback(time) })
      metrics.pendingRaf.add(id)
      return id
    }
    window.cancelAnimationFrame = id => { metrics.pendingRaf.delete(id); cancel(id) }
    window.addEventListener('circuitiary:3d-created', event => metrics.created.push(String((event as CustomEvent).detail.instanceId)))
    window.addEventListener('circuitiary:3d-disposed', event => metrics.disposed.push(String((event as CustomEvent).detail.instanceId)))
  })
  await page.goto('/')
  await expect(page.locator('.circuit-canvas canvas').first()).toBeVisible()
  // Locator.evaluate initializes Playwright's main-world InjectedScript and
  // its 13 global hit-target/removal-check listeners. Initialize that harness
  // on the existing 2D canvas before the first 3D import or renderer exists,
  // so every 3D-owned listener remains inside the unchanged baseline bound.
  expect(await page.locator('.circuit-canvas canvas').first().evaluate(element => element.tagName)).toBe('CANVAS')
  await settleFrames(page)
  const baselineCanvasCount = await page.locator('.circuit-canvas canvas').count()
  const baseline = await page.evaluate(() => {
    const metrics = (window as unknown as { __circuitiary3DLifetime: LifetimeMetrics }).__circuitiary3DLifetime
    return { pendingRaf: metrics.pendingRaf.size, globalListeners: [...metrics.listeners.entries()].filter(([target]) => target === window || target === document).reduce((total, [, entries]) => total + [...entries.values()].reduce((sum, values) => sum + values.size, 0), 0) }
  })
  for (let cycle = 0; cycle < 4; cycle++) {
    await enterThreeD(page, 8)
    await canvas(page).evaluate(element => {
      const metrics = (window as unknown as { __circuitiary3DLifetime: LifetimeMetrics }).__circuitiary3DLifetime
      metrics.ownedCanvases.push(element as HTMLCanvasElement)
      const context = (element as HTMLCanvasElement).getContext('webgl2')
      if (!context) throw new Error('A real WebGL2 context is required for lifetime checks')
      metrics.ownedContexts.push(context)
    })
    await twoD(page).click()
    await expect(canvas(page)).toHaveCount(0)
    await expect(page.locator('.circuit-canvas canvas')).toHaveCount(baselineCanvasCount)
    await settleFrames(page)
    const cycleGlobalListeners = await page.evaluate(() => {
      const metrics = (window as unknown as { __circuitiary3DLifetime: LifetimeMetrics }).__circuitiary3DLifetime
      return [...metrics.listeners.entries()]
        .filter(([target]) => target === window || target === document)
        .reduce((total, [, entries]) => total + [...entries.values()].reduce((sum, values) => sum + values.size, 0), 0)
    })
    expect(cycleGlobalListeners, `global listeners after cycle ${cycle + 1}`).toBeLessThanOrEqual(baseline.globalListeners)
  }
  const result = await page.evaluate(() => {
    const metrics = (window as unknown as { __circuitiary3DLifetime: LifetimeMetrics }).__circuitiary3DLifetime
    return {
      created: metrics.created, disposed: metrics.disposed, pendingRaf: metrics.pendingRaf.size,
      contextLost: metrics.ownedContexts.map(context => context.isContextLost()),
      connected: metrics.ownedCanvases.map(element => element.isConnected),
      canvasListenerCounts: metrics.ownedCanvases.map(element => [...(metrics.listeners.get(element)?.values() ?? [])].reduce((count, values) => count + values.size, 0)),
      globalListeners: [...metrics.listeners.entries()].filter(([target]) => target === window || target === document).reduce((total, [, entries]) => total + [...entries.values()].reduce((sum, values) => sum + values.size, 0), 0),
    }
  })
  expect(result.created).toHaveLength(4)
  expect(new Set(result.created).size).toBe(4)
  expect([...result.disposed].sort()).toEqual([...result.created].sort())
  expect(result.contextLost).toEqual([true, true, true, true])
  expect(result.connected).toEqual([false, false, false, false])
  expect(result.canvasListenerCounts).toEqual([0, 0, 0, 0])
  expect(result.pendingRaf).toBeLessThanOrEqual(baseline.pendingRaf + 1)
  expect(result.globalListeners).toBeLessThanOrEqual(baseline.globalListeners)
})

test('unavailable WebGL has an explicit fallback and returning to 2D preserves all experiment functions', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
      if (/^(webgl2?|experimental-webgl)$/i.test(contextId)) return null
      return original.apply(this, [contextId, ...args] as Parameters<typeof original>)
    } as typeof original
  })
  await page.goto('/')
  const before = await exported(page)
  await threeD(page).click()
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'unavailable')
  await expect(renderer(page).getByRole('status')).toContainText('3D görünüm kullanılamıyor')
  await renderer(page).getByRole('button', { name: /2D/ }).click()
  await expect(twoD(page)).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.circuit-canvas canvas').first()).toBeVisible()
  expect((await exported(page)).results).toEqual(before.results)
  await page.locator('#amplitude').fill('0')
  await expect(page.getByTestId('peak-baseline')).toHaveText('0,000')
  await page.getByRole('button', { name: /Sıfırla/ }).click()
  await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
  await cell(page, 'O1').focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.node-description')).toContainText('O1 / Çıktı hücresi')
})

test('a real WEBGL_lose_context event shows a loss fallback and 2D restores the unchanged experiment', async ({ page }, testInfo) => {
  await page.goto('/')
  await enterThreeD(page, 8)
  await recordWebGL(page, testInfo)
  const before = await exported(page)
  const extensionAvailable = await canvas(page).evaluate(element => {
    const gl = (element as HTMLCanvasElement).getContext('webgl2')
    const extension = gl?.getExtension('WEBGL_lose_context')
    if (!extension) return false
    extension.loseContext()
    return true
  })
  expect(extensionAvailable, 'Context-loss proof requires the actual browser extension, never a synthetic success event').toBe(true)
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'context-lost')
  await expect(renderer(page).getByRole('status')).toContainText('3D görünüm kesildi')
  await renderer(page).getByRole('button', { name: /2D/ }).click()
  await expect(twoD(page)).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.circuit-canvas canvas').first()).toBeVisible()
  expect((await exported(page)).results).toEqual(before.results)
  await timeSlider(page).fill('400')
  await expect(page.locator('.timeline output')).toContainText('400')
  await page.getByRole('button', { name: 'Etkinliği oynat', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Oynatmayı duraklat', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Oynatmayı duraklat', exact: true }).click()
})
