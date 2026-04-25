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
import { TaskSlaService } from '../src/tasks/task-sla.service.js';

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
  if (cachedSuperadminAuth) return cachedSuperadminAuth;
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
  cachedSuperadminAuth = {
    accessToken: body.data.accessToken,
    csrfToken: body.data.csrfToken,
    cookie: `refresh_token=${cookies.refresh_token ?? ''}; csrf_token=${cookies.csrf_token ?? ''}`,
  };
  return cachedSuperadminAuth;
}

async function loginManagerWithConsentDirect(prisma: PrismaService): Promise<AuthBundle> {
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
        ipHash: createHash('sha256').update('tasks-test').digest('hex'),
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

/** İki aday: superadmin + seed manager — claim yarışı */
async function createClaimRaceTask(
  prisma: PrismaService,
  userAId: string,
  userBId: string,
  companyId: string,
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
      startedByUserId: userAId,
      companyId,
      status: 'IN_PROGRESS',
    },
  });
  const t = await prisma.task.create({
    data: {
      processId: proc.id,
      stepKey: 'KTI_MANAGER_APPROVAL',
      stepOrder: 2,
      assignmentMode: AssignmentMode.CLAIM,
      status: 'PENDING',
      slaDueAt: new Date(Date.now() + 48 * 3600 * 1000),
    },
  });
  await prisma.taskAssignment.create({
    data: { taskId: t.id, userId: userAId, status: 'PENDING' },
  });
  await prisma.taskAssignment.create({
    data: { taskId: t.id, userId: userBId, status: 'PENDING' },
  });
  return t.id;
}

/** Yönetici onayı PENDING — tek assignee */
async function createManagerApprovalTask(
  prisma: PrismaService,
  startedById: string,
  managerId: string,
  companyId: string,
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
      startedByUserId: startedById,
      companyId,
      status: 'IN_PROGRESS',
    },
  });
  const t = await prisma.task.create({
    data: {
      processId: proc.id,
      stepKey: 'KTI_MANAGER_APPROVAL',
      stepOrder: 2,
      assignmentMode: AssignmentMode.SINGLE,
      status: 'PENDING',
      slaDueAt: new Date(Date.now() + 72 * 3600 * 1000),
    },
  });
  await prisma.taskAssignment.create({
    data: { taskId: t.id, userId: managerId, status: 'PENDING', resolvedByRule: true },
  });
  return t.id;
}

describe('Tasks API (integration)', () => {
  it('POST :id/claim — yarış: biri 200, diğeri 409 TASK_CLAIM_LOST', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const prisma = app.get(PrismaService);
    const superU = await prisma.user.findFirst({
      where: { firstName: 'Super', lastName: 'Admin' },
    });
    const mgrU = await prisma.user.findFirst({ where: { firstName: 'Seed', lastName: 'Manager' } });
    if (!superU || !mgrU) throw new Error('seed');
    const taskId = await createClaimRaceTask(prisma, superU.id, mgrU.id, superU.companyId);
    const authA = await loginSuperadmin();
    const authB = await loginManagerWithConsentDirect(prisma);

    const p1 = srv.inject({
      method: 'POST',
      url: `/api/v1/tasks/${encodeURIComponent(taskId)}/claim`,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${authA.accessToken}`,
        'x-csrf-token': authA.csrfToken,
        cookie: authA.cookie,
      },
      payload: '{}',
    });
    const p2 = srv.inject({
      method: 'POST',
      url: `/api/v1/tasks/${encodeURIComponent(taskId)}/claim`,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${authB.accessToken}`,
        'x-csrf-token': authB.csrfToken,
        cookie: authB.cookie,
      },
      payload: '{}',
    });
    const [r1, r2] = await Promise.all([p1, p2]);
    const codes = [r1.statusCode, r2.statusCode].sort();
    expect(codes).toEqual([200, 409]);
    const t = await prisma.task.findUnique({ where: { id: taskId } });
    expect(t?.status).toBe('CLAIMED');
    const losers = r1.statusCode === 409 ? r1 : r2;
    const body = JSON.parse(losers.body) as { error: { code: string } };
    expect(body.error.code).toBe('TASK_CLAIM_LOST');
  });

  it('TaskSlaService — sla_due_at geçmiş task isSlaOverdue olur', async () => {
    const prisma = app.get(PrismaService);
    const sla = app.get(TaskSlaService);
    const u = await prisma.user.findFirst({ where: { firstName: 'Super', lastName: 'Admin' } });
    if (!u) throw new Error('seed');
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
        startedByUserId: u.id,
        companyId: u.companyId,
        status: 'IN_PROGRESS',
      },
    });
    const t = await prisma.task.create({
      data: {
        processId: proc.id,
        stepKey: 'KTI_MANAGER_APPROVAL',
        stepOrder: 2,
        assignmentMode: AssignmentMode.SINGLE,
        status: 'PENDING',
        slaDueAt: new Date(Date.now() - 3_600_000),
        isSlaOverdue: false,
      },
    });
    const r = await sla.markOverdueTasks();
    expect(r.updated).toBeGreaterThanOrEqual(1);
    const u2 = await prisma.task.findUnique({ where: { id: t.id } });
    expect(u2?.isSlaOverdue).toBe(true);
  });

  it('POST :id/complete — yönetici APPROVE, süreç COMPLETED', async () => {
    const srv = app.getHttpAdapter().getInstance();
    const prisma = app.get(PrismaService);
    const superU = await prisma.user.findFirst({
      where: { firstName: 'Super', lastName: 'Admin' },
    });
    const mgrU = await prisma.user.findFirst({ where: { firstName: 'Seed', lastName: 'Manager' } });
    if (!superU || !mgrU) throw new Error('seed');
    const taskId = await createManagerApprovalTask(prisma, superU.id, mgrU.id, superU.companyId);
    const authB = await loginManagerWithConsentDirect(prisma);
    const res = await srv.inject({
      method: 'POST',
      url: `/api/v1/tasks/${encodeURIComponent(taskId)}/complete`,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${authB.accessToken}`,
        'x-csrf-token': authB.csrfToken,
        cookie: authB.cookie,
      },
      payload: JSON.stringify({ action: 'APPROVE', formData: { comment: 'ok' } }),
    });
    expect(res.statusCode).toBe(200);
    const j = JSON.parse(res.body) as { data: { processStatus: string; nextTaskId: null } };
    expect(j.data.processStatus).toBe('COMPLETED');
    expect(j.data.nextTaskId).toBeNull();
  });
});
