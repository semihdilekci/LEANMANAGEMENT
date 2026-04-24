import config from '@leanmgmt/config/eslint';

export default [
  ...config,
  { ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
];
