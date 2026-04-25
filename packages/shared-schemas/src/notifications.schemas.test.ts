import { describe, expect, it } from 'vitest';

import {
  NotificationListQuerySchema,
  NotificationPreferencesPutSchema,
} from './notifications.schemas.js';

describe('NotificationListQuerySchema', () => {
  it('varsayılanları uygular', () => {
    const q = NotificationListQuerySchema.parse({});
    expect(q.channel).toBe('IN_APP');
    expect(q.isRead).toBe('all');
    expect(q.limit).toBe(20);
  });

  it('bilinmeyen query alanını reddeder', () => {
    expect(() => NotificationListQuerySchema.parse({ foo: 'x' })).toThrow();
  });
});

describe('NotificationPreferencesPutSchema', () => {
  it('geçerli tercih listesini kabul eder', () => {
    const v = NotificationPreferencesPutSchema.parse({
      preferences: [
        {
          eventType: 'TASK_ASSIGNED',
          inAppEnabled: true,
          emailEnabled: false,
          digestEnabled: false,
        },
      ],
    });
    expect(v.preferences[0]?.emailEnabled).toBe(false);
  });
});
