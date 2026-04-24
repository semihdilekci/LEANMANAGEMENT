import type { Metadata } from 'next';
import Link from 'next/link';

import { UserRolesContent } from './UserRolesContent';

export const metadata: Metadata = {
  title: 'Kullanıcı rolleri',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserRolesPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="space-y-[var(--space-6)]">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-[var(--space-2)] text-sm text-[var(--color-neutral-500)]">
          <li>
            <Link href="/users" className="hover:text-[var(--color-primary-600)]">
              Kullanıcılar
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/users/${id}`} className="hover:text-[var(--color-primary-600)]">
              Detay
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--color-neutral-800)]">Roller</li>
        </ol>
      </nav>

      <UserRolesContent userId={id} />
    </div>
  );
}
