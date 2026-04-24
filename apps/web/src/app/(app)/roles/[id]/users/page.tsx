import type { Metadata } from 'next';
import { Suspense } from 'react';

import { RoleUsersTable } from '@/components/roles/RoleUsersTable';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Rol Kullanıcıları' };
}

export default async function RoleUsersPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="h-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]" />
      }
    >
      <RoleUsersTable roleId={id} />
    </Suspense>
  );
}
