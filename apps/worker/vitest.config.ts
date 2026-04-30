import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@leanmgmt/config/vitest/base';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      alias: {
        '@leanmgmt/prisma-client': path.join(__dirname, '../api/src/generated/prisma/client.ts'),
      },
    },
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.integration.test.ts'],
      testTimeout: 180_000,
      hookTimeout: 180_000,
    },
  }),
);
