import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { navLabels, navLink } from './support/ui'

/*
 * Offline use (public/sw.js), checked against the production build. The service
 * worker needs a secure origin of its own per test, so every test serves the real
 * build through a small proxy on a fresh 127.0.0.1 port. The proxy lets a test
 * take the "server" away, answer 503, stall, or change the build id, and it
 * answers /api/local-connectome with synthetic text: no local data is read, and
 * its headers (no-store) leave the service worker as the only cache in play.
 * The dev server never registers a worker, so only the production profile runs this.
 */
test.use({ serviceWorkers: 'allow' })
test.beforeEach(({}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('production'), 'The service worker is registered by production builds only')
})

const API = '/api/local-connectome'
const SYNTHETIC = JSON.stringify({ synthetic: 'offline-spec' })

interface Origin {
  url: string
  /** Every request that reached the proxy, as "GET /path". */
  requests: string[]
  /** online serves the build; down drops connections; unavailable answers pages with 503; stalled never answers pages. */
  mode: 'online' | 'down' | 'unavailable' | 'stalled'
  /** Replaces the build id inside /sw.js, as if a new build were deployed. */
  buildId?: string
  /** A path the proxy answers with 404, as if the new build lacked a file. */
  missing?: string
}

const servers: http.Server[] = []
test.afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections() })
})

async function serveBuild(upstream: string): Promise<Origin> {
  const origin: Origin = { url: '', requests: [], mode: 'online' }
  const server = http.createServer(async (req, res) => {
    const target = req.url ?? '/'
    const path = target.split('?')[0]
    origin.requests.push(`${req.method} ${path}`)
    if (origin.mode === 'down') { req.socket.destroy(); return }
    const isPage = (req.headers.accept ?? '').includes('text/html')
    if (isPage && origin.mode === 'stalled') return
    if (isPage && origin.mode === 'unavailable') { res.writeHead(503, { 'content-type': 'text/html' }); res.end('<h1>503</h1>'); return }
    if (path === API) { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(SYNTHETIC); return }
    if (path === origin.missing) { res.writeHead(404); res.end(); return }
    try {
      const reply = await fetch(new URL(target, upstream))
      let body = Buffer.from(await reply.arrayBuffer())
      if (path === '/sw.js' && origin.buildId) body = Buffer.from(body.toString('utf8').replace(/const BUILD_ID = '[^']*'/, `const BUILD_ID = '${origin.buildId}'`))
      // `vary: Origin` is what `vite preview` sends. Chrome adds an Origin header to the page's own
      // module and stylesheet requests, so a cache lookup that honours Vary would miss every build file.
      res.writeHead(reply.status, { 'content-type': reply.headers.get('content-type') ?? 'application/octet-stream', 'cache-control': 'no-store', vary: 'Origin' })
      res.end(body)
    } catch { res.writeHead(502); res.end() }
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  origin.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return origin
}

/** Waits until a worker is active and has taken control of the open page. */
async function workerInControl(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state ?? 'none')).toBe('activated')
}

const cacheNames = (page: Page) => page.evaluate(async () => (await caches.keys()).sort())
const cachedPaths = (page: Page) => page.evaluate(async () => {
  const paths: string[] = []
  for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname)
  return paths.sort()
})

/** Both the browser and the "server" are gone, so only a worker can answer. */
async function goOffline(context: BrowserContext, origin: Origin): Promise<void> {
  origin.mode = 'down'
  await context.setOffline(true)
}

const experimentHeading = (page: Page) => page.getByRole('heading', { level: 1, name: /Bir uyaranın\s+izini sür/ })
const guidedHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Rehberli deneyler', exact: true })
const atlasHeading = (page: Page) => page.getByRole('heading', { level: 1, name: /Türler\s+atlası/ })

test('after one online visit every page reopens offline, including lazy lessons never opened', async ({ page, context, baseURL }) => {
  const origin = await serveBuild(baseURL!)
  await page.goto(origin.url)
  await expect(experimentHeading(page)).toBeVisible()
  await workerInControl(page)
  await page.goto(`${origin.url}/ogren/rehberli-deneyler`)
  await expect(guidedHeading(page)).toBeVisible()

  await goOffline(context, origin)
  await page.reload()
  await expect(guidedHeading(page)).toBeVisible()
  await expect(page).toHaveTitle('Rehberli deneyler · Circuitiary')
  await page.goto(origin.url)
  await expect(experimentHeading(page)).toBeVisible()
  // The atlas chunk was never fetched online by this page; it comes from the precache.
  await navLink(page, navLabels.atlas).click()
  await expect(atlasHeading(page)).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  // A direct visit to an app path the page never opened also gets the shell.
  await page.goto(`${origin.url}/ogren/gercek-veri-ve-varsayimlar`)
  await expect(page.getByRole('heading', { level: 1, name: /Gerçek veri ve\s+varsayımlar/ })).toBeVisible()
})

test('the shell is network first online and hashed files come from the cache', async ({ page, baseURL }) => {
  const origin = await serveBuild(baseURL!)
  await page.goto(origin.url)
  await workerInControl(page)
  origin.requests.length = 0
  await page.reload()
  await expect(experimentHeading(page)).toBeVisible()
  expect(origin.requests).toContain('GET /')
  expect(origin.requests.filter(request => request.startsWith('GET /assets/'))).toEqual([])
})

test('a server error or a stalled network shows the cached shell instead of an error page', async ({ page, baseURL }) => {
  const origin = await serveBuild(baseURL!)
  await page.goto(origin.url)
  await workerInControl(page)
  origin.mode = 'unavailable'
  await page.reload()
  await expect(experimentHeading(page)).toBeVisible()
  origin.mode = 'stalled'
  await page.reload()
  await expect(experimentHeading(page)).toBeVisible()
})

test('the local data endpoint is never cached or answered by the worker', async ({ page, context, baseURL }) => {
  const origin = await serveBuild(baseURL!)
  await page.goto(origin.url)
  await workerInControl(page)
  const online = await page.evaluate(async () => {
    const response = await fetch('/api/local-connectome', { cache: 'no-store' })
    return { status: response.status, body: await response.text() }
  })
  expect(online).toEqual({ status: 200, body: SYNTHETIC })
  await page.goto(`${origin.url}${API}`)
  await expect(page.locator('body')).toHaveText(SYNTHETIC)
  const paths = await cachedPaths(page)
  expect(paths).toContain('/index.html')
  expect(paths.filter(path => path.startsWith('/api'))).toEqual([])

  await goOffline(context, origin)
  // Offline the request fails like any network request; no cached copy or shell stands in.
  expect(await page.evaluate(() => fetch('/api/local-connectome').then(() => 'answered', (error: Error) => error.name))).toBe('TypeError')
  expect(await page.evaluate(() => caches.match('/api/local-connectome').then(match => match === undefined))).toBe(true)
  // The app shows its normal "not available" state.
  await page.goto(origin.url)
  await expect(experimentHeading(page)).toBeVisible()
  await page.getByRole('group', { name: 'Devre modu', exact: true }).getByRole('button', { name: 'C. elegans · gerçek veri', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Yerel gerçek veri yüklenemedi')
  // Opening the endpoint as a page fails too, rather than showing the cached app shell.
  await expect(page.goto(`${origin.url}${API}`)).rejects.toThrow()
})

test('a missing hashed file that the server answers with the app page is not cached', async ({ page, baseURL }) => {
  const origin = await serveBuild(baseURL!)
  await page.goto(origin.url)
  await workerInControl(page)
  const type = await page.evaluate(async () => (await fetch('/assets/removed-in-a-newer-build-0123.js')).headers.get('content-type'))
  expect(type).toContain('text/html')
  expect(await cachedPaths(page)).not.toContain('/assets/removed-in-a-newer-build-0123.js')
})

test('a new build id replaces the old cache and keeps foreign caches', async ({ page, context, baseURL }) => {
  const origin = await serveBuild(baseURL!)
  origin.buildId = 'aaaaaaaaaaaa'
  await page.goto(origin.url)
  await workerInControl(page)
  expect(await cacheNames(page)).toEqual(['circuitiary-aaaaaaaaaaaa'])
  const precached = await cachedPaths(page)
  expect(precached).toContain('/index.html')
  expect(precached.filter(path => path.startsWith('/assets/')).length).toBeGreaterThan(3)
  await page.evaluate(() => caches.open('unrelated-cache'))

  origin.buildId = 'bbbbbbbbbbbb'
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update() })
  await expect.poll(() => cacheNames(page)).toEqual(['circuitiary-bbbbbbbbbbbb', 'unrelated-cache'])
  expect(await cachedPaths(page)).toEqual(precached)

  await goOffline(context, origin)
  await page.reload()
  await expect(experimentHeading(page)).toBeVisible()
})

test('a build that cannot be fully cached leaves the working cache alone', async ({ page, context, baseURL }) => {
  const origin = await serveBuild(baseURL!)
  origin.buildId = 'aaaaaaaaaaaa'
  await page.goto(origin.url)
  await workerInControl(page)

  origin.buildId = 'cccccccccccc'
  origin.missing = '/favicon.svg'
  origin.requests.length = 0
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update() })
  await expect.poll(() => origin.requests).toContain('GET /favicon.svg')
  await expect.poll(() => cacheNames(page)).toEqual(['circuitiary-aaaaaaaaaaaa'])

  await goOffline(context, origin)
  await page.reload()
  await expect(experimentHeading(page)).toBeVisible()
})

test('the build ships a filled-in worker, a manifest and an icon', async ({ request }) => {
  const worker = await (await request.get('/sw.js')).text()
  expect(worker).not.toContain('__BUILD_ID__')
  expect(worker).not.toContain('__PRECACHE__')
  const list = JSON.parse(/const PRECACHE = (\[.*\])/.exec(worker)?.[1] ?? 'null') as string[]
  expect(list).toContain('/index.html')
  expect(list).toContain('/manifest.webmanifest')
  expect(list.filter(path => /^\/assets\/.+\.js$/.test(path)).length).toBeGreaterThan(3)
  expect(list).not.toContain('/sw.js')
  for (const path of list) expect((await request.get(path)).ok(), path).toBe(true)

  const html = await (await request.get('/')).text()
  expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"')
  const manifest = await (await request.get('/manifest.webmanifest')).json() as Record<string, unknown>
  expect(manifest).toMatchObject({ name: 'Circuitiary', lang: 'tr', start_url: '/', display: 'standalone' })
  expect(html).toContain(`<meta name="theme-color" content="${String(manifest.theme_color)}"`)
  expect(manifest.icons).toEqual([{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }])
  const icon = await request.get('/icon.svg')
  expect(icon.headers()['content-type']).toContain('image/svg+xml')
  expect(await icon.text()).toMatch(/^<svg /)
})
