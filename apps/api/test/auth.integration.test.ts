import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';

import cookie from '@fastify/cookie';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { PrismaService } from '../src/prisma/prisma.service.js';

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

async function ensureManagerConsent(prisma: PrismaService): Promise<{ id: string }> {
  const mgr = await prisma.user.findFirst({ where: { firstName: 'Seed', lastName: 'Manager' } });
  if (!mgr) throw new Error('seed manager yok');
  const cv = await prisma.consentVersion.findFirst({ where: { status: 'PUBLISHED' } });
  if (!cv) throw new Error('rıza yok');
  const ex = await prisma.userConsent.findUnique({
    where: { userId_consentVersionId: { userId: mgr.id, consentVersionId: cv.id } },
  });
  if (!ex) {
    const sig = createHash('sha256').update(`${mgr.id}:${cv.id}:${PII_PEPPER}`).digest('hex');
    await prisma.userConsent.create({
      data: {
        userId: mgr.id,
        consentVersionId: cv.id,
        ipHash: createHash('sha256').update('auth-pwd-expiry-test').digest('hex'),
        userAgent: 'integration-test',
        signature: sig,
      },
    });
  }
  return mgr;
}

describe('Auth integration', () => {
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
      OIDC_ENABLED: 'false',
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

  it('login → refresh → replay old refresh → logout', async () => {
    const srv = app.getHttpAdapter().getInstance();

    const login = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'superadmin@leanmgmt.local',
        password: 'AdminPass123!@#',
      }),
    });

    expect(login.statusCode).toBe(200);
    const loginJson = JSON.parse(login.body) as {
      success: boolean;
      data: { accessToken: string; csrfToken: string };
    };
    expect(loginJson.success).toBe(true);
    const csrfFromBody = loginJson.data.csrfToken;
    const cookies1 = parseSetCookie(login.headers['set-cookie']);
    const cookieHeader1 = `refresh_token=${cookies1.refresh_token}; csrf_token=${cookies1.csrf_token}`;

    const refresh1 = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie: cookieHeader1,
        'x-csrf-token': csrfFromBody,
      },
    });

    expect(refresh1.statusCode).toBe(200);
    const refreshJson = JSON.parse(refresh1.body) as {
      success: boolean;
      data: { accessToken: string; csrfToken: string };
    };
    expect(refreshJson.success).toBe(true);
    const access2 = refreshJson.data.accessToken;
    const csrf2 = refreshJson.data.csrfToken;
    const cookies2 = parseSetCookie(refresh1.headers['set-cookie']);
    const cookieHeader2 = `refresh_token=${cookies2.refresh_token}; csrf_token=${cookies2.csrf_token}`;

    const replay = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie: cookieHeader1,
        'x-csrf-token': csrfFromBody,
      },
    });

    expect(replay.statusCode).toBe(401);
    const replayJson = JSON.parse(replay.body) as { success: boolean; error: { code: string } };
    expect(replayJson.success).toBe(false);
    expect(replayJson.error.code).toBe('AUTH_SESSION_REVOKED');

    const logout = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        authorization: `Bearer ${access2}`,
        cookie: cookieHeader2,
        'x-csrf-token': csrf2,
      },
    });

    expect(logout.statusCode).toBe(204);
  });

  it('login — 14 gün içinde şifre süresi bitiyorsa PASSWORD_EXPIRY_WARNING (tek sefer)', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const prisma = app.get(PrismaService);
    const mgr = await ensureManagerConsent(prisma);
    const changed = new Date();
    changed.setUTCDate(changed.getUTCDate() - 170);
    await prisma.user.update({
      where: { id: mgr.id },
      data: { passwordChangedAt: changed, passwordExpiryWarningStage: 0 },
    });

    const login1 = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'seed.manager@leanmgmt.local',
        password: 'ManagerPass123!@#',
      }),
    });
    expect(login1.statusCode).toBe(200);

    const row = await prisma.notification.findFirst({
      where: { userId: mgr.id, eventType: 'PASSWORD_EXPIRY_WARNING', channel: 'IN_APP' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).not.toBeNull();
    const after1 = await prisma.user.findUnique({ where: { id: mgr.id } });
    expect(after1?.passwordExpiryWarningStage).toBe(1);

    const beforeCount = await prisma.notification.count({
      where: { userId: mgr.id, eventType: 'PASSWORD_EXPIRY_WARNING' },
    });
    const login2 = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'seed.manager@leanmgmt.local',
        password: 'ManagerPass123!@#',
      }),
    });
    expect(login2.statusCode).toBe(200);
    const afterCount = await prisma.notification.count({
      where: { userId: mgr.id, eventType: 'PASSWORD_EXPIRY_WARNING' },
    });
    expect(afterCount).toBe(beforeCount);
  });

  it('GET consent-versions — aktif sürüm metni dönner', async () => {
    const srv = app.getHttpAdapter().getInstance();

    const login = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'superadmin@leanmgmt.local',
        password: 'AdminPass123!@#',
      }),
    });
    expect(login.statusCode).toBe(200);
    const loginJson = JSON.parse(login.body) as {
      success: boolean;
      data: { accessToken: string; user: { activeConsentVersionId: string | null } };
    };
    const token = loginJson.data.accessToken;
    const vId = loginJson.data.user.activeConsentVersionId;
    expect(vId).toBeTruthy();
    if (!vId) return;

    const doc = await srv.inject({
      method: 'GET',
      url: `/api/v1/consent-versions/${vId}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(doc.statusCode).toBe(200);
    const body = JSON.parse(doc.body) as {
      success: boolean;
      data: { id: string; version: number; body: string; title: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(vId);
    expect(body.data.body.length).toBeGreaterThan(0);
  });

  it('GET /users — superadmin 200 (DI smoke)', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const login = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'superadmin@leanmgmt.local', password: 'AdminPass123!@#' }),
    });
    const token = (JSON.parse(login.body) as { data: { accessToken: string } }).data.accessToken;
    const res = await srv.inject({
      method: 'GET',
      url: '/api/v1/users?limit=2',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('OIDC kapalıyken GET /api/v1/auth/oauth/google → 404 AUTH_OIDC_DISABLED', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const res = await srv.inject({ method: 'GET', url: '/api/v1/auth/oauth/google' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUTH_OIDC_DISABLED');
  });

  it('OIDC kapalıyken GET /api/v1/auth/oauth/google/callback → 404 AUTH_OIDC_DISABLED', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const res = await srv.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/google/callback?code=x&state=y',
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe('AUTH_OIDC_DISABLED');
  });

  it('PATCH /auth/me/avatar — günceller ve GET /auth/me avatarKey döner', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const login = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'superadmin@leanmgmt.local',
        password: 'AdminPass123!@#',
      }),
    });
    expect(login.statusCode).toBe(200);
    const loginJson = JSON.parse(login.body) as {
      success: boolean;
      data: { accessToken: string; csrfToken: string };
    };
    const token = loginJson.data.accessToken;
    const csrfFromBody = loginJson.data.csrfToken;
    const cookies = parseSetCookie(login.headers['set-cookie']);
    const cookieHeader = `csrf_token=${cookies.csrf_token ?? ''}`;

    const patch = await srv.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me/avatar',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-csrf-token': csrfFromBody,
        cookie: cookieHeader,
      },
      payload: JSON.stringify({ avatarKey: 'night/clear/1' }),
    });
    expect(patch.statusCode).toBe(200);
    const patchJson = JSON.parse(patch.body) as { success: boolean; data: { avatarKey: string } };
    expect(patchJson.success).toBe(true);
    expect(patchJson.data.avatarKey).toBe('night/clear/1');

    const me = await srv.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    const meJson = JSON.parse(me.body) as { success: boolean; data: { avatarKey: string } };
    expect(meJson.data.avatarKey).toBe('night/clear/1');
  });

  it('PATCH /auth/me/avatar — geçersiz key doğrulama hatası', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const login = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        email: 'superadmin@leanmgmt.local',
        password: 'AdminPass123!@#',
      }),
    });
    const loginJson = JSON.parse(login.body) as {
      success: boolean;
      data: { accessToken: string; csrfToken: string };
    };
    const token = loginJson.data.accessToken;
    const csrfFromBody = loginJson.data.csrfToken;
    const cookies = parseSetCookie(login.headers['set-cookie']);
    const cookieHeader = `csrf_token=${cookies.csrf_token ?? ''}`;

    const patch = await srv.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me/avatar',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-csrf-token': csrfFromBody,
        cookie: cookieHeader,
      },
      payload: JSON.stringify({ avatarKey: 'invalid/key' }),
    });
    expect(patch.statusCode).toBe(400);
  });
});
