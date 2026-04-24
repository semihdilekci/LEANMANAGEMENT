'use client';

import { Permission } from '@leanmgmt/shared-types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { PermissionGate } from '@/components/shared/PermissionGate';
import {
  usePermissionMetadataQuery,
  useReplaceRolePermissionsMutation,
  useRoleDetailQuery,
  useRolePermissionsQuery,
} from '@/lib/queries/roles';
import { RoleSummaryBand } from '@/components/roles/RoleSummaryBand';

const CATEGORIES = ['MENU', 'ACTION', 'DATA', 'FIELD'] as const;

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
        const m = metaByKey.get(k);
        return m?.isSensitive;
      });
    return check(added) || check(removed);
  }, [added, removed, metaByKey]);

  const save = async () => {
    setError(null);
    if (hasSensitiveChange) {
      const ok = window.confirm(
        'Hassas yetkilerde değişiklik var. Bu işlem güvenlik etkisi doğurabilir. Devam edilsin mi?',
      );
      if (!ok) return;
    } else if (!window.confirm('Rol yetkileri güncellenecek. Onaylıyor musunuz?')) {
      return;
    }
    try {
      await replaceMutation.mutateAsync([...selected]);
      setDirty(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      setError(err.response?.data?.error?.message ?? 'Kayıt başarısız.');
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
        {CATEGORIES.map((c) => (
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
            {c}
          </button>
        ))}
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
                onClick={() => void save()}
              >
                {replaceMutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </PermissionGate>
          </div>
        </div>
      ) : null}
    </div>
  );
}
