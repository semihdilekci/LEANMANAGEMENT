import type { NotificationEventType, Prisma, PrismaClient } from '@leanmgmt/prisma-client';
import { slaPctRemaining } from '@leanmgmt/shared-utils';

const ACTIVE_STATUSES = ['PENDING', 'CLAIMED', 'IN_PROGRESS'] as const;

function defaultPreferenceChannels(): { inAppEnabled: boolean; emailEnabled: boolean } {
  return { inAppEnabled: true, emailEnabled: true };
}

async function isInAppEnabled(
  prisma: PrismaClient,
  userId: string,
  eventType: NotificationEventType,
): Promise<boolean> {
  const row = await prisma.notificationPreference.findUnique({
    where: { userId_eventType: { userId, eventType } },
  });
  if (!row) return defaultPreferenceChannels().inAppEnabled;
  return row.inAppEnabled;
}

async function isEmailEnabled(
  prisma: PrismaClient,
  userId: string,
  eventType: NotificationEventType,
): Promise<boolean> {
  const row = await prisma.notificationPreference.findUnique({
    where: { userId_eventType: { userId, eventType } },
  });
  if (!row) return defaultPreferenceChannels().emailEnabled;
  return row.emailEnabled;
}

function getKtiTaskStepLabel(stepKey: string): string {
  switch (stepKey) {
    case 'KTI_INITIATION':
      return 'Başlatma';
    case 'KTI_MANAGER_APPROVAL':
      return 'Yönetici Onay';
    case 'KTI_REVISION':
      return 'Revize';
    default:
      return 'Görev';
  }
}

export type SlaMonitorPipelineDeps = {
  enqueueNotificationEmail: (notificationId: string) => Promise<void>;
};

type CreateNotificationInput = {
  userId: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  linkUrl?: string | null;
  metadata?: Prisma.InputJsonValue;
};

async function createInAppIfEnabled(
  prisma: PrismaClient,
  input: CreateNotificationInput,
): Promise<void> {
  const ok = await isInAppEnabled(prisma, input.userId, input.eventType);
  if (!ok) return;
  await prisma.notification.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      channel: 'IN_APP',
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl ?? null,
      metadata: input.metadata ?? undefined,
      deliveryStatus: 'SENT',
      sentAt: new Date(),
    },
  });
}

async function createEmailPendingIfEnabled(
  prisma: PrismaClient,
  deps: SlaMonitorPipelineDeps,
  input: CreateNotificationInput,
): Promise<void> {
  const emailOn = await isEmailEnabled(prisma, input.userId, input.eventType);
  if (!emailOn) return;
  const tpl = await prisma.emailTemplate.findUnique({
    where: { eventType: input.eventType },
  });
  if (!tpl) return;
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      channel: 'EMAIL',
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl ?? null,
      metadata: input.metadata ?? undefined,
      deliveryStatus: 'PENDING',
      sentAt: new Date(),
    },
  });
  await deps.enqueueNotificationEmail(row.id);
}

async function createInAppAndEmailIfEnabled(
  prisma: PrismaClient,
  deps: SlaMonitorPipelineDeps,
  input: CreateNotificationInput,
): Promise<void> {
  await createInAppIfEnabled(prisma, input);
  await createEmailPendingIfEnabled(prisma, deps, input);
}

function resolveNotifyUserIds(task: {
  claimedByUserId: string | null;
  assignments: { userId: string | null }[];
}): string[] {
  if (task.claimedByUserId) return [task.claimedByUserId];
  const ids = task.assignments
    .map((a) => a.userId)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
  return [...new Set(ids)];
}

/** docs/01_DOMAIN_MODEL + Faz 6: sla_due_at geçti, aşım bayrağı */
export async function markOverdueTasks(prisma: PrismaClient): Promise<{ updated: number }> {
  const now = new Date();
  const r = await prisma.task.updateMany({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      slaDueAt: { not: null, lt: now },
      isSlaOverdue: false,
    },
    data: { isSlaOverdue: true },
  });
  return { updated: r.count };
}

async function notifySlaBreachesOnce(
  prisma: PrismaClient,
  deps: SlaMonitorPipelineDeps,
): Promise<number> {
  const now = new Date();
  const tasks = await prisma.task.findMany({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      slaDueAt: { not: null, lte: now },
      slaBreachSentAt: null,
    },
    include: {
      process: { select: { displayId: true } },
      assignments: { where: { userId: { not: null } }, select: { userId: true } },
    },
  });

  let count = 0;
  for (const task of tasks) {
    const userIds = resolveNotifyUserIds(task);
    if (userIds.length === 0) continue;
    const stepLabel = getKtiTaskStepLabel(task.stepKey);
    const displayId = task.process.displayId;
    for (const userId of userIds) {
      await createInAppAndEmailIfEnabled(prisma, deps, {
        userId,
        eventType: 'SLA_BREACH',
        title: 'SLA aşıldı',
        body: `[${displayId}] sürecindeki “${stepLabel}” görevinde SLA süresi doldu.`,
        linkUrl: `/tasks/${task.id}`,
        metadata: {
          processId: task.processId,
          taskId: task.id,
          displayId,
          taskTitle: stepLabel,
        },
      });
    }
    await prisma.task.update({
      where: { id: task.id },
      data: { slaBreachSentAt: now },
    });
    count += 1;
  }
  return count;
}

async function notifySlaWarningsOnce(
  prisma: PrismaClient,
  deps: SlaMonitorPipelineDeps,
): Promise<number> {
  const now = new Date();
  const nowMs = now.getTime();
  const tasks = await prisma.task.findMany({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      slaDueAt: { not: null, gt: now },
      slaWarningSentAt: null,
    },
    include: {
      process: { select: { displayId: true } },
      assignments: { where: { userId: { not: null } }, select: { userId: true } },
    },
  });

  let count = 0;
  for (const task of tasks) {
    const due = task.slaDueAt!;
    const pct = slaPctRemaining(nowMs, due.getTime(), task.createdAt.getTime());
    if (pct > 80) continue;

    const userIds = resolveNotifyUserIds(task);
    if (userIds.length === 0) continue;

    const stepLabel = getKtiTaskStepLabel(task.stepKey);
    const displayId = task.process.displayId;
    for (const userId of userIds) {
      await createInAppAndEmailIfEnabled(prisma, deps, {
        userId,
        eventType: 'SLA_WARNING',
        title: 'SLA uyarısı',
        body: `[${displayId}] sürecindeki “${stepLabel}” görevinde SLA süresine yaklaşılıyor.`,
        linkUrl: `/tasks/${task.id}`,
        metadata: {
          processId: task.processId,
          taskId: task.id,
          displayId,
          taskTitle: stepLabel,
        },
      });
    }
    await prisma.task.update({
      where: { id: task.id },
      data: { slaWarningSentAt: now },
    });
    count += 1;
  }
  return count;
}

/**
 * BullMQ `check-task-sla` job gövdesi — API pod’unda çalıştırılmaz (04 §11.1).
 */
export async function runSlaMonitorPipeline(
  prisma: PrismaClient,
  deps: SlaMonitorPipelineDeps,
): Promise<{
  overdueUpdated: number;
  breachNotified: number;
  warningNotified: number;
}> {
  const overdue = await markOverdueTasks(prisma);
  const breachNotified = await notifySlaBreachesOnce(prisma, deps);
  const warningNotified = await notifySlaWarningsOnce(prisma, deps);
  return {
    overdueUpdated: overdue.updated,
    breachNotified,
    warningNotified,
  };
}
