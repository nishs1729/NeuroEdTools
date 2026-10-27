import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,   // simulations are CPU-heavy; run serially
  retries: 1,
  reporter: [['list'], ['html', { outputFolder: 'tests/reports/playwright', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3131',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
  webServer: {
    command: 'npx serve docs -p 3131',
    url: 'http://localhost:3131',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
