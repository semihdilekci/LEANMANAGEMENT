import { createHash } from 'node:crypto';

import { AssignmentMode, PrismaClient } from '@leanmgmt/prisma-client';

/**
 * Playwright E2E sunucusu (e2e-serve) ayağa kalkarken: seed yöneticiye rıza + bekleyen KTİ onay görevi.
 * Gerçek KTİ başlatma / doküman zinciri olmadan yönetici onay journey’sini test eder.
 */
export async function runE2ePlaywrightSeed(prisma: PrismaClient): Promise<void> {
  const pepperHex = process.env.APP_PII_PEPPER;
  if (!pepperHex) {
    throw new Error('APP_PII_PEPPER eksik — e2e seed atlanamaz');
  }

  const superadmin = await prisma.user.findFirst({
    where: { firstName: 'Super', lastName: 'Admin' },
  });
  const manager = await prisma.user.findFirst({
    where: { firstName: 'Seed', lastName: 'Manager' },
  });
  if (!superadmin || !manager) {
    console.warn('[e2e-playwright-seed] superadmin veya seed manager yok, atlanıyor');
    return;
  }

  const cv = await prisma.consentVersion.findFirst({ where: { status: 'PUBLISHED' } });
  if (cv) {
    const existing = await prisma.userConsent.findUnique({
      where: { userId_consentVersionId: { userId: manager.id, consentVersionId: cv.id } },
    });
    if (!existing) {
      const sig = createHash('sha256').update(`${manager.id}:${cv.id}:${pepperHex}`).digest('hex');
      await prisma.userConsent.create({
        data: {
          userId: manager.id,
          consentVersionId: cv.id,
          ipHash: createHash('sha256').update('e2e-seed').digest('hex'),
          userAgent: 'e2e-playwright-seed',
          signature: sig,
        },
      });
    }
  }

  const existingTask = await prisma.task.findFirst({
    where: {
      stepKey: 'KTI_MANAGER_APPROVAL',
      status: { in: ['PENDING', 'CLAIMED', 'IN_PROGRESS'] },
      assignments: { some: { userId: manager.id, status: 'PENDING' } },
    },
  });
  if (existingTask) {
    return;
  }

  const rows = await prisma.$queryRaw<[{ n: bigint }]>`
    SELECT nextval('process_seq_before_after_kaizen') AS n
  `;
  const n = rows[0].n;
  const displayId = `KTI-${String(n).padStart(6, '0')}`;
  const proc = await prisma.process.create({
    data: {
      processNumber: BigInt(n),
      processType: 'BEFORE_AFTER_KAIZEN',
      displayId,
      startedByUserId: superadmin.id,
      companyId: superadmin.companyId,
      status: 'IN_PROGRESS',
    },
  });
  const slaDueAt = new Date(Date.now() + 72 * 3600 * 1000);
  const t = await prisma.task.create({
    data: {
      processId: proc.id,
      stepKey: 'KTI_MANAGER_APPROVAL',
      stepOrder: 2,
      assignmentMode: AssignmentMode.SINGLE,
      status: 'PENDING',
      slaDueAt,
    },
  });
  await prisma.taskAssignment.create({
    data: { taskId: t.id, userId: manager.id, status: 'PENDING', resolvedByRule: true },
  });
  console.log('[e2e-playwright-seed] bekleyen yönetici görevi:', t.id, displayId);
}
