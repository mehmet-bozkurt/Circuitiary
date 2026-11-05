import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { localConnectome } from './vite.local-data.ts'

// Vite's own defaults are repeated because setting `deny` replaces them. The
// local source and derived data stay reachable only through /api/local-connectome.
const deniedFiles = ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/data/raw/**', '**/data/local/**']

// Where the app is served from. '/' unless CIRCUITIARY_BASE says otherwise; the GitHub Pages
// workflow sets it to '/<repository name>/'. Everything in the app that needs an address
// goes through import.meta.env.BASE_URL (src/siteBase.ts), so nothing else reads this.
const base = process.env.CIRCUITIARY_BASE || '/'
if (!/^\/([^/?#\s]+\/)*$/.test(base)) throw new Error(`CIRCUITIARY_BASE must start and end with '/' and contain no spaces, '?' or '#' (got '${base}')`)

// Fills the two placeholders of the emitted sw.js with the files this build produced
// (the page, every hashed chunk, and the unhashed files from public/) and a build id
// hashed from their contents, so every changed build gets its own offline cache.
// Under a base other than '/', the precache addresses carry the base.
const swPlaceholders = { id: "'__BUILD_ID__'", list: "['__PRECACHE__']" }

// public/ is copied as it is, so the manifest keeps its root-absolute addresses ("/", "/icon.svg")
// and stays byte-identical for the default base. Under another base they are prefixed here,
// before the build id is hashed.
const rooted = (value: unknown, prefix: string) => typeof value === 'string' && value.startsWith('/') ? prefix + value.slice(1) : value
async function prefixManifest(file: string, prefix: string) {
  const manifest = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown> & { icons?: Array<Record<string, unknown>> }
  for (const key of ['id', 'start_url', 'scope']) if (key in manifest) manifest[key] = rooted(manifest[key], prefix)
  manifest.icons = manifest.icons?.map(icon => ({ ...icon, src: rooted(icon.src, prefix) }))
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`)
}
function offlineCache(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'circuitiary-offline-cache',
    apply: 'build',
    configResolved(resolved) { config = resolved },
    async writeBundle(options, bundle) {
      const outDir = options.dir ?? config.build.outDir
      const swFile = join(outDir, 'sw.js')
      if (config.base !== '/') await prefixManifest(join(outDir, 'manifest.webmanifest'), config.base)
      const publicFiles = config.publicDir
        ? (await readdir(config.publicDir, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile())
          .map(entry => relative(config.publicDir, join(entry.parentPath, entry.name)).split(sep).join('/'))
        : []
      const files = [...new Set([...Object.keys(bundle), ...publicFiles])].filter(file => file !== 'sw.js' && !file.endsWith('.map')).sort()
      const source = await readFile(swFile, 'utf8')
      const hash = createHash('sha256').update(source)
      for (const file of files) hash.update(file).update(await readFile(join(outDir, file)))
      if (!source.includes(swPlaceholders.id) || !source.includes(swPlaceholders.list)) throw new Error('sw.js is missing its build placeholders')
      const precache = files.map(file => `${config.base}${file}`)
      await writeFile(swFile, source
        .replace(swPlaceholders.id, () => JSON.stringify(hash.digest('hex').slice(0, 12)).replace(/"/g, "'"))
        .replace(swPlaceholders.list, () => JSON.stringify(precache)))
    },
  }
}

export default defineConfig({
  base,
  plugins: [vue(), localConnectome(), offlineCache()],
  server: { host: '127.0.0.1', strictPort: true, fs: { deny: deniedFiles } },
  preview: { host: '127.0.0.1', strictPort: true },
  // Keep the licence headers (@license, copyright lines) of the bundled libraries (Vue, Cytoscape.js,
  // three.js: MIT) in the minified output; MIT asks for the notice to travel with copies. See THIRD_PARTY_NOTICES.md.
  // Cytoscape.js writes its copyright as a plain block comment (not /*! or @license), so the chunk that
  // contains it gets the same one-line notice the other libraries carry.
  build: {
    rolldownOptions: {
      output: {
        comments: { legal: true },
        banner: chunk => chunk.moduleIds.some(id => id.replace(/\\/g, '/').includes('/node_modules/cytoscape/'))
          ? '/*! Cytoscape.js: Copyright (c) 2016-2026, The Cytoscape Consortium. MIT License (https://github.com/cytoscape/cytoscape.js/blob/master/LICENSE). */\n'
          : '',
      },
    },
  },
})
