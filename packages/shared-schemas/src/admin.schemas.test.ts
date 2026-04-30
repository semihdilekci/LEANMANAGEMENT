import { describe, it, expect, vi, afterEach } from 'vitest';

import { AdminConsentVersionPublishBodySchema, parseSystemSettingValue } from './admin.schemas.js';

describe('parseSystemSettingValue', () => {
  it('number keys için sınır kabul eder', () => {
    expect(parseSystemSettingValue('LOGIN_ATTEMPT_THRESHOLD', 5)).toBe(5);
  });

  it('SUPERADMIN_IP_WHITELIST dizi doğrular', () => {
    expect(parseSystemSettingValue('SUPERADMIN_IP_WHITELIST', ['203.0.113.0/24'])).toEqual([
      '203.0.113.0/24',
    ]);
  });

  it('ACTIVE_CONSENT_VERSION_ID null kabul eder', () => {
    expect(parseSystemSettingValue('ACTIVE_CONSENT_VERSION_ID', null)).toBeNull();
  });

  it('IN_APP_NOTIFICATION_RETENTION_DAYS 7–730 gün', () => {
    expect(parseSystemSettingValue('IN_APP_NOTIFICATION_RETENTION_DAYS', 90)).toBe(90);
  });
});

describe('AdminConsentVersionPublishBodySchema', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('effectiveFrom en az now+1dk kabul eder', () => {
    vi.useFakeTimers({ now: new Date('2026-05-01T12:00:00.000Z') });
    const ok = AdminConsentVersionPublishBodySchema.safeParse({
      effectiveFrom: '2026-05-01T12:02:00.000Z',
    });
    expect(ok.success).toBe(true);
  });

  it('effectiveFrom çok yakınsa reddeder', () => {
    vi.useFakeTimers({ now: new Date('2026-05-01T12:00:00.000Z') });
    const bad = AdminConsentVersionPublishBodySchema.safeParse({
      effectiveFrom: '2026-05-01T12:00:30.000Z',
    });
    expect(bad.success).toBe(false);
  });
});
