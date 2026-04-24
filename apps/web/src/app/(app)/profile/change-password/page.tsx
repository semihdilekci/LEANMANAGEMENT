import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ChangePasswordForm } from '@/components/auth/change-password-form';

export const metadata: Metadata = {
  title: 'Şifre değiştir',
};

function Fallback() {
  return (
    <div className="ls-card p-[var(--space-6)]" role="status">
      <p className="text-sm text-[var(--color-neutral-600)]">Yükleniyor…</p>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ChangePasswordForm />
    </Suspense>
  );
}
