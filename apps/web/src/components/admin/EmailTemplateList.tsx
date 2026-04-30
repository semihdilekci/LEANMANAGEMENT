'use client';

import Link from 'next/link';

import { Permission } from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
import { notificationEventLabel } from '@/lib/notification-ui';
import { useEmailTemplatesListQuery } from '@/lib/queries/email-templates';

export function EmailTemplateList() {
  const { data, isLoading, isError, refetch } = useEmailTemplatesListQuery();

  if (isLoading) {
    return (
      <div className="ls-card p-[var(--space-8)] shadow-[var(--shadow-md)]" role="status">
        <p className="text-[var(--color-neutral-600)]">Şablonlar yükleniyor…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="ls-card p-[var(--space-8)] shadow-[var(--shadow-md)]">
        <p className="text-[var(--color-danger-600)]">Liste yüklenemedi.</p>
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm mt-3"
          onClick={() => refetch()}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  return (
    <div className="ls-card overflow-hidden shadow-[var(--shadow-md)]">
      <div className="border-b border-[var(--color-neutral-200)] p-[var(--space-4)]">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-neutral-900)]">
          E-posta şablonları
        </h1>
        <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
          Bildirim olayları için konu ve gövde şablonlarını yönetin.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
              <th className="px-[var(--space-3)] py-[var(--space-3)] font-medium">Olay</th>
              <th className="px-[var(--space-3)] py-[var(--space-3)] font-medium">Konu (özet)</th>
              <th className="px-[var(--space-3)] py-[var(--space-3)] font-medium">Güncellendi</th>
              <th className="px-[var(--space-3)] py-[var(--space-3)] font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b border-[var(--color-neutral-100)]">
                <td className="px-[var(--space-3)] py-[var(--space-2)]">
                  <span className="font-medium text-[var(--color-neutral-900)]">
                    {notificationEventLabel(row.eventType)}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--color-neutral-500)]">
                    {row.eventType}
                  </span>
                </td>
                <td className="max-w-xs truncate px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-neutral-700)]">
                  {row.subjectTemplate}
                </td>
                <td className="whitespace-nowrap px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-neutral-600)]">
                  {new Date(row.updatedAt).toLocaleString('tr-TR')}
                </td>
                <td className="px-[var(--space-3)] py-[var(--space-2)]">
                  <PermissionGate permission={Permission.EMAIL_TEMPLATE_EDIT}>
                    <Link
                      href={`/admin/email-templates/${encodeURIComponent(row.eventType)}/edit`}
                      className="text-sm font-medium text-[var(--color-primary-600)] underline"
                    >
                      Düzenle
                    </Link>
                  </PermissionGate>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
