import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['http://127.0.0.1:3000'],
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: [
    '@leanmgmt/shared-schemas',
    '@leanmgmt/shared-types',
    '@leanmgmt/shared-utils',
  ],
  async rewrites() {
    const upstream = process.env.API_UPSTREAM_URL ?? 'http://127.0.0.1:3001';
    return [{ source: '/api/:path*', destination: `${upstream}/api/:path*` }];
  },
  async redirects() {
    return [
      { source: '/admin/users', destination: '/users', permanent: false },
      { source: '/admin/users/:path*', destination: '/users/:path*', permanent: false },
      { source: '/admin/master-data', destination: '/master-data', permanent: false },
      { source: '/admin/master-data/:path*', destination: '/master-data/:path*', permanent: false },
    ];
  },
};

export default nextConfig;
