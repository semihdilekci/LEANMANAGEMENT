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
        '@leanmgmt/prisma-client': path.join(__dirname, 'src/generated/prisma/client.ts'),
      },
    },
    test: {
      include: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'test/**/*.test.ts'],
      testTimeout: 180_000,
      hookTimeout: 180_000,
      /** Documents modülü env doğrulaması — gerçek S3 olmadan integration yeşil */
      env: {
        DOCUMENTS_STORAGE_DRIVER: 'noop',
        S3_DOCUMENTS_BUCKET: 'vitest-placeholder',
        AWS_REGION: 'eu-central-1',
      },
    },
  }),
);
