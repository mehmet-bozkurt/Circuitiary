import { expect, test, type Page } from '@playwright/test'
import { experimentLink, navLabels, navLink, settleFrames, viewLabels } from './support/ui'

// 2D and 3D graph resilience: kept views across resizes and hidden page regions,
// load/context failures with an in-place retry, hidden initialisation and named controls.

const tabs = (page: Page) => page.getByRole('tablist', { name: 'Devre görünümü', exact: true })
const threeD = (page: Page) => tabs(page).getByRole('tab', { name: viewLabels['3D'], exact: true })
const renderer = (page: Page) => page.locator('.circuit-3d')
const canvas3D = (page: Page) => page.locator('canvas.circuit-3d-canvas')
const lessonLink = (page: Page) => navLink(page, navLabels.neuron)
const realMode = (page: Page) => page.getByRole('group', { name: 'Devre modu', exact: true }).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true })
const retry3D = (page: Page) => renderer(page).getByRole('button', { name: '3D görünümü yeniden dene', exact: true })

const cytoscapeChunk = /\/node_modules\/\.vite\/deps\/cytoscape\.js(\?|$)/
const threeChunk = /\/node_modules\/\.vite\/deps\/three\.js(\?|$)/

async function waitFor3D(page: Page): Promise<void> {
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'ready', { timeout: 15_000 })
  await expect.poll(async () => Number(await renderer(page).getAttribute('data-render-count'))).toBeGreaterThan(0)
  await settleFrames(page)
}

async function enterThreeD(page: Page): Promise<void> {
  await threeD(page).click()
  await waitFor3D(page)
}

const renderCount = async (page: Page) => Number(await renderer(page).getAttribute('data-render-count'))

/** The render count once frames have stopped arriving (the first resize observation can still redraw after 'ready'). */
async function stableRenderCount(page: Page): Promise<number> {
  let previous = -1
  for (let attempt = 0; attempt < 20; attempt++) {
    const current = await renderCount(page)
    if (current === previous) return current
    previous = current
    await page.waitForTimeout(150)
  }
  throw new Error('3D rendering never settled')
}

async function cameraPose(page: Page): Promise<{ position: number[]; target: number[] }> {
  const read = async (name: string) => (await renderer(page).getAttribute(name))!.split(',').map(Number)
  return { position: await read('data-camera-position'), target: await read('data-camera-target') }
}

/** Runs an action and waits for the frame it causes, so a refit that the action would trigger has had its chance. */
async function renderedAfter(page: Page, action: () => Promise<void>): Promise<void> {
  const before = await renderCount(page)
  await action()
  await expect.poll(() => renderCount(page)).toBeGreaterThan(before)
  await settleFrames(page)
}

/** The Cytoscape instance registers itself on its container; its pan and zoom are the real view state. */
async function graphView(page: Page): Promise<{ zoom: number; x: number; y: number }> {
  return page.locator('#graph-panel-2d .circuit-canvas').evaluate(element => {
    const cy = (element as unknown as { _cyreg: { cy: { zoom(): number; pan(): { x: number; y: number } } } })._cyreg.cy
    return { zoom: cy.zoom(), x: cy.pan().x, y: cy.pan().y }
  })
}

/** Whether the graph's cell centres all lie inside its container and spread across it: a fitted view, not a collapsed or stale one. */
async function graphIsFitted(page: Page): Promise<boolean> {
  return page.locator('#graph-panel-2d .circuit-canvas').evaluate(element => {
    const cy = (element as unknown as { _cyreg?: { cy: { nodes(): { toArray(): Array<{ renderedPosition(): { x: number; y: number } }> } } } })._cyreg?.cy
    const width = element.clientWidth
    const height = element.clientHeight
    if (!cy || width === 0 || height === 0) return false
    const points = cy.nodes().toArray().map(node => node.renderedPosition())
    if (points.length === 0) return false
    const xs = points.map(point => point.x)
    const ys = points.map(point => point.y)
    const inside = Math.min(...xs) >= 0 && Math.max(...xs) <= width && Math.min(...ys) >= 0 && Math.max(...ys) <= height
    const spread = Math.max((Math.max(...xs) - Math.min(...xs)) / width, (Math.max(...ys) - Math.min(...ys)) / height)
    return inside && spread > 0.4
  })
}

async function openRealTwoD(page: Page): Promise<void> {
  await page.goto('/')
  await realMode(page).click()
  await expect(page.getByRole('button', { name: 'Tüm hücreleri sığdır', exact: true })).toBeEnabled({ timeout: 15_000 })
  await settleFrames(page)
}

async function leaveAndReturn(page: Page): Promise<void> {
  await lessonLink(page).click()
  await expect(page.locator('#amplitude')).not.toBeVisible()
  // Let the hidden region's layout change reach every observer before returning.
  await settleFrames(page)
  await experimentLink(page).click()
  await expect(page.locator('#amplitude')).toBeVisible()
  await settleFrames(page)
}

test('a failed 2D chunk load shows a visible error and its retry builds the graph', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  let failures = 1
  await page.route(cytoscapeChunk, route => failures-- > 0 ? route.abort('failed') : route.continue())
  await page.goto('/')
  const alert = page.getByRole('alert').filter({ hasText: '2D bağlantı haritası yüklenemedi' })
  await expect(alert).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.circuit-canvas canvas')).toHaveCount(0)
  // No empty graph box is left under the message.
  await expect(page.locator('#graph-panel-2d .circuit-canvas')).toBeHidden()
  await alert.getByRole('button', { name: 'Yeniden dene', exact: true }).click()
  await expect(page.locator('.circuit-canvas canvas').first()).toBeVisible({ timeout: 15_000 })
  await expect(alert).toHaveCount(0)
  expect(errors).toEqual([])
})

test('2D keeps the user zoom and pan across hiding the page and window resizes, and refits only an untouched view', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Window resizing is exercised in the desktop project')
  await openRealTwoD(page)
  const fitted = await graphView(page)
  const zoomIn = page.getByRole('button', { name: 'Grafiği yakınlaştır', exact: true })
  await zoomIn.click()
  await zoomIn.click()
  await expect.poll(async () => (await graphView(page)).zoom).toBeGreaterThan(fitted.zoom * 1.4)
  const zoomed = await graphView(page)
  await leaveAndReturn(page)
  expect(await graphView(page)).toEqual(zoomed)
  await page.setViewportSize({ width: 1100, height: 1050 })
  await settleFrames(page)
  await page.waitForTimeout(250)
  expect(await graphView(page)).toEqual(zoomed)
  // A view the user never changed still follows the container, so the graph keeps filling it.
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.getByRole('button', { name: 'Tüm hücreleri sığdır', exact: true }).click()
  await settleFrames(page)
  const refit = await graphView(page)
  await page.setViewportSize({ width: 1200, height: 1050 })
  await expect.poll(async () => JSON.stringify(await graphView(page))).not.toBe(JSON.stringify(refit))
  const followed = await graphView(page)
  expect(followed.zoom).toBeGreaterThan(0)
  expect(Number.isFinite(followed.x) && Number.isFinite(followed.y)).toBe(true)
})

test('a 2D graph first built inside a hidden container is fitted once it is shown', async ({ page }) => {
  let requested!: () => void
  const chunkRequested = new Promise<void>(resolve => { requested = resolve })
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(cytoscapeChunk, async route => { requested(); await gate; await route.continue() })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  // Hide the region while the chunk is held back, so the graph is created against a 0x0 container.
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.id = 'hide-2d-panel'
    style.textContent = '#graph-panel-2d { display: none !important }'
    document.head.append(style)
  })
  await chunkRequested
  release()
  await expect.poll(() => page.locator('#graph-panel-2d .circuit-canvas').evaluate(element => Boolean((element as unknown as { _cyreg?: unknown })._cyreg)), { timeout: 15_000 }).toBe(true)
  await page.waitForTimeout(300)
  expect(await page.locator('#graph-panel-2d .circuit-canvas').evaluate(element => element.clientWidth)).toBe(0)
  // Built against a 0x0 container, the view is not a fit; showing the container must produce one.
  const hiddenView = await graphView(page)
  await page.evaluate(() => document.getElementById('hide-2d-panel')?.remove())
  await expect.poll(async () => JSON.stringify(await graphView(page))).not.toBe(JSON.stringify(hiddenView))
  await expect.poll(() => graphIsFitted(page)).toBe(true)
})

test('2D refits when a narrow window reflows the real-data grid, even after the user zoomed', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Window resizing is exercised in the desktop project')
  await openRealTwoD(page)
  expect(await graphIsFitted(page)).toBe(true)
  const fitted = await graphView(page)
  const zoomIn = page.getByRole('button', { name: 'Grafiği yakınlaştır', exact: true })
  await zoomIn.click()
  await zoomIn.click()
  await expect.poll(async () => (await graphView(page)).zoom).toBeGreaterThan(fitted.zoom * 1.4)
  // Below 460 px the cells move from six columns to three: the new positions need a new fit.
  await page.setViewportSize({ width: 500, height: 1050 })
  await expect.poll(() => graphIsFitted(page)).toBe(true)
})

test('3D keeps a moved camera across hiding the page and resizes, and refits only an untouched one', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Window resizing is exercised in the desktop project')
  await page.goto('/')
  await enterThreeD(page)
  const initial = await cameraPose(page)
  // Untouched camera: a narrower container changes the aspect, so the circuit is refitted.
  await renderedAfter(page, () => page.setViewportSize({ width: 800, height: 1050 }))
  expect((await cameraPose(page)).position).not.toEqual(initial.position)
  // Moved camera: it keeps its pose through resizes and through hiding the page.
  await canvas3D(page).focus()
  await renderedAfter(page, async () => { await page.keyboard.press('+'); await page.keyboard.press('ArrowLeft') })
  const moved = await cameraPose(page)
  await renderedAfter(page, () => page.setViewportSize({ width: 1440, height: 1050 }))
  expect(await cameraPose(page)).toEqual(moved)
  await renderedAfter(page, () => leaveAndReturn(page))
  expect(await cameraPose(page)).toEqual(moved)
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'ready')
})

test('a hidden page region draws no 3D frames and drawing resumes when it is shown', async ({ page }) => {
  await page.goto('/')
  await enterThreeD(page)
  const drawn = await stableRenderCount(page)
  await lessonLink(page).click()
  await expect(renderer(page)).toBeHidden()
  // A time change while hidden (playback, or here the slider) must not redraw an unseen canvas.
  await page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true, includeHidden: true }).evaluate(element => {
    ;(element as HTMLInputElement).value = '300'
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await settleFrames(page)
  await page.waitForTimeout(500)
  expect(await renderCount(page)).toBe(drawn)
  await experimentLink(page).click()
  await expect(renderer(page)).toBeVisible()
  await expect.poll(() => renderCount(page)).toBeGreaterThan(drawn)
  await expect(page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true })).toHaveValue('300')
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'ready')
  expect(await canvas3D(page).evaluate(element => (element as HTMLCanvasElement).width)).toBeGreaterThan(100)
})

test('a 3D view first built inside a hidden container fits a finite camera once it is shown', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(threeChunk, async route => { await gate; await route.continue() })
  await page.goto('/')
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.id = 'hide-3d-panel'
    style.textContent = '#graph-panel-3d { display: none !important }'
    document.head.append(style)
    ;(document.getElementById('graph-tab-3d') as HTMLButtonElement).click()
  })
  await expect(canvas3D(page)).toHaveCount(1)
  release()
  await expect(renderer(page)).toHaveAttribute('data-node-count', '8', { timeout: 15_000 })
  await page.waitForTimeout(300)
  await page.evaluate(() => document.getElementById('hide-3d-panel')?.remove())
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'ready', { timeout: 15_000 })
  await settleFrames(page)
  const { position, target } = await cameraPose(page)
  expect([...position, ...target].every(Number.isFinite)).toBe(true)
  expect(Math.hypot(...position)).toBeGreaterThan(1)
  const label = renderer(page).locator('.node-label-3d[data-node-id="O1"]')
  await expect(label).toHaveAttribute('data-visible', 'true')
  expect(Number.isFinite(Number(await label.getAttribute('data-projected-x')))).toBe(true)
  // The fit that waited for the container is the ordinary fit: the fit button leaves the pose unchanged.
  const shown = await cameraPose(page)
  await renderedAfter(page, () => renderer(page).getByRole('button', { name: 'Devreyi sığdır', exact: true }).click())
  expect(await cameraPose(page)).toEqual(shown)
})

test('a lost WebGL context offers an in-place retry that builds a new working renderer', async ({ page }) => {
  await page.goto('/')
  await enterThreeD(page)
  const firstInstance = await renderer(page).getAttribute('data-renderer-instance')
  const lost = await canvas3D(page).evaluate(element => {
    const extension = (element as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context')
    if (!extension) return false
    extension.loseContext()
    return true
  })
  expect(lost, 'Context-loss proof requires the actual browser extension').toBe(true)
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'context-lost')
  await expect(canvas3D(page)).toHaveCount(0)
  const drawnBefore = await renderCount(page)
  await retry3D(page).click()
  await waitFor3D(page)
  await expect(canvas3D(page)).toHaveCount(1)
  await expect(renderer(page)).toHaveAttribute('data-node-count', '8')
  expect(await renderer(page).getAttribute('data-renderer-instance')).not.toBe(firstInstance)
  expect(await renderCount(page)).toBeGreaterThan(drawnBefore)
  expect(await canvas3D(page).evaluate(element => (element as HTMLCanvasElement).getContext('webgl2')?.isContextLost())).toBe(false)
  await expect(canvas3D(page)).toBeFocused()
  const { position } = await cameraPose(page)
  expect(position.every(Number.isFinite)).toBe(true)
})

test('a failed 3D chunk load shows the fallback and its retry loads the renderer', async ({ page }) => {
  let failures = 1
  await page.route(threeChunk, route => failures-- > 0 ? route.abort('failed') : route.continue())
  await page.goto('/')
  await threeD(page).click()
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'error', { timeout: 15_000 })
  await expect(renderer(page).getByRole('status')).toContainText('3D görünüm hazırlanamadı')
  await retry3D(page).click()
  await waitFor3D(page)
  await expect(renderer(page)).toHaveAttribute('data-node-count', '8')
})

test('a retry made while the renderer chunks are still loading leaves exactly one renderer', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(threeChunk, async route => { await gate; await route.continue() })
  await page.goto('/')
  await page.evaluate(() => {
    const created: string[] = []
    ;(window as unknown as { created3D: string[] }).created3D = created
    window.addEventListener('circuitiary:3d-created', event => created.push(String((event as CustomEvent).detail.instanceId)))
  })
  const createdCount = () => page.evaluate(() => (window as unknown as { created3D: string[] }).created3D.length)
  await threeD(page).click()
  await expect(canvas3D(page)).toHaveCount(1)
  // The context is lost while the held-back chunks are pending, and the user retries before they arrive.
  await canvas3D(page).evaluate(element => { (element as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext() })
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'context-lost')
  await retry3D(page).click()
  // The retry hands focus to the new canvas in the same task that starts the new load.
  await expect(canvas3D(page)).toBeFocused()
  // Hidden, no frame can mark the first load's renderer ready before the second load settles.
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.id = 'hide-3d-panel'
    style.textContent = '#graph-panel-3d { display: none !important }'
    document.head.append(style)
  })
  release()
  await expect.poll(createdCount, { timeout: 15_000 }).toBeGreaterThan(0)
  await page.waitForTimeout(300)
  expect(await createdCount()).toBe(1)
  await page.evaluate(() => document.getElementById('hide-3d-panel')?.remove())
  await waitFor3D(page)
  expect(await createdCount()).toBe(1)
})

test('unavailable WebGL offers the way back to 2D but no 3D retry', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
      if (/^(webgl2?|experimental-webgl)$/i.test(contextId)) return null
      return original.apply(this, [contextId, ...args] as Parameters<typeof original>)
    } as typeof original
  })
  await page.goto('/')
  await threeD(page).click()
  await expect(renderer(page)).toHaveAttribute('data-renderer-status', 'unavailable')
  await expect(renderer(page).getByRole('button', { name: '2D görünümüne dön', exact: true })).toBeVisible()
  await expect(retry3D(page)).toHaveCount(0)
})

test('graph control clusters are exposed as named groups', async ({ page }) => {
  await page.goto('/')
  await realMode(page).click()
  await expect(page.getByRole('group', { name: 'Grafik yakınlaştırma', exact: true }).getByRole('button')).toHaveCount(3)
  await enterThreeD(page)
  await expect(page.getByRole('group', { name: '3D kamera denetimleri', exact: true }).getByRole('button')).toHaveCount(7)
})
