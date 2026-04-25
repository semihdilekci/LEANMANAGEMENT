'use client';

import { Permission } from '@leanmgmt/shared-types';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  UserRoleAssignDialog,
  useRoleOptionsForUserAssign,
} from '@/components/roles/UserRoleAssignDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PermissionGate } from '@/components/shared/PermissionGate';
import {
  useUserQuery,
  useUserRolesQuery,
  useAssignUserRoleOnUserPageMutation,
  useRemoveUserRoleOnUserPageMutation,
} from '@/lib/queries/users';
import type { UserRole } from '@/lib/queries/users';

interface UserRolesContentProps {
  userId: string;
}

function formatRuleSummary(r: UserRole) {
  if (r.source !== 'ATTRIBUTE_RULE' || !r.matchedConditionSet) {
    return null;
  }
  return JSON.stringify(r.matchedConditionSet, null, 2);
}

export function UserRolesContent({ userId }: UserRolesContentProps) {
  const {
    data: user,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useUserQuery(userId);
  const {
    data: roles,
    isLoading: rolesLoading,
    error: rolesError,
    refetch: refetchRoles,
  } = useUserRolesQuery(userId);

  const [assignOpen, setAssignOpen] = useState(false);
  const [removeRole, setRemoveRole] = useState<Pick<UserRole, 'id' | 'name' | 'code'> | null>(null);
  const assignMut = useAssignUserRoleOnUserPageMutation(userId);
  const removeMut = useRemoveUserRoleOnUserPageMutation(userId);

  const list = roles ?? [];
  const direct = list.filter((r) => r.source === 'DIRECT');
  const fromAttribute = list.filter((r) => r.source === 'ATTRIBUTE_RULE');
  const directIdSet = new Set(direct.map((r) => r.id));
  const { options: rolePickOptions, isLoading: pickLoading } =
    useRoleOptionsForUserAssign(directIdSet);

  const isLoading = userLoading || rolesLoading;
  const error = userError || rolesError;

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy className="space-y-[var(--space-3)]">
        <span className="sr-only">Roller yükleniyor...</span>
        <div className="h-10 w-64 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]" />
        <div className="ls-card h-32 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="ls-alert ls-alert--error">
        <p>Rol bilgileri yüklenemedi.</p>
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm mt-[var(--space-2)]"
          onClick={() => {
            void refetchUser();
            void refetchRoles();
          }}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  const bothEmpty = direct.length === 0 && fromAttribute.length === 0;

  return (
    <div className="space-y-[var(--space-8)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
            {user && !user.anonymizedAt
              ? `Kullanıcının Rolleri — ${user.firstName} ${user.lastName}`
              : 'Kullanıcı rolleri'}
          </h1>
          {user && !user.anonymizedAt && user.sicil ? (
            <p className="mt-[var(--space-1)] text-sm text-[var(--color-neutral-600)]">
              <span className="font-mono text-[var(--color-neutral-500)]">({user.sicil})</span>
            </p>
          ) : null}
        </div>
        {user && !user.anonymizedAt ? (
          <PermissionGate permission={Permission.ROLE_ASSIGN}>
            <button
              type="button"
              className="ls-btn ls-btn--primary ls-btn--sm"
              disabled={pickLoading || rolePickOptions.length === 0}
              onClick={() => setAssignOpen(true)}
            >
              Yeni rol ata
            </button>
          </PermissionGate>
        ) : null}
      </div>

      {bothEmpty ? (
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-neutral-300)] bg-[var(--color-neutral-0)] p-[var(--space-6)] text-center"
          role="status"
        >
          <p className="text-sm text-[var(--color-neutral-600)]">
            Bu kullanıcıya henüz rol atanmadı. Doğrudan atama yok; nitelik kuralıyla eşleşen rol de
            yok.
          </p>
        </div>
      ) : null}

      <UserRoleAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        availableRoleOptions={rolePickOptions}
        isSubmitting={assignMut.isPending}
        onConfirm={async (roleId) => {
          try {
            await assignMut.mutateAsync(roleId);
            toast.success('Rol atandı');
            void refetchRoles();
          } catch (e: unknown) {
            const err = e as { response?: { data?: { error?: { message?: string } } } };
            toast.error(err.response?.data?.error?.message ?? 'Rol atama başarısız');
          }
        }}
      />

      <ConfirmDialog
        open={removeRole !== null}
        title="Rolü kaldır"
        description={
          removeRole
            ? `"${removeRole.name}" (${removeRole.code}) bu kullanıcıdan kaldırılacak. Emin misiniz?`
            : ''
        }
        confirmLabel="Kaldır"
        destructive
        onOpenChange={(o) => {
          if (!o) setRemoveRole(null);
        }}
        onConfirm={async () => {
          if (!removeRole) return;
          try {
            await removeMut.mutateAsync(removeRole.id);
            toast.success('Rol kaldırıldı');
            setRemoveRole(null);
            void refetchRoles();
          } catch (e: unknown) {
            const err = e as { response?: { data?: { error?: { message?: string } } } };
            toast.error(err.response?.data?.error?.message ?? 'Kaldırma başarısız');
          }
        }}
      />

      <section aria-labelledby="direct-roles-heading">
        <h2
          id="direct-roles-heading"
          className="mb-[var(--space-3)] text-base font-semibold text-[var(--color-neutral-800)]"
        >
          Doğrudan atanan roller
          {direct.length > 0 ? (
            <span className="ml-2 text-sm font-normal text-[var(--color-neutral-500)]">
              {direct.length} rol
            </span>
          ) : null}
        </h2>
        {direct.length === 0 ? (
          <p className="text-sm text-[var(--color-neutral-500)]">Doğrudan atanmış rol yok.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-200)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
            {direct.map((r) => (
              <li
                key={`d-${r.id}`}
                className="flex flex-col gap-2 px-[var(--space-4)] py-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/roles/${r.id}`}
                    className="font-medium text-[var(--color-primary-800)] hover:underline"
                  >
                    {r.name}
                  </Link>
                  <span className="ml-2 font-mono text-sm text-[var(--color-neutral-500)]">
                    {r.code}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <time className="text-xs text-[var(--color-neutral-500)]" dateTime={r.assignedAt}>
                    {new Date(r.assignedAt).toLocaleString('tr-TR')}
                  </time>
                  <PermissionGate permission={Permission.ROLE_ASSIGN}>
                    <button
                      type="button"
                      className="text-xs text-[var(--color-error-700)] underline"
                      onClick={() => setRemoveRole({ id: r.id, name: r.name, code: r.code })}
                    >
                      Kaldır
                    </button>
                  </PermissionGate>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="attr-roles-heading">
        <h2
          id="attr-roles-heading"
          className="mb-[var(--space-3)] text-base font-semibold text-[var(--color-neutral-800)]"
        >
          Attribute kuralıyla gelen roller
        </h2>
        {fromAttribute.length === 0 ? (
          <p className="text-sm text-[var(--color-neutral-500)]">
            Attribute kuralıyla eşleşen rol yok.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-200)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
            {fromAttribute.map((r) => (
              <li
                key={`a-${r.id}-${r.matchedRuleId ?? 'x'}`}
                className="px-[var(--space-4)] py-[var(--space-3)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <Link
                      href={`/roles/${r.id}`}
                      className="font-medium text-[var(--color-primary-800)] hover:underline"
                    >
                      {r.name}
                    </Link>
                    <span className="ml-2 font-mono text-sm text-[var(--color-neutral-500)]">
                      {r.code}
                    </span>
                  </div>
                  <p
                    className="max-w-md text-xs text-[var(--color-neutral-500)]"
                    title="Bu rol kullanıcının niteliklerine göre otomatik; kullanımdan kaldırmak için niteliği değiştirmek veya kuralı güncellemek gerekir"
                  >
                    Nitelik kuralı ile; doğrudan kaldırılamaz.
                  </p>
                </div>
                {formatRuleSummary(r) ? (
                  <pre className="mt-2 max-w-full overflow-x-auto rounded border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-2 text-[10px] text-[var(--color-neutral-700)]">
                    {formatRuleSummary(r)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm">
        <Link href={`/users/${userId}`} className="text-[var(--color-primary-600)] hover:underline">
          Kullanıcı detayına dön
        </Link>
      </p>
    </div>
  );
}
