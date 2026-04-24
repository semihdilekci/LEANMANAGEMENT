'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';

import { Permission } from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
import { useRoleListQuery } from '@/lib/queries/roles';

export function RoleList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const filters = useMemo(
    () => ({
      isActive: searchParams.get('isActive') ?? 'all',
      isSystem: searchParams.get('isSystem') ?? 'all',
      search: searchParams.get('search') ?? '',
    }),
    [searchParams],
  );

  const {
    data: roles,
    isLoading,
    error,
    refetch,
  } = useRoleListQuery({
    isActive: filters.isActive === 'all' ? undefined : filters.isActive,
    isSystem: filters.isSystem === 'all' ? undefined : filters.isSystem,
    search: filters.search || undefined,
  });

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
      startTransition(() => {
        router.push(`/roles?${next.toString()}`);
      });
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="flex flex-wrap items-end justify-between gap-[var(--space-4)]">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
            Roller
          </h1>
          <p className="mt-[var(--space-1)] text-sm text-[var(--color-neutral-500)]">
            Rol tanımları, yetki matrisi ve attribute kuralları.
          </p>
        </div>
        <PermissionGate permission={Permission.ROLE_CREATE}>
          <Link href="/roles/new" className="ls-btn ls-btn--primary">
            Yeni Rol
          </Link>
        </PermissionGate>
      </div>

      <div className="flex flex-wrap gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-3)]">
        <label className="flex flex-col gap-[var(--space-1)] text-xs text-[var(--color-neutral-600)]">
          Arama
          <input
            type="search"
            defaultValue={filters.search}
            onBlur={(e) => setParam('search', e.target.value.trim())}
            className="ls-input min-w-[12rem]"
            placeholder="Kod veya ad"
          />
        </label>
        <label className="flex flex-col gap-[var(--space-1)] text-xs text-[var(--color-neutral-600)]">
          Aktiflik
          <select
            className="ls-input"
            value={filters.isActive}
            onChange={(e) => setParam('isActive', e.target.value)}
          >
            <option value="all">Tümü</option>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
        </label>
        <label className="flex flex-col gap-[var(--space-1)] text-xs text-[var(--color-neutral-600)]">
          Tip
          <select
            className="ls-input"
            value={filters.isSystem}
            onChange={(e) => setParam('isSystem', e.target.value)}
          >
            <option value="all">Tümü</option>
            <option value="true">Sistem</option>
            <option value="false">Özel</option>
          </select>
        </label>
      </div>

      {isLoading || pending ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <span className="sr-only">Yükleniyor...</span>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-error-200)] bg-[var(--color-error-50)] p-4 text-sm text-[var(--color-error-800)]">
          Liste yüklenemedi.
          <button type="button" className="ml-2 underline" onClick={() => void refetch()}>
            Tekrar dene
          </button>
        </div>
      ) : !roles?.length ? (
        <p className="text-sm text-[var(--color-neutral-600)]">Rol bulunamadı.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
              <tr>
                <th className="px-3 py-2 font-medium">Kod</th>
                <th className="px-3 py-2 font-medium">Ad</th>
                <th className="px-3 py-2 font-medium">Tip</th>
                <th className="px-3 py-2 font-medium">Yetkiler</th>
                <th className="px-3 py-2 font-medium">Kullanıcı (doğrudan)</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]"
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/roles/${r.id}`}
                      className="text-[var(--color-primary-700)] hover:underline"
                    >
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">
                    {r.isSystem ? (
                      <span className="rounded bg-[var(--color-neutral-200)] px-2 py-0.5 text-xs">
                        Sistem
                      </span>
                    ) : (
                      <span className="rounded bg-[var(--color-primary-100)] px-2 py-0.5 text-xs">
                        Özel
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.permissionCount}</td>
                  <td className="px-3 py-2">{r.userCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
