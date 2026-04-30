import { calendarDaysUntilPasswordExpiry } from '@leanmgmt/shared-utils/password-expiry-calendar';
import { describe, expect, it } from 'vitest';

describe('calendarDaysUntilPasswordExpiry', () => {
  it('returns 0 when expiry is today (UTC date)', () => {
    const now = new Date(Date.UTC(2026, 1, 5, 12, 0, 0));
    const iso = new Date(Date.UTC(2026, 1, 5, 23, 59)).toISOString();
    expect(calendarDaysUntilPasswordExpiry(iso, now)).toBe(0);
  });

  it('returns positive days for future expiry', () => {
    const now = new Date(Date.UTC(2026, 1, 5, 12, 0, 0));
    const future = new Date(Date.UTC(2026, 1, 12, 12, 0)).toISOString();
    expect(calendarDaysUntilPasswordExpiry(future, now)).toBe(7);
  });
});
