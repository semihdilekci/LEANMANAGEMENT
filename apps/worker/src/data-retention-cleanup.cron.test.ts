import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@leanmgmt/prisma-client';

import { purgeStaleInAppNotifications } from './data-retention-cleanup.cron.js';

describe('purgeStaleInAppNotifications', () => {
  it('system_settings gün değerine göre in-app siler', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const prisma = {
      notification: { deleteMany },
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 90 }),
      },
    } as unknown as PrismaClient;
    const r = await purgeStaleInAppNotifications(prisma);
    expect(r.deleted).toBe(3);
    expect(r.retentionDays).toBe(90);
    expect(deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          channel: 'IN_APP',
          createdAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });
});
