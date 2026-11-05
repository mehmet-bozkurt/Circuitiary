import { defineConfig, devices } from '@playwright/test'

// Playwright clears outputDir on every run; keep it in a subfolder so the dated
// evidence folders under test-results/ survive a plain test run. `npm run
// test:evidence` points it at a new timestamped folder instead, so a kept
// evidence run never reuses (and therefore never clears) an earlier one.
const outputDir = process.env.CIRCUITIARY_EVIDENCE_DIR ?? './test-results/latest'
// Both servers run with strictPort, so a second run (or anything already
// listening on 4176/4177) fails fast. CIRCUITIARY_DEV_PORT and
// CIRCUITIARY_PREVIEW_PORT move a run to other ports so two runs can overlap.
function port(name: string, fallback: number): number {
  const value = Number(process.env[name] || fallback)
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name} must be a port number from 1 to 65535`)
  return value
}
const devPort = port('CIRCUITIARY_DEV_PORT', 4176)
const previewPort = port('CIRCUITIARY_PREVIEW_PORT', 4177)
const devURL = `http://127.0.0.1:${devPort}`
const previewURL = `http://127.0.0.1:${previewPort}`
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1050 } }
const mobile = { ...devices['iPhone 13'], defaultBrowserType: 'chromium' as const }
// The extra profiles run only the cross-page evidence scenarios.
const evidenceOnly = /evidence\.spec\.ts$/

export default defineConfig({
  testDir: './tests',
  outputDir,
  fullyParallel: false,
  workers: 1,
  // The JSON report keeps machine-readable pass/skip counts beside the run.
  reporter: [['list'], ['json', { outputFile: `${outputDir}/report.json` }]],
  use: {
    baseURL: devURL,
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CIRCUITIARY_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
  },
  projects: [
    { name: 'desktop', use: desktop },
    { name: 'mobile', use: mobile },
    { name: 'narrow-reduced-motion', testMatch: evidenceOnly, use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 800 }, reducedMotion: 'reduce' } },
    { name: 'production-desktop', testMatch: evidenceOnly, use: { ...desktop, baseURL: previewURL } },
    { name: 'production-mobile', testMatch: evidenceOnly, use: { ...mobile, baseURL: previewURL } },
  ],
  webServer: [
    { command: `npm run dev -- --port ${devPort}`, url: devURL, reuseExistingServer: false },
    // Full type check and production bundle in dist/, then the same local preview
    // server README documents; it also serves /api/local-connectome.
    { command: `npm run build && npm run preview -- --port ${previewPort}`, url: previewURL, reuseExistingServer: false, timeout: 180_000 },
  ],
})
