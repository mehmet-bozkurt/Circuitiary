import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4176',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.CIRCUITIARY_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1050 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev -- --port 4176',
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: false,
  },
})
