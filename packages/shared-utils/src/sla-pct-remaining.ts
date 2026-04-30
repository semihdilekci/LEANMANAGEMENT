/** `apps/web/src/lib/sla-badge-logic.ts` ile aynı pencere — drift önlemi */
const DEFAULT_WINDOW_MS = 72 * 3600 * 1000;

/**
 * SLA penceresi içinde kalan süre yüzdesi (100 = tam süre kaldı, 0 = süre doldu).
 * `baselineAtMs` yoksa `slaDueAtMs - 72h` kullanılır (FE default ile uyumlu).
 */
export function slaPctRemaining(
  nowMs: number,
  slaDueAtMs: number,
  baselineAtMs: number | null | undefined,
): number {
  const baseline =
    baselineAtMs != null && !Number.isNaN(baselineAtMs)
      ? baselineAtMs
      : slaDueAtMs - DEFAULT_WINDOW_MS;
  const total = Math.max(slaDueAtMs - baseline, 1);
  const remaining = slaDueAtMs - nowMs;
  return (remaining / total) * 100;
}
