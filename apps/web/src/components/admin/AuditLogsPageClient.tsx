'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  AuditLogListQuerySchema,
  type AuditLogExportQuery,
  type AuditLogListQuery,
} from '@leanmgmt/shared-schemas';

import { AuditChainIntegrityPanel } from '@/components/admin/AuditChainIntegrityPanel';
import { SimpleAlertDialog } from '@/components/shared/SimpleAlertDialog';
import {
  type AuditLogRow,
  downloadAuditLogsCsv,
  useAuditLogsInfiniteQuery,
} from '@/lib/queries/admin-audit-logs';
import { datetimeLocalToIsoUtc, isoToDatetimeLocalValue } from '@/lib/consent-publish-ui';
function defaultRangeIso(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function buildAuditQueryFromSearchParams(sp: URLSearchParams): AuditLogListQuery {
  const { from, to } = defaultRangeIso();
  const raw = {
    limit: 20,
    timestampFrom: sp.get('timestampFrom') ?? from,
    timestampTo: sp.get('timestampTo') ?? to,
    userId: sp.get('userId') ?? undefined,
    action: sp.get('action') ?? undefined,
    entity: sp.get('entity') ?? undefined,
    entityId: sp.get('entityId') ?? undefined,
    ipHash: sp.get('ipHash') ?? undefined,
  };
  const r = AuditLogListQuerySchema.safeParse(raw);
  if (r.success) return r.data;
  return AuditLogListQuerySchema.parse({
    limit: 20,
    timestampFrom: from,
    timestampTo: to,
  });
}

function toExportQuery(q: AuditLogListQuery): AuditLogExportQuery {
  return {
    userId: q.userId,
    action: q.action,
    entity: q.entity,
    entityId: q.entityId,
    timestampFrom: q.timestampFrom,
    timestampTo: q.timestampTo,
    ipHash: q.ipHash,
  };
}

export function AuditLogsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const listQuery = useMemo(() => buildAuditQueryFromSearchParams(sp), [sp]);

  const [localFrom, setLocalFrom] = useState(() =>
    isoToDatetimeLocalValue(listQuery.timestampFrom ?? defaultRangeIso().from),
  );
  const [localTo, setLocalTo] = useState(() =>
    isoToDatetimeLocalValue(listQuery.timestampTo ?? defaultRangeIso().to),
  );
  const [localAction, setLocalAction] = useState(sp.get('action') ?? '');
  const [localEntity, setLocalEntity] = useState(sp.get('entity') ?? '');

  useEffect(() => {
    setLocalFrom(isoToDatetimeLocalValue(listQuery.timestampFrom ?? defaultRangeIso().from));
    setLocalTo(isoToDatetimeLocalValue(listQuery.timestampTo ?? defaultRangeIso().to));
    setLocalAction(sp.get('action') ?? '');
    setLocalEntity(sp.get('entity') ?? '');
  }, [listQuery.timestampFrom, listQuery.timestampTo, sp]);

  const infinite = useAuditLogsInfiniteQuery(listQuery, true);
  const rows: AuditLogRow[] = useMemo(
    () => infinite.data?.pages.flatMap((p) => p.data) ?? [],
    [infinite.data?.pages],
  );

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<AuditLogRow | null>(null);

  const applyFilters = useCallback(() => {
    const p = new URLSearchParams();
    try {
      p.set('timestampFrom', datetimeLocalToIsoUtc(localFrom));
      p.set('timestampTo', datetimeLocalToIsoUtc(localTo));
    } catch {
      toast.error('Tarih aralığı geçersiz');
      return;
    }
    if (localAction.trim()) p.set('action', localAction.trim());
    if (localEntity.trim()) p.set('entity', localEntity.trim());
    router.replace(`${pathname}?${p.toString()}`);
  }, [localAction, localEntity, localFrom, localTo, pathname, router]);

  const onExport = useCallback(async () => {
    try {
      await downloadAuditLogsCsv(toExportQuery(listQuery));
      toast.success('Dışa aktarma indirilmeye başladı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dışa aktarma başarısız');
    }
  }, [listQuery]);

  return (
    <div className="space-y-[var(--space-6)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-neutral-900)]">
            Denetim kayıtları
          </h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
            Filtreleri uyguladıktan sonra liste ve dışa aktarma aynı aralığı kullanır.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-[var(--color-primary-600)] underline underline-offset-2"
        >
          Yönetim özeti
        </Link>
      </div>

      <AuditChainIntegrityPanel />

      <section className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-4)]">
        <h2 className="text-sm font-semibold text-[var(--color-neutral-900)]">Filtreler</h2>
        <div className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-3)]">
          <label className="flex flex-col gap-1 text-xs text-[var(--color-neutral-600)]">
            Başlangıç
            <input
              type="datetime-local"
              className="ls-input min-w-[200px]"
              value={localFrom}
              onChange={(e) => setLocalFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-neutral-600)]">
            Bitiş
            <input
              type="datetime-local"
              className="ls-input min-w-[200px]"
              value={localTo}
              onChange={(e) => setLocalTo(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-neutral-600)]">
            Aksiyon
            <input
              type="text"
              className="ls-input min-w-[140px]"
              value={localAction}
              onChange={(e) => setLocalAction(e.target.value)}
              placeholder="örn. USER_CREATED"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-neutral-600)]">
            Varlık
            <input
              type="text"
              className="ls-input min-w-[140px]"
              value={localEntity}
              onChange={(e) => setLocalEntity(e.target.value)}
              placeholder="örn. user"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="ls-btn ls-btn--primary ls-btn--sm"
              onClick={applyFilters}
            >
              Uygula
            </button>
            <button
              type="button"
              className="ls-btn ls-btn--neutral ls-btn--sm"
              onClick={() => void onExport()}
            >
              CSV dışa aktar
            </button>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
            <tr>
              <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">Zaman</th>
              <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">Aksiyon</th>
              <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">Varlık</th>
              <th className="px-3 py-2 font-medium text-[var(--color-neutral-700)]">Kullanıcı</th>
            </tr>
          </thead>
          <tbody>
            {infinite.isPending ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[var(--color-neutral-600)]">
                  Yükleniyor…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[var(--color-neutral-600)]">
                  Kayıt bulunamadı
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]"
                  onClick={() => {
                    setDetailRow(r);
                    setDetailOpen(true);
                  }}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-[var(--color-neutral-800)]">
                    {new Date(r.timestamp).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--color-neutral-800)]">
                    {r.action}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-neutral-800)]">
                    {r.entity}
                    {r.entityId ? (
                      <span className="text-[var(--color-neutral-500)]"> ({r.entityId})</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-neutral-800)]">
                    {r.user
                      ? `${r.user.firstName} ${r.user.lastName}${r.user.sicil ? ` · ${r.user.sicil}` : ''}`
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {infinite.hasNextPage ? (
        <div className="flex justify-center">
          <button
            type="button"
            className="ls-btn ls-btn--neutral ls-btn--sm"
            disabled={infinite.isFetchingNextPage}
            onClick={() => void infinite.fetchNextPage()}
          >
            {infinite.isFetchingNextPage ? 'Yükleniyor…' : 'Daha fazla'}
          </button>
        </div>
      ) : null}

      <SimpleAlertDialog open={detailOpen} onOpenChange={setDetailOpen} title="Denetim kaydı">
        {detailRow ? (
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-2 font-mono text-xs">
            {JSON.stringify(detailRow, null, 2)}
          </pre>
        ) : null}
      </SimpleAlertDialog>
    </div>
  );
}
