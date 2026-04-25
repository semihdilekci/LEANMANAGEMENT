'use client';

import { Permission } from '@leanmgmt/shared-types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { PermissionGate } from '@/components/shared/PermissionGate';
import { RoleSummaryBand } from '@/components/roles/RoleSummaryBand';
import {
  useAssignUserToRoleMutation,
  useRoleDetailQuery,
  useRoleUsersQuery,
  useUnassignUserFromRoleMutation,
} from '@/lib/queries/roles';
import { useUserListQuery } from '@/lib/queries/users';

const ASSIGN_SEARCH_MIN = 2;
const DEBOUNCE_MS = 350;

export function RoleUsersTable({ roleId }: { roleId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const source = searchParams.get('source') ?? 'all';
  const tableSearch = searchParams.get('search') ?? '';

  const { data: role } = useRoleDetailQuery(roleId);
  const { data, isLoading, refetch } = useRoleUsersQuery(roleId, {
    source,
    search: tableSearch || undefined,
  });
  const assignMutation = useAssignUserToRoleMutation(roleId);
  const unassignMutation = useUnassignUserFromRoleMutation(roleId);

  const [assignInput, setAssignInput] = useState('');
  const [debouncedAssign, setDebouncedAssign] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [listSearchInput, setListSearchInput] = useState(tableSearch);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedAssign(assignInput.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [assignInput]);

  useEffect(() => {
    setListSearchInput(tableSearch);
  }, [tableSearch]);

  const assignSearchEnabled = debouncedAssign.length >= ASSIGN_SEARCH_MIN;
  const { data: pickList } = useUserListQuery(
    {
      search: debouncedAssign,
      limit: 20,
      isActive: 'true',
    },
    assignSearchEnabled,
  );

  const setSource = (next: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (next === 'all') p.delete('source');
    else p.set('source', next);
    startTransition(() => router.push(`/roles/${roleId}/users?${p.toString()}`));
  };

  const pushTableSearch = (raw: string) => {
    const v = raw.trim();
    const p = new URLSearchParams(searchParams.toString());
    if (!v) p.delete('search');
    else p.set('search', v);
    startTransition(() => router.push(`/roles/${roleId}/users?${p.toString()}`));
  };

  const items = useMemo(() => data?.items ?? [], [data]);
  const pickItems = useMemo(() => pickList?.items ?? [], [pickList]);

  const selectedPickLabel = useMemo(() => {
    if (!selectedUserId) return null;
    const u = pickItems.find((x) => x.id === selectedUserId);
    if (!u) return selectedUserId;
    return `${u.sicil ?? '—'} — ${u.firstName} ${u.lastName}`;
  }, [selectedUserId, pickItems]);

  if (!role) {
    return (
      <div className="h-32 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]" />
    );
  }

  return (
    <div className="space-y-[var(--space-4)]">
      <nav className="text-sm text-[var(--color-neutral-600)]">
        <Link href="/roles">Roller</Link>
        <span aria-hidden> / </span>
        <Link href={`/roles/${role.id}`}>{role.name}</Link>
        <span aria-hidden> / </span>
        <span className="text-[var(--color-neutral-900)]">Kullanıcılar</span>
      </nav>

      <RoleSummaryBand role={role} active="users" />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-[var(--color-neutral-600)]">
          Kaynak
          <select
            className="ls-input mt-1 block"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">Tümü</option>
            <option value="direct">Doğrudan</option>
            <option value="attribute_rule">Kural ile</option>
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-xs text-[var(--color-neutral-600)]">
          Listede ara (sicil / ad)
          <input
            type="search"
            className="ls-input mt-1 block w-full"
            value={listSearchInput}
            onChange={(e) => setListSearchInput(e.target.value)}
            onBlur={() => {
              if (listSearchInput.trim() !== tableSearch.trim()) {
                pushTableSearch(listSearchInput);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                pushTableSearch(listSearchInput);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </label>
      </div>

      <PermissionGate permission={Permission.ROLE_ASSIGN}>
        <div className="space-y-2 rounded border border-[var(--color-neutral-200)] p-3">
          <p className="text-xs font-medium text-[var(--color-neutral-700)]">
            Kullanıcı ata (sicil veya ad ile ara, listeden seç)
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="relative min-w-[14rem] flex-1">
              <label className="text-xs">
                Ara
                <input
                  className="ls-input mt-1 w-full"
                  value={assignInput}
                  onChange={(e) => {
                    setAssignInput(e.target.value);
                    setSelectedUserId(null);
                  }}
                  placeholder={`En az ${ASSIGN_SEARCH_MIN} karakter`}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-controls="role-user-assign-suggestions"
                  aria-expanded={assignSearchEnabled && pickItems.length > 0}
                />
              </label>
              {assignSearchEnabled && pickItems.length > 0 ? (
                <ul
                  id="role-user-assign-suggestions"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] shadow-md"
                >
                  {pickItems.map((u) => (
                    <li key={u.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedUserId === u.id}
                        className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-[var(--color-neutral-100)] ${
                          selectedUserId === u.id ? 'bg-[var(--color-primary-50)]' : ''
                        }`}
                        onClick={() => setSelectedUserId(u.id)}
                      >
                        <span className="font-mono text-xs text-[var(--color-neutral-700)]">
                          {u.sicil ?? '—'}
                        </span>
                        <span>
                          {u.firstName} {u.lastName}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button
              type="button"
              className="ls-btn ls-btn--primary ls-btn--sm"
              disabled={assignMutation.isPending || !selectedUserId}
              onClick={async () => {
                if (!selectedUserId) return;
                try {
                  await assignMutation.mutateAsync(selectedUserId);
                  toast.success('Kullanıcı role atandı');
                  setAssignInput('');
                  setSelectedUserId(null);
                  void refetch();
                } catch (e: unknown) {
                  const err = e as { response?: { data?: { error?: { message?: string } } } };
                  toast.error(err.response?.data?.error?.message ?? 'Atama başarısız.');
                }
              }}
            >
              Ata
            </button>
          </div>
          {selectedPickLabel ? (
            <p className="text-xs text-[var(--color-neutral-600)]">Seçili: {selectedPickLabel}</p>
          ) : null}
        </div>
      </PermissionGate>

      {isLoading || pending ? (
        <div className="h-24 animate-pulse rounded bg-[var(--color-neutral-100)]" />
      ) : (
        <div className="overflow-x-auto rounded border border-[var(--color-neutral-200)]">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b bg-[var(--color-neutral-50)]">
              <tr>
                <th className="px-3 py-2">Sicil</th>
                <th className="px-3 py-2">Ad</th>
                <th className="px-3 py-2">Kaynak</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={`${row.user.id}-${row.source}`}
                  className="border-b border-[var(--color-neutral-100)]"
                >
                  <td className="px-3 py-2 font-mono text-xs">{row.user.sicil}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/users/${row.user.id}`}
                      className="text-[var(--color-primary-700)] hover:underline"
                    >
                      {row.user.firstName} {row.user.lastName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">{row.source}</td>
                  <td className="px-3 py-2">
                    {row.source === 'DIRECT' ? (
                      <PermissionGate permission={Permission.ROLE_ASSIGN}>
                        <button
                          type="button"
                          className="text-xs text-[var(--color-error-700)] underline"
                          onClick={async () => {
                            try {
                              await unassignMutation.mutateAsync(row.user.id);
                              toast.success('Atama kaldırıldı');
                              void refetch();
                            } catch (e: unknown) {
                              const err = e as {
                                response?: { data?: { error?: { message?: string } } };
                              };
                              toast.error(
                                err.response?.data?.error?.message ?? 'Kaldırma başarısız.',
                              );
                            }
                          }}
                        >
                          Kaldır
                        </button>
                      </PermissionGate>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
