'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChangePasswordFormSchema, type ChangePasswordFormInput } from '@leanmgmt/shared-schemas';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { isAxiosError } from 'axios';

import { type ApiErrorBody, apiClient } from '@/lib/api-client';

function isApiError(data: unknown): data is ApiErrorBody {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    (data as { success: unknown }).success === false &&
    'error' in data
  );
}

export function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const required = searchParams.get('required') === 'true';
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(ChangePasswordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: ChangePasswordFormInput): Promise<void> {
    setFormError(null);
    try {
      await apiClient.post('/api/v1/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      router.replace('/dashboard');
      router.refresh();
    } catch (e: unknown) {
      if (isAxiosError(e) && e.response?.data && isApiError(e.response.data)) {
        const err = e.response.data.error;
        if (err.code === 'AUTH_INVALID_CREDENTIALS') {
          form.setError('currentPassword', { message: 'Mevcut şifre hatalı' });
        } else if (
          err.code === 'VALIDATION_FAILED' &&
          err.details &&
          typeof err.details === 'object'
        ) {
          const details = err.details as { rule?: string; fields?: Record<string, string> };
          if (details.rule === 'PASSWORD_REUSE') {
            form.setError('newPassword', { message: 'Son 5 şifreden birini kullanamazsınız' });
          } else if (details.rule === 'PASSWORD_SAME_AS_CURRENT') {
            form.setError('newPassword', { message: 'Yeni şifre mevcut şifreyle aynı olamaz' });
          } else if (details.fields) {
            for (const [k, v] of Object.entries(details.fields)) {
              if (k === 'newPassword' || k === 'currentPassword') {
                form.setError(k, { message: v });
              }
            }
          } else {
            setFormError(err.message);
          }
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Şifre güncellenemedi. Lütfen tekrar deneyin.');
      }
    }
  }

  return (
    <div className="ls-card max-w-lg p-[var(--space-6)] shadow-[var(--shadow-md)]">
      <h1 className="mb-[var(--space-2)] font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-neutral-900)]">
        Şifre değiştir
      </h1>
      {required ? (
        <div className="ls-alert ls-alert--danger mb-[var(--space-4)]" role="alert">
          Şifrenizin süresi dolmuştur. Devam etmek için yeni bir şifre belirleyin.
        </div>
      ) : null}

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
          <label
            htmlFor="cp-current"
            className="text-sm font-medium text-[var(--color-neutral-800)]"
          >
            Mevcut şifre
          </label>
          <input
            id="cp-current"
            type="password"
            autoComplete="current-password"
            className="ls-input"
            aria-required="true"
            aria-invalid={form.formState.errors.currentPassword ? 'true' : 'false'}
            {...form.register('currentPassword')}
          />
          {form.formState.errors.currentPassword?.message ? (
            <p className="text-sm text-[var(--color-danger-600)]" role="status">
              {form.formState.errors.currentPassword.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="cp-new" className="text-sm font-medium text-[var(--color-neutral-800)]">
            Yeni şifre
          </label>
          <input
            id="cp-new"
            type="password"
            autoComplete="new-password"
            className="ls-input"
            aria-required="true"
            aria-invalid={form.formState.errors.newPassword ? 'true' : 'false'}
            {...form.register('newPassword')}
          />
          {form.formState.errors.newPassword?.message ? (
            <p className="text-sm text-[var(--color-danger-600)]" role="status">
              {form.formState.errors.newPassword.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-[var(--space-1)]">
          <label
            htmlFor="cp-confirm"
            className="text-sm font-medium text-[var(--color-neutral-800)]"
          >
            Yeni şifre (tekrar)
          </label>
          <input
            id="cp-confirm"
            type="password"
            autoComplete="new-password"
            className="ls-input"
            aria-required="true"
            aria-invalid={form.formState.errors.confirmPassword ? 'true' : 'false'}
            {...form.register('confirmPassword')}
          />
          {form.formState.errors.confirmPassword?.message ? (
            <p className="text-sm text-[var(--color-danger-600)]" role="status">
              {form.formState.errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        <p className="text-xs text-[var(--color-neutral-500)]">
          En az 12 karakter, büyük-küçük harf, rakam ve özel karakter gerekir.
        </p>

        <div className="flex flex-col-reverse gap-[var(--space-2)] sm:flex-row sm:justify-end">
          {!required ? (
            <Link href="/dashboard" className="ls-btn ls-btn--neutral w-full text-center sm:w-auto">
              İptal
            </Link>
          ) : null}
          <button
            type="submit"
            className="ls-btn ls-btn--primary w-full sm:w-auto"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Kaydediliyor…' : 'Şifreyi değiştir'}
          </button>
        </div>
      </form>
    </div>
  );
}
