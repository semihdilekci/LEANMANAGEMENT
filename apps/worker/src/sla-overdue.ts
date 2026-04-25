import type { PrismaClient } from '@leanmgmt/prisma-client';

/**
 * `apps/api/src/tasks/task-sla.service.ts` ile aynı iş kuralı — kopya tut, drift önle.
 * SLA: aktif task + sla_due_at < now + henüz işaretlenmemiş → is_sla_overdue.
 */
export async function runSlaOverdueScan(prisma: PrismaClient): Promise<{ updated: number }> {
  const now = new Date();
  const r = await prisma.task.updateMany({
    where: {
      status: { in: ['PENDING', 'CLAIMED', 'IN_PROGRESS'] },
      slaDueAt: { not: null, lt: now },
      isSlaOverdue: false,
    },
    data: { isSlaOverdue: true },
  });

  console.log({ event: 'sla_overdue_scan', updated: r.count });
  return { updated: r.count };
}
