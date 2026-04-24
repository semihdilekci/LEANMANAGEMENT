import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@leanmgmt/config/vitest/base';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'test/**/*.test.ts'],
      testTimeout: 180_000,
      hookTimeout: 180_000,
    },
  }),
);
