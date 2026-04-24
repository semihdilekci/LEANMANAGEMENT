'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Permission } from '@leanmgmt/shared-types';

import { PermissionGate } from '@/components/shared/PermissionGate';
import { RoleSummaryBand } from '@/components/roles/RoleSummaryBand';
import {
  useAssignUserToRoleMutation,
  useRoleDetailQuery,
  useRoleUsersQuery,
  useUnassignUserFromRoleMutation,
} from '@/lib/queries/roles';

export function RoleUsersTable({ roleId }: { roleId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const source = searchParams.get('source') ?? 'all';
  const search = searchParams.get('search') ?? '';

  const { data: role } = useRoleDetailQuery(roleId);
  const { data, isLoading, refetch } = useRoleUsersQuery(roleId, {
    source,
    search: search || undefined,
  });
  const assignMutation = useAssignUserToRoleMutation(roleId);
  const unassignMutation = useUnassignUserFromRoleMutation(roleId);
  const [userIdInput, setUserIdInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const setSource = (next: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (next === 'all') p.delete('source');
    else p.set('source', next);
    startTransition(() => router.push(`/roles/${roleId}/users?${p.toString()}`));
  };

  const items = useMemo(() => data?.items ?? [], [data]);

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
      </div>

      <PermissionGate permission={Permission.ROLE_ASSIGN}>
        <div className="flex flex-wrap items-end gap-2 rounded border border-[var(--color-neutral-200)] p-3">
          <label className="flex-1 text-xs">
            Kullanıcı ID (cuid)
            <input
              className="ls-input mt-1 w-full font-mono text-sm"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="ls-btn ls-btn--primary ls-btn--sm"
            disabled={assignMutation.isPending}
            onClick={async () => {
              setMsg(null);
              try {
                await assignMutation.mutateAsync(userIdInput.trim());
                setUserIdInput('');
                setMsg('Atama yapıldı.');
              } catch (e: unknown) {
                const err = e as { response?: { data?: { error?: { message?: string } } } };
                setMsg(err.response?.data?.error?.message ?? 'Atama başarısız.');
              }
            }}
          >
            Ata
          </button>
        </div>
      </PermissionGate>

      {msg ? <p className="text-sm text-[var(--color-neutral-700)]">{msg}</p> : null}

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
                            await unassignMutation.mutateAsync(row.user.id);
                            void refetch();
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
