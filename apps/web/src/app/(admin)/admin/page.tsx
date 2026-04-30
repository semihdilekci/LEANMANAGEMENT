'use client';

import Link from 'next/link';

import { Permission } from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
import { useAdminOrganizationSummaryQuery } from '@/lib/queries/admin-summary';

function AdminSummaryMetrics() {
  const { data, isLoading, isError, error, refetch } = useAdminOrganizationSummaryQuery();

  if (isLoading) {
    return (
      <div
        className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-4)]"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-[var(--color-neutral-600)]">Özet yükleniyor…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="rounded-[var(--radius-md)] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] p-[var(--space-4)]"
        role="alert"
      >
        <p className="text-sm text-[var(--color-neutral-800)]">
          Özet yüklenemedi.{' '}
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-[var(--color-primary-600)] underline underline-offset-2"
          >
            Tekrar dene
          </button>
        </p>
        {error && 'message' in error && (
          <p className="mt-1 text-xs text-[var(--color-neutral-600)]">{(error as Error).message}</p>
        )}
      </div>
    );
  }

  if (!data) return null;

  const items = [
    { label: 'Aktif kullanıcı', value: data.activeUserCount },
    { label: 'Açık süreç', value: data.openProcessCount },
    { label: 'SLA gecikmiş görev', value: data.overdueTaskCount },
  ] as const;

  return (
    <div
      className="grid gap-[var(--space-3)] sm:grid-cols-3"
      role="region"
      aria-label="Kurumsal özet sayıları"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] px-[var(--space-4)] py-[var(--space-3)]"
        >
          <p className="text-sm text-[var(--color-neutral-600)]">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-neutral-900)]">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function AdminHomePage() {
  return (
    <div className="space-y-[var(--space-6)]">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-neutral-900)]">Yönetim paneli</h1>
        <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
          Yetkiniz olan modüllere buradan erişebilirsiniz.
        </p>
      </div>
      <AdminSummaryMetrics />
      <ul className="grid gap-[var(--space-4)] sm:grid-cols-2">
        <PermissionGate permission={Permission.AUDIT_LOG_VIEW}>
          <li className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-4)]">
            <h2 className="font-medium text-[var(--color-neutral-900)]">Denetim kayıtları</h2>
            <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
              Liste, filtre ve dışa aktarma.
            </p>
            <Link
              href="/admin/audit-logs"
              className="mt-3 inline-block text-sm text-[var(--color-primary-600)] underline underline-offset-2"
            >
              Aç
            </Link>
          </li>
        </PermissionGate>
        <PermissionGate permission={Permission.AUDIT_LOG_VIEW}>
          <li className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-4)]">
            <h2 className="font-medium text-[var(--color-neutral-900)]">Zincir bütünlüğü</h2>
            <p className="mt-1 text-sm text-[var(--color-neutral-600)]">Özet ve anlık doğrulama.</p>
            <Link
              href="/admin/audit-logs/chain-integrity"
              className="mt-3 inline-block text-sm text-[var(--color-primary-600)] underline underline-offset-2"
            >
              Aç
            </Link>
          </li>
        </PermissionGate>
        <PermissionGate anyOf={[Permission.SYSTEM_SETTINGS_VIEW, Permission.SYSTEM_SETTINGS_EDIT]}>
          <li className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-4)]">
            <h2 className="font-medium text-[var(--color-neutral-900)]">Sistem ayarları</h2>
            <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
              Güvenlik ve oturum eşikleri.
            </p>
            <Link
              href="/admin/system-settings"
              className="mt-3 inline-block text-sm text-[var(--color-primary-600)] underline underline-offset-2"
            >
              Aç
            </Link>
          </li>
        </PermissionGate>
        <PermissionGate permission={Permission.CONSENT_VERSION_VIEW}>
          <li className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-4)]">
            <h2 className="font-medium text-[var(--color-neutral-900)]">Rıza metinleri</h2>
            <p className="mt-1 text-sm text-[var(--color-neutral-600)]">Sürüm listesi ve yayın.</p>
            <Link
              href="/admin/consent-versions"
              className="mt-3 inline-block text-sm text-[var(--color-primary-600)] underline underline-offset-2"
            >
              Aç
            </Link>
          </li>
        </PermissionGate>
        <PermissionGate permission={Permission.EMAIL_TEMPLATE_VIEW}>
          <li className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-4)]">
            <h2 className="font-medium text-[var(--color-neutral-900)]">E-posta şablonları</h2>
            <p className="mt-1 text-sm text-[var(--color-neutral-600)]">Bildirim e-postaları.</p>
            <Link
              href="/admin/email-templates"
              className="mt-3 inline-block text-sm text-[var(--color-primary-600)] underline underline-offset-2"
            >
              Aç
            </Link>
          </li>
        </PermissionGate>
      </ul>
    </div>
  );
}
