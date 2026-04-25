export type SlaBadgeVariant = 'ok' | 'warn' | 'critical' | 'overdue';

const DEFAULT_WINDOW_MS = 72 * 3600 * 1000;

/**
 * Katalog S-TASK-LIST: kalan sürenin toplam SLA penceresine oranı.
 * `slaBaselineAt` görev oluşturulduğu an (API: task.createdAt); pencere = due - baseline.
 */
export function getSlaBadgeVariant(
  nowMs: number,
  slaDueAtIso: string | null,
  slaBaselineAtIso: string | null,
  isSlaOverdue: boolean,
): SlaBadgeVariant {
  if (!slaDueAtIso) {
    return 'ok';
  }
  const due = Date.parse(slaDueAtIso);
  if (Number.isNaN(due)) {
    return 'ok';
  }
  if (isSlaOverdue || nowMs >= due) {
    return 'overdue';
  }
  const baseline = slaBaselineAtIso ? Date.parse(slaBaselineAtIso) : due - DEFAULT_WINDOW_MS;
  const total = Math.max(due - baseline, 1);
  const remaining = due - nowMs;
  const pctRemaining = (remaining / total) * 100;
  if (pctRemaining > 80) {
    return 'ok';
  }
  if (pctRemaining >= 20) {
    return 'warn';
  }
  return 'critical';
}
