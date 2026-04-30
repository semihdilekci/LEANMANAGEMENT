'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema } from '@leanmgmt/shared-schemas';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { sanitizeInternalRedirectPath } from '@leanmgmt/shared-utils/internal-redirect-path';

import { isAxiosError } from 'axios';

import { type ApiErrorBody, loginRequest, refreshAccessToken } from '@/lib/api-client';
import {
  buildOidcGoogleStartHref,
  isOidcLoginButtonEnabled,
  isPasswordLoginFormEnabled,
  messageForOidcLoginError,
} from '@/lib/oidc-login-ui';
import {
  resolvePostLoginPath,
  shouldForcePasswordChangeBeforeApp,
} from '@/lib/post-login-redirect';
import { useAuthStore } from '@/stores/auth-store';

type LoginFormValues = z.infer<typeof LoginSchema>;

/** React Strict Mode çift effect + aynı query tekrarını tek uçuşta sınırlar */
let lmLastOidcSuccessSearch: string | null = null;

function isApiError(data: unknown): data is ApiErrorBody {
  return typeof data === 'object' && data !== null && 'error' in data;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  /** OIDC query hataları genelde tekrar denenebilir — kırmızı alarm yerine uyarı tonu */
  const [errorBannerTone, setErrorBannerTone] = useState<'danger' | 'warning'>('danger');
  const [lockCountdown, setLockCountdown] = useState<string | null>(null);
  const [oidcCompleting, setOidcCompleting] = useState(false);
  const redirectParam = searchParams.get('redirect');
  const redirectTo = resolvePostLoginPath(redirectParam);
  const oidcErrorHandledKey = useRef<string | null>(null);

  const showOidc = isOidcLoginButtonEnabled();
  const showPassword = isPasswordLoginFormEnabled();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const navigateAfterAuthenticatedSession = useCallback((): void => {
    const u = useAuthStore.getState().currentUser;
    if (shouldForcePasswordChangeBeforeApp(u)) {
      router.replace('/profile/change-password?required=true');
      router.refresh();
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }, [router, redirectTo]);

  useEffect(() => {
    if (searchParams.get('oidc') !== 'error') return;
    const errCode = searchParams.get('error') ?? '';
    const key = `${searchParams.toString()}`;
    if (oidcErrorHandledKey.current === key) return;
    oidcErrorHandledKey.current = key;

    const msg = messageForOidcLoginError(errCode);
    setFormError(msg ?? 'Kurumsal giriş başarısız. Lütfen tekrar deneyin.');
    setErrorBannerTone('warning');

    const next = new URLSearchParams();
    const safeRedirect = sanitizeInternalRedirectPath(redirectParam);
    if (safeRedirect) next.set('redirect', safeRedirect);
    router.replace(next.toString() ? `/login?${next}` : '/login');
  }, [searchParams, router, redirectParam]);

  useEffect(() => {
    if (searchParams.get('oidc') !== 'success') return;
    const q = searchParams.toString();
    if (lmLastOidcSuccessSearch === q) return;
    lmLastOidcSuccessSearch = q;

    setFormError(null);
    setErrorBannerTone('danger');
    setOidcCompleting(true);

    void (async () => {
      try {
        await refreshAccessToken();
        navigateAfterAuthenticatedSession();
      } catch {
        lmLastOidcSuccessSearch = null;
        setFormError('Oturum tamamlanamadı. Lütfen kurumsal girişi yeniden deneyin.');
        setErrorBannerTone('danger');
      } finally {
        setOidcCompleting(false);
      }
    })();
  }, [searchParams, navigateAfterAuthenticatedSession]);

  async function onSubmit(values: LoginFormValues): Promise<void> {
    setFormError(null);
    setErrorBannerTone('danger');
    setLockCountdown(null);
    try {
      await loginRequest(values.email, values.password);
      navigateAfterAuthenticatedSession();
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

  const oidcStartHref = buildOidcGoogleStartHref(redirectParam);

  return (
    <div className="ls-card p-[var(--space-6)] shadow-[var(--shadow-md)]">
      <h1 className="mb-[var(--space-2)] font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-neutral-900)]">
        Giriş yap
      </h1>
      <p className="mb-[var(--space-6)] text-sm text-[var(--color-neutral-600)]">
        {showOidc
          ? 'Kurumsal hesabınızla (Google veya SSO) veya e-posta ile oturum açın.'
          : 'Platforma erişmek için hesabınızla giriş yapın.'}
      </p>

      {formError ? (
        <div className={`ls-alert mb-[var(--space-4)] ls-alert--${errorBannerTone}`} role="alert">
          {formError}
          {lockCountdown ? (
            <span className="mt-[var(--space-2)] block text-sm opacity-90">{lockCountdown}</span>
          ) : null}
        </div>
      ) : null}

      {showOidc ? (
        <div className="mb-[var(--space-6)] flex flex-col gap-[var(--space-3)]">
          <a
            href={oidcStartHref}
            className="ls-btn ls-btn--secondary w-full text-center no-underline"
            aria-label="Kurumsal hesap ile giriş (Google veya SSO)"
          >
            Kurumsal hesap ile giriş
          </a>
          {oidcCompleting ? (
            <p className="text-center text-sm text-[var(--color-neutral-600)]" role="status">
              Oturum tamamlanıyor…
            </p>
          ) : null}
          {showPassword ? (
            <p className="text-center text-sm text-[var(--color-neutral-500)]">veya e-posta ile</p>
          ) : null}
        </div>
      ) : null}

      {showPassword ? (
        <form
          className="flex flex-col gap-[var(--space-4)]"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
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
      ) : null}

      {!showOidc && !showPassword ? (
        <p className="text-sm text-[var(--color-danger-600)]" role="alert">
          Giriş yöntemi yapılandırılmamış. Sistem yöneticinize başvurun.
        </p>
      ) : null}

      <p className="mt-[var(--space-6)] text-center text-xs text-[var(--color-neutral-500)]">
        Hesabınız yoksa sistem yöneticinizle iletişime geçin.
      </p>
    </div>
  );
}
