'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema } from '@leanmgmt/shared-schemas';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { isAxiosError } from 'axios';

import { type ApiErrorBody, loginRequest } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

type LoginFormValues = z.infer<typeof LoginSchema>;

function isApiError(data: unknown): data is ApiErrorBody {
  return typeof data === 'object' && data !== null && 'error' in data;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [lockCountdown, setLockCountdown] = useState<string | null>(null);
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginFormValues): Promise<void> {
    setFormError(null);
    setLockCountdown(null);
    try {
      await loginRequest(values.email, values.password);
      const u = useAuthStore.getState().currentUser;
      if (u?.passwordExpiresAt) {
        const exp = new Date(u.passwordExpiresAt);
        if (exp.getTime() < Date.now()) {
          router.replace('/profile/change-password?required=true');
          router.refresh();
          return;
        }
      }
      router.replace(redirectTo.startsWith('/') ? redirectTo : '/dashboard');
      router.refresh();
    } catch (e: unknown) {
      if (isAxiosError(e) && e.response?.data && isApiError(e.response.data)) {
        const { code, message, details } = e.response.data.error;
        if (code === 'AUTH_ACCOUNT_LOCKED' && details?.unlocksAt) {
          const until = new Date(String(details.unlocksAt));
          setFormError('Hesabınız geçici olarak kilitlendi.');
          setLockCountdown(
            `Kilit ${until.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })} itibarıyla kalkar.`,
          );
        } else if (
          code === 'RATE_LIMIT_IP' ||
          code === 'RATE_LIMIT_USER' ||
          code === 'RATE_LIMIT_LOGIN'
        ) {
          const s = details?.retryAfterSeconds;
          setFormError(
            s != null && typeof s === 'number'
              ? `Çok fazla deneme. En az ${s} sn sonra tekrar deneyin.`
              : message,
          );
        } else {
          setFormError(message);
        }
        return;
      }
      if (e && typeof e === 'object' && 'response' in e) {
        const data = (e as { response?: { data?: unknown } }).response?.data;
        if (isApiError(data)) {
          setFormError(data.error.message);
          return;
        }
      }
      setFormError('Giriş yapılamadı. Lütfen tekrar deneyin.');
    }
  }

  return (
    <div className="ls-card p-[var(--space-6)] shadow-[var(--shadow-md)]">
      <h1 className="mb-[var(--space-2)] font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-neutral-900)]">
        Giriş yap
      </h1>
      <p className="mb-[var(--space-6)] text-sm text-[var(--color-neutral-600)]">
        Kurumsal e-posta ve şifrenizle oturum açın.
      </p>

      <form
        className="flex flex-col gap-[var(--space-4)]"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        {formError ? (
          <div className="ls-alert ls-alert--danger" role="alert">
            {formError}
            {lockCountdown ? (
              <span className="mt-[var(--space-2)] block text-sm opacity-90">{lockCountdown}</span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-[var(--space-1)]">
          <label
            htmlFor="login-email"
            className="text-sm font-medium text-[var(--color-neutral-800)]"
          >
            E-posta
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className="ls-input"
            aria-required="true"
            aria-invalid={form.formState.errors.email ? 'true' : 'false'}
            {...form.register('email')}
          />
          {form.formState.errors.email?.message ? (
            <p className="text-sm text-[var(--color-danger-600)]" role="status">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-[var(--space-1)]">
          <label
            htmlFor="login-password"
            className="text-sm font-medium text-[var(--color-neutral-800)]"
          >
            Şifre
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="ls-input"
            aria-required="true"
            aria-invalid={form.formState.errors.password ? 'true' : 'false'}
            {...form.register('password')}
          />
          {form.formState.errors.password?.message ? (
            <p className="text-sm text-[var(--color-danger-600)]" role="status">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-[var(--space-3)]">
          <Link
            href="/forgot-password"
            className="text-sm text-[var(--color-primary-600)] underline decoration-[var(--color-primary-600)] underline-offset-2"
          >
            Şifremi unuttum
          </Link>
        </div>

        <button
          type="submit"
          className="ls-btn ls-btn--primary w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </div>
  );
}
