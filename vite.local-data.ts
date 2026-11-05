import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Exact local file; never part of the browser bundle or public/ directory.
const dataFile = fileURLToPath(new URL('./data/local/cook-subset.json', import.meta.url))
const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])
function localRequest(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress
  if (!address || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return false
  try {
    const host = new URL(`http://${req.headers.host}`).hostname
    if (!localHosts.has(host)) return false
    if (req.headers.origin) {
      const origin = new URL(req.headers.origin)
      if (!localHosts.has(origin.hostname) || origin.host !== req.headers.host) return false
    }
  } catch { return false }
  return true
}
async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (req.url?.split('?')[0] !== '/api/local-connectome') { next(); return }
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  if (!localRequest(req)) { res.statusCode = 403; res.end('{"error":"Local access only"}'); return }
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end('{"error":"GET only"}'); return }
  try {
    const text = await readFile(dataFile, 'utf8')
    if (Buffer.byteLength(text) > 2_000_000) throw new Error('Oversized local dataset')
    JSON.parse(text)
    res.end(text)
  } catch {
    res.statusCode = 404; res.end('{"error":"Local dataset not imported"}')
  }
}
export function localConnectome(): Plugin {
  return {
    name: 'circuitiary-local-connectome',
    configureServer(server) { server.middlewares.use(handle) },
    configurePreviewServer(server) { server.middlewares.use(handle) },
  }
}
