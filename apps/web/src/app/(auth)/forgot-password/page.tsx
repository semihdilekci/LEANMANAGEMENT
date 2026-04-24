import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Şifre sıfırlama',
};

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="ls-card p-[var(--space-6)]" role="status">
          Yükleniyor…
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
