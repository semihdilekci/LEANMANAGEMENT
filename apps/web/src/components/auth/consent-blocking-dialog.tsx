'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { type ApiErrorBody, apiClient, logoutRequest } from '@/lib/api-client';
import { authQueryKeys, useConsentVersionQuery } from '@/lib/queries/auth';
import { type AuthUser } from '@/stores/auth-store';

function isApiError(data: unknown): data is ApiErrorBody {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    (data as { success: unknown }).success === false &&
    'error' in data
  );
}

type Props = {
  user: AuthUser;
  open: boolean;
};

export function ConsentBlockingDialog({ user, open }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const descId = useId();
  const [agreed, setAgreed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const versionId = user.activeConsentVersionId;
  const query = useConsentVersionQuery(versionId, open && !!versionId);
  const queryClient = useQueryClient();

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onCancel = (e: Event) => e.preventDefault();
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, []);

  async function onLogout(): Promise<void> {
    await logoutRequest();
    window.location.href = '/login';
  }

  async function onAccept(): Promise<void> {
    if (!versionId) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await apiClient.post('/api/v1/auth/consent/accept', { consentVersionId: versionId });
      await queryClient.invalidateQueries({ queryKey: authQueryKeys.me });
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.consentVersion(versionId) });
      window.location.reload();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: unknown } };
      const data = ax.response?.data;
      if (isApiError(data)) {
        setFormError(data.error.message);
      } else {
        setFormError('Onay kaydedilemedi. Ağ bağlantınızı kontrol edin.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !versionId) return null;

  return (
    <dialog
      ref={dialogRef}
      className="max-h-[min(90vh,720px)] w-full max-w-lg border-0 bg-[var(--color-neutral-0)] p-0 shadow-[var(--shadow-lg)] [backdrop-filter:blur(4px)] [&::backdrop]:bg-[var(--color-neutral-900)] [&::backdrop]:opacity-50"
      aria-labelledby="consent-title"
      aria-describedby={descId}
      role="alertdialog"
    >
      <div className="flex max-h-[min(90vh,720px)] flex-col p-[var(--space-6)]">
        <h2
          id="consent-title"
          className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-neutral-900)]"
        >
          Aydınlatma ve Açık Rıza
        </h2>
        <p className="mt-[var(--space-2)] text-sm text-[var(--color-neutral-600)]">
          Platformu kullanmak için aşağıdaki rıza metnini onaylamanız gerekmektedir.
        </p>

        <div
          id={descId}
          className="mt-[var(--space-4)] max-h-[min(400px,50vh)] overflow-y-auto rounded-md border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-[var(--space-3)] text-sm text-[var(--color-neutral-800)]"
        >
          {query.isLoading ? (
            <p className="text-[var(--color-neutral-500)]" role="status">
              Rıza metni yükleniyor…
            </p>
          ) : query.isError ? (
            <p className="text-[var(--color-danger-600)]">
              Rıza metni yüklenemedi. Lütfen sayfayı yenileyin.
            </p>
          ) : (
            <>
              {query.data?.title ? (
                <p className="mb-[var(--space-2)] font-medium">{query.data.title}</p>
              ) : null}
              <p className="whitespace-pre-wrap">{query.data?.body ?? ''}</p>
            </>
          )}
        </div>

        <label className="mt-[var(--space-4)] flex cursor-pointer items-start gap-[var(--space-2)] text-sm text-[var(--color-neutral-800)]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={() => {
              setAgreed((v) => !v);
            }}
            className="mt-1 h-4 w-4 rounded border border-[var(--color-neutral-300)]"
          />
          <span>Rıza metnini okudum ve onaylıyorum</span>
        </label>

        {formError ? (
          <div className="ls-alert ls-alert--danger mt-[var(--space-3)]" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="mt-[var(--space-6)] flex flex-col-reverse gap-[var(--space-3)] sm:flex-row sm:justify-end">
          <button
            type="button"
            className="ls-btn ls-btn--neutral w-full sm:w-auto"
            onClick={() => void onLogout()}
            disabled={submitting}
          >
            Çıkış Yap
          </button>
          <button
            type="button"
            className="ls-btn ls-btn--primary w-full sm:w-auto"
            disabled={!agreed || submitting || query.isLoading || !query.data}
            onClick={() => void onAccept()}
          >
            {submitting ? 'Kaydediliyor…' : 'Onaylıyorum'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
