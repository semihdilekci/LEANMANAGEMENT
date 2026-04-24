import type { Metadata } from 'next';
import { Suspense } from 'react';

import { RoleList } from '@/components/roles/RoleList';

export const metadata: Metadata = {
  title: 'Roller',
};

export default function RolesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]" />
      }
    >
      <RoleList />
    </Suspense>
  );
}
