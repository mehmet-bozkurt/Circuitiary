import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { include: ['src/model/**/*.test.ts', 'src/view/**/*.test.ts', 'src/learning/**/*.test.ts', 'src/terms/**/*.test.ts'] } })
