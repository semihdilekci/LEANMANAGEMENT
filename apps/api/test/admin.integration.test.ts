import { execSync } from 'node:child_process';
import path from 'node:path';

import cookie from '@fastify/cookie';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';

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

function decodeJwtSub(token: string): string {
  const p = token.split('.')[1];
  if (!p) throw new Error('jwt');
  const json = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as { sub: string };
  return json.sub;
}

/** Aynı Nest örneği + throttle; testler sırayla çalışsın (paralel login/export 429 üretebilir). */
describe.sequential('Admin — system settings + audit (integration)', () => {
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

  async function loginAs(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    csrfToken: string;
    cookieHeader: string;
  }> {
    const srv = app.getHttpAdapter().getInstance();
    const res = await srv.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email, password }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { accessToken: string; csrfToken: string };
    };
    const c = parseSetCookie(res.headers['set-cookie']);
    const cookieHeader = `refresh_token=${c['refresh_token'] ?? ''}; csrf_token=${c['csrf_token'] ?? ''}`;
    return {
      accessToken: body.data.accessToken,
      csrfToken: body.data.csrfToken,
      cookieHeader,
    };
  }

  it('superadmin system-settings list (VIEW permission)', async () => {
    const { accessToken } = await loginAs('superadmin@leanmgmt.local', 'AdminPass123!@#');
    const srv = app.getHttpAdapter().getInstance();
    const r = await srv.inject({
      method: 'GET',
      url: '/api/v1/admin/system-settings',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body) as { success: boolean; data: { key: string }[] };
    expect(body.success).toBe(true);
    expect(body.data.some((x) => x.key === 'LOCKOUT_THRESHOLD')).toBe(true);
  });

  it('superadmin PUT system setting + cache yenilenir', async () => {
    const { accessToken, csrfToken, cookieHeader } = await loginAs(
      'superadmin@leanmgmt.local',
      'AdminPass123!@#',
    );
    const srv = app.getHttpAdapter().getInstance();
    const prisma = app.get(PrismaService);
    const before = await prisma.systemSetting.findUnique({ where: { key: 'LOCKOUT_THRESHOLD' } });
    const nextVal = (typeof before?.value === 'number' ? before.value : 5) === 5 ? 6 : 5;

    const r = await srv.inject({
      method: 'PUT',
      url: '/api/v1/admin/system-settings/LOCKOUT_THRESHOLD',
      headers: {
        authorization: `Bearer ${accessToken}`,
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ value: nextVal }),
    });
    expect(r.statusCode).toBe(200);
    const row = JSON.parse(r.body) as { data: { value: number } };
    expect(row.data.value).toBe(nextVal);

    const r2 = await srv.inject({
      method: 'GET',
      url: '/api/v1/admin/system-settings',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const list = JSON.parse(r2.body) as { data: { key: string; value: number }[] };
    const found = list.data.find((x) => x.key === 'LOCKOUT_THRESHOLD');
    expect(found?.value).toBe(nextVal);
  });

  it('rolsüz yönetici (seed.manager) audit-logs 403', async () => {
    const { accessToken } = await loginAs('seed.manager@leanmgmt.local', 'ManagerPass123!@#');
    const srv = app.getHttpAdapter().getInstance();
    const r = await srv.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-logs?limit=5',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(r.statusCode).toBe(403);
  });

  it('superadmin GET /admin/summary 200', async () => {
    const { accessToken } = await loginAs('superadmin@leanmgmt.local', 'AdminPass123!@#');
    const srv = app.getHttpAdapter().getInstance();
    const r = await srv.inject({
      method: 'GET',
      url: '/api/v1/admin/summary',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body) as {
      data: { activeUserCount: number; openProcessCount: number; overdueTaskCount: number };
    };
    expect(typeof body.data.activeUserCount).toBe('number');
    expect(typeof body.data.openProcessCount).toBe('number');
    expect(typeof body.data.overdueTaskCount).toBe('number');
  });

  it('seed.manager GET /admin/summary 403 (admin izinleri yok)', async () => {
    const { accessToken } = await loginAs('seed.manager@leanmgmt.local', 'ManagerPass123!@#');
    const srv = app.getHttpAdapter().getInstance();
    const r = await srv.inject({
      method: 'GET',
      url: '/api/v1/admin/summary',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(r.statusCode).toBe(403);
  });

  it('PROCESS_MANAGER (AUDIT_LOG_VIEW) GET /admin/summary 200', async () => {
    const { accessToken } = await loginAs('integration_process@leanmgmt.local', 'OnlyProc123!@#');
    const srv = app.getHttpAdapter().getInstance();
    const r = await srv.inject({
      method: 'GET',
      url: '/api/v1/admin/summary',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(r.statusCode).toBe(200);
  });

  it('superadmin audit-logs list + pagination', async () => {
    const { accessToken } = await loginAs('superadmin@leanmgmt.local', 'AdminPass123!@#');
    const srv = app.getHttpAdapter().getInstance();
    const r = await srv.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-logs?limit=3',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body) as {
      success: boolean;
      data: { data: unknown[]; pagination: { hasMore: boolean; nextCursor: string | null } };
    };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.data)).toBe(true);
    expect(typeof body.data.pagination.hasMore).toBe('boolean');
  });

  it('superadmin chain-integrity 200', async () => {
    const { accessToken } = await loginAs('superadmin@leanmgmt.local', 'AdminPass123!@#');
    const srv = app.getHttpAdapter().getInstance();
    const r = await srv.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-logs/chain-integrity',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body) as {
      data: { chainIntact: boolean; totalRecordsChecked: number };
    };
    expect(typeof body.data.chainIntact).toBe('boolean');
    expect(typeof body.data.totalRecordsChecked).toBe('number');
  });

  it('POST chain-integrity/verify 200 (CSRF)', async () => {
    const { accessToken, csrfToken, cookieHeader } = await loginAs(
      'superadmin@leanmgmt.local',
      'AdminPass123!@#',
    );
    const srv = app.getHttpAdapter().getInstance();
    const r = await srv.inject({
      method: 'POST',
      url: '/api/v1/admin/audit-logs/chain-integrity/verify',
      headers: {
        authorization: `Bearer ${accessToken}`,
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({}),
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body) as { data: { chainIntact: boolean } };
    expect(typeof body.data.chainIntact).toBe('boolean');
  });

  it('seed.manager admin consent-versions 403', async () => {
    const { accessToken } = await loginAs('seed.manager@leanmgmt.local', 'ManagerPass123!@#');
    const srv = app.getHttpAdapter().getInstance();
    const r = await srv.inject({
      method: 'GET',
      url: '/api/v1/admin/consent-versions',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(r.statusCode).toBe(403);
  });

  it('consent publish sonrası (effective geçmiş) kullanıcı consentAccepted false', async () => {
    const prisma = app.get(PrismaService);
    const { accessToken, csrfToken, cookieHeader } = await loginAs(
      'superadmin@leanmgmt.local',
      'AdminPass123!@#',
    );
    const srv = app.getHttpAdapter().getInstance();

    const content =
      'x'.repeat(100) +
      ' yeni rıza metni içeriği — KVKK kapsamında kişisel verileriniz işlenmektedir. Bu metin test amaçlıdır.';

    const createRes = await srv.inject({
      method: 'POST',
      url: '/api/v1/admin/consent-versions',
      headers: {
        authorization: `Bearer ${accessToken}`,
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ content }),
    });
    expect(createRes.statusCode).toBe(201);
    const draftId = (JSON.parse(createRes.body) as { data: { id: string } }).data.id;

    const effectiveFrom = new Date(Date.now() + 120_000).toISOString();
    const pubRes = await srv.inject({
      method: 'POST',
      url: `/api/v1/admin/consent-versions/${draftId}/publish`,
      headers: {
        authorization: `Bearer ${accessToken}`,
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ effectiveFrom }),
    });
    expect(pubRes.statusCode).toBe(200);

    await prisma.consentVersion.update({
      where: { id: draftId },
      data: { effectiveFrom: new Date(Date.now() - 60_000) },
    });

    const mgr = await loginAs('seed.manager@leanmgmt.local', 'ManagerPass123!@#');
    const me = await srv.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${mgr.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    const meBody = JSON.parse(me.body) as { data: { consentAccepted: boolean } };
    expect(meBody.data.consentAccepted).toBe(false);

    const v1 = await prisma.consentVersion.findFirst({ where: { version: 1 } });
    if (v1) {
      await prisma.systemSetting.update({
        where: { key: 'ACTIVE_CONSENT_VERSION_ID' },
        data: { value: v1.id },
      });
    }
  });

  it('export: 11. istek 429 (saatlik kota)', async () => {
    const { accessToken } = await loginAs('superadmin@leanmgmt.local', 'AdminPass123!@#');
    const redisService = app.get(RedisService);
    const sub = decodeJwtSub(accessToken);
    const slot = new Date().toISOString().slice(0, 13);
    await redisService.raw.del(`audit:export:hour:${sub}:${slot}`);

    const srv = app.getHttpAdapter().getInstance();
    for (let i = 0; i < 10; i++) {
      const res = await srv.inject({
        method: 'GET',
        url: '/api/v1/admin/audit-logs/export',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(200);
    }
    const last = await srv.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-logs/export',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(last.statusCode).toBe(429);
  });
});
