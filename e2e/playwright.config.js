import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, '../frontend')

/**
 * E2E suite drives the *real* React build in a real browser. The backend is not
 * required: each spec stubs `/api/**` at the network layer (page.route), so the
 * flows are deterministic and run fully offline.
 *
 * The HTML report is written to ../reports/e2e so the reports container can serve it.
 */
// When running inside the Playwright Docker image we point at a Vite server that
// is already running (on the host / another container), so skip the managed
// webServer. Locally, Playwright starts Vite itself.
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const SKIP_WEBSERVER = !!process.env.E2E_SKIP_WEBSERVER

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../reports/e2e', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Start the Vite dev server automatically for the duration of the run.
  webServer: SKIP_WEBSERVER ? undefined : {
    command: 'npm run dev -- --port 3000',
    cwd: FRONTEND_DIR,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
