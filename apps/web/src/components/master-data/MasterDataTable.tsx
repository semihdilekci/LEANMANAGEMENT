'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Permission } from '@leanmgmt/shared-types';
import type { MasterDataType } from '@leanmgmt/shared-schemas';

import { PermissionGate } from '@/components/shared/PermissionGate';
import {
  useDeactivateMasterDataMutation,
  useMasterDataListQuery,
  useReactivateMasterDataMutation,
  type MasterDataListFilters,
} from '@/lib/queries/master-data';

interface MasterDataTableProps {
  type: MasterDataType;
  filters?: MasterDataListFilters;
}

export function MasterDataTable({ type, filters = {} }: MasterDataTableProps) {
  const router = useRouter();

  const { data, isLoading, error, refetch } = useMasterDataListQuery(type, filters);

  const deactivateMutation = useDeactivateMasterDataMutation(type);
  const reactivateMutation = useReactivateMasterDataMutation(type);

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy className="space-y-[var(--space-3)]">
        <span className="sr-only">Yükleniyor...</span>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="ls-alert ls-alert--error">
        <p>Veriler yüklenemedi.</p>
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

  const items = data?.items ?? [];

  if (!items.length) {
    return (
      <div className="py-[var(--space-12)] text-center text-[var(--color-neutral-500)]">
        <p className="text-lg font-medium">Kayıt bulunamadı</p>
        <p className="mt-[var(--space-1)] text-sm">
          Farklı filtreler deneyin veya yeni kayıt ekleyin.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)]">
        <table className="w-full text-sm" aria-label="Master data listesi">
          <thead className="bg-[var(--color-neutral-50)]">
            <tr>
              <th
                scope="col"
                className="px-[var(--space-4)] py-[var(--space-3)] text-left font-medium text-[var(--color-neutral-600)]"
              >
                Kod
              </th>
              <th
                scope="col"
                className="px-[var(--space-4)] py-[var(--space-3)] text-left font-medium text-[var(--color-neutral-600)]"
              >
                Ad
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
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-[var(--color-neutral-50)] transition-colors">
                <td className="px-[var(--space-4)] py-[var(--space-3)] font-mono text-[var(--color-neutral-700)]">
                  {item.code}
                </td>
                <td className="px-[var(--space-4)] py-[var(--space-3)] font-medium text-[var(--color-neutral-800)]">
                  {item.name}
                </td>
                <td className="px-[var(--space-4)] py-[var(--space-3)]">
                  <span
                    className={`inline-flex items-center gap-[var(--space-1)] rounded-full px-[var(--space-2)] py-0.5 text-xs font-medium ${
                      item.isActive
                        ? 'bg-[var(--color-success-100)] text-[var(--color-success-700)]'
                        : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${item.isActive ? 'bg-[var(--color-success-500)]' : 'bg-[var(--color-neutral-400)]'}`}
                      aria-hidden
                    />
                    {item.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-[var(--space-4)] py-[var(--space-3)] text-right">
                  <div className="flex items-center justify-end gap-[var(--space-2)]">
                    <button
                      type="button"
                      className="ls-btn ls-btn--neutral ls-btn--xs"
                      onClick={() => router.push(`/master-data/${type}/${item.id}`)}
                    >
                      Detay
                    </button>
                    {item.isActive ? (
                      <PermissionGate permission={Permission.MASTER_DATA_MANAGE}>
                        <button
                          type="button"
                          className="ls-btn ls-btn--danger ls-btn--xs"
                          disabled={deactivateMutation.isPending}
                          onClick={() => {
                            if (!confirm('Bu kaydı pasif yapmak istediğinizden emin misiniz?'))
                              return;
                            deactivateMutation.mutate(item.id, {
                              onSuccess: () => toast.success('Kayıt pasif yapıldı'),
                              onError: () =>
                                toast.error('İşlem başarısız. Kayıt kullanımda olabilir.'),
                            });
                          }}
                        >
                          Pasif yap
                        </button>
                      </PermissionGate>
                    ) : (
                      <PermissionGate permission={Permission.MASTER_DATA_MANAGE}>
                        <button
                          type="button"
                          className="ls-btn ls-btn--primary ls-btn--xs"
                          disabled={reactivateMutation.isPending}
                          onClick={() => {
                            reactivateMutation.mutate(item.id, {
                              onSuccess: () => toast.success('Kayıt aktif yapıldı'),
                              onError: () => toast.error('İşlem başarısız'),
                            });
                          }}
                        >
                          Aktif yap
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

      <p className="mt-[var(--space-4)] text-sm text-[var(--color-neutral-500)]">
        {items.length} kayıt gösteriliyor
      </p>
    </div>
  );
}
