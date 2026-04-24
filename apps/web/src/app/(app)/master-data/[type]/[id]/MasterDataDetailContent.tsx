'use client';

import Link from 'next/link';
import { toast } from 'sonner';

import { Permission } from '@leanmgmt/shared-types';
import type { MasterDataType } from '@leanmgmt/shared-schemas';

import { PermissionGate } from '@/components/shared/PermissionGate';
import {
  useDeactivateMasterDataMutation,
  useMasterDataDetailQuery,
  useReactivateMasterDataMutation,
  MASTER_DATA_TYPE_LABELS,
} from '@/lib/queries/master-data';

interface MasterDataDetailContentProps {
  type: MasterDataType;
  id: string;
}

export function MasterDataDetailContent({ type, id }: MasterDataDetailContentProps) {
  const { data: item, isLoading, error, refetch } = useMasterDataDetailQuery(type, id);
  const deactivateMutation = useDeactivateMasterDataMutation(type);
  const reactivateMutation = useReactivateMasterDataMutation(type);

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy className="space-y-[var(--space-4)]">
        <span className="sr-only">Yükleniyor...</span>
        <div className="h-10 w-64 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]" />
        <div className="ls-card h-32 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="ls-alert ls-alert--error">
        <p>Kayıt yüklenemedi.</p>
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

  if (!item) {
    return (
      <div role="alert" className="ls-alert ls-alert--error">
        Kayıt bulunamadı.
      </div>
    );
  }

  const typeName = MASTER_DATA_TYPE_LABELS[type] ?? type;

  return (
    <div className="space-y-[var(--space-6)]">
      <div className="flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
            {item.name}
          </h1>
          <p className="mt-[var(--space-1)] font-mono text-sm text-[var(--color-neutral-500)]">
            Kod: {item.code}
          </p>
        </div>

        <div className="flex flex-wrap gap-[var(--space-2)]">
          <PermissionGate permission={Permission.MASTER_DATA_MANAGE}>
            <Link
              href={`/master-data/${type}/${id}/edit`}
              className="ls-btn ls-btn--neutral ls-btn--sm"
            >
              Düzenle
            </Link>
          </PermissionGate>

          {item.isActive ? (
            <PermissionGate permission={Permission.MASTER_DATA_MANAGE}>
              <button
                type="button"
                className="ls-btn ls-btn--danger ls-btn--sm"
                disabled={deactivateMutation.isPending}
                onClick={() => {
                  if (!confirm('Bu kaydı pasif yapmak istediğinizden emin misiniz?')) return;
                  deactivateMutation.mutate(id, {
                    onSuccess: () => toast.success('Kayıt pasif yapıldı'),
                    onError: () => toast.error('İşlem başarısız. Kayıt kullanımda olabilir.'),
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
                className="ls-btn ls-btn--primary ls-btn--sm"
                disabled={reactivateMutation.isPending}
                onClick={() => {
                  reactivateMutation.mutate(id, {
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
      </div>

      <div>
        <span
          className={`inline-flex items-center gap-[var(--space-1)] rounded-full px-[var(--space-3)] py-1 text-sm font-medium ${
            item.isActive
              ? 'bg-[var(--color-success-100)] text-[var(--color-success-700)]'
              : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${item.isActive ? 'bg-[var(--color-success-500)]' : 'bg-[var(--color-neutral-400)]'}`}
            aria-hidden
          />
          {item.isActive ? 'Aktif' : 'Pasif'}
        </span>
      </div>

      <div className="ls-card p-[var(--space-6)]">
        <dl className="grid gap-[var(--space-4)] sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-neutral-500)]">
              Kod
            </dt>
            <dd className="mt-[var(--space-1)] font-mono text-sm text-[var(--color-neutral-800)]">
              {item.code}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-neutral-500)]">
              Ad
            </dt>
            <dd className="mt-[var(--space-1)] text-sm text-[var(--color-neutral-800)]">
              {item.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-neutral-500)]">
              Oluşturulma Tarihi
            </dt>
            <dd className="mt-[var(--space-1)] text-sm text-[var(--color-neutral-800)]">
              {new Date(item.createdAt).toLocaleDateString('tr-TR')}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-neutral-500)]">
              Güncelleme Tarihi
            </dt>
            <dd className="mt-[var(--space-1)] text-sm text-[var(--color-neutral-800)]">
              {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('tr-TR') : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex items-center gap-[var(--space-3)]">
        <Link
          href={`/master-data/${type}/${id}/users`}
          className="ls-btn ls-btn--neutral ls-btn--sm"
        >
          Bu {typeName} Kaydına Bağlı Kullanıcılar
        </Link>
      </div>
    </div>
  );
}
