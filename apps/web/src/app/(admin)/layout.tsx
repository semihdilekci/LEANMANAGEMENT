'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { Permission } from '@leanmgmt/shared-types';

import { PageRouteCardMotion } from '@/components/layout/PageRouteCardMotion';
import { useAuthStore } from '@/stores/auth-store';

const ADMIN_ENTRY_ANY_OF: Permission[] = [
  Permission.AUDIT_LOG_VIEW,
  Permission.SYSTEM_SETTINGS_VIEW,
  Permission.SYSTEM_SETTINGS_EDIT,
  Permission.CONSENT_VERSION_VIEW,
  Permission.CONSENT_VERSION_EDIT,
  Permission.CONSENT_VERSION_PUBLISH,
  Permission.EMAIL_TEMPLATE_VIEW,
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);

  const allowed = useMemo(() => {
    const p = currentUser?.permissions;
    if (!p?.length) return false;
    return ADMIN_ENTRY_ANY_OF.some((perm) => p.includes(perm));
  }, [currentUser?.permissions]);

  useEffect(() => {
    if (!currentUser) return;
    if (!allowed) {
      router.replace('/dashboard');
    }
  }, [allowed, currentUser, router]);

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-neutral-50)]">
        <p className="text-sm text-[var(--color-neutral-600)]">Yükleniyor…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-neutral-50)]">
        <p className="text-sm text-[var(--color-neutral-600)]">Yönlendiriliyor…</p>
      </div>
    );
  }

  const p = currentUser.permissions ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-neutral-50)]">
      <header className="border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] px-[var(--space-6)] py-[var(--space-4)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-[var(--space-3)]">
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-4)]">
            <div className="flex items-center gap-[var(--space-3)]">
              <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-primary-700)]">
                Yönetim
              </span>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-[var(--color-primary-600)] underline decoration-[var(--color-primary-600)] underline-offset-2"
            >
              Uygulamaya dön
            </Link>
          </div>
          <nav
            aria-label="Yönetim menüsü"
            className="flex flex-wrap gap-x-[var(--space-4)] gap-y-2 text-sm"
          >
            <Link
              href="/admin"
              className="text-[var(--color-neutral-600)] hover:text-[var(--color-primary-600)]"
            >
              Özet
            </Link>
            {p.includes(Permission.AUDIT_LOG_VIEW) ? (
              <>
                <Link
                  href="/admin/audit-logs"
                  className="text-[var(--color-neutral-600)] hover:text-[var(--color-primary-600)]"
                >
                  Denetim
                </Link>
                <Link
                  href="/admin/audit-logs/chain-integrity"
                  className="text-[var(--color-neutral-600)] hover:text-[var(--color-primary-600)]"
                >
                  Zincir
                </Link>
              </>
            ) : null}
            {p.includes(Permission.SYSTEM_SETTINGS_VIEW) ||
            p.includes(Permission.SYSTEM_SETTINGS_EDIT) ? (
              <Link
                href="/admin/system-settings"
                className="text-[var(--color-neutral-600)] hover:text-[var(--color-primary-600)]"
              >
                Sistem ayarları
              </Link>
            ) : null}
            {p.includes(Permission.CONSENT_VERSION_VIEW) ||
            p.includes(Permission.CONSENT_VERSION_EDIT) ||
            p.includes(Permission.CONSENT_VERSION_PUBLISH) ? (
              <Link
                href="/admin/consent-versions"
                className="text-[var(--color-neutral-600)] hover:text-[var(--color-primary-600)]"
              >
                Rıza metinleri
              </Link>
            ) : null}
            {p.includes(Permission.EMAIL_TEMPLATE_VIEW) ? (
              <Link
                href="/admin/email-templates"
                className="text-[var(--color-neutral-600)] hover:text-[var(--color-primary-600)]"
              >
                E-posta şablonları
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-[var(--space-6)]" id="main-content">
        <PageRouteCardMotion>{children}</PageRouteCardMotion>
      </main>
    </div>
  );
}
