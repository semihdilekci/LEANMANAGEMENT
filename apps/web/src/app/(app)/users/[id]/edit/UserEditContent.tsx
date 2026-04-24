'use client';

import { UserForm } from '@/components/users/UserForm';
import { useUserQuery } from '@/lib/queries/users';

interface UserEditContentProps {
  userId: string;
}

export function UserEditContent({ userId }: UserEditContentProps) {
  const { data: user, isLoading, error } = useUserQuery(userId);

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy className="space-y-[var(--space-4)]">
        <span className="sr-only">Yükleniyor...</span>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]"
          />
        ))}
      </div>
    );
  }

  if (error || !user) {
    return (
      <div role="alert" className="ls-alert ls-alert--error">
        Kullanıcı bilgileri yüklenemedi.
      </div>
    );
  }

  return <UserForm mode="edit" userId={userId} defaultValues={user} />;
}
