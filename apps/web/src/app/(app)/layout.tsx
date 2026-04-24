'use client';

import Link from 'next/link';

import { Permission } from '@leanmgmt/shared-types';

import { ConsentBlockingDialog } from '@/components/auth/consent-blocking-dialog';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { logoutRequest } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.currentUser);
  const needConsent = Boolean(user?.activeConsentVersionId && !user.consentAccepted);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-neutral-50)]">
      <header className="border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] px-[var(--space-6)] py-[var(--space-4)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-6)]">
            <Link
              href="/dashboard"
              className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-primary-700)]"
            >
              Lean Management
            </Link>
            {user && !needConsent ? (
              <nav
                aria-label="Ana menü"
                className="hidden items-center gap-[var(--space-4)] md:flex"
              >
                <Link
                  href="/dashboard"
                  className="text-sm text-[var(--color-neutral-600)] hover:text-[var(--color-primary-600)]"
                >
                  Ana Sayfa
                </Link>
                <PermissionGate permission={Permission.USER_LIST_VIEW}>
                  <Link
                    href="/users"
                    className="text-sm text-[var(--color-neutral-600)] hover:text-[var(--color-primary-600)]"
                  >
                    Kullanıcılar
                  </Link>
                </PermissionGate>
                <PermissionGate
                  anyOf={[Permission.MASTER_DATA_VIEW, Permission.MASTER_DATA_MANAGE]}
                >
                  <Link
                    href="/master-data"
                    className="text-sm text-[var(--color-neutral-600)] hover:text-[var(--color-primary-600)]"
                  >
                    Master Data
                  </Link>
                </PermissionGate>
                <PermissionGate permission={Permission.ROLE_VIEW}>
                  <Link
                    href="/roles"
                    className="text-sm text-[var(--color-neutral-600)] hover:text-[var(--color-primary-600)]"
                  >
                    Roller
                  </Link>
                </PermissionGate>
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-[var(--space-4)]">
            {user && !needConsent ? (
              <span className="text-sm text-[var(--color-neutral-700)]">
                {user.firstName} {user.lastName}
              </span>
            ) : null}
            <button
              type="button"
              className="ls-btn ls-btn--neutral ls-btn--sm"
              onClick={() =>
                void logoutRequest().then(() => {
                  window.location.href = '/login';
                })
              }
            >
              Çıkış
            </button>
            {user && !needConsent ? (
              <Link
                href="/profile/change-password"
                className="text-sm text-[var(--color-primary-600)] underline decoration-[var(--color-primary-600)] underline-offset-2"
              >
                Şifre değiştir
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      <main
        className={`mx-auto w-full max-w-6xl flex-1 p-[var(--space-6)] ${needConsent ? 'pointer-events-none select-none opacity-30' : ''}`}
        id="main-content"
        aria-hidden={needConsent}
      >
        {children}
      </main>
      {user && needConsent ? <ConsentBlockingDialog user={user} open={needConsent} /> : null}
    </div>
  );
}
