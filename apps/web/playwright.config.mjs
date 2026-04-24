import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: path.join(rootDir, 'e2e'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'api',
      command: 'pnpm exec tsx test/e2e-serve.ts',
      cwd: path.join(rootDir, '../api'),
      url: 'http://127.0.0.1:31099/api/v1/health',
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      name: 'web',
      command:
        'pnpm exec wait-on -t 120000 http://127.0.0.1:31099/api/v1/health && pnpm exec next dev --port 3000',
      cwd: rootDir,
      env: {
        ...process.env,
        API_UPSTREAM_URL: 'http://127.0.0.1:31099',
      },
      url: 'http://127.0.0.1:3000',
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
