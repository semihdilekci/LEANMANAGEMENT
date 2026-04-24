'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Permission } from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
import { useDeactivateUserMutation, useUserListQuery } from '@/lib/queries/users';

export function UserList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cursor, setCursor] = useState<string | undefined>();

  const filters = {
    search: searchParams.get('search') ?? undefined,
    companyId: searchParams.get('companyId') ?? undefined,
    isActive: searchParams.get('isActive') ?? undefined,
    cursor,
    limit: 20,
  };

  const { data, isLoading, error, refetch } = useUserListQuery(filters);
  const deactivateMutation = useDeactivateUserMutation();

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy className="space-y-[var(--space-3)]">
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

  if (error) {
    return (
      <div role="alert" className="ls-alert ls-alert--error">
        <p>Kullanıcılar yüklenemedi.</p>
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm mt-[var(--space-2)]"
          onClick={() => void refetch()}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="py-[var(--space-12)] text-center text-[var(--color-neutral-500)]">
        <p className="text-lg font-medium">Kullanıcı bulunamadı</p>
        <p className="mt-[var(--space-1)] text-sm">
          Farklı filtreler deneyin veya yeni kullanıcı oluşturun.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)]">
        <table className="w-full text-sm" aria-label="Kullanıcı listesi">
          <thead className="bg-[var(--color-neutral-50)]">
            <tr>
              <th
                scope="col"
                className="px-[var(--space-4)] py-[var(--space-3)] text-left font-medium text-[var(--color-neutral-600)]"
              >
                Sicil
              </th>
              <th
                scope="col"
                className="px-[var(--space-4)] py-[var(--space-3)] text-left font-medium text-[var(--color-neutral-600)]"
              >
                Ad Soyad
              </th>
              <th
                scope="col"
                className="px-[var(--space-4)] py-[var(--space-3)] text-left font-medium text-[var(--color-neutral-600)]"
              >
                E-posta
              </th>
              <th
                scope="col"
                className="px-[var(--space-4)] py-[var(--space-3)] text-left font-medium text-[var(--color-neutral-600)]"
              >
                Şirket
              </th>
              <th
                scope="col"
                className="px-[var(--space-4)] py-[var(--space-3)] text-left font-medium text-[var(--color-neutral-600)]"
              >
                Durum
              </th>
              <th
                scope="col"
                className="px-[var(--space-4)] py-[var(--space-3)] text-right font-medium text-[var(--color-neutral-600)]"
              >
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-neutral-200)] bg-[var(--color-neutral-0)]">
            {data.items.map((user) => (
              <tr key={user.id} className="hover:bg-[var(--color-neutral-50)] transition-colors">
                <td className="px-[var(--space-4)] py-[var(--space-3)] font-mono text-[var(--color-neutral-700)]">
                  {user.sicil ?? '—'}
                </td>
                <td className="px-[var(--space-4)] py-[var(--space-3)]">
                  <Link
                    href={`/users/${user.id}`}
                    className="font-medium text-[var(--color-primary-700)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]"
                  >
                    {user.firstName} {user.lastName}
                  </Link>
                </td>
                <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-neutral-600)]">
                  {user.email ?? '—'}
                </td>
                <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-neutral-600)]">
                  {user.company.name}
                </td>
                <td className="px-[var(--space-4)] py-[var(--space-3)]">
                  <span
                    className={`inline-flex items-center gap-[var(--space-1)] rounded-full px-[var(--space-2)] py-0.5 text-xs font-medium ${
                      user.isActive
                        ? 'bg-[var(--color-success-100)] text-[var(--color-success-700)]'
                        : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
                    }`}
                    aria-label={user.isActive ? 'Aktif' : 'Pasif'}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-[var(--color-success-500)]' : 'bg-[var(--color-neutral-400)]'}`}
                      aria-hidden
                    />
                    {user.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-[var(--space-4)] py-[var(--space-3)] text-right">
                  <div className="flex items-center justify-end gap-[var(--space-2)]">
                    <button
                      type="button"
                      className="ls-btn ls-btn--neutral ls-btn--xs"
                      onClick={() => router.push(`/users/${user.id}`)}
                    >
                      Detay
                    </button>
                    <PermissionGate permission={Permission.USER_UPDATE_ATTRIBUTE}>
                      <button
                        type="button"
                        className="ls-btn ls-btn--neutral ls-btn--xs"
                        onClick={() => router.push(`/users/${user.id}/edit`)}
                      >
                        Düzenle
                      </button>
                    </PermissionGate>
                    {user.isActive && (
                      <PermissionGate permission={Permission.USER_DEACTIVATE}>
                        <button
                          type="button"
                          className="ls-btn ls-btn--danger ls-btn--xs"
                          disabled={deactivateMutation.isPending}
                          onClick={() => {
                            if (
                              !confirm('Bu kullanıcıyı pasif yapmak istediğinizden emin misiniz?')
                            )
                              return;
                            deactivateMutation.mutate(
                              { id: user.id, reason: 'Admin tarafından deaktive edildi' },
                              {
                                onSuccess: () => toast.success('Kullanıcı pasif yapıldı'),
                                onError: () => toast.error('İşlem başarısız'),
                              },
                            );
                          }}
                        >
                          Pasif yap
                        </button>
                      </PermissionGate>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-[var(--space-4)] flex items-center justify-between">
        <p className="text-sm text-[var(--color-neutral-500)]">
          {data.items.length} kayıt gösteriliyor
        </p>
        <div className="flex gap-[var(--space-2)]">
          {cursor && (
            <button
              type="button"
              className="ls-btn ls-btn--neutral ls-btn--sm"
              onClick={() => setCursor(undefined)}
            >
              Başa dön
            </button>
          )}
          {data.pagination.hasMore && (
            <button
              type="button"
              className="ls-btn ls-btn--primary ls-btn--sm"
              onClick={() => setCursor(data.pagination.nextCursor ?? undefined)}
            >
              Sonraki
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
