import { describe, expect, it } from 'vitest';

import { calendarDaysUntilPasswordExpiry } from './password-expiry-calendar.js';

describe('calendarDaysUntilPasswordExpiry', () => {
  it('aynı UTC günü için 0', () => {
    const ref = new Date(Date.UTC(2026, 3, 10, 15, 30, 0));
    const iso = new Date(Date.UTC(2026, 3, 10, 8, 0, 0)).toISOString();
    expect(calendarDaysUntilPasswordExpiry(iso, ref)).toBe(0);
  });

  it('gelecek için pozitif gün', () => {
    const ref = new Date(Date.UTC(2026, 3, 10, 12, 0, 0));
    const iso = new Date(Date.UTC(2026, 3, 17, 12, 0, 0)).toISOString();
    expect(calendarDaysUntilPasswordExpiry(iso, ref)).toBe(7);
  });
});
