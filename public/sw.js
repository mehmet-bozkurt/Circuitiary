// Circuitiary offline support. A deliberately small service worker: it keeps the
// built app (shell, scripts, styles, lazily loaded lesson pages) so a classroom
// without internet can still open pages it has loaded online once.
//
// The two placeholders below are filled in by the circuitiary-offline-cache plugin
// in vite.config.ts when the app is built. Left unfilled, installation fails on
// purpose, so a misbuilt worker never takes control of a page.
const BUILD_ID = '__BUILD_ID__'
const PRECACHE = ['__PRECACHE__']

const CACHE_PREFIX = 'circuitiary-'
const CACHE = CACHE_PREFIX + BUILD_ID
const SHELL = '/index.html'
// Past this, a page that was cached before is shown instead of waiting on a bad network.
const NAVIGATION_TIMEOUT_MS = 4000

// A redirected response cannot answer a navigation, so keep a clean copy of it.
async function plain(response) {
  if (!response.redirected) return response
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers })
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    try {
      // `reload` skips the HTTP cache, so a stale copy is never stored under the new build id.
      await Promise.all(PRECACHE.map(async path => {
        const response = await fetch(path, { cache: 'reload' })
        if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
        await cache.put(path, await plain(response))
      }))
    } catch (error) {
      // All or nothing: a half-filled cache is dropped and the worker already in charge stays.
      await caches.delete(CACHE)
      throw error
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key)
    await self.clients.claim()
  })())
})

// Every file is stored once, by address. `ignoreVary` matters: a server that answers with
// `Vary: Origin` (vite preview does) would otherwise never match, because the browser adds an
// Origin header to the page's own module and stylesheet requests but not to the worker's fetch.
const fromCache = async key => (await caches.open(CACHE)).match(key, { ignoreVary: true })

// Pages: the network first, so a new build shows up as soon as there is a connection.
// Offline, a slow network or a server error falls back to the cached shell, which
// the app routes to the requested lesson on its own.
async function navigate(request) {
  const network = fetch(request)
  network.catch(() => {})
  let response
  try { response = await Promise.race([network, new Promise(resolve => setTimeout(resolve, NAVIGATION_TIMEOUT_MS))]) } catch { /* Offline. */ }
  if (response && response.status < 500) return response
  return (await fromCache(SHELL)) ?? response ?? network
}

// Hashed build files never change under one name, so the cache wins and the network
// fills it. A missing file may come back as the app's HTML page; that is never stored.
async function hashedAsset(event) {
  const cached = await fromCache(event.request)
  if (cached) return cached
  const response = await fetch(event.request)
  if (response.status === 200 && !(response.headers.get('content-type') ?? '').startsWith('text/html')) {
    const copy = response.clone()
    event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)))
  }
  return response
}

// The few unhashed files (icon, manifest): the network first, the cached copy offline.
async function staticFile(request, path) {
  try { return await fetch(request) } catch (error) {
    const cached = await fromCache(path)
    if (cached) return cached
    throw error
  }
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Never touch the local data endpoint: it holds licence-unverified data, so it must
  // always reach the network and fail normally when there is none.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') event.respondWith(navigate(request))
  else if (url.pathname.startsWith('/assets/')) event.respondWith(hashedAsset(event))
  else if (PRECACHE.includes(url.pathname)) event.respondWith(staticFile(request, url.pathname))
})
