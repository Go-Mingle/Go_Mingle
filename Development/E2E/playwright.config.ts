import { defineConfig, devices } from '@playwright/test'
import { ADMIN_STORAGE, ADMIN_URL, PARTNER_STORAGE, PARTNER_URL } from './tests/support/env'

/**
 * GoMingle end-to-end suite. Start the API and both portals first
 * (`Development/run-gomingle.sh`), or point E2E_API_URL / E2E_ADMIN_URL /
 * E2E_PARTNER_URL at a deployment.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['json', { outputFile: 'results.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'Asia/Karachi',
    locale: 'en-US',
  },
  projects: [
    { name: 'setup', testMatch: /seed\.setup\.ts/ },
    { name: 'api', testMatch: /api\..*\.spec\.ts/, dependencies: ['setup'] },
    { name: 'admin', testMatch: /admin\..*\.spec\.ts/, dependencies: ['setup'], use: { baseURL: ADMIN_URL, storageState: ADMIN_STORAGE } },
    { name: 'partner', testMatch: /partner\..*\.spec\.ts/, dependencies: ['setup'], use: { baseURL: PARTNER_URL, storageState: PARTNER_STORAGE } },
  ],
})
