import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { localConnectome } from './vite.local-data.ts'

// Vite's own defaults are repeated because setting `deny` replaces them. The
// local source and derived data stay reachable only through /api/local-connectome.
const deniedFiles = ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/data/raw/**', '**/data/local/**']

export default defineConfig({
  plugins: [vue(), localConnectome()],
  server: { host: '127.0.0.1', strictPort: true, fs: { deny: deniedFiles } },
  preview: { host: '127.0.0.1', strictPort: true },
})
