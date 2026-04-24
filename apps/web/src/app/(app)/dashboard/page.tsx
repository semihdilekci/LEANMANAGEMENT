'use client';

import { useAuthStore } from '@/stores/auth-store';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.currentUser);

  return (
    <div className="ls-card p-[var(--space-8)] shadow-[var(--shadow-md)]">
      <h1 className="mb-[var(--space-2)] font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
        Ana sayfa
      </h1>
      <p className="text-[var(--color-neutral-600)]">
        Hoş geldiniz{user?.firstName ? `, ${user.firstName}` : ''}. Oturumunuz aktif.
      </p>
      {user?.email ? (
        <p className="mt-[var(--space-4)] text-sm text-[var(--color-neutral-600)]">
          E-posta: {user.email}
        </p>
      ) : null}
    </div>
  );
}
