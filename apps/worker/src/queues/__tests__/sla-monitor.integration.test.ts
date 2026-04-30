import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { AssignmentMode, PrismaClient } from '@leanmgmt/prisma-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { runSlaMonitorPipeline } from '../../sla-monitor.pipeline.js';

const PII_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const PII_PEPPER = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, '../../../../api');

let pg: StartedPostgreSqlContainer;
let prisma: PrismaClient;

beforeAll(async () => {
  pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  const databaseUrl = pg.getConnectionUri();
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    APP_PII_ENCRYPTION_KEY: PII_KEY,
    APP_PII_PEPPER: PII_PEPPER,
  };
  execSync('pnpm exec prisma migrate deploy', { cwd: apiDir, stdio: 'inherit', env });
  execSync('pnpm exec prisma db seed', { cwd: apiDir, stdio: 'inherit', env });
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  await prisma.$connect();
}, 180_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (pg) await pg.stop();
});

describe('sla-monitor pipeline (integration)', () => {
  it('zamanı ileri sarılmış görevde %80 eşiğinde SLA_WARNING üretir', async () => {
    const u = await prisma.user.findFirst({ where: { firstName: 'Seed', lastName: 'Manager' } });
    if (!u) throw new Error('seed manager yok');
    const nowMs = Date.now();
    const due = new Date(nowMs + 2 * 3600 * 1000);
    const created = new Date(nowMs - 200 * 3600 * 1000);
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
        slaDueAt: due,
        slaWarningSentAt: null,
        createdAt: created,
      },
    });
    await prisma.taskAssignment.create({
      data: { taskId: t.id, userId: u.id, status: 'PENDING', resolvedByRule: true },
    });

    const r = await runSlaMonitorPipeline(prisma, {
      enqueueNotificationEmail: async () => {},
    });
    expect(r.warningNotified).toBeGreaterThanOrEqual(1);

    const nRow = await prisma.notification.findFirst({
      where: { userId: u.id, eventType: 'SLA_WARNING', channel: 'IN_APP' },
      orderBy: { createdAt: 'desc' },
    });
    expect(nRow).not.toBeNull();
    expect(nRow?.metadata).toEqual(expect.objectContaining({ taskId: t.id, displayId }));

    const t2 = await prisma.task.findUnique({ where: { id: t.id } });
    expect(t2?.slaWarningSentAt).not.toBeNull();
  });
});
