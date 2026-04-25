import { describe, expect, it } from 'vitest';

import { getSlaBadgeVariant } from '@/lib/sla-badge-logic';

describe('getSlaBadgeVariant', () => {
  const base = new Date('2026-04-01T00:00:00.000Z').getTime();

  it('isSlaOverdue true → overdue', () => {
    expect(
      getSlaBadgeVariant(base, '2026-04-10T00:00:00.000Z', '2026-04-01T00:00:00.000Z', true),
    ).toBe('overdue');
  });

  it('süre dolduysa overdue', () => {
    expect(
      getSlaBadgeVariant(base, '2026-03-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', false),
    ).toBe('overdue');
  });

  it('kalan %80 üstü → ok', () => {
    const start = new Date('2026-04-01T00:00:00.000Z').getTime();
    const due = new Date('2026-04-11T00:00:00.000Z').getTime();
    const now = start + 0.1 * (due - start);
    expect(
      getSlaBadgeVariant(now, new Date(due).toISOString(), new Date(start).toISOString(), false),
    ).toBe('ok');
  });

  it('kalan %20–80 → warn', () => {
    const start = new Date('2026-04-01T00:00:00.000Z').getTime();
    const due = new Date('2026-04-11T00:00:00.000Z').getTime();
    const now = start + 0.5 * (due - start);
    expect(
      getSlaBadgeVariant(now, new Date(due).toISOString(), new Date(start).toISOString(), false),
    ).toBe('warn');
  });

  it('kalan %20 altı → critical', () => {
    const start = new Date('2026-04-01T00:00:00.000Z').getTime();
    const due = new Date('2026-04-11T00:00:00.000Z').getTime();
    const now = start + 0.82 * (due - start);
    expect(
      getSlaBadgeVariant(now, new Date(due).toISOString(), new Date(start).toISOString(), false),
    ).toBe('critical');
  });
});
