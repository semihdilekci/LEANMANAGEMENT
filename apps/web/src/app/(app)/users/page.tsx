import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { UserList } from '@/components/users/UserList';

export const metadata: Metadata = {
  title: 'Kullanıcılar',
};

export default function UsersPage() {
  return (
    <div className="space-y-[var(--space-6)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
            Kullanıcılar
          </h1>
          <p className="mt-[var(--space-1)] text-sm text-[var(--color-neutral-500)]">
            Sistemdeki tüm kullanıcıları görüntüleyin ve yönetin.
          </p>
        </div>
        <Link href="/users/new" className="ls-btn ls-btn--primary">
          + Yeni Kullanıcı
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="space-y-[var(--space-3)]" role="status" aria-live="polite">
            <span className="sr-only">Yükleniyor...</span>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]"
              />
            ))}
          </div>
        }
      >
        <UserList />
      </Suspense>
    </div>
  );
}
