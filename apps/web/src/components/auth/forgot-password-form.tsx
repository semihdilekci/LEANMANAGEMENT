'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordResetRequestSchema } from '@leanmgmt/shared-schemas';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { apiClient, type ApiErrorBody } from '@/lib/api-client';

type FormValues = z.infer<typeof PasswordResetRequestSchema>;

function isApiError(data: unknown): data is ApiErrorBody {
  return typeof data === 'object' && data !== null && 'error' in data;
}

export function ForgotPasswordForm() {
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(PasswordResetRequestSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: FormValues): Promise<void> {
    setFormError(null);
    try {
      await apiClient.post('/api/v1/auth/password-reset-request', values);
      setDone(true);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: unknown } };
      const data = ax.response?.data;
      if (isApiError(data)) {
        setFormError(data.error.message);
      } else {
        setFormError('İstek gönderilemedi. Lütfen tekrar deneyin.');
      }
    }
  }

  if (done) {
    return (
      <div className="ls-card p-[var(--space-6)] shadow-[var(--shadow-md)]">
        <h1 className="mb-[var(--space-2)] text-lg font-semibold text-[var(--color-neutral-900)]">
          E-posta gönderildi
        </h1>
        <p className="mb-[var(--space-6)] text-sm text-[var(--color-neutral-600)]">
          Eğer bu email sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.
        </p>
        <Link href="/login" className="ls-btn ls-btn--secondary inline-block text-center">
          Girişe dön
        </Link>
      </div>
    );
  }

  return (
    <div className="ls-card p-[var(--space-6)] shadow-[var(--shadow-md)]">
      <h1 className="mb-[var(--space-2)] font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-neutral-900)]">
        Şifre sıfırlama
      </h1>
      <p className="mb-[var(--space-6)] text-sm text-[var(--color-neutral-600)]">
        Hesabınıza kayıtlı e-posta adresini girin; size bağlantı göndereceğiz.
      </p>

      <form
        className="flex flex-col gap-[var(--space-4)]"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        {formError ? (
          <div className="ls-alert ls-alert--danger" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="fp-email" className="text-sm font-medium text-[var(--color-neutral-800)]">
            E-posta
          </label>
          <input
            id="fp-email"
            type="email"
            autoComplete="email"
            className="ls-input"
            {...form.register('email')}
          />
          {form.formState.errors.email?.message ? (
            <p className="text-sm text-[var(--color-danger-600)]">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="ls-btn ls-btn--primary w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Gönderiliyor…' : 'Bağlantı gönder'}
        </button>

        <Link
          href="/login"
          className="text-center text-sm text-[var(--color-primary-600)] underline decoration-[var(--color-primary-600)] underline-offset-2"
        >
          Girişe dön
        </Link>
      </form>
    </div>
  );
}
