'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Permission } from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
import { useProcessesListQuery } from '@/lib/queries/processes';

function scopeFromSearch(searchParams: URLSearchParams): 'my-started' | 'admin' {
  const s = searchParams.get('scope');
  return s === 'admin' ? 'admin' : 'my-started';
}

export function ProcessList() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scope = scopeFromSearch(searchParams);
  const { data, isLoading, isError, error, refetch } = useProcessesListQuery({
    scope,
    limit: 50,
    sort: 'started_at_desc',
  });

  const setScope = (next: 'my-started' | 'admin') => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('scope', next);
    router.push(`/processes?${p.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-[var(--space-3)]" role="status" aria-live="polite">
        <span className="sr-only">Yükleniyor...</span>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="ls-alert ls-alert--danger" role="alert">
        <p>Süreçler yüklenemedi.</p>
        <p className="text-sm opacity-90">{(error as Error)?.message ?? 'Bilinmeyen hata'}</p>
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm mt-[var(--space-2)]"
          onClick={() => refetch()}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-[var(--space-6)]">
      <div className="flex flex-wrap items-center gap-[var(--space-2)] border-b border-[var(--color-neutral-200)] pb-[var(--space-3)]">
        <button
          type="button"
          className={`rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm font-medium ${
            scope === 'my-started'
              ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]'
              : 'text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]'
          }`}
          onClick={() => setScope('my-started')}
        >
          Başlattığım Süreçler
        </button>
        <PermissionGate permission={Permission.PROCESS_VIEW_ALL}>
          <button
            type="button"
            className={`rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm font-medium ${
              scope === 'admin'
                ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]'
                : 'text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]'
            }`}
            onClick={() => setScope('admin')}
          >
            Tüm Süreçler
          </button>
        </PermissionGate>
        <div className="ml-auto flex gap-[var(--space-2)]">
          <PermissionGate permission={Permission.PROCESS_KTI_START}>
            <Link href="/processes/kti/start" className="ls-btn ls-btn--primary ls-btn--sm">
              Yeni KTİ Başlat
            </Link>
          </PermissionGate>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="ls-card p-[var(--space-8)] text-center">
          <p className="text-[var(--color-neutral-700)]">
            {scope === 'my-started' ? 'Henüz süreç başlatmadınız.' : 'Listelenecek süreç yok.'}
          </p>
          <PermissionGate permission={Permission.PROCESS_KTI_START}>
            <Link
              href="/processes/kti/start"
              className="ls-btn ls-btn--primary mt-[var(--space-4)] inline-flex"
            >
              Yeni KTİ Başlat
            </Link>
          </PermissionGate>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[var(--color-neutral-50)] text-[var(--color-neutral-600)]">
              <tr>
                <th className="px-[var(--space-4)] py-[var(--space-3)] font-medium">Süreç</th>
                <th className="px-[var(--space-4)] py-[var(--space-3)] font-medium">Durum</th>
                <th className="px-[var(--space-4)] py-[var(--space-3)] font-medium">Aktif adım</th>
                <th className="px-[var(--space-4)] py-[var(--space-3)] font-medium">Başlangıç</th>
                <th className="px-[var(--space-4)] py-[var(--space-3)] font-medium">Şirket</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-[var(--color-neutral-100)]">
                  <td className="px-[var(--space-4)] py-[var(--space-3)]">
                    <Link
                      href={`/processes/${encodeURIComponent(row.displayId)}`}
                      className="font-mono font-medium text-[var(--color-primary-700)] hover:underline"
                    >
                      {row.displayId}
                    </Link>
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)]">{row.status}</td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-neutral-700)]">
                    {row.activeTaskLabel}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-neutral-600)]">
                    {new Date(row.startedAt).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-neutral-600)]">
                    {row.company.name}
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
