/**
 * E2E için API + PostgreSQL + Redis — Playwright webServer tarafından uzun süreli süreç olarak çalıştırılır.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cookie from '@fastify/cookie';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, '..');

const PII_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const PII_PEPPER = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const JWT_SECRET = 'dev-only-jwt-secret-min-32-characters-long!!';

const port = Number(process.env.E2E_API_PORT ?? '31099');

let pg: StartedPostgreSqlContainer;
let redis: StartedTestContainer;
let app: NestFastifyApplication;

async function shutdown(): Promise<void> {
  try {
    if (app) await app.close();
  } catch {
    /* ignore */
  }
  try {
    if (pg) await pg.stop();
  } catch {
    /* ignore */
  }
  try {
    if (redis) await redis.stop();
  } catch {
    /* ignore */
  }
}

process.on('SIGINT', () => void shutdown().then(() => process.exit(0)));
process.on('SIGTERM', () => void shutdown().then(() => process.exit(0)));

async function main(): Promise<void> {
  pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  redis = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();

  const databaseUrl = pg.getConnectionUri();
  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    APP_PII_ENCRYPTION_KEY: PII_KEY,
    APP_PII_PEPPER: PII_PEPPER,
    JWT_ACCESS_SECRET_CURRENT: JWT_SECRET,
    AUTH_EXPOSE_RESET_TOKEN: 'true',
  };

  execSync('pnpm exec prisma migrate deploy', { cwd: apiDir, stdio: 'inherit', env });
  execSync('pnpm exec prisma db seed', { cwd: apiDir, stdio: 'inherit', env });

  Object.assign(process.env, env);

  const { AppModule } = await import('../src/app.module.js');
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(cookie as unknown as Parameters<NestFastifyApplication['register']>[0], {
    secret: 'test-cookie-signing-secret-min-32-chars___',
  });
  app.setGlobalPrefix('api/v1');
  await app.init();
  await app.listen(port, '0.0.0.0');
  console.log(`[e2e-serve] API http://127.0.0.1:${port}`);
}

void main().catch(async (err) => {
  console.error(err);
  await shutdown();
  process.exit(1);
});
