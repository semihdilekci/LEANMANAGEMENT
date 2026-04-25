'use client';

import type { AxiosError } from 'axios';
import { Permission } from '@leanmgmt/shared-types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import {
  usePermissionMetadataQuery,
  useReplaceRolePermissionsMutation,
  useRoleDetailQuery,
  useRolePermissionsQuery,
} from '@/lib/queries/roles';
import { RoleSummaryBand } from '@/components/roles/RoleSummaryBand';

const CATEGORIES = ['MENU', 'ACTION', 'DATA', 'FIELD'] as const;

const DIFF_PREVIEW_LIMIT = 12;

export function PermissionMatrix({ roleId }: { roleId: string }) {
  const { data: role } = useRoleDetailQuery(roleId);
  const { data: meta, isLoading: metaLoading } = usePermissionMetadataQuery();
  const { data: grantedRows, isLoading: permLoading } = useRolePermissionsQuery(roleId);
  const replaceMutation = useReplaceRolePermissionsMutation(roleId);

  const initialKeys = useMemo(() => new Set(grantedRows?.map((r) => r.key) ?? []), [grantedRows]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<(typeof CATEGORIES)[number]>('ACTION');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    setSelected(new Set(grantedRows?.map((r) => r.key) ?? []));
    setDirty(false);
  }, [grantedRows]);

  const metaByKey = useMemo(() => {
    const m = new Map<string, { category: string; description: string; isSensitive: boolean }>();
    for (const row of meta ?? []) {
      m.set(row.key, {
        category: row.category,
        description: row.description,
        isSensitive: row.isSensitive,
      });
    }
    return m;
  }, [meta]);

  const categoryStats = useMemo(() => {
    const list = meta ?? [];
    const stats: Record<(typeof CATEGORIES)[number], { total: number; selected: number }> = {
      MENU: { total: 0, selected: 0 },
      ACTION: { total: 0, selected: 0 },
      DATA: { total: 0, selected: 0 },
      FIELD: { total: 0, selected: 0 },
    };
    for (const p of list) {
      const cat = p.category as (typeof CATEGORIES)[number];
      if (!(cat in stats)) continue;
      stats[cat].total += 1;
      if (selected.has(p.key)) stats[cat].selected += 1;
    }
    return stats;
  }, [meta, selected]);

  const rowsInTab = useMemo(() => {
    const list = meta ?? [];
    return list.filter((p) => {
      if (p.category !== tab) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return p.key.toLowerCase().includes(s) || p.description.toLowerCase().includes(s);
    });
  }, [meta, tab, search]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setDirty(true);
  };

  const toggleCategoryAll = () => {
    const keys = rowsInTab.map((r) => r.key);
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
    setDirty(true);
  };

  const added = useMemo(
    () => [...selected].filter((k) => !initialKeys.has(k)),
    [selected, initialKeys],
  );
  const removed = useMemo(
    () => [...initialKeys].filter((k) => !selected.has(k)),
    [selected, initialKeys],
  );
  const hasSensitiveChange = useMemo(() => {
    const check = (keys: string[]) =>
      keys.some((k) => {
        const row = metaByKey.get(k);
        return row?.isSensitive;
      });
    return check(added) || check(removed);
  }, [added, removed, metaByKey]);

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success('Yetki anahtarı panoya kopyalandı');
    } catch {
      toast.error('Panoya kopyalanamadı');
    }
  };

  const executeSave = async () => {
    setError(null);
    try {
      await replaceMutation.mutateAsync([...selected]);
      setDirty(false);
      toast.success('Rol yetkileri güncellendi');
    } catch (e: unknown) {
      const ax = e as AxiosError<{ error?: { code?: string; message?: string } }>;
      const code = ax.response?.data?.error?.code;
      const message = ax.response?.data?.error?.message;
      if (code === 'ROLE_SELF_EDIT_FORBIDDEN') {
        toast.error('Kendi rolünüzün yetkilerini düşüremezsiniz');
      } else {
        setError(message ?? 'Kayıt başarısız.');
      }
      throw e;
    }
  };

  if (!role || metaLoading || permLoading) {
    return (
      <div
        className="h-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]"
        role="status"
      >
        <span className="sr-only">Yükleniyor…</span>
      </div>
    );
  }

  return (
    <div className="space-y-[var(--space-4)]">
      <nav className="text-sm text-[var(--color-neutral-600)]">
        <Link href="/roles" className="hover:text-[var(--color-primary-600)]">
          Roller
        </Link>
        <span aria-hidden> / </span>
        <Link href={`/roles/${role.id}`} className="hover:text-[var(--color-primary-600)]">
          {role.name}
        </Link>
        <span aria-hidden> / </span>
        <span className="text-[var(--color-neutral-900)]">Yetkiler</span>
      </nav>

      <RoleSummaryBand role={role} active="permissions" />

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const { total, selected: sel } = categoryStats[c];
          return (
            <button
              key={c}
              type="button"
              className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm ${
                tab === c
                  ? 'bg-[var(--color-primary-100)] font-medium text-[var(--color-primary-900)]'
                  : 'bg-[var(--color-neutral-100)]'
              }`}
              onClick={() => setTab(c)}
            >
              {c}{' '}
              <span className="text-xs text-[var(--color-neutral-500)]">
                ({sel}/{total})
              </span>
            </button>
          );
        })}
      </div>

      <input
        type="search"
        className="ls-input max-w-md"
        placeholder="Yetki ara…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-sm text-[var(--color-primary-700)] underline"
          onClick={toggleCategoryAll}
        >
          Bu kategoride tümünü seç / kaldır
        </button>
        <span className="text-xs text-[var(--color-neutral-500)]">
          Seçili: {selected.size} / {meta?.length ?? 0}
        </span>
      </div>

      <ul className="divide-y divide-[var(--color-neutral-100)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
        {rowsInTab.map((p) => (
          <li key={p.key} className="flex items-start gap-3 px-3 py-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.has(p.key)}
              onChange={() => toggle(p.key)}
              aria-label={p.key}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs text-[var(--color-neutral-800)]">{p.key}</code>
                <button
                  type="button"
                  className="text-[10px] text-[var(--color-primary-700)] underline"
                  aria-label={`${p.key} anahtarını kopyala`}
                  onClick={() => void copyKey(p.key)}
                >
                  Kopyala
                </button>
                {p.isSensitive ? (
                  <span className="rounded bg-[var(--color-error-100)] px-1.5 py-0.5 text-xs text-[var(--color-error-800)]">
                    Hassas
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[var(--color-neutral-600)]">{p.description}</p>
            </div>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="text-sm text-[var(--color-error-600)]">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        title={hasSensitiveChange ? 'Hassas yetki değişikliği' : 'Yetkileri güncelle'}
        description={
          hasSensitiveChange
            ? 'Hassas yetkilerde değişiklik var. Bu işlem güvenlik etkisi doğurabilir. Özet aşağıda.'
            : 'Rol yetkileri aşağıdaki özetle güncellenecek.'
        }
        confirmLabel={replaceMutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        cancelLabel="Vazgeç"
        destructive={hasSensitiveChange}
        confirmDisabled={replaceMutation.isPending}
        onConfirm={executeSave}
      >
        <div className="max-h-48 space-y-2 overflow-y-auto text-xs">
          {added.length > 0 ? (
            <div>
              <p className="font-medium text-[var(--color-success)]">Eklenecek ({added.length})</p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {added.slice(0, DIFF_PREVIEW_LIMIT).map((k) => (
                  <li
                    key={k}
                    className="rounded px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-success)]"
                    style={{ background: 'var(--color-success-soft)' }}
                  >
                    +{k}
                  </li>
                ))}
              </ul>
              {added.length > DIFF_PREVIEW_LIMIT ? (
                <p className="mt-1 text-[var(--color-neutral-500)]">
                  ve {added.length - DIFF_PREVIEW_LIMIT} diğer…
                </p>
              ) : null}
            </div>
          ) : null}
          {removed.length > 0 ? (
            <div>
              <p className="font-medium text-[var(--color-danger)]">
                Kaldırılacak ({removed.length})
              </p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {removed.slice(0, DIFF_PREVIEW_LIMIT).map((k) => (
                  <li
                    key={k}
                    className="rounded px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-danger)]"
                    style={{ background: 'var(--color-danger-soft)' }}
                  >
                    −{k}
                  </li>
                ))}
              </ul>
              {removed.length > DIFF_PREVIEW_LIMIT ? (
                <p className="mt-1 text-[var(--color-neutral-500)]">
                  ve {removed.length - DIFF_PREVIEW_LIMIT} diğer…
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </ConfirmDialog>

      {dirty ? (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] py-3">
          <p className="text-xs text-[var(--color-neutral-700)]">
            +{added.length} eklenecek, −{removed.length} kaldırılacak
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="ls-btn ls-btn--neutral ls-btn--sm"
              onClick={() => {
                setSelected(new Set(grantedRows?.map((r) => r.key) ?? []));
                setDirty(false);
              }}
            >
              Vazgeç
            </button>
            <PermissionGate permission={Permission.ROLE_PERMISSION_MANAGE}>
              <button
                type="button"
                className="ls-btn ls-btn--primary ls-btn--sm"
                disabled={replaceMutation.isPending}
                onClick={() => setSaveDialogOpen(true)}
              >
                Kaydet
              </button>
            </PermissionGate>
          </div>
        </div>
      ) : null}
    </div>
  );
}
