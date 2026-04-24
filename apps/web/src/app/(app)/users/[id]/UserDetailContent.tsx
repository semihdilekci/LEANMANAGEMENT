'use client';

import { UserDetailCard } from '@/components/users/UserDetailCard';
import { useUserQuery } from '@/lib/queries/users';

interface UserDetailContentProps {
  userId: string;
}

export function UserDetailContent({ userId }: UserDetailContentProps) {
  const { data: user, isLoading, error, refetch } = useUserQuery(userId);

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy className="space-y-[var(--space-4)]">
        <span className="sr-only">Kullanıcı yükleniyor...</span>
        <div className="h-10 w-64 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]" />
        <div className="ls-card h-48 animate-pulse p-[var(--space-6)] bg-[var(--color-neutral-50)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="ls-alert ls-alert--error">
        <p>Kullanıcı yüklenemedi.</p>
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm mt-[var(--space-2)]"
          onClick={() => void refetch()}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div role="alert" className="ls-alert ls-alert--error">
        Kullanıcı bulunamadı.
      </div>
    );
  }

  return <UserDetailCard user={user} />;
}
