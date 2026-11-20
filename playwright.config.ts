import { defineConfig, devices } from '@playwright/test';

// Local-only smoke tests (not run in CI: CI has no browsers). Run: npm run test:e2e
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  use: { ...devices['iPhone 14'], browserName: 'chromium', baseURL: 'http://localhost:5199' },
  webServer: { command: 'npx vite --port 5199', url: 'http://localhost:5199', reuseExistingServer: true, timeout: 60_000 },
});
