'use client';

import { getSlaBadgeVariant } from '@/lib/sla-badge-logic';

export interface SlaBadgeProps {
  slaDueAt: string | null;
  slaBaselineAt?: string | null;
  isSlaOverdue: boolean;
  /** Test / Storybook için */
  nowMs?: number;
}

function formatRemainingTurkish(ms: number): string {
  const rtf = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });
  if (ms <= 0) {
    const overdueMin = Math.ceil(-ms / 60_000);
    if (overdueMin < 90) {
      return rtf.format(-overdueMin, 'minute');
    }
    const overdueHours = Math.ceil(overdueMin / 60);
    return `${overdueHours} saat gecikti`;
  }
  const hours = ms / 3_600_000;
  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((ms - h * 3_600_000) / 60_000);
    return m > 0 ? `${h} saat ${m} dk kaldı` : rtf.format(h, 'hour');
  }
  const d = Math.round(hours / 24);
  return rtf.format(d, 'day');
}

export function SlaBadge({ slaDueAt, slaBaselineAt, isSlaOverdue, nowMs }: SlaBadgeProps) {
  if (!slaDueAt) {
    return <span className="text-xs text-[var(--color-neutral-500)]">SLA yok</span>;
  }
  const now = nowMs ?? Date.now();
  const due = Date.parse(slaDueAt);
  const variant = getSlaBadgeVariant(now, slaDueAt, slaBaselineAt ?? null, isSlaOverdue);
  const remainingMs = due - now;
  const label = formatRemainingTurkish(remainingMs);

  const cls =
    variant === 'ok'
      ? 'bg-[var(--color-success-100)] text-[var(--color-success-800)]'
      : variant === 'warn'
        ? 'bg-[var(--color-warning-100)] text-[var(--color-warning-900)]'
        : variant === 'critical'
          ? 'bg-[var(--color-warning-200)] text-[var(--color-neutral-900)]'
          : 'bg-[var(--color-error-100)] text-[var(--color-error-800)]';

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
