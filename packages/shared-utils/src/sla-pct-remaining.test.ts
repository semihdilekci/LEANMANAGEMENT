import { describe, expect, it } from 'vitest';

import { slaPctRemaining } from './sla-pct-remaining.js';

describe('slaPctRemaining', () => {
  it('baseline ile kalan yüzde hesaplanır', () => {
    const baseline = Date.parse('2026-01-01T00:00:00.000Z');
    const due = Date.parse('2026-01-04T00:00:00.000Z');
    const now = Date.parse('2026-01-03T00:00:00.000Z');
    const pct = slaPctRemaining(now, due, baseline);
    expect(pct).toBeGreaterThan(30);
    expect(pct).toBeLessThan(40);
  });

  it('baseline yoksa 72h penceresi kullanılır', () => {
    const due = Date.parse('2026-01-04T12:00:00.000Z');
    const now = Date.parse('2026-01-04T06:00:00.000Z');
    const pct = slaPctRemaining(now, due, null);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
});
