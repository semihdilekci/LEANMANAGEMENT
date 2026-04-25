'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import type { TaskListQuery } from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
import { completionActionLabelTr } from '@/lib/completion-action-tr';
import { useTasksInfiniteQuery } from '@/lib/queries/tasks';

import { SlaBadge } from './SlaBadge';

type TabKey = 'pending' | 'started' | 'completed';

function tabFromParam(v: string | null): TabKey {
  if (v === 'started' || v === 'completed') {
    return v;
  }
  return 'pending';
}

export function TaskList() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tab = tabFromParam(searchParams.get('tab'));
  const processType = searchParams.get('processType') as TaskListQuery['processType'] | null;
  const startedAtFrom = searchParams.get('startedAtFrom') ?? undefined;
  const startedAtTo = searchParams.get('startedAtTo') ?? undefined;
  const search = searchParams.get('search') ?? undefined;

  const baseFilters = useMemo(
    (): Omit<TaskListQuery, 'cursor'> => ({
      tab,
      limit: 20,
      ...(processType ? { processType } : {}),
      ...(startedAtFrom ? { startedAtFrom } : {}),
      ...(startedAtTo ? { startedAtTo } : {}),
      ...(search ? { search } : {}),
    }),
    [tab, processType, startedAtFrom, startedAtTo, search],
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTasksInfiniteQuery(baseFilters);

  const setParams = useCallback(
    (mut: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString());
      mut(p);
      router.push(`/tasks?${p.toString()}`);
    },
    [router, searchParams],
  );

  const setTab = (next: TabKey) => {
    setParams((p) => {
      p.set('tab', next);
    });
  };

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data?.pages]);

  if (isLoading) {
    return (
      <div className="space-y-[var(--space-3)]" role="status" aria-live="polite">
        <span className="sr-only">Yükleniyor…</span>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="ls-alert ls-alert--danger" role="alert">
        <p>Görevler yüklenemedi.</p>
        <p className="text-sm opacity-90">{(error as Error)?.message ?? ''}</p>
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

  return (
    <div className="space-y-[var(--space-6)]">
      <div className="flex flex-wrap items-end gap-[var(--space-4)] border-b border-[var(--color-neutral-200)] pb-[var(--space-3)]">
        <button
          type="button"
          className={`rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm font-medium ${
            tab === 'pending'
              ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]'
              : 'text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]'
          }`}
          onClick={() => setTab('pending')}
        >
          Onayda bekleyen
        </button>
        <button
          type="button"
          className={`rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm font-medium ${
            tab === 'started'
              ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]'
              : 'text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]'
          }`}
          onClick={() => setTab('started')}
        >
          Başlattığım süreçler
        </button>
        <button
          type="button"
          className={`rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm font-medium ${
            tab === 'completed'
              ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]'
              : 'text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]'
          }`}
          onClick={() => setTab('completed')}
        >
          Tamamlanan görevler
        </button>
        <div className="ml-auto">
          <PermissionGate permission={Permission.PROCESS_KTI_START}>
            <Link href="/processes/kti/start" className="ls-btn ls-btn--primary ls-btn--sm">
              Yeni KTİ başlat
            </Link>
          </PermissionGate>
        </div>
      </div>

      <div className="flex flex-wrap gap-[var(--space-3)]">
        <input
          type="search"
          placeholder="Süreç no (ör. KTI-000042)"
          defaultValue={search ?? ''}
          className="ls-input max-w-xs text-sm"
          aria-label="Süreç numarası ara"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = (e.target as HTMLInputElement).value.trim();
              setParams((p) => {
                if (v) {
                  p.set('search', v);
                } else {
                  p.delete('search');
                }
              });
            }
          }}
        />
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm"
          onClick={() => {
            setParams((p) => {
              p.delete('search');
              p.delete('processType');
              p.delete('startedAtFrom');
              p.delete('startedAtTo');
            });
          }}
        >
          Filtreleri temizle
        </button>
      </div>

      {items.length === 0 ? (
        <div className="ls-card p-[var(--space-8)] text-center text-sm text-[var(--color-neutral-700)]">
          {tab === 'pending' ? 'Size atanmış bekleyen görev yok.' : null}
          {tab === 'started' ? (
            <div className="space-y-[var(--space-3)]">
              <p>Başlattığınız aktif süreç yok.</p>
              <PermissionGate permission={Permission.PROCESS_KTI_START}>
                <Link
                  href="/processes/kti/start"
                  className="ls-btn ls-btn--primary ls-btn--sm inline-flex"
                >
                  Yeni KTİ başlat
                </Link>
              </PermissionGate>
            </div>
          ) : null}
          {tab === 'completed' ? 'Henüz tamamladığınız görev yok.' : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--color-neutral-50)] text-[var(--color-neutral-700)]">
              <tr>
                <th className="px-[var(--space-3)] py-2 font-medium">Süreç</th>
                <th className="px-[var(--space-3)] py-2 font-medium">Adım</th>
                {tab === 'pending' ? (
                  <th className="px-[var(--space-3)] py-2 font-medium">Başlatan</th>
                ) : null}
                {tab === 'pending' ? (
                  <th className="px-[var(--space-3)] py-2 font-medium">Başlangıç</th>
                ) : null}
                {tab === 'started' ? (
                  <th className="px-[var(--space-3)] py-2 font-medium">Durum</th>
                ) : null}
                {tab === 'completed' ? (
                  <th className="px-[var(--space-3)] py-2 font-medium">Aksiyon</th>
                ) : null}
                {tab === 'completed' ? (
                  <th className="px-[var(--space-3)] py-2 font-medium">Tamamlanma</th>
                ) : null}
                {tab === 'pending' ? (
                  <th className="px-[var(--space-3)] py-2 font-medium">SLA</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-neutral-100)]">
              {items.map((row) => (
                <tr
                  key={row.taskId}
                  className="cursor-pointer hover:bg-[var(--color-neutral-50)]"
                  onClick={() => {
                    if (tab === 'pending') {
                      router.push(`/tasks/${encodeURIComponent(row.taskId)}`);
                    } else {
                      router.push(`/processes/${encodeURIComponent(row.process.displayId)}`);
                    }
                  }}
                >
                  <td className="px-[var(--space-3)] py-2">
                    <Link
                      href={`/processes/${encodeURIComponent(row.process.displayId)}`}
                      className="font-medium text-[var(--color-primary-700)] underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.process.displayId}
                    </Link>
                  </td>
                  <td className="px-[var(--space-3)] py-2 text-[var(--color-neutral-800)]">
                    {row.stepLabel}
                  </td>
                  {tab === 'pending' ? (
                    <td className="px-[var(--space-3)] py-2">
                      {row.process.startedBy.firstName} {row.process.startedBy.lastName}
                    </td>
                  ) : null}
                  {tab === 'pending' ? (
                    <td className="px-[var(--space-3)] py-2 text-[var(--color-neutral-600)]">
                      {new Date(row.process.startedAt).toLocaleDateString('tr-TR')}
                    </td>
                  ) : null}
                  {tab === 'started' ? (
                    <td className="px-[var(--space-3)] py-2">{row.process.status}</td>
                  ) : null}
                  {tab === 'completed' ? (
                    <td className="px-[var(--space-3)] py-2">
                      <span className="rounded-full bg-[var(--color-neutral-100)] px-2 py-0.5 text-xs">
                        {completionActionLabelTr(row.completionAction)}
                      </span>
                    </td>
                  ) : null}
                  {tab === 'completed' ? (
                    <td className="px-[var(--space-3)] py-2 text-[var(--color-neutral-600)]">
                      {row.completedAt ? new Date(row.completedAt).toLocaleString('tr-TR') : '—'}
                    </td>
                  ) : null}
                  {tab === 'pending' ? (
                    <td className="px-[var(--space-3)] py-2">
                      <SlaBadge
                        slaDueAt={row.slaDueAt}
                        slaBaselineAt={row.slaBaselineAt ?? null}
                        isSlaOverdue={row.isSlaOverdue}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasNextPage ? (
        <div className="flex justify-center">
          <button
            type="button"
            className="ls-btn ls-btn--neutral ls-btn--sm"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? 'Yükleniyor…' : 'Daha fazla yükle'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
