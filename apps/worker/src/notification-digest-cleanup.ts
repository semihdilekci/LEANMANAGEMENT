import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { PrismaClient } from '@leanmgmt/prisma-client';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Son 24 saatteki in-app özetini DAILY_DIGEST e-postası olarak kuyruklar */
export async function runDailyDigest(prisma: PrismaClient): Promise<{ enqueued: number }> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { enqueued: 0 };
  }

  const template = await prisma.emailTemplate.findUnique({ where: { eventType: 'DAILY_DIGEST' } });
  if (!template) {
    return { enqueued: 0 };
  }

  const queueName = process.env.NOTIFICATION_EMAIL_QUEUE_NAME ?? 'notification-email-outbound';
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue<{ notificationId: string }>(queueName, { connection });

  let enqueued = 0;
  try {
    const prefs = await prisma.notificationPreference.findMany({
      where: { eventType: 'DAILY_DIGEST', digestEnabled: true, emailEnabled: true },
      select: { userId: true },
    });
    const userIds = [...new Set(prefs.map((p) => p.userId))];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const digestDate = new Date().toLocaleDateString('tr-TR');

    for (const userId of userIds) {
      const items = await prisma.notification.findMany({
        where: { userId, channel: 'IN_APP', createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { title: true, body: true },
      });
      if (items.length === 0) continue;

      const digestBodyHtml = `<ul>${items
        .map((i) => `<li><strong>${escapeHtml(i.title)}</strong> — ${escapeHtml(i.body)}</li>`)
        .join('')}</ul>`;
      const digestBodyText = items.map((i) => `- ${i.title}: ${i.body}`).join('\n');

      const row = await prisma.notification.create({
        data: {
          userId,
          eventType: 'DAILY_DIGEST',
          channel: 'EMAIL',
          title: `Günlük özet — ${digestDate}`,
          body: digestBodyText.slice(0, 5000),
          linkUrl: null,
          metadata: {
            digestDate,
            digestBodyHtml,
            digestBodyText,
          },
          deliveryStatus: 'PENDING',
          sentAt: new Date(),
        },
      });

      await queue.add(
        'send-notification-email',
        { notificationId: row.id },
        {
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
      enqueued += 1;
    }
  } finally {
    await queue.close();
    await connection.quit();
  }

  return { enqueued };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Günlük digest — interval varsayılan 24 saat (in-app retention: `data-retention-cleanup.cron`).
 */
export function startNotificationDigestAndCleanup(prisma: PrismaClient): () => Promise<void> {
  const intervalMs = Number(process.env.NOTIFICATION_CRON_INTERVAL_MS ?? DAY_MS);
  const safeMs = Number.isFinite(intervalMs) && intervalMs >= 60_000 ? intervalMs : DAY_MS;

  const tick = (): void => {
    void runDailyDigest(prisma).then((r) => {
      console.log({ event: 'digest_run', enqueued: r.enqueued });
    });
  };

  tick();
  const id = setInterval(tick, safeMs);
  return async () => {
    clearInterval(id);
  };
}
