import { describe, expect, it, vi } from 'vitest';

import {
  defaultPreferenceChannels,
  NotificationPreferencesService,
} from './notification-preferences.service.js';

describe('defaultPreferenceChannels', () => {
  it('digest varsayılan kapalı, kanallar açık', () => {
    const d = defaultPreferenceChannels();
    expect(d.digestEnabled).toBe(false);
    expect(d.inAppEnabled).toBe(true);
    expect(d.emailEnabled).toBe(true);
  });
});

describe('NotificationPreferencesService', () => {
  it('getResolvedForUser satır yoksa varsayılanları döner', async () => {
    const prisma = {
      notificationPreference: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as import('../prisma/prisma.service.js').PrismaService;

    const svc = new NotificationPreferencesService(prisma);
    const r = await svc.getResolvedForUser('user-1');
    expect(r.preferences.length).toBeGreaterThan(10);
    const ta = r.preferences.find((p) => p.eventType === 'TASK_ASSIGNED');
    expect(ta?.inAppEnabled).toBe(true);
    expect(ta?.emailEnabled).toBe(true);
  });
});
