import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Yeni şifre',
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="ls-card p-[var(--space-6)]" role="status">
          Yükleniyor…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
