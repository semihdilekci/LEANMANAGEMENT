import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@leanmgmt/prisma-client';

import { purgeStaleInAppNotifications } from './notification-digest-cleanup.js';

describe('purgeStaleInAppNotifications', () => {
  it('90 günden eski in-app kayıtları siler', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const prisma = { notification: { deleteMany } } as unknown as PrismaClient;
    const r = await purgeStaleInAppNotifications(prisma);
    expect(r.deleted).toBe(3);
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
