import { defineConfig, devices } from '@playwright/test';
import { API_PORT, API_URL } from './e2e/fixtures';

const WEB_PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  // Tests share one seeded database; running them one at a time keeps them deterministic.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // PW_CHANNEL=chrome uses an installed Chrome instead of `npx playwright install chromium`.
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL },
    },
  ],
  webServer: [
    {
      command: 'node e2e/start-api.mjs',
      url: `${API_URL}/`,
      env: { E2E_API_PORT: String(API_PORT) },
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      // A production build in its own directory, pointed at the test API.
      command: `npm run build && npm run start -- -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { NEXT_DIST_DIR: '.next-e2e', NEXT_PUBLIC_API_BASE_URL: API_URL },
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
});
