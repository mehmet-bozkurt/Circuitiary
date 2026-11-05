import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { localConnectome } from './vite.local-data.ts'

export default defineConfig({
  plugins: [vue(), localConnectome()],
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
})
