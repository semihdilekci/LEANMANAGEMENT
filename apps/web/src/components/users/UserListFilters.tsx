'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAllMasterDataQuery } from '@/lib/queries/master-data';

const EMPLOYEE_TYPE_OPTIONS = [
  { value: '', label: 'Tümü' },
  { value: 'WHITE_COLLAR', label: 'Beyaz yaka' },
  { value: 'BLUE_COLLAR', label: 'Mavi yaka' },
  { value: 'INTERN', label: 'Stajyer' },
] as const;

const IS_ACTIVE_OPTIONS = [
  { value: 'true', label: 'Aktif' },
  { value: 'false', label: 'Pasif' },
  { value: 'all', label: 'Tümü' },
] as const;

const SORT_OPTIONS = [
  { value: 'last_name_asc', label: 'Soyad (A-Z)' },
  { value: 'sicil_asc', label: 'Sicil (artan)' },
  { value: 'created_at_desc', label: 'Kayıt tarihi (önce yeniler)' },
] as const;

/** URL'deki filtre parametreleri — cursor sıfırlama imzası için kullanılır */
export const USER_LIST_FILTER_PARAM_KEYS = [
  'search',
  'companyId',
  'locationId',
  'departmentId',
  'positionId',
  'levelId',
  'employeeType',
  'isActive',
  'sort',
] as const;

export function userListFilterSignature(searchParams: Pick<URLSearchParams, 'get'>) {
  return USER_LIST_FILTER_PARAM_KEYS.map((k) => searchParams.get(k) ?? '').join('|');
}

export function hasUserListActiveFilters(searchParams: Pick<URLSearchParams, 'get'>) {
  const hasNonDefaultSort = (searchParams.get('sort') ?? 'last_name_asc') !== 'last_name_asc';
  const hasNonDefaultActive = (searchParams.get('isActive') ?? 'true') !== 'true';
  return Boolean(
    (searchParams.get('search')?.trim() ?? '') ||
    searchParams.get('companyId') ||
    searchParams.get('locationId') ||
    searchParams.get('departmentId') ||
    searchParams.get('positionId') ||
    searchParams.get('levelId') ||
    searchParams.get('employeeType') ||
    hasNonDefaultActive ||
    hasNonDefaultSort,
  );
}

/** URL query ile senkron; cursor pagination UserList içinde ayrı tutulur */
export function useUserListFilterParamsWrite() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setFilterParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '') next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return { setFilterParams };
}

export function UserListFiltersPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setFilterParams } = useUserListFilterParamsWrite();

  const { data: companies } = useAllMasterDataQuery('companies');
  const { data: locations } = useAllMasterDataQuery('locations');
  const { data: departments } = useAllMasterDataQuery('departments');
  const { data: positions } = useAllMasterDataQuery('positions');
  const { data: levels } = useAllMasterDataQuery('levels');

  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('search') ?? '');

  useEffect(() => {
    setSearchDraft(searchParams.get('search') ?? '');
  }, [searchParams]);

  const applySearch = () => {
    const trimmed = searchDraft.trim();
    setFilterParams({ search: trimmed || undefined });
  };

  const clearAll = () => {
    setSearchDraft('');
    router.push(pathname);
  };

  const hasActiveFilters = hasUserListActiveFilters(searchParams);

  const sortValue = searchParams.get('sort') ?? 'last_name_asc';

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-4)]"
      role="search"
      aria-label="Kullanıcı listesi filtreleri"
    >
      <div className="grid gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-2">
          <label
            htmlFor="user-list-search"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Arama (ad, soyad, e-posta, sicil)
          </label>
          <div className="mt-[var(--space-1)] flex flex-col gap-[var(--space-2)] sm:flex-row">
            <input
              id="user-list-search"
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applySearch();
                }
              }}
              className="ls-input min-w-0 flex-1"
              placeholder="Örn. Yılmaz veya sicil"
              autoComplete="off"
            />
            <button
              type="button"
              className="ls-btn ls-btn--primary ls-btn--sm shrink-0"
              onClick={applySearch}
            >
              Ara
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="filter-company"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Şirket
          </label>
          <select
            id="filter-company"
            className="ls-input mt-[var(--space-1)] w-full"
            value={searchParams.get('companyId') ?? ''}
            onChange={(e) => setFilterParams({ companyId: e.target.value || undefined })}
          >
            <option value="">Tümü</option>
            {companies?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-location"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Lokasyon
          </label>
          <select
            id="filter-location"
            className="ls-input mt-[var(--space-1)] w-full"
            value={searchParams.get('locationId') ?? ''}
            onChange={(e) => setFilterParams({ locationId: e.target.value || undefined })}
          >
            <option value="">Tümü</option>
            {locations?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-department"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Departman
          </label>
          <select
            id="filter-department"
            className="ls-input mt-[var(--space-1)] w-full"
            value={searchParams.get('departmentId') ?? ''}
            onChange={(e) => setFilterParams({ departmentId: e.target.value || undefined })}
          >
            <option value="">Tümü</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-position"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Pozisyon
          </label>
          <select
            id="filter-position"
            className="ls-input mt-[var(--space-1)] w-full"
            value={searchParams.get('positionId') ?? ''}
            onChange={(e) => setFilterParams({ positionId: e.target.value || undefined })}
          >
            <option value="">Tümü</option>
            {positions?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-level"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Seviye
          </label>
          <select
            id="filter-level"
            className="ls-input mt-[var(--space-1)] w-full"
            value={searchParams.get('levelId') ?? ''}
            onChange={(e) => setFilterParams({ levelId: e.target.value || undefined })}
          >
            <option value="">Tümü</option>
            {levels?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-employee-type"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Çalışan tipi
          </label>
          <select
            id="filter-employee-type"
            className="ls-input mt-[var(--space-1)] w-full"
            value={searchParams.get('employeeType') ?? ''}
            onChange={(e) => setFilterParams({ employeeType: e.target.value || undefined })}
          >
            {EMPLOYEE_TYPE_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-is-active"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Durum
          </label>
          <select
            id="filter-is-active"
            className="ls-input mt-[var(--space-1)] w-full"
            value={searchParams.get('isActive') ?? 'true'}
            onChange={(e) => {
              const v = e.target.value;
              setFilterParams({ isActive: v === 'true' ? undefined : v });
            }}
          >
            {IS_ACTIVE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-sort"
            className="block text-sm font-medium text-[var(--color-neutral-700)]"
          >
            Sıralama
          </label>
          <select
            id="filter-sort"
            className="ls-input mt-[var(--space-1)] w-full"
            value={sortValue}
            onChange={(e) => {
              const v = e.target.value;
              setFilterParams({ sort: v === 'last_name_asc' ? undefined : v });
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-[var(--space-4)] flex justify-end border-t border-[var(--color-neutral-100)] pt-[var(--space-3)]">
          <button type="button" className="ls-btn ls-btn--neutral ls-btn--sm" onClick={clearAll}>
            Filtreleri temizle
          </button>
        </div>
      )}
    </div>
  );
}
