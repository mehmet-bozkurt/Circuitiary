import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Exact local file; never part of the browser bundle or public/ directory.
const dataFile = fileURLToPath(new URL('./data/local/cook-subset.json', import.meta.url))
const maxBytes = 2_000_000
const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])
export function localRequest(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress
  if (!address || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return false
  // Browsers send no Origin on no-cors GETs (img, script); Sec-Fetch-Site still names the initiator.
  // Absent means a non-browser local client (curl, Playwright request), which stays allowed.
  const site = req.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return false
  try {
    const host = new URL(`http://${req.headers.host}`).hostname
    if (!localHosts.has(host)) return false
    if (req.headers.origin) {
      const origin = new URL(req.headers.origin)
      if (origin.protocol !== 'http:' || !localHosts.has(origin.hostname) || origin.host !== req.headers.host) return false
    }
  } catch { return false }
  return true
}

interface Outcome { status: number, body: string, log?: string }
const failure = (status: number, error: string, log?: string): Outcome => ({ status, body: JSON.stringify({ error }), log })

// Missing is the normal "not imported yet" state (404). Anything else is a fault of the local
// file: a safe, distinct client message, and the detail (never the content) goes to the server log.
async function readDataset(file: string): Promise<Outcome> {
  try {
    const info = await stat(file)
    if (!info.isFile()) return failure(500, 'Local dataset unreadable', 'dataset path is not a regular file')
    if (info.size > maxBytes) return failure(500, 'Local dataset too large', `dataset is ${info.size} bytes, limit ${maxBytes}`)
    const bytes = await readFile(file)
    if (bytes.length > maxBytes) return failure(500, 'Local dataset too large', `dataset grew to ${bytes.length} bytes, limit ${maxBytes}`)
    const text = bytes.toString('utf8')
    try { JSON.parse(text) } catch { return failure(500, 'Local dataset invalid', 'dataset is not valid JSON') }
    return { status: 200, body: text }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return failure(404, 'Local dataset not imported')
    return failure(500, 'Local dataset unreadable', `dataset could not be read (${code ?? 'unknown error'})`)
  }
}

export function createHandler(file: string = dataFile, warn: (message: string) => void = () => {}) {
  return async function handle(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
    if (req.url?.split('?')[0] !== '/api/local-connectome') { next(); return }
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    if (!localRequest(req)) { res.statusCode = 403; res.end('{"error":"Local access only"}'); return }
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end('{"error":"GET only"}'); return }
    const outcome = await readDataset(file)
    if (outcome.log) warn(`/api/local-connectome: ${outcome.log}`)
    res.statusCode = outcome.status
    res.end(outcome.body)
  }
}
export function localConnectome(): Plugin {
  return {
    name: 'circuitiary-local-connectome',
    configureServer(server) { server.middlewares.use(createHandler(dataFile, message => server.config.logger.warn(message))) },
    configurePreviewServer(server) { server.middlewares.use(createHandler(dataFile, message => server.config.logger.warn(message))) },
  }
}
