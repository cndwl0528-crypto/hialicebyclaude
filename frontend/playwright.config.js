// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright E2E test configuration for HiAlice frontend.
 * Base URL targets the Next.js dev server on port 3001.
 *
 * Run tests: npx playwright test
 * Run with UI: npx playwright test --ui
 * Show report: npx playwright show-report
 */
module.exports = defineConfig({
  testDir: './e2e',

  /* Maximum time one test can run before it is considered failed */
  timeout: 30_000,

  /* Expect timeout for individual assertions */
  expect: {
    timeout: 8_000,
  },

  /* Run tests in files in parallel */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,

  /* Limit workers on CI to avoid resource contention */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter configuration */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  /* Shared settings for all projects */
  use: {
    /* Base URL — matches the Next.js dev server port */
    baseURL: 'http://localhost:3001',

    /* Collect trace on first retry so failures are debuggable */
    trace: 'on-first-retry',

    /* Take screenshots on failure */
    screenshot: 'only-on-failure',

    /* Video recording on first retry */
    video: 'on-first-retry',

    /* Headless by default; set HEADED=1 env var to watch the browser */
    headless: process.env.HEADED !== '1',

    /* Viewport appropriate for tablet-first design */
    viewport: { width: 1024, height: 768 },

    /* Ignore HTTPS errors from self-signed certs */
    ignoreHTTPSErrors: true,

    /* Short navigation timeout so flaky API waits fail fast */
    navigationTimeout: 20_000,

    /* Action timeout (clicks, fills, etc.) */
    actionTimeout: 10_000,
  },

  /* Only Chromium for now — easily extended later */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start the Next.js dev server before running tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'development',
      NEXT_PUBLIC_API_URL: 'http://localhost:5000',
    },
  },
});
