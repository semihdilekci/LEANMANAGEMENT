import { resolve } from 'path';
import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@leanmgmt/config/vitest/base';

export default mergeConfig(
  base,
  defineConfig({
    esbuild: {
      jsx: 'automatic',
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      environment: 'jsdom',
    },
  }),
);
