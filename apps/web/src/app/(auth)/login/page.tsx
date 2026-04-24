import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Giriş',
};

function LoginFallback() {
  return (
    <div className="ls-card p-[var(--space-6)]" role="status">
      <p className="text-sm text-[var(--color-neutral-600)]">Yükleniyor…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
