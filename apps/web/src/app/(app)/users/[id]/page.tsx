import type { Metadata } from 'next';
import Link from 'next/link';

import { UserDetailContent } from './UserDetailContent';

export const metadata: Metadata = {
  title: 'Kullanıcı Detayı',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: PageProps) {
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
          <li className="text-[var(--color-neutral-800)]">Detay</li>
        </ol>
      </nav>

      <UserDetailContent userId={id} />
    </div>
  );
}
