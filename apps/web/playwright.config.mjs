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
    /** 3000 sık dolu; E2E izole port */
    baseURL: 'http://127.0.0.1:3010',
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
      // CI’da her koşum izole; lokalde api zaten ayaktaysa port çakışmasını önler
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      name: 'web',
      command:
        'pnpm exec wait-on -t 120000 http://127.0.0.1:31099/api/v1/health && pnpm exec next dev --port 3010',
      cwd: rootDir,
      env: {
        ...process.env,
        API_UPSTREAM_URL: 'http://127.0.0.1:31099',
      },
      url: 'http://127.0.0.1:3010',
      timeout: 180_000,
      // Lokalde `next dev` 3000’de çalışıyorsa onu kullan (aksi halde hata: port already used)
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
