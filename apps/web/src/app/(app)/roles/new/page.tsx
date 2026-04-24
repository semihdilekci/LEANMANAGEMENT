import type { Metadata } from 'next';
import Link from 'next/link';

import { RoleForm } from '@/components/roles/RoleForm';

export const metadata: Metadata = {
  title: 'Yeni Rol',
};

export default function NewRolePage() {
  return (
    <div className="space-y-[var(--space-4)]">
      <nav className="text-sm text-[var(--color-neutral-600)]">
        <Link href="/roles" className="hover:text-[var(--color-primary-600)]">
          Roller
        </Link>
        <span aria-hidden> / </span>
        <span className="text-[var(--color-neutral-900)]">Yeni</span>
      </nav>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
        Yeni Rol
      </h1>
      <RoleForm />
    </div>
  );
}
