import { expect, test as base, type Page } from '@playwright/test'
import { execFile } from 'node:child_process'
import { copyFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { main, navLabels, navLink, navigation } from './support/ui'

/*
 * The GitHub Pages build (docs/pages-demo.md): base /Circuitiary/, demo mode, served by a small
 * static server that behaves like Pages. The page is built into a scratch directory (never dist/);
 * 404.html is a copy of index.html, as in .github/workflows/pages.yml. The server serves nothing
 * outside /Circuitiary/, answers every unknown path with 404.html and status 404, and keeps a log
 * of what reached it, so a request that escapes the base shows up twice (browser and server side).
 *
 * Run with `npm run test:pages`. The tests register only when CIRCUITIARY_PAGES is set (the config
 * sets it), so the default `npm run test:browser` finds this file and runs nothing from it.
 */
const BASE = '/Circuitiary/'
const root = fileURLToPath(new URL('..', import.meta.url))
const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
}
// The sentence the brief asks for, written out here on purpose: the page's own constant is not the oracle.
const DEMO_NOTICE = 'Bu çevrimiçi demoda gerçek veri yoktur: veri kümesinin dağıtım lisansı doğrulanmadığı için depoya konmaz. Yerel kurulumda kendi indirdiğin dosyalarla çalışır (README).'

const pages = [
  { label: navLabels.experiments, path: '', title: 'Circuitiary · Devre deneyleri' },
  { label: navLabels.neuron, path: 'ogren/norondan-devreye', title: 'Nörondan devreye · Circuitiary' },
  { label: navLabels.guided, path: 'ogren/rehberli-deneyler', title: 'Rehberli deneyler · Circuitiary' },
  { label: navLabels.reading, path: 'ogren/devreyi-okumak', title: 'Devreyi okumak · Circuitiary' },
  { label: navLabels.assumptions, path: 'ogren/gercek-veri-ve-varsayimlar', title: 'Gerçek veri ve varsayımlar · Circuitiary' },
  { label: navLabels.atlas, path: 'ogren/turler-atlasi', title: 'Türler atlası · Circuitiary' },
  { label: navLabels.builder, path: 'ogren/devre-kur', title: 'Devre kur · Circuitiary' },
  { label: navLabels.glossary, path: 'ogren/sozluk', title: 'Sözlük · Circuitiary' },
] as const

interface Site { origin: string; outDir: string; server: http.Server; hits: string[] }
let site: Site
const at = (path = '') => `${site.origin}${BASE}${path}`

async function serve(outDir: string): Promise<Site> {
  const hits: string[] = []
  const notFound = await readFile(join(outDir, '404.html'))
  const server = http.createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]!)
    hits.push(path)
    const send = (status: number, type: string, body: Buffer | string, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'max-age=0', ...headers })
      res.end(body)
    }
    // Pages redirects /Circuitiary to /Circuitiary/ and has no site at all outside it.
    if (path === BASE.slice(0, -1)) { send(301, 'text/plain', '', { location: BASE }); return }
    if (!path.startsWith(BASE)) { send(404, 'text/plain', 'There isn\'t a GitHub Pages site here.'); return }
    const relative = path.slice(BASE.length)
    const file = resolve(outDir, relative.endsWith('/') || relative === '' ? `${relative}index.html` : relative)
    try {
      if (!file.startsWith(outDir + sep) || !(await stat(file)).isFile()) throw new Error('no such file')
      send(200, mimeTypes[extname(file)] ?? 'application/octet-stream', await readFile(file))
    } catch { send(404, mimeTypes['.html']!, notFound) }
  })
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, outDir, server, hits }
}

// Every test also fails on a request outside the base, a request for the local data endpoint,
// and a console error or uncaught exception on its page.
const test = base.extend<{ guard: undefined }>({
  guard: [async ({ context, page }, use) => {
    const requests: string[] = []
    const problems: string[] = []
    const hitsBefore = site.hits.length
    // A page that Pages answers with 404.html (status 404) makes Chrome log the failed load itself. That one line is expected.
    const expectedMissing = new Set<string>()
    context.on('request', request => requests.push(request.url()))
    page.on('response', response => { if (response.status() === 404 && response.request().isNavigationRequest()) expectedMissing.add(response.url()) })
    page.on('console', message => {
      if (message.type() === 'error' && !(message.text().includes('status of 404') && expectedMissing.has(message.location().url.split('#')[0]!)))
        problems.push(`console: ${message.text()} (${message.location().url})`)
    })
    page.on('pageerror', error => problems.push(`exception: ${error.message}`))
    await use(undefined)
    const escaped = requests.filter(url => /^https?:/.test(url) && !url.startsWith(`${site.origin}${BASE}`) && url !== `${site.origin}${BASE.slice(0, -1)}`)
    expect(escaped, 'browser requests outside the base').toEqual([])
    expect(site.hits.slice(hitsBefore).filter(path => !path.startsWith(BASE) && path !== BASE.slice(0, -1)), 'server hits outside the base').toEqual([])
    expect([...requests, ...site.hits.slice(hitsBefore)].filter(url => url.includes('/api/')), 'local data endpoint requests').toEqual([])
    expect(problems).toEqual([])
  }, { auto: true }],
})
test.use({ serviceWorkers: 'allow' })

if (process.env.CIRCUITIARY_PAGES) {
  test.beforeAll(async () => {
    test.setTimeout(180_000)
    const outDir = await mkdtemp(join(tmpdir(), 'circuitiary-pages-'))
    await promisify(execFile)(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir, '--emptyOutDir'], {
      cwd: root, env: { ...process.env, CIRCUITIARY_BASE: BASE, VITE_DEMO: '1' }, maxBuffer: 16 * 1024 * 1024,
    })
    // The workflow's own step: Pages serves 404.html for unknown paths.
    await copyFile(join(outDir, 'index.html'), join(outDir, '404.html'))
    site = await serve(outDir)
  })
  test.afterAll(async () => {
    await new Promise<void>(done => { site.server.close(() => done()); site.server.closeAllConnections() })
    await rm(site.outDir, { recursive: true, force: true })
  })

  const noticeFor = (page: Page) => page.getByRole('status').filter({ hasText: 'adresinde bir sayfa yok' })
  const heading = (page: Page) => main(page).getByRole('heading', { level: 1 })
  const hrefsOutsideBase = (page: Page) => page.locator('a[href^="/"]').evaluateAll((links, base) =>
    links.map(link => link.getAttribute('href') ?? '').filter(href => !href.startsWith(base)), BASE)

  test('the build carries the base and the server behaves like Pages', async ({ request }) => {
    const html = await (await request.get(at())).text()
    expect(html).toContain(`href="${BASE}manifest.webmanifest"`)
    expect(html).toContain(`href="${BASE}favicon.svg"`)
    expect(html).toContain(`src="${BASE}assets/`)
    expect(html).not.toMatch(/(?:href|src)="\/(?!Circuitiary\/)/)
    expect(await (await request.get(at('404.html'))).text()).toBe(html)

    const manifest = await (await request.get(at('manifest.webmanifest'))).json() as { start_url: string; scope: string; id: string; icons: Array<{ src: string }> }
    expect([manifest.start_url, manifest.scope, manifest.id]).toEqual([BASE, BASE, BASE])
    expect(manifest.icons.map(icon => icon.src)).toEqual([`${BASE}icon.svg`])

    const worker = await (await request.get(at('sw.js'))).text()
    const list = JSON.parse(/const PRECACHE = (\[.*\])/.exec(worker)![1]!.replace(/'/g, '"')) as string[]
    expect(list.length).toBeGreaterThan(20)
    expect(list.filter(path => !path.startsWith(BASE))).toEqual([])
    expect(list).toContain(`${BASE}index.html`)
    expect(list).toContain(`${BASE}manifest.webmanifest`)
    expect(list).not.toContain(`${BASE}sw.js`)
    expect(worker).not.toContain('__PRECACHE__')

    // Nothing at the root, nothing for the data endpoint, status 404 with the page for unknown paths.
    const hitsBefore = site.hits.length
    expect((await request.get(`${site.origin}/`)).status()).toBe(404)
    expect((await request.get(`${site.origin}/sw.js`)).status()).toBe(404)
    expect((await request.get(`${site.origin}/api/local-connectome`)).status()).toBe(404)
    const unknown = await request.get(at('ogren/yok'))
    expect(unknown.status()).toBe(404)
    expect(await unknown.text()).toBe(html)
    site.hits.length = hitsBefore
  })

  test('the home page and every navigation link work under the base, without reloading', async ({ page }) => {
    await page.goto(`${site.origin}${BASE.slice(0, -1)}`)
    await expect(page).toHaveURL(at())
    await expect(page).toHaveTitle(pages[0].title)
    await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
    await page.evaluate(() => { (window as unknown as { __kept: boolean }).__kept = true })

    const hrefs = await navigation(page).getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')))
    expect(hrefs).toEqual(pages.map(entry => `${BASE}${entry.path}`))
    for (const entry of [...pages.slice(1), pages[0]]) {
      await navLink(page, entry.label).click()
      await expect(page).toHaveURL(at(entry.path))
      await expect(page).toHaveTitle(entry.title)
      await expect(navLink(page, entry.label)).toHaveAttribute('aria-current', 'page')
      await expect(heading(page)).toBeVisible()
      await expect(noticeFor(page)).toHaveCount(0)
      expect(await hrefsOutsideBase(page), `${entry.path || 'home'}: links outside the base`).toEqual([])
    }
    // The shell stayed alive: every step was a client-side route, not a page load.
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true)
    await expect(page.getByRole('alert').filter({ hasText: 'yüklenemedi' })).toHaveCount(0)
  })

  test('in-page links to other lessons and back to the experiment keep the base', async ({ page }) => {
    await page.goto(at('ogren/rehberli-deneyler'))
    await page.getByRole('link', { name: /^Önce nörondan devreye dersini oku/ }).click()
    await expect(page).toHaveURL(at('ogren/norondan-devreye'))
    await page.getByRole('link', { name: /^Devre deneyine geç/ }).click()
    await expect(page).toHaveURL(at())
    await expect(page).toHaveTitle(pages[0].title)
  })

  test('a direct visit to a deep link renders through the 404.html fallback', async ({ page }) => {
    for (const entry of pages.slice(1)) {
      for (const path of [entry.path, `${entry.path}/`]) {
        const response = await page.goto(at(path))
        expect(response?.status(), `${path}: Pages answers unknown paths with 404.html`).toBe(404)
        await expect(page).toHaveTitle(entry.title)
        await expect(navLink(page, entry.label)).toHaveAttribute('aria-current', 'page')
        await expect(heading(page)).toBeVisible()
        await expect(noticeFor(page)).toHaveCount(0)
      }
    }
    // A fragment on a deep link still lands on its section.
    await page.goto(at('ogren/sozluk#term-neuron'))
    await expect(page).toHaveTitle('Sözlük · Circuitiary')
  })

  test('back, forward and the share link keep the base', async ({ page, context }) => {
    await page.goto(at())
    await navLink(page, navLabels.neuron).click()
    await navLink(page, navLabels.glossary).click()
    await expect(page).toHaveURL(at('ogren/sozluk'))
    await page.goBack()
    await expect(page).toHaveURL(at('ogren/norondan-devreye'))
    await expect(page).toHaveTitle('Nörondan devreye · Circuitiary')
    await page.goBack()
    await expect(page).toHaveURL(at())
    await expect(page).toHaveTitle(pages[0].title)
    await page.goForward()
    await page.goForward()
    await expect(page).toHaveURL(at('ogren/sozluk'))
    await expect(page).toHaveTitle('Sözlük · Circuitiary')

    await navLink(page, navLabels.experiments).click()
    await page.locator('#amplitude').fill('0.45')
    const link = await page.getByTestId('share-url').inputValue()
    expect(link.startsWith(`${at()}?`), link).toBe(true)
    const second = await context.newPage()
    await second.goto(link)
    await expect(second.locator('#amplitude')).toHaveValue('0.45')
    await expect(second.getByTestId('share-notice')).toHaveText('Bağlantıdaki ayarlar uygulandı.')
    await expect(second).toHaveTitle(pages[0].title)
  })

  test('a share link that asks for real data falls back to the example, without asking for the endpoint', async ({ page }) => {
    await page.goto(`${at()}?m=real&am=0.45`)
    await expect(page.getByTestId('share-notice')).toContainText('yerel veri bu bilgisayarda yok')
    await expect(page.getByRole('group', { name: 'Devre modu', exact: true }).getByRole('button', { name: 'Sekiz hücreli örnek', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#amplitude')).toHaveValue('0.45')
  })

  test('the unknown-address notice names the path without the base', async ({ page }) => {
    const notice = noticeFor(page)
    const response = await page.goto(at('yanlis/adres?x=1'))
    expect(response?.status()).toBe(404)
    await expect(notice).toContainText('“/yanlis/adres” adresinde bir sayfa yok')
    await expect(notice).not.toContainText('Circuitiary')
    await expect(page).toHaveTitle('Sayfa bulunamadı · Circuitiary')
    await expect(notice.getByRole('link', { name: 'Devre deneyleri sayfasına git' })).toHaveAttribute('href', BASE)
    await navLink(page, navLabels.glossary).click()
    await expect(notice).toHaveCount(0)
    await page.goBack()
    await expect(notice).toContainText('“/yanlis/adres”')
    await notice.getByRole('link', { name: 'Devre deneyleri sayfasına git' }).click()
    await expect(page).toHaveURL(at())
    await expect(notice).toHaveCount(0)
    await expect(page).toHaveTitle(pages[0].title)
    // The same address outside the base is not the app's business either: it is shown whole.
    await page.goto(at('ogren/sozluk/alt'))
    await expect(notice).toContainText('“/ogren/sozluk/alt”')
  })

  test('the demo says there is no real data where the local-data pages would say it is missing', async ({ page }) => {
    for (const [path, status] of [['ogren/devreyi-okumak', 'reading-load-status'], ['ogren/gercek-veri-ve-varsayimlar', 'assumptions-load-status']] as const) {
      await page.goto(at(path))
      const line = page.getByTestId(status)
      await expect(line).toContainText(DEMO_NOTICE)
      await expect(line).toHaveAttribute('data-state', 'missing')
      await expect(line.getByRole('button')).toHaveCount(0)
      await expect(page.getByRole('alert')).toHaveCount(0)
    }
    await page.goto(at())
    const mode = page.getByRole('group', { name: 'Devre modu', exact: true })
    await mode.getByRole('button', { name: 'C. elegans · gerçek veri', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText(DEMO_NOTICE)
    await expect(mode.getByRole('button', { name: 'Sekiz hücreli örnek', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('peak-baseline')).toHaveText('0,663')
  })

  test('the service worker takes the base as its scope and an offline reload of a visited page works', async ({ page, context }) => {
    await page.goto(at())
    const registration = await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready
      return { scope: ready.scope, script: ready.active?.scriptURL }
    })
    expect(registration).toEqual({ scope: at(), script: at('sw.js') })
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state ?? 'none')).toBe('activated')

    // Online, a deep link still arrives as Pages' 404.html; the worker passes that through.
    await page.goto(at('ogren/sozluk'))
    await expect(page).toHaveTitle('Sözlük · Circuitiary')
    const cached = await page.evaluate(async () => {
      const paths: string[] = []
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname)
      return paths
    })
    expect(cached.length).toBeGreaterThan(20)
    expect(cached.filter(path => !path.startsWith(BASE))).toEqual([])

    await context.setOffline(true)
    await page.reload()
    await expect(page).toHaveTitle('Sözlük · Circuitiary')
    await expect(heading(page)).toBeVisible()
    // A lesson never opened online comes from the precache, through the cached shell.
    await page.goto(at('ogren/turler-atlasi'))
    await expect(page).toHaveTitle('Türler atlası · Circuitiary')
    await navLink(page, navLabels.builder).click()
    await expect(page).toHaveTitle('Devre kur · Circuitiary')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await context.setOffline(false)
  })
}
