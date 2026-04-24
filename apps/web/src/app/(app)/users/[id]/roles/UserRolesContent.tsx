'use client';

import Link from 'next/link';

import { useUserQuery, useUserRolesQuery } from '@/lib/queries/users';

interface UserRolesContentProps {
  userId: string;
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

  const list = roles ?? [];
  const direct = list.filter((r) => r.source === 'DIRECT');
  const fromAttribute = list.filter((r) => r.source === 'ATTRIBUTE_RULE');

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
          Kullanıcı rolleri
        </h1>
        {user && !user.anonymizedAt && (
          <p className="mt-[var(--space-1)] text-sm text-[var(--color-neutral-600)]">
            {user.firstName} {user.lastName}
            {user.sicil ? (
              <span className="ml-2 font-mono text-[var(--color-neutral-500)]">({user.sicil})</span>
            ) : null}
          </p>
        )}
      </div>

      <div
        className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-[var(--space-4)] text-sm text-[var(--color-neutral-700)]"
        role="status"
      >
        Rol atama ve kaldırma (ROLE_ASSIGN) Faz 4 kapsamında. Bu ekran salt okunur; yalnızca mevcut
        atamaları listeler.
      </div>

      <section aria-labelledby="direct-roles-heading">
        <h2
          id="direct-roles-heading"
          className="mb-[var(--space-3)] text-base font-semibold text-[var(--color-neutral-800)]"
        >
          Doğrudan atanan roller
        </h2>
        {direct.length === 0 ? (
          <p className="text-sm text-[var(--color-neutral-500)]">Doğrudan atanmış rol yok.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-200)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
            {direct.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-1 px-[var(--space-4)] py-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <span className="font-medium text-[var(--color-neutral-900)]">{r.name}</span>
                  <span className="ml-2 font-mono text-sm text-[var(--color-neutral-500)]">
                    {r.code}
                  </span>
                </div>
                <time className="text-xs text-[var(--color-neutral-500)]" dateTime={r.assignedAt}>
                  {new Date(r.assignedAt).toLocaleString('tr-TR')}
                </time>
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
          Nitelik kurallarından gelen roller
        </h2>
        {fromAttribute.length === 0 ? (
          <p className="text-sm text-[var(--color-neutral-500)]">
            Nitelik kuralı ile atanan rol yok (Faz 4 ile genişletilebilir).
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-200)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
            {fromAttribute.map((r) => (
              <li key={r.id} className="px-[var(--space-4)] py-[var(--space-3)]">
                <span className="font-medium text-[var(--color-neutral-900)]">{r.name}</span>
                <span className="ml-2 font-mono text-sm text-[var(--color-neutral-500)]">
                  {r.code}
                </span>
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
