import { describe, expect, it, vi } from 'vitest';

import {
  CONSENT_PUBLISH_MIN_LEAD_MS,
  datetimeLocalToIsoUtc,
  isEffectiveFromPublishValid,
  minEffectiveFromIsoForPublish,
} from '@/lib/consent-publish-ui';

describe('consent-publish-ui', () => {
  it('minEffectiveFromIsoForPublish en az 60 sn ileri ISO döner', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00.000Z'));
    const minIso = minEffectiveFromIsoForPublish(Date.now());
    const delta = new Date(minIso).getTime() - Date.now();
    expect(delta).toBeGreaterThanOrEqual(CONSENT_PUBLISH_MIN_LEAD_MS - 5);
    vi.useRealTimers();
  });

  it('isEffectiveFromPublishValid eşik altını reddeder', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00.000Z'));
    const now = Date.now();
    const tooSoon = new Date(now + 30_000).toISOString();
    expect(isEffectiveFromPublishValid(tooSoon, now)).toBe(false);
    const ok = new Date(now + 90_000).toISOString();
    expect(isEffectiveFromPublishValid(ok, now)).toBe(true);
    vi.useRealTimers();
  });

  it('datetimeLocalToIsoUtc yerel datetime-local değerini ISOya çevirir', () => {
    const iso = datetimeLocalToIsoUtc('2026-06-15T14:30');
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
