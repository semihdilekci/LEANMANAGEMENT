'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Permission } from '@leanmgmt/shared-types';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PermissionGate } from '@/components/shared/PermissionGate';
import {
  datetimeLocalToIsoUtc,
  isEffectiveFromPublishValid,
  isoToDatetimeLocalValue,
  minEffectiveFromIsoForPublish,
} from '@/lib/consent-publish-ui';
import {
  useConsentVersionDetailQuery,
  usePatchConsentVersionMutation,
  usePublishConsentVersionMutation,
} from '@/lib/queries/admin-consent-versions';

export function ConsentVersionEditPageClient() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  const detail = useConsentVersionDetailQuery(id, !!id);
  const patch = usePatchConsentVersionMutation(id);
  const publish = usePublishConsentVersionMutation(id);

  const [content, setContent] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [effectiveLocal, setEffectiveLocal] = useState('');

  useEffect(() => {
    if (detail.data?.content != null) setContent(detail.data.content);
  }, [detail.data?.content]);

  useEffect(() => {
    if (publishOpen) {
      setEffectiveLocal(isoToDatetimeLocalValue(minEffectiveFromIsoForPublish(Date.now())));
    }
  }, [publishOpen]);

  const isDraft = detail.data?.status === 'DRAFT';

  async function onSave(): Promise<void> {
    if (!isDraft) return;
    if (content.length < 100) {
      toast.error('İçerik en az 100 karakter olmalıdır');
      return;
    }
    try {
      await patch.mutateAsync({ content });
      toast.success('Taslak kaydedildi');
    } catch {
      toast.error('Kayıt başarısız');
    }
  }

  async function onPublishConfirm(): Promise<void> {
    let iso: string;
    try {
      iso = datetimeLocalToIsoUtc(effectiveLocal);
    } catch {
      toast.error('Tarih geçersiz');
      throw new Error('invalid');
    }
    const now = Date.now();
    if (!isEffectiveFromPublishValid(iso, now)) {
      toast.error('Yürürlük tarihi en az bir dakika sonrası olmalıdır');
      throw new Error('invalid');
    }
    try {
      await publish.mutateAsync({ effectiveFrom: iso });
      toast.success('Rıza metni yayınlandı');
    } catch {
      toast.error('Yayın başarısız');
      throw new Error('failed');
    }
  }

  if (!id) {
    return <p className="text-sm text-[var(--color-error-700)]">Geçersiz adres.</p>;
  }

  if (detail.isPending) {
    return <p className="text-sm text-[var(--color-neutral-600)]">Yükleniyor…</p>;
  }

  if (detail.error || !detail.data) {
    return <p className="text-sm text-[var(--color-error-700)]">Sürüm yüklenemedi.</p>;
  }

  const d = detail.data;

  return (
    <div className="mx-auto max-w-3xl space-y-[var(--space-6)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-neutral-900)]">
            Rıza sürümü {d.version}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
            Durum: {d.status}
            {d.isActive ? ' · Aktif yapılandırma' : ''}
          </p>
        </div>
        <Link
          href="/admin/consent-versions"
          className="text-sm text-[var(--color-primary-600)] underline underline-offset-2"
        >
          Listeye dön
        </Link>
      </div>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)] p-[var(--space-4)]">
        <h2 className="text-sm font-semibold text-[var(--color-neutral-900)]">
          Başlık (salt okunur)
        </h2>
        <p className="mt-1 text-sm text-[var(--color-neutral-800)]">{d.title}</p>
      </section>

      {isDraft ? (
        <PermissionGate
          permission={Permission.CONSENT_VERSION_EDIT}
          fallback={
            <section>
              <h2 className="text-sm font-semibold text-[var(--color-neutral-900)]">İçerik</h2>
              <pre className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-3 font-mono text-xs text-[var(--color-neutral-800)]">
                {d.body}
              </pre>
            </section>
          }
        >
          <section className="space-y-3">
            <label className="block text-sm text-[var(--color-neutral-700)]">
              İçerik
              <textarea
                className="ls-input mt-1 min-h-[16rem] w-full font-mono text-sm"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                minLength={100}
                maxLength={50_000}
              />
            </label>
            <p className="text-xs text-[var(--color-neutral-500)]">{content.length} karakter</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="ls-btn ls-btn--primary ls-btn--sm"
                disabled={patch.isPending}
                onClick={() => void onSave()}
              >
                {patch.isPending ? 'Kaydediliyor…' : 'Taslağı kaydet'}
              </button>
              <PermissionGate permission={Permission.CONSENT_VERSION_PUBLISH}>
                <button
                  type="button"
                  className="ls-btn ls-btn--neutral ls-btn--sm"
                  onClick={() => setPublishOpen(true)}
                >
                  Yayınla…
                </button>
              </PermissionGate>
            </div>
          </section>
        </PermissionGate>
      ) : (
        <section>
          <h2 className="text-sm font-semibold text-[var(--color-neutral-900)]">İçerik</h2>
          <pre className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-3 font-mono text-xs text-[var(--color-neutral-800)]">
            {d.body}
          </pre>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-[var(--color-neutral-900)]">
          Önizleme (düz metin)
        </h2>
        <pre className="mt-2 max-h-[24rem] overflow-auto whitespace-pre-wrap rounded border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-3 text-sm text-[var(--color-neutral-800)]">
          {isDraft ? content : d.body}
        </pre>
      </section>

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Rıza metnini yayınla"
        description="Yürürlük tarihi en az bir dakika sonrası olmalıdır. Yayın sonrası kullanıcılar yeniden onay isteyebilir."
        confirmLabel="Yayınla"
        onConfirm={onPublishConfirm}
      >
        <label className="mt-2 block text-sm text-[var(--color-neutral-700)]">
          Yürürlük tarihi (yerel)
          <input
            type="datetime-local"
            className="ls-input mt-1 w-full max-w-xs"
            min={isoToDatetimeLocalValue(minEffectiveFromIsoForPublish(Date.now()))}
            value={effectiveLocal}
            onChange={(e) => setEffectiveLocal(e.target.value)}
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}
