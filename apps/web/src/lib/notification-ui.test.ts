import { describe, expect, it, vi } from 'vitest';

import { formatNotificationRelativeTime, notificationEventLabel } from './notification-ui';

describe('notification-ui', () => {
  it('notificationEventLabel bilinen tipleri Türkçe döner', () => {
    expect(notificationEventLabel('TASK_ASSIGNED')).toBe('Görev atandı');
  });

  it('formatNotificationRelativeTime yakın zaman için metin döner', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T12:00:00Z'));
    const iso = new Date('2026-04-25T11:30:00Z').toISOString();
    expect(formatNotificationRelativeTime(iso)).toMatch(/dk önce|Az önce/);
    vi.useRealTimers();
  });
});
