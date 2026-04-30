'use client';

import Link from 'next/link';

import { Permission } from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
import { useConsentVersionsListQuery } from '@/lib/queries/admin-consent-versions';

export function ConsentVersionsPageClient() {
  const q = useConsentVersionsListQuery(true);

  return (
    <div className="space-y-[var(--space-6)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-neutral-900)]">Rıza metinleri</h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
            Taslakları düzenleyip yayınlayarak yürürlük tarihini belirleyebilirsiniz.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="ls-btn ls-btn--neutral ls-btn--sm inline-flex no-underline"
          >
            Yönetim özeti
          </Link>
          <PermissionGate permission={Permission.CONSENT_VERSION_EDIT}>
            <Link
              href="/admin/consent-versions/new"
              className="ls-btn ls-btn--primary ls-btn--sm inline-flex no-underline"
            >
              Yeni taslak
            </Link>
          </PermissionGate>
        </div>
      </div>

      {q.isPending ? (
        <p className="text-sm text-[var(--color-neutral-600)]">Yükleniyor…</p>
      ) : q.error ? (
        <p className="text-sm text-[var(--color-error-700)]">Liste yüklenemedi.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
              <tr>
                <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">Sürüm</th>
                <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">Durum</th>
                <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">Yürürlük</th>
                <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">
                  Onay sayısı
                </th>
                <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">Aktif</th>
                <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-neutral-100)]">
                  <td className="px-3 py-2 font-medium text-[var(--color-neutral-900)]">
                    {r.version}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-neutral-800)]">{r.status}</td>
                  <td className="px-3 py-2 text-[var(--color-neutral-800)]">
                    {r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleString('tr-TR') : '—'}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-neutral-800)]">
                    {r.acceptedUserCount}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-neutral-800)]">
                    {r.isActive ? 'Evet' : 'Hayır'}
                  </td>
                  <td className="px-3 py-2">
                    <PermissionGate permission={Permission.CONSENT_VERSION_VIEW}>
                      <Link
                        href={`/admin/consent-versions/${encodeURIComponent(r.id)}/edit`}
                        className="text-[var(--color-primary-600)] underline underline-offset-2"
                      >
                        Aç
                      </Link>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
