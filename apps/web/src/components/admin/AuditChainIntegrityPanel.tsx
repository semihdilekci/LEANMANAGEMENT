'use client';

import Link from 'next/link';
import { toast } from 'sonner';

import { Permission } from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
import {
  useAuditChainIntegrityQuery,
  useVerifyAuditChainMutation,
} from '@/lib/queries/admin-audit-logs';

export function AuditChainIntegrityPanel({
  showDetailLink = true,
  enableQuery = true,
}: {
  showDetailLink?: boolean;
  enableQuery?: boolean;
}) {
  const { data, isPending, error, refetch } = useAuditChainIntegrityQuery(enableQuery);
  const verify = useVerifyAuditChainMutation();

  async function onVerify(): Promise<void> {
    try {
      const d = await verify.mutateAsync();
      toast.success(
        d.chainIntact
          ? 'Zincir bütünlüğü doğrulandı — tutarlı.'
          : 'Zincirde tutarsızlık tespit edildi. Ayrıntılar için zincir sayfasına bakın.',
      );
      await refetch();
    } catch {
      toast.error('Doğrulama çalıştırılamadı. Lütfen tekrar deneyin.');
    }
  }

  return (
    <section
      className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-4)]"
      aria-label="Denetim zinciri özeti"
    >
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-neutral-900)]">
            Denetim zinciri bütünlüğü
          </h2>
          {isPending ? (
            <p className="mt-1 text-sm text-[var(--color-neutral-600)]">Yükleniyor…</p>
          ) : error ? (
            <p className="mt-1 text-sm text-[var(--color-error-700)]">Özet yüklenemedi.</p>
          ) : data ? (
            <ul className="mt-2 space-y-1 text-sm text-[var(--color-neutral-700)]">
              <li>
                Durum:{' '}
                <span
                  className={
                    data.chainIntact
                      ? 'font-medium text-[var(--color-success-700)]'
                      : 'font-medium text-[var(--color-error-700)]'
                  }
                >
                  {data.chainIntact ? 'Sağlam' : 'Kırık'}
                </span>
              </li>
              <li>Taranan kayıt: {data.totalRecordsChecked}</li>
              <li>
                Son kontrol:{' '}
                {data.lastCheckAt ? new Date(data.lastCheckAt).toLocaleString('tr-TR') : '—'}
              </li>
              {!data.chainIntact && data.firstBrokenRecordId ? (
                <li className="text-[var(--color-error-800)]">
                  İlk tutarsız kayıt: {data.firstBrokenRecordId}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PermissionGate permission={Permission.AUDIT_LOG_VIEW}>
            <button
              type="button"
              className="ls-btn ls-btn--primary ls-btn--sm"
              disabled={verify.isPending}
              onClick={() => void onVerify()}
            >
              {verify.isPending ? 'Doğrulanıyor…' : 'Şimdi doğrula'}
            </button>
          </PermissionGate>
          {showDetailLink ? (
            <PermissionGate permission={Permission.AUDIT_LOG_VIEW}>
              <Link
                href="/admin/audit-logs/chain-integrity"
                className="ls-btn ls-btn--neutral ls-btn--sm inline-flex no-underline"
              >
                Zincir sayfası
              </Link>
            </PermissionGate>
          ) : null}
        </div>
      </div>
    </section>
  );
}
