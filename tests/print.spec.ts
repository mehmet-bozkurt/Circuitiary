import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow, main, navigation } from './support/ui'

test.skip(({ isMobile }) => isMobile, 'Print layout does not depend on the device; the desktop run covers it.')

const routes = [
  '/',
  '/ogren/norondan-devreye',
  '/ogren/rehberli-deneyler',
  '/ogren/devreyi-okumak',
  '/ogren/gercek-veri-ve-varsayimlar',
  '/ogren/turler-atlasi',
  '/ogren/devre-kur',
  '/ogren/sozluk',
]
// CSS pixels of an A4 page at 96 dpi, and the same minus the 14 mm side margins of the @page rule.
const A4_WIDTH = 794
const A4_CONTENT_WIDTH = 688

/** Opens a page in the dark theme at A4 width, so a print rule that only works in the light theme fails. */
async function open(page: Page, route: string): Promise<void> {
  await page.addInitScript(() => { try { localStorage.setItem('circuitiary-theme', 'dark') } catch { /* The theme falls back to the system one. */ } })
  await page.setViewportSize({ width: A4_WIDTH, height: 1123 })
  await page.goto(route)
  await expect(main(page)).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
}

/** Whether any canvas of the locator has a non-transparent pixel. */
const hasPaint = (canvases: Locator) => canvases.evaluateAll(all => all.some(element => {
  const canvas = element as HTMLCanvasElement
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0)
}))

const detailsStates = (page: Page) => page.locator('details').evaluateAll(all => all.map(details => (details as HTMLDetailsElement).open))
const fire = (page: Page, type: 'beforeprint' | 'afterprint') => page.evaluate(name => { window.dispatchEvent(new Event(name)) }, type)

/** WCAG contrast of a CSS colour against white. */
const contrastOnWhite = (page: Page, locator: string) => page.locator(locator).first().evaluate(element => {
  const [red, green, blue] = (getComputedStyle(element).color.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(value => {
    const channel = Number(value) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 1.05 / (0.2126 * red + 0.7152 * green + 0.0722 * blue + 0.05)
})

for (const route of routes) {
  test(`${route} prints light on white without navigation, also from the dark theme`, async ({ page }) => {
    await open(page, route)
    await expect(navigation(page)).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Tema', exact: true })).toBeVisible()
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(18, 29, 25)')

    await page.emulateMedia({ media: 'print' })
    await expect(navigation(page)).toBeHidden()
    await expect(page.getByRole('combobox', { name: 'Tema', exact: true })).toBeHidden()
    await expect(page.locator('.shell-skip-link')).toHaveCSS('display', 'none')
    await expect(main(page)).toBeVisible()
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    expect(await contrastOnWhite(page, 'main h1')).toBeGreaterThanOrEqual(7)
    expect(await contrastOnWhite(page, 'main p')).toBeGreaterThanOrEqual(4.5)

    for (const width of [A4_WIDTH, A4_CONTENT_WIDTH]) {
      await page.setViewportSize({ width, height: 1123 })
      await expectNoHorizontalOverflow(page)
    }
  })
}

test('cards keep their light surface and dark text from the dark theme', async ({ page }) => {
  await open(page, '/')
  await page.emulateMedia({ media: 'print' })
  const panel = page.locator('.control-panel')
  await expect(panel).toHaveCSS('background-color', 'rgb(250, 251, 245)')
  expect(await contrastOnWhite(page, '.control-panel h2')).toBeGreaterThanOrEqual(7)
})

test('the experiment page stacks its two columns on paper and shows the whole data table', async ({ page }) => {
  await open(page, '/')
  const columns = () => page.locator('.experiment-layout').evaluate(layout => getComputedStyle(layout).gridTemplateColumns.split(' ').length)
  expect(await columns()).toBe(2)
  const scroll = page.locator('.chart-table-scroll')
  await page.locator('details').filter({ has: page.locator('.chart-table-scroll') }).evaluate(details => { (details as HTMLDetailsElement).open = true })
  expect(await scroll.evaluate(box => box.scrollHeight > box.clientHeight)).toBe(true)

  await page.emulateMedia({ media: 'print' })
  expect(await columns()).toBe(1)
  expect(await scroll.evaluate(box => box.scrollHeight <= box.clientHeight)).toBe(true)
})

test('buttons that only act are dropped from the printout, state toggles and term words stay', async ({ page }) => {
  await open(page, '/')
  const chrome = [
    page.getByRole('button', { name: 'Etkinliği oynat', exact: true }),
    page.getByRole('button', { name: /^Deney kaydını indir/ }),
    page.getByRole('button', { name: 'Sıfırla ↺', exact: true }),
    page.getByRole('tablist', { name: 'Devre görünümü', exact: true }),
    page.getByRole('slider', { name: 'Simülasyon zamanı', exact: true }),
  ]
  const toggle = page.getByRole('button', { name: 'Sekiz hücreli örnek', exact: true })
  const term = page.locator('.term-trigger').first()
  for (const control of [...chrome, toggle, term]) await expect(control).toBeVisible()

  await page.emulateMedia({ media: 'print' })
  for (const control of chrome) await expect(control).toBeHidden()
  await expect(toggle).toBeVisible()
  await expect(term).toBeVisible()
  await expect(page.locator('.print-snapshot')).toHaveCount(0)
})

test('the 3D view and its camera controls are not printed, and the page says so', async ({ page }) => {
  await open(page, '/')
  await page.getByRole('tab', { name: '3D · şematik uzay', exact: true }).click()
  await expect(page.locator('.circuit-3d')).toHaveAttribute('data-renderer-status', 'ready', { timeout: 15_000 })
  await expect(page.locator('.circuit-3d-canvas')).toBeVisible()
  await expect(page.getByRole('group', { name: '3D kamera denetimleri', exact: true })).toBeVisible()

  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.circuit-3d-canvas')).toBeHidden()
  await expect(page.getByRole('group', { name: '3D kamera denetimleri', exact: true })).toBeHidden()
  expect(await page.locator('#graph-panel-3d').evaluate(panel => getComputedStyle(panel, '::before').content)).toContain('Üç boyutlu şematik görünüm yazdırılmaz')
})

test('beforeprint opens every details and afterprint puts each one back, also when print is cancelled', async ({ page }) => {
  await open(page, '/')
  await page.locator('details.connection-table').evaluate(details => { (details as HTMLDetailsElement).open = true })
  const before = await detailsStates(page)
  expect(before.length).toBeGreaterThanOrEqual(2)
  expect(before).toContain(true)
  expect(before).toContain(false)

  await fire(page, 'beforeprint')
  expect(await detailsStates(page)).toEqual(before.map(() => true))
  // A second beforeprint (nothing restored in between) must not remember the opened state as the original.
  await fire(page, 'beforeprint')
  await fire(page, 'afterprint')
  expect(await detailsStates(page)).toEqual(before)

  // afterprint alone, as after a cancelled dialog, changes nothing.
  await fire(page, 'afterprint')
  expect(await detailsStates(page)).toEqual(before)

  // A real print job goes through the same events.
  await page.evaluate(() => {
    const seen = { opened: 0, total: 0 }
    window.addEventListener('beforeprint', () => { seen.total = document.querySelectorAll('details').length; seen.opened = document.querySelectorAll('details[open]').length })
    Object.assign(window, { printSeen: seen })
  })
  await page.pdf({ format: 'A4' })
  expect(await page.evaluate(() => (window as unknown as { printSeen: { opened: number; total: number } }).printSeen)).toEqual({ opened: before.length, total: before.length })
  expect(await detailsStates(page)).toEqual(before)
})

test('the 2D connection map prints as a scaled copy that is removed afterwards', async ({ page }) => {
  await open(page, '/')
  await expect(page.locator('.circuit-canvas canvas').first()).toBeAttached()
  // The map is drawn into several layered canvases; wait until any of them has paint.
  await expect.poll(() => hasPaint(page.locator('.circuit-canvas canvas'))).toBe(true)

  await fire(page, 'beforeprint')
  await fire(page, 'beforeprint')
  await expect(page.locator('.print-snapshot')).toHaveCount(1)
  await expect(page.locator('.print-snapshot')).toBeHidden()
  await page.emulateMedia({ media: 'print' })
  const snapshot = page.locator('.print-snapshot')
  await expect(snapshot).toBeVisible()
  await expect(page.locator('.circuit-canvas')).toBeHidden()
  const box = await snapshot.boundingBox()
  expect(box!.width).toBeLessThanOrEqual(A4_WIDTH)
  expect(await hasPaint(snapshot)).toBe(true)

  await fire(page, 'afterprint')
  await expect(page.locator('.print-snapshot')).toHaveCount(0)
  await page.emulateMedia({ media: 'screen' })
  await expect(page.locator('.circuit-canvas')).toBeVisible()
})

test('the stylesheet sets A4 page margins and an honest footer line', async ({ page }) => {
  await page.goto('/')
  const pageRules = await page.evaluate(() => [...document.styleSheets].flatMap(sheet => [...sheet.cssRules]).filter(rule => rule instanceof CSSPageRule).map(rule => rule.cssText).join('\n'))
  expect(pageRules).toMatch(/margin: 16mm 14mm 18mm/)
  expect(pageRules).toContain('Circuitiary · eğitim amaçlı model; ölçüm değildir')
})

for (const route of ['/', '/ogren/turler-atlasi', '/ogren/devre-kur', '/ogren/sozluk']) {
  test(`${route} produces a PDF`, async ({ page }) => {
    await open(page, route)
    const pdf = await page.pdf({ format: 'A4' })
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    const pages = (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length
    expect(pages).toBeGreaterThanOrEqual(1)
    // A page whose content were hidden by mistake would print a single blank sheet. The builder and glossary are written by others, so they only need to print.
    if (route === '/' || route === '/ogren/turler-atlasi') expect(pages).toBeGreaterThanOrEqual(2)
  })
}

test('the heading focused by opening a page by link is not framed on paper', async ({ page }) => {
  await open(page, '/ogren/norondan-devreye')
  const outline = () => page.evaluate(() => getComputedStyle(document.activeElement ?? document.body).outlineStyle)
  await expect(page.locator('main h1')).toBeFocused()
  expect(await outline()).toBe('solid')

  await page.emulateMedia({ media: 'print' })
  expect(await outline()).toBe('none')
})

test('the builder prints its curves in the light-theme colours, also from the dark theme', async ({ page }) => {
  await open(page, '/ogren/devre-kur')
  await main(page).getByRole('button', { name: /^Kendini sürdüren döngü/ }).click()
  await main(page).getByTestId('builder-run').click()
  await expect(main(page).getByTestId('builder-result')).toHaveAttribute('data-stale', 'false')
  const traces = main(page).locator('path[data-trace]')
  expect(await traces.count()).toBeGreaterThanOrEqual(2)
  const strokes = () => traces.evaluateAll(all => all.map(path => getComputedStyle(path).stroke))
  // On screen the dark theme draws pale curves; on white they would be close to invisible.
  const screenStrokes = await strokes()
  await page.emulateMedia({ media: 'print' })
  const printStrokes = await strokes()
  expect(printStrokes).not.toEqual(screenStrokes)
  const luminance = (colour: string) => {
    const [red, green, blue] = (colour.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(value => {
      const channel = Number(value) / 255
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }
  // WCAG 1.4.11 asks 3:1 for graphical objects; the white page has luminance 1.
  for (const stroke of printStrokes) expect(1.05 / (luminance(stroke) + 0.05)).toBeGreaterThanOrEqual(3)
})
