import type { PrismaClient } from '@leanmgmt/prisma-client';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `IN_APP_NOTIFICATION_RETENTION_DAYS` önce env (worker deploy override), yoksa system_settings, yoksa 90.
 */
export async function resolveInAppNotificationRetentionDays(prisma: PrismaClient): Promise<number> {
  const envOverride = process.env.IN_APP_NOTIFICATION_RETENTION_DAYS;
  if (envOverride !== undefined && envOverride !== '') {
    const n = Number(envOverride);
    if (Number.isFinite(n) && n >= 1) {
      return Math.min(730, Math.max(1, Math.floor(n)));
    }
  }
  const row = await prisma.systemSetting.findUnique({
    where: { key: 'IN_APP_NOTIFICATION_RETENTION_DAYS' },
  });
  if (row && typeof row.value === 'number') {
    return row.value;
  }
  return 90;
}

/** docs/02 — in-app kanalı; e-posta bildirim satırlarına dokunulmaz */
export async function purgeStaleInAppNotifications(
  prisma: PrismaClient,
): Promise<{ deleted: number; retentionDays: number }> {
  const retentionDays = await resolveInAppNotificationRetentionDays(prisma);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const r = await prisma.notification.deleteMany({
    where: { channel: 'IN_APP', createdAt: { lt: cutoff } },
  });
  return { deleted: r.count, retentionDays };
}

/**
 * Gecelik retention; digest’ten ayrı (docs/04 cron idempotency).
 * Varsayılan 24 saat; test için `NOTIFICATION_RETENTION_CRON_INTERVAL_MS`.
 */
export function startInAppNotificationRetention(prisma: PrismaClient): () => Promise<void> {
  const intervalMs = Number(process.env.NOTIFICATION_RETENTION_CRON_INTERVAL_MS ?? DAY_MS);
  const safeMs = Number.isFinite(intervalMs) && intervalMs >= 60_000 ? intervalMs : DAY_MS;

  const tick = (): void => {
    void purgeStaleInAppNotifications(prisma).then((r) => {
      console.log(
        JSON.stringify({
          event: 'in_app_notification_retention',
          deleted: r.deleted,
          days: r.retentionDays,
        }),
      );
    });
  };

  tick();
  const id = setInterval(tick, safeMs);
  return async () => {
    clearInterval(id);
  };
}
