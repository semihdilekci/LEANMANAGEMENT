'use client';

import { calendarDaysUntilPasswordExpiry } from '@leanmgmt/shared-utils/password-expiry-calendar';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export { calendarDaysUntilPasswordExpiry };

type Props = {
  expiresAt: string | null | undefined;
};

/**
 * Roadmap: 14 gün sarı, 3 gün kırmızı — `docs/05_FRONTEND_SPEC.md` §16.3 ile uyumlu.
 * `expiresAt` yoksa veya 14 günden uzaksa render yok.
 */
export function PasswordExpiryBanner({ expiresAt }: Props) {
  if (!expiresAt) return null;
  const days = calendarDaysUntilPasswordExpiry(expiresAt, new Date());
  if (days > 14) return null;

  const urgent = days <= 3;
  const className = urgent
    ? 'bg-[var(--color-danger)] text-[var(--color-fg-inverse)]'
    : 'bg-[var(--color-primary-200)] text-[var(--color-primary-900)]';

  const message =
    days < 0
      ? 'Şifre süreniz doldu. Hesabınızı kullanmaya devam etmek için şifrenizi güncelleyin.'
      : days === 0
        ? 'Şifrenizin süresi bugün doluyor.'
        : `Şifrenizin süresi ${days} gün içinde dolacak.`;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center justify-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)] text-sm ${className}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
      <Link
        href="/profile/change-password"
        className={`font-medium underline underline-offset-2 ${urgent ? 'text-[var(--color-fg-inverse)]' : 'text-[var(--color-primary-900)]'}`}
      >
        Şimdi değiştir
      </Link>
    </div>
  );
}
