import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@leanmgmt/prisma-client';

import { runNotificationEmailJob } from './notification-email.processor.js';

function makeJob(data: { notificationId: string }): Job {
  return {
    data,
    opts: { attempts: 3 },
    attemptsMade: 1,
  } as unknown as Job;
}

describe('runNotificationEmailJob', () => {
  it('bildirim yoksa güncelleme yapmaz', async () => {
    const update = vi.fn();
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue(null),
        update,
      },
    } as unknown as PrismaClient;
    await runNotificationEmailJob(prisma, makeJob({ notificationId: 'missing' }));
    expect(update).not.toHaveBeenCalled();
  });

  it('pasif kullanıcıda FAILED yazar', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'n1',
          channel: 'EMAIL',
          deliveryStatus: 'PENDING',
          userId: 'u1',
          eventType: 'TASK_ASSIGNED',
          metadata: {},
        }),
        update,
      },
      emailTemplate: {
        findUnique: vi.fn().mockResolvedValue({
          subjectTemplate: 'S',
          htmlBodyTemplate: '<p>x</p>',
          textBodyTemplate: 'x',
        }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          isActive: false,
          firstName: 'X',
          emailEncrypted: new Uint8Array(1),
        }),
      },
    } as unknown as PrismaClient;

    await runNotificationEmailJob(prisma, makeJob({ notificationId: 'n1' }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n1' },
        data: expect.objectContaining({ deliveryStatus: 'FAILED' }),
      }),
    );
  });
});
