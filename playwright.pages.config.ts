import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// `npm run test:pages`: the GitHub Pages build (base /Circuitiary/, demo mode) served by a small
// static server that behaves like Pages. tests/base-path.spec.ts builds into a scratch directory
// and starts that server itself, so this config needs no webServer and no fixed port. The spec
// registers its tests only when CIRCUITIARY_PAGES is set, so the default `npm run test:browser`
// finds the file but runs nothing from it.
process.env.CIRCUITIARY_PAGES = '1'

export default defineConfig({
  testDir: './tests',
  testMatch: /base-path\.spec\.ts$/,
  // Outside the repository: Playwright clears this folder on every run, and test-results/ keeps dated evidence.
  outputDir: process.env.CIRCUITIARY_EVIDENCE_DIR ?? join(tmpdir(), 'circuitiary-pages-results'),
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CIRCUITIARY_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1050 } } }],
})
