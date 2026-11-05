import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { localConnectome } from './vite.local-data.ts'

// Vite's own defaults are repeated because setting `deny` replaces them. The
// local source and derived data stay reachable only through /api/local-connectome.
const deniedFiles = ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/data/raw/**', '**/data/local/**']

// Fills the two placeholders of the emitted sw.js with the files this build produced
// (the page, every hashed chunk, and the unhashed files from public/) and a build id
// hashed from their contents, so every changed build gets its own offline cache.
const swPlaceholders = { id: "'__BUILD_ID__'", list: "['__PRECACHE__']" }
function offlineCache(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'circuitiary-offline-cache',
    apply: 'build',
    configResolved(resolved) { config = resolved },
    async writeBundle(options, bundle) {
      const outDir = options.dir ?? config.build.outDir
      const swFile = join(outDir, 'sw.js')
      const publicFiles = config.publicDir
        ? (await readdir(config.publicDir, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile())
          .map(entry => relative(config.publicDir, join(entry.parentPath, entry.name)).split(sep).join('/'))
        : []
      const files = [...new Set([...Object.keys(bundle), ...publicFiles])].filter(file => file !== 'sw.js' && !file.endsWith('.map')).sort()
      const source = await readFile(swFile, 'utf8')
      const hash = createHash('sha256').update(source)
      for (const file of files) hash.update(file).update(await readFile(join(outDir, file)))
      if (!source.includes(swPlaceholders.id) || !source.includes(swPlaceholders.list)) throw new Error('sw.js is missing its build placeholders')
      const precache = files.map(file => `/${file}`)
      await writeFile(swFile, source
        .replace(swPlaceholders.id, () => JSON.stringify(hash.digest('hex').slice(0, 12)).replace(/"/g, "'"))
        .replace(swPlaceholders.list, () => JSON.stringify(precache)))
    },
  }
}

export default defineConfig({
  plugins: [vue(), localConnectome(), offlineCache()],
  server: { host: '127.0.0.1', strictPort: true, fs: { deny: deniedFiles } },
  preview: { host: '127.0.0.1', strictPort: true },
})
