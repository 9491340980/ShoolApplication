import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Tests run against the app in OFFLINE DEMO MODE (Firebase disabled
 * via the `demo` build config) — deterministic, no network, never touches live
 * data. Nothing here is part of `ng build`/`firebase deploy`, so it never ships.
 *
 *   npm run test:e2e        # headless
 *   npm run test:e2e:ui     # interactive
 *
 * Point at a different target with E2E_BASE_URL=... (skips the local server).
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4300';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    actionTimeout: 12_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 850 } } },
  ],
  // Start the offline-demo dev server unless we're pointed at a remote URL.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start:demo',
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
      },
});
