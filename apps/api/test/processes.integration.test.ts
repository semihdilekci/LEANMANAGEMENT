import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';

import cookie from '@fastify/cookie';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AssignmentMode } from '@leanmgmt/prisma-client';

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

let pg: StartedPostgreSqlContainer;
let redis: StartedTestContainer;
let app: NestFastifyApplication;
const apiDir = path.join(__dirname, '..');

type AuthBundle = { accessToken: string; csrfToken: string; cookie: string };
let cachedSuperadminAuth: AuthBundle | null = null;

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

async function loginSuperadmin(): Promise<AuthBundle> {
  const srv = app.getHttpAdapter().getInstance();
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

async function getSuperadminAuth(): Promise<AuthBundle> {
  if (!cachedSuperadminAuth) {
    cachedSuperadminAuth = await loginSuperadmin();
  }
  return cachedSuperadminAuth;
}

/** Aktif yönetici onay adımı (2) + IN_PROGRESS — rollback hedef 1 testi için */
async function createInProgressKti(
  prisma: PrismaService,
  starterId: string,
  companyId: string,
  assigneeUserId?: string,
): Promise<string> {
  const rows = await prisma.$queryRaw<[{ n: bigint }]>`
    SELECT nextval('process_seq_before_after_kaizen') AS n
  `;
  const n = rows[0].n;
  const displayId = `KTI-${String(n).padStart(6, '0')}`;
  const proc = await prisma.process.create({
    data: {
      processNumber: n,
      processType: 'BEFORE_AFTER_KAIZEN',
      displayId,
      startedByUserId: starterId,
      companyId,
      status: 'IN_PROGRESS',
    },
  });
  const task = await prisma.task.create({
    data: {
      processId: proc.id,
      stepKey: 'KTI_MANAGER_APPROVAL',
      stepOrder: 2,
      assignmentMode: AssignmentMode.SINGLE,
      status: 'PENDING',
    },
  });
  await prisma.taskAssignment.create({
    data: { taskId: task.id, userId: assigneeUserId ?? starterId, status: 'PENDING' },
  });
  return displayId;
}

/** Seed yöneticisi: rol yok, PROCESS_VIEW_ALL yok; rıza kaydı testte tamamlanır */
async function loginSeedManagerWithConsent(prisma: PrismaService): Promise<AuthBundle> {
  const mgr = await prisma.user.findFirst({
    where: { firstName: 'Seed', lastName: 'Manager' },
  });
  if (!mgr) throw new Error('Seed Manager kullanıcısı yok');
  const cv = await prisma.consentVersion.findFirst({ where: { status: 'PUBLISHED' } });
  if (!cv) throw new Error('Yayınlanmış rıza sürümü yok');
  const existing = await prisma.userConsent.findUnique({
    where: {
      userId_consentVersionId: { userId: mgr.id, consentVersionId: cv.id },
    },
  });
  if (!existing) {
    const pepperHex = PII_PEPPER;
    const sig = createHash('sha256').update(`${mgr.id}:${cv.id}:${pepperHex}`).digest('hex');
    await prisma.userConsent.create({
      data: {
        userId: mgr.id,
        consentVersionId: cv.id,
        ipHash: createHash('sha256').update('it-mgr-consent').digest('hex'),
        userAgent: 'integration-test',
        signature: sig,
      },
    });
  }
  const srv = app.getHttpAdapter().getInstance();
  const login = await srv.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({
      email: 'seed.manager@leanmgmt.local',
      password: 'ManagerPass123!@#',
    }),
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

describe('Processes API (integration)', () => {
  it('POST :displayId/cancel — 204, süreç CANCELLED, task SKIPPED_BY_ROLLBACK', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const auth = await getSuperadminAuth();
    const prisma = app.get(PrismaService);
    const u = await prisma.user.findFirst({ where: { isActive: true } });
    if (!u) throw new Error('seed user yok');
    const displayId = await createInProgressKti(prisma, u.id, u.companyId);

    const res = await srv.inject({
      method: 'POST',
      url: `/api/v1/processes/${encodeURIComponent(displayId)}/cancel`,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${auth.accessToken}`,
        'x-csrf-token': auth.csrfToken,
        cookie: auth.cookie,
      },
      payload: JSON.stringify({ reason: 'Yanlışlıkla açıldı, iptal şart' }),
    });
    expect(res.statusCode).toBe(204);
    const updated = await prisma.process.findFirst({ where: { displayId } });
    expect(updated?.status).toBe('CANCELLED');
    const tasks = await prisma.task.findMany({ where: { processId: updated?.id } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('SKIPPED_BY_ROLLBACK');
  });

  it('POST :displayId/rollback — 200, yeni KTI_INITIATION task, eskisi SKIPPED', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const auth = await getSuperadminAuth();
    const prisma = app.get(PrismaService);
    const u = await prisma.user.findFirst({ where: { isActive: true } });
    if (!u) throw new Error('seed user yok');
    const displayId = await createInProgressKti(prisma, u.id, u.companyId);
    const procBefore = await prisma.process.findFirstOrThrow({ where: { displayId } });
    const oldTasks = await prisma.task.findMany({ where: { processId: procBefore.id } });
    const oldId = oldTasks[0].id;

    const res = await srv.inject({
      method: 'POST',
      url: `/api/v1/processes/${encodeURIComponent(displayId)}/rollback`,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${auth.accessToken}`,
        'x-csrf-token': auth.csrfToken,
        cookie: auth.cookie,
      },
      payload: JSON.stringify({
        targetStepOrder: 1,
        reason: 'Başlatma formunda düzeltme gerek; geri alma onaylı',
      }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        newActiveTaskId: string;
        newActiveTaskStepKey: string;
        rolledBackFromStepOrder: number;
      };
    };
    expect(body.data.newActiveTaskStepKey).toBe('KTI_INITIATION');
    expect(body.data.rolledBackFromStepOrder).toBe(2);

    const oldT = await prisma.task.findUnique({ where: { id: oldId } });
    expect(oldT?.status).toBe('SKIPPED_BY_ROLLBACK');
    const newT = await prisma.task.findUnique({ where: { id: body.data.newActiveTaskId } });
    expect(newT?.status).toBe('PENDING');
    expect(newT?.stepKey).toBe('KTI_INITIATION');
  });

  it('POST cancel — terminal süreç 409', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const auth = await getSuperadminAuth();
    const prisma = app.get(PrismaService);
    const u = await prisma.user.findFirst({ where: { isActive: true } });
    if (!u) throw new Error('seed user yok');
    const rows = await prisma.$queryRaw<[{ n: bigint }]>`
      SELECT nextval('process_seq_before_after_kaizen') AS n
    `;
    const n = rows[0].n;
    const displayId = `KTI-${String(n).padStart(6, '0')}`;
    await prisma.process.create({
      data: {
        processNumber: n,
        processType: 'BEFORE_AFTER_KAIZEN',
        displayId,
        startedByUserId: u.id,
        companyId: u.companyId,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    const res = await srv.inject({
      method: 'POST',
      url: `/api/v1/processes/${encodeURIComponent(displayId)}/cancel`,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${auth.accessToken}`,
        'x-csrf-token': auth.csrfToken,
        cookie: auth.cookie,
      },
      payload: JSON.stringify({ reason: 'Tekrar iptal denemesi olmamalı başarısız' }),
    });
    expect(res.statusCode).toBe(409);
    const json = JSON.parse(res.body) as { error: { code: string } };
    expect(json.error.code).toBe('PROCESS_INVALID_STATE');
  });

  it('GET /processes?scope=admin — 200, süperadmin süreç görür', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const auth = await getSuperadminAuth();
    const prisma = app.get(PrismaService);
    const u = await prisma.user.findFirst({ where: { isActive: true } });
    if (!u) throw new Error('seed user yok');
    const displayId = await createInProgressKti(prisma, u.id, u.companyId);

    const res = await srv.inject({
      method: 'GET',
      url: `/api/v1/processes?scope=admin&limit=50`,
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        cookie: auth.cookie,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { items: { displayId: string }[]; pagination: { hasMore: boolean } };
    };
    expect(body.data.items.some((x) => x.displayId === displayId)).toBe(true);
  });

  it('GET /processes?scope=my-started — CANCELLED süreç dönmez', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const auth = await getSuperadminAuth();
    const prisma = app.get(PrismaService);
    const u = await prisma.user.findFirst({ where: { isActive: true } });
    if (!u) throw new Error('seed user yok');
    const rows = await prisma.$queryRaw<[{ n: bigint }]>`
      SELECT nextval('process_seq_before_after_kaizen') AS n
    `;
    const n = rows[0].n;
    const displayId = `KTI-${String(n).padStart(6, '0')}`;
    await prisma.process.create({
      data: {
        processNumber: n,
        processType: 'BEFORE_AFTER_KAIZEN',
        displayId,
        startedByUserId: u.id,
        companyId: u.companyId,
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: 'Test iptal',
        cancelledByUserId: u.id,
      },
    });

    const res = await srv.inject({
      method: 'GET',
      url: `/api/v1/processes?scope=my-started&limit=100`,
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        cookie: auth.cookie,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { items: { displayId: string; status: string }[] };
    };
    expect(body.data.items.some((x) => x.displayId === displayId)).toBe(false);
  });

  it('GET /processes/:displayId — yetkisiz kullanıcı 403', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const prisma = app.get(PrismaService);
    const authProc = await loginSeedManagerWithConsent(prisma);
    const superadmin = await prisma.user.findFirst({
      where: { userRoles: { some: { role: { code: 'SUPERADMIN' } } } },
    });
    if (!superadmin) throw new Error('superadmin yok');
    const displayId = await createInProgressKti(prisma, superadmin.id, superadmin.companyId);

    const res = await srv.inject({
      method: 'GET',
      url: `/api/v1/processes/${encodeURIComponent(displayId)}`,
      headers: {
        authorization: `Bearer ${authProc.accessToken}`,
        cookie: authProc.cookie,
      },
    });
    expect(res.statusCode).toBe(403);
    const json = JSON.parse(res.body) as { error: { code: string } };
    expect(json.error.code).toBe('PROCESS_ACCESS_DENIED');
  });

  it('GET /processes/:displayId — süperadmin 200 ve task listesi', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const auth = await getSuperadminAuth();
    const prisma = app.get(PrismaService);
    const superadmin = await prisma.user.findFirst({
      where: { userRoles: { some: { role: { code: 'SUPERADMIN' } } } },
    });
    if (!superadmin) throw new Error('superadmin yok');
    const displayId = await createInProgressKti(prisma, superadmin.id, superadmin.companyId);

    const res = await srv.inject({
      method: 'GET',
      url: `/api/v1/processes/${encodeURIComponent(displayId)}`,
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        cookie: auth.cookie,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        displayId: string;
        tasks: { stepKey: string; status: string }[];
        activeTaskLabel: string;
      };
    };
    expect(body.data.displayId).toBe(displayId);
    expect(body.data.activeTaskLabel).toBe('Yönetici Onayında');
    expect(body.data.tasks.length).toBeGreaterThanOrEqual(1);
    expect(body.data.tasks.some((t) => t.stepKey === 'KTI_MANAGER_APPROVAL')).toBe(true);
  });
});
