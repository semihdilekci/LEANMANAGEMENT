import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: [
    '@leanmgmt/shared-schemas',
    '@leanmgmt/shared-types',
    '@leanmgmt/shared-utils',
  ],
};

export default nextConfig;
