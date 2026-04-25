import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7: CLI ve migrate URL’i — `schema.prisma` içinde `url` yok.
 * Komutlar `apps/api` kökünden çalıştırılmalı (örn. `pnpm exec prisma migrate dev`).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
