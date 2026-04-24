'use client';

import Link from 'next/link';

import type { RoleDetail } from '@/lib/queries/roles';

export function RoleSummaryBand({
  role,
  active,
}: {
  role: RoleDetail;
  active: 'permissions' | 'rules' | 'users';
}) {
  const tabClass = (key: typeof active) =>
    `rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm font-medium ${
      active === key
        ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]'
        : 'text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]'
    }`;

  return (
    <div className="sticky top-0 z-10 mb-[var(--space-4)] border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] pb-[var(--space-3)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        <div>
          <p className="font-mono text-sm text-[var(--color-neutral-500)]">{role.code}</p>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-neutral-900)]">
            {role.name}
          </h2>
          <p className="text-xs text-[var(--color-neutral-500)]">
            Yetki: {role.permissionCount} · Kural: {role.ruleCount}
          </p>
        </div>
        <nav aria-label="Rol alt sayfaları" className="flex flex-wrap gap-[var(--space-2)]">
          <Link href={`/roles/${role.id}/permissions`} className={tabClass('permissions')}>
            Yetkiler
          </Link>
          <Link href={`/roles/${role.id}/rules`} className={tabClass('rules')}>
            Kurallar
          </Link>
          <Link href={`/roles/${role.id}/users`} className={tabClass('users')}>
            Kullanıcılar
          </Link>
        </nav>
      </div>
    </div>
  );
}
