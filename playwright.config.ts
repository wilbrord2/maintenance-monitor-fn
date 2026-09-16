import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a real Maintenance Monitor API and this app.
 * See README → Testing for the environment they expect.
 *
 * Set E2E_BROWSER_CHANNEL=chrome to use the locally installed Google Chrome instead of Playwright's
 * bundled Chromium (needed on operating systems Playwright no longer ships browsers for).
 */
const channel = process.env.E2E_BROWSER_CHANNEL;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts/results',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    browserName: 'chromium',
    ...(channel ? { channel } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'tablet',
      testMatch: /responsive\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
    { name: 'mobile', testMatch: /responsive\.spec\.ts/, use: { ...devices['Pixel 7'] } },
  ],
});
