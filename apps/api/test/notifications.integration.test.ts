import { execSync } from 'node:child_process';
import path from 'node:path';

import cookie from '@fastify/cookie';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AssignmentMode } from '@leanmgmt/prisma-client';

import { NOTIFICATION_DOMAIN_EVENT } from '../src/notifications/notification-domain.events.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';

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
/** BullMQ job sayımı için */
let testRedisUrl = '';
const apiDir = path.join(__dirname, '..');

beforeAll(async () => {
  pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  redis = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
  const databaseUrl = pg.getConnectionUri();
  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
  testRedisUrl = redisUrl;
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

async function loginSuperadmin(): Promise<{
  accessToken: string;
  csrfToken: string;
  cookie: string;
}> {
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

async function createSingleAssigneeTask(
  prisma: PrismaService,
  startedById: string,
  assigneeId: string,
  companyId: string,
): Promise<{ taskId: string; displayId: string }> {
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
    data: { taskId: t.id, userId: assigneeId, status: 'PENDING', resolvedByRule: true },
  });
  return { taskId: t.id, displayId };
}

describe('Notifications (integration)', () => {
  it('task.assigned emit → IN_APP bildirim + liste endpoint’i', async () => {
    const prisma = app.get(PrismaService);
    const emitter = app.get(EventEmitter2);
    const starter = await prisma.user.findFirst({
      where: { firstName: 'Super', lastName: 'Admin' },
    });
    if (!starter) throw new Error('seed');
    const { taskId, displayId } = await createSingleAssigneeTask(
      prisma,
      starter.id,
      starter.id,
      starter.companyId,
    );

    await emitter.emitAsync(NOTIFICATION_DOMAIN_EVENT.TASK_ASSIGNED, {
      taskId,
      userId: starter.id,
      processDisplayId: displayId,
    });

    const auth = await loginSuperadmin();
    const srv = app.getHttpAdapter().getInstance();
    const list = await srv.inject({
      method: 'GET',
      url: '/api/v1/notifications?limit=20',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
      },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as {
      success: boolean;
      data: {
        items: { id: string; eventType: string; body: string }[];
        pagination: { total: number };
      };
    };
    expect(body.success).toBe(true);
    expect(body.data.pagination.total).toBeGreaterThanOrEqual(1);
    const mine = body.data.items.filter((i) => i.body.includes(displayId));
    expect(mine.length).toBeGreaterThanOrEqual(1);
    expect(mine[0]?.eventType).toBe('TASK_ASSIGNED');

    const emailPending = await prisma.notification.count({
      where: {
        userId: starter.id,
        channel: 'EMAIL',
        eventType: 'TASK_ASSIGNED',
        deliveryStatus: 'PENDING',
      },
    });
    expect(emailPending).toBeGreaterThanOrEqual(1);
  });

  it('e-posta tercihi kapalı → EMAIL satırı ve kuyruk job’u oluşmaz', async () => {
    const prisma = app.get(PrismaService);
    const notificationsService = app.get(NotificationsService);
    const mgr = await prisma.user.findFirst({ where: { firstName: 'Seed', lastName: 'Manager' } });
    if (!mgr) throw new Error('seed');

    await prisma.notificationPreference.upsert({
      where: { userId_eventType: { userId: mgr.id, eventType: 'TASK_ASSIGNED' } },
      create: {
        userId: mgr.id,
        eventType: 'TASK_ASSIGNED',
        inAppEnabled: true,
        emailEnabled: false,
        digestEnabled: false,
      },
      update: { emailEnabled: false, inAppEnabled: true },
    });

    const beforeEmail = await prisma.notification.count({
      where: { userId: mgr.id, channel: 'EMAIL', eventType: 'TASK_ASSIGNED' },
    });

    const connection = new Redis(testRedisUrl, { maxRetriesPerRequest: null });
    const queueName = process.env.NOTIFICATION_EMAIL_QUEUE_NAME ?? 'notification-email-outbound';
    const q = new Queue<{ notificationId: string }>(queueName, { connection });
    const beforeWaiting = (await q.getJobCounts()).waiting;

    await notificationsService.createEmailPendingIfEnabled({
      userId: mgr.id,
      eventType: 'TASK_ASSIGNED',
      title: 'Test',
      body: 'Test body',
      linkUrl: '/tasks/x',
      metadata: { displayId: 'KTI-000001', taskTitle: 'Adım', processId: 'p', taskId: 't' },
    });

    const afterEmail = await prisma.notification.count({
      where: { userId: mgr.id, channel: 'EMAIL', eventType: 'TASK_ASSIGNED' },
    });
    expect(afterEmail).toBe(beforeEmail);

    const afterWaiting = (await q.getJobCounts()).waiting;
    expect(afterWaiting).toBe(beforeWaiting);

    await q.close();
    await connection.quit();

    await prisma.notification.create({
      data: {
        userId: mgr.id,
        eventType: 'TASK_ASSIGNED',
        channel: 'IN_APP',
        title: 'Test',
        body: 'Test body integration',
        deliveryStatus: 'SENT',
        sentAt: new Date(),
      },
    });

    const inAppRows = await prisma.notification.count({
      where: { userId: mgr.id, channel: 'IN_APP', eventType: 'TASK_ASSIGNED' },
    });
    expect(inAppRows).toBeGreaterThanOrEqual(1);
  });

  it('e-posta açık + şablon varken → EMAIL PENDING + kuyruk', async () => {
    const prisma = app.get(PrismaService);
    const notificationsService = app.get(NotificationsService);
    const mgr = await prisma.user.findFirst({ where: { firstName: 'Seed', lastName: 'Manager' } });
    if (!mgr) throw new Error('seed');

    await prisma.notificationPreference.upsert({
      where: { userId_eventType: { userId: mgr.id, eventType: 'TASK_ASSIGNED' } },
      create: {
        userId: mgr.id,
        eventType: 'TASK_ASSIGNED',
        inAppEnabled: true,
        emailEnabled: true,
        digestEnabled: false,
      },
      update: { emailEnabled: true, inAppEnabled: true },
    });

    const connection = new Redis(testRedisUrl, { maxRetriesPerRequest: null });
    const queueName = process.env.NOTIFICATION_EMAIL_QUEUE_NAME ?? 'notification-email-outbound';
    const q = new Queue<{ notificationId: string }>(queueName, { connection });
    const beforeWaiting = (await q.getJobCounts()).waiting;

    await notificationsService.createEmailPendingIfEnabled({
      userId: mgr.id,
      eventType: 'TASK_ASSIGNED',
      title: 'E-posta test',
      body: 'İçerik',
      linkUrl: '/tasks/x',
      metadata: { displayId: 'KTI-000099', taskTitle: 'Onay', processId: 'p1', taskId: 't1' },
    });

    const afterWaiting = (await q.getJobCounts()).waiting;
    expect(afterWaiting).toBeGreaterThanOrEqual(beforeWaiting + 1);

    const pending = await prisma.notification.findFirst({
      where: {
        userId: mgr.id,
        channel: 'EMAIL',
        eventType: 'TASK_ASSIGNED',
        deliveryStatus: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(pending).toBeTruthy();

    await q.close();
    await connection.quit();
  });

  it('GET /admin/email-templates/TASK_ASSIGNED — superadmin şablon döner', async () => {
    const auth = await loginSuperadmin();
    const srv = app.getHttpAdapter().getInstance();
    const res = await srv.inject({
      method: 'GET',
      url: '/api/v1/admin/email-templates/TASK_ASSIGNED',
      headers: { authorization: `Bearer ${auth.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      data: { eventType: string; subjectTemplate: string; requiredVariables: string[] };
    };
    expect(body.success).toBe(true);
    expect(body.data.eventType).toBe('TASK_ASSIGNED');
    expect(body.data.subjectTemplate.length).toBeGreaterThan(0);
    expect(body.data.requiredVariables).toContain('firstName');
  });

  it('POST /admin/email-templates/TASK_ASSIGNED/send-test — noop modunda sent false', async () => {
    const prevMode = process.env.EMAIL_SENDING_MODE;
    process.env.EMAIL_SENDING_MODE = 'noop';
    const auth = await loginSuperadmin();
    const srv = app.getHttpAdapter().getInstance();
    const res = await srv.inject({
      method: 'POST',
      url: '/api/v1/admin/email-templates/TASK_ASSIGNED/send-test',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        'content-type': 'application/json',
        'x-csrf-token': auth.csrfToken,
        cookie: auth.cookie,
      },
      payload: JSON.stringify({ toEmail: 'test@example.com' }),
    });
    process.env.EMAIL_SENDING_MODE = prevMode;
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      data: { sent: boolean; mode: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.sent).toBe(false);
    expect(body.data.mode).toBe('noop');
  });
});
