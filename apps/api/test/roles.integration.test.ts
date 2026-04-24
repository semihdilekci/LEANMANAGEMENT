import { execSync } from 'node:child_process';
import path from 'node:path';

import cookie from '@fastify/cookie';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

const PII_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const PII_PEPPER = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const JWT_SECRET = 'dev-only-jwt-secret-min-32-characters-long!!';

function parseSetCookie(setCookie: string | string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const line of lines) {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const val = pair.slice(eq + 1).trim();
    out[name] = val;
  }
  return out;
}

let pg: StartedPostgreSqlContainer;
let redis: StartedTestContainer;
let app: NestFastifyApplication;
const apiDir = path.join(__dirname, '..');

beforeAll(async () => {
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
    AUTH_EXPOSE_RESET_TOKEN: 'false',
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
  await app.getHttpAdapter().getInstance().ready();
}, 180_000);

afterAll(async () => {
  if (app) await app.close();
  if (pg) await pg.stop();
  if (redis) await redis.stop();
});

async function loginSuperadmin(
  srv: ReturnType<NestFastifyApplication['getHttpAdapter']>['getInstance'],
) {
  const login = await srv.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: 'superadmin@leanmgmt.local', password: 'AdminPass123!@#' }),
  });
  expect(login.statusCode).toBe(200);
  const body = JSON.parse(login.body) as { data: { accessToken: string; csrfToken: string } };
  const cookies = parseSetCookie(login.headers['set-cookie']);
  return {
    accessToken: body.data.accessToken,
    csrfToken: body.data.csrfToken,
    cookie: `refresh_token=${cookies.refresh_token ?? ''}; csrf_token=${cookies.csrf_token ?? ''}`,
  };
}

describe('Roles API (integration)', () => {
  it('GET /roles — superadmin 200', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const { accessToken } = await loginSuperadmin(srv);
    const res = await srv.inject({
      method: 'GET',
      url: '/api/v1/roles',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body) as { data: { code: string }[] };
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.some((r) => r.code === 'SUPERADMIN')).toBe(true);
  });

  it('GET /permissions — metadata', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const { accessToken } = await loginSuperadmin(srv);
    const res = await srv.inject({
      method: 'GET',
      url: '/api/v1/permissions',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body) as { data: { key: string; category: string }[] };
    expect(json.data.length).toBeGreaterThan(5);
  });

  it('POST /roles + GET detay + DELETE', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const auth = await loginSuperadmin(srv);
    const code = `INT_${Date.now()}`;
    const post = await srv.inject({
      method: 'POST',
      url: '/api/v1/roles',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        'x-csrf-token': auth.csrfToken,
        'content-type': 'application/json',
        cookie: auth.cookie,
      },
      payload: JSON.stringify({ code, name: 'Integration Rol', description: 'test' }),
    });
    expect(post.statusCode).toBe(201);
    const created = JSON.parse(post.body) as { data: { id: string; code: string } };
    expect(created.data.code).toBe(code);

    const get = await srv.inject({
      method: 'GET',
      url: `/api/v1/roles/${created.data.id}`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
    });
    expect(get.statusCode).toBe(200);
    const detail = JSON.parse(get.body) as { data: { permissions: string[]; ruleCount: number } };
    expect(detail.data.permissions).toEqual([]);
    expect(detail.data.ruleCount).toBe(0);

    const del = await srv.inject({
      method: 'DELETE',
      url: `/api/v1/roles/${created.data.id}`,
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        'x-csrf-token': auth.csrfToken,
        cookie: auth.cookie,
      },
    });
    expect(del.statusCode).toBe(204);
  });

  it('PROCESS_MANAGER — GET /roles 403', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const login = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'integration_process@leanmgmt.local',
        password: 'OnlyProc123!@#',
      }),
    });
    const tok = (JSON.parse(login.body) as { data: { accessToken: string } }).data.accessToken;
    const res = await srv.inject({
      method: 'GET',
      url: '/api/v1/roles',
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
