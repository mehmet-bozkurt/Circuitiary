import { expect, test } from '@playwright/test'
import { chmod, mkdir, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import http, { type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHandler, localRequest } from '../vite.local-data.ts'

// The /api/local-connectome handler, exercised on a throw-away HTTP server with synthetic
// files. No browser is involved and nothing under data/ is read.
const ENDPOINT = '/api/local-connectome'
const dataset = JSON.stringify({ schemaVersion: 1, neurons: [{ id: 'AVAR' }] })

interface Reply { status: number, headers: http.IncomingHttpHeaders, body: string }
interface Served { port: number, warnings: string[], get: (headers?: Record<string, string>, options?: { method?: string, path?: string }) => Promise<Reply> }

let directory = ''
let file = ''
const servers: http.Server[] = []

test.beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'circuitiary-endpoint-'))
  file = join(directory, 'cook-subset.json')
})
test.afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections() })
  await rm(directory, { recursive: true, force: true })
})

async function serve(dataFile: string): Promise<Served> {
  const warnings: string[] = []
  const handler = createHandler(dataFile, message => warnings.push(message))
  const server = http.createServer((req, res) => { void handler(req, res, () => { res.statusCode = 418; res.end('next') }) })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  const get: Served['get'] = (headers = {}, { method = 'GET', path = ENDPOINT } = {}) => new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, method, path, headers }, response => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }))
    })
    request.on('error', reject)
    request.end()
  })
  return { port, warnings, get }
}

test('serves the dataset unchanged with the protective headers', async () => {
  await writeFile(file, dataset)
  const { get, warnings } = await serve(file)
  const reply = await get()
  expect(reply.status).toBe(200)
  expect(reply.body).toBe(dataset)
  expect(reply.headers['content-type']).toBe('application/json; charset=utf-8')
  expect(reply.headers['cache-control']).toBe('no-store')
  expect(reply.headers['x-content-type-options']).toBe('nosniff')
  expect(reply.headers['cross-origin-resource-policy']).toBe('same-origin')
  expect((await get({}, { path: `${ENDPOINT}?retry=1` })).status).toBe(200)
  expect(warnings).toEqual([])
})

test('other paths fall through to the next middleware', async () => {
  const { get } = await serve(file)
  expect(await get({}, { path: '/api/other' })).toMatchObject({ status: 418, body: 'next' })
})

test('a missing file is 404 and is not logged as a fault', async () => {
  const { get, warnings } = await serve(file)
  const reply = await get()
  expect(reply.status).toBe(404)
  expect(JSON.parse(reply.body)).toEqual({ error: 'Local dataset not imported' })
  expect(warnings).toEqual([])
})

test('an oversized file is a distinct 500 and is logged without its content', async () => {
  const secret = 'SECRET-LOCAL-CONTENT'
  const content = secret + ' '.repeat(2_000_001)
  await writeFile(file, content)
  const { get, warnings } = await serve(file)
  const reply = await get()
  expect(reply.status).toBe(500)
  expect(JSON.parse(reply.body)).toEqual({ error: 'Local dataset too large' })
  expect(reply.body).not.toContain(secret)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain(`${Buffer.byteLength(content)} bytes`)
  expect(warnings[0]).not.toContain(secret)
})

test('a file at the size limit is still served', async () => {
  const exact = JSON.stringify({ pad: 'x'.repeat(2_000_000 - 10) })
  expect(Buffer.byteLength(exact)).toBe(2_000_000)
  await writeFile(file, exact)
  const { get } = await serve(file)
  expect((await get()).status).toBe(200)
})

test('invalid JSON is a distinct 500 and is logged without its content', async () => {
  await writeFile(file, '{"neurons": [secret')
  const { get, warnings } = await serve(file)
  const reply = await get()
  expect(reply.status).toBe(500)
  expect(JSON.parse(reply.body)).toEqual({ error: 'Local dataset invalid' })
  expect(reply.body).not.toContain('secret')
  expect(warnings).toEqual(['/api/local-connectome: dataset is not valid JSON'])
})

test('a path that is not a regular file is a 500, not "not imported"', async () => {
  await mkdir(file)
  const { get, warnings } = await serve(file)
  const reply = await get()
  expect(reply.status).toBe(500)
  expect(JSON.parse(reply.body)).toEqual({ error: 'Local dataset unreadable' })
  expect(warnings).toHaveLength(1)
})

test('a file that cannot be read is a 500 with its cause logged, not "not imported"', async () => {
  test.skip(process.getuid?.() === 0, 'root can read any file')
  await writeFile(file, dataset)
  await chmod(file, 0o000)
  const { get, warnings } = await serve(file)
  const reply = await get()
  expect(reply.status).toBe(500)
  expect(JSON.parse(reply.body)).toEqual({ error: 'Local dataset unreadable' })
  expect(warnings).toEqual(['/api/local-connectome: dataset could not be read (EACCES)'])
})

test('the size is checked before the file is read', async () => {
  // Sparse 3 GiB: reading it would fail on Node's own 2 GiB read limit, so only a stat-first
  // check can still report "too large".
  await writeFile(file, '')
  await truncate(file, 3 * 1024 ** 3)
  const { get, warnings } = await serve(file)
  const reply = await get()
  expect(reply.status).toBe(500)
  expect(JSON.parse(reply.body)).toEqual({ error: 'Local dataset too large' })
  expect(warnings).toEqual([`/api/local-connectome: dataset is ${3 * 1024 ** 3} bytes, limit 2000000`])
})

test('only loopback Host names are accepted, which stops DNS rebinding', async () => {
  await writeFile(file, dataset)
  const { get, port } = await serve(file)
  for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`, '127.0.0.1']) {
    expect((await get({ Host: host })).status, host).toBe(200)
  }
  for (const host of ['evil.example', `evil.example:${port}`, `127.0.0.1.evil.example:${port}`, `localhost.evil.example:${port}`, '192.168.1.20', '0.0.0.0']) {
    const reply = await get({ Host: host })
    expect(reply.status, host).toBe(403)
    expect(JSON.parse(reply.body)).toEqual({ error: 'Local access only' })
  }
})

test('Origin must be the same http origin as Host when it is sent', async () => {
  await writeFile(file, dataset)
  const { get, port } = await serve(file)
  const host = `127.0.0.1:${port}`
  expect((await get({ Host: host, Origin: `http://${host}` })).status).toBe(200)
  for (const origin of ['https://example.invalid', `http://localhost:${port}`, `http://127.0.0.1:${port + 1}`, `https://${host}`, 'null', 'not a url']) {
    expect((await get({ Host: host, Origin: origin })).status, origin).toBe(403)
  }
})

test('Sec-Fetch-Site rejects cross-site and same-site requests even without an Origin', async () => {
  await writeFile(file, dataset)
  const { get } = await serve(file)
  for (const site of ['cross-site', 'same-site', 'bogus']) {
    const reply = await get({ 'Sec-Fetch-Site': site, 'Sec-Fetch-Mode': 'no-cors' })
    expect(reply.status, site).toBe(403)
    expect(reply.body).not.toContain('AVAR')
  }
  for (const site of ['same-origin', 'none']) expect((await get({ 'Sec-Fetch-Site': site })).status, site).toBe(200)
  expect((await get()).status).toBe(200) // curl and other non-browser local clients send no Sec-Fetch headers
})

test('mutation methods are 405 for local requests and 403 for foreign ones', async () => {
  await writeFile(file, dataset)
  const { get } = await serve(file)
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const reply = await get({}, { method })
    expect(reply.status, method).toBe(405)
    expect(reply.headers.allow).toBe('GET')
  }
  expect((await get({ Host: 'evil.example' }, { method: 'POST' })).status).toBe(403)
})

test('only loopback peers are local', () => {
  const request = (remoteAddress: string | undefined, headers: Record<string, string> = { host: '127.0.0.1:5173' }) =>
    ({ socket: { remoteAddress }, headers }) as unknown as IncomingMessage
  for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) expect(localRequest(request(address)), address).toBe(true)
  for (const address of ['192.168.1.20', '10.0.0.2', '::ffff:192.168.1.20', '', undefined]) expect(localRequest(request(address)), String(address)).toBe(false)
  expect(localRequest(request('192.168.1.20', { host: 'localhost:5173' }))).toBe(false)
})

test('the development server applies the Sec-Fetch-Site rule', async ({ request }) => {
  const crossSite = await request.get(ENDPOINT, { headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'no-cors' } })
  expect(crossSite.status()).toBe(403)
  expect(await crossSite.text()).toBe('{"error":"Local access only"}')
  // 200 when the local dataset has been imported, 404 when it has not; never 403.
  for (const site of ['same-origin', 'none']) {
    expect([200, 404], site).toContain((await request.get(ENDPOINT, { headers: { 'Sec-Fetch-Site': site } })).status())
  }
})
