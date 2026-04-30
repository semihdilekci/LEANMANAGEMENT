'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { useCreateConsentVersionMutation } from '@/lib/queries/admin-consent-versions';

const PLACEHOLDER =
  'Bu alana en az 100 karakterlik rıza metni girin. KVKK kapsamında işlenen veriler, amaçlar ve haklarınız açıkça anlatılmalıdır. ' +
  'Taslak yayınlanana kadar yalnızca yetkili yöneticiler görebilir.';

export function ConsentVersionNewPageClient() {
  const router = useRouter();
  const create = useCreateConsentVersionMutation();
  const [content, setContent] = useState('');

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (content.length < 100) {
      toast.error('İçerik en az 100 karakter olmalıdır');
      return;
    }
    try {
      const row = await create.mutateAsync({ content });
      toast.success('Taslak oluşturuldu');
      router.replace(`/admin/consent-versions/${encodeURIComponent(row.id)}/edit`);
    } catch {
      toast.error('Taslak oluşturulamadı');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-[var(--space-6)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        <h1 className="text-xl font-semibold text-[var(--color-neutral-900)]">Yeni rıza taslağı</h1>
        <Link
          href="/admin/consent-versions"
          className="text-sm text-[var(--color-primary-600)] underline underline-offset-2"
        >
          Listeye dön
        </Link>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <label className="block text-sm text-[var(--color-neutral-700)]">
          İçerik (Markdown benzeri düz metin)
          <textarea
            required
            minLength={100}
            maxLength={50_000}
            className="ls-input mt-1 min-h-[16rem] w-full font-mono text-sm"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={PLACEHOLDER}
          />
        </label>
        <p className="text-xs text-[var(--color-neutral-500)]">
          {content.length} / 50.000 karakter
        </p>
        <button
          type="submit"
          className="ls-btn ls-btn--primary ls-btn--sm"
          disabled={create.isPending}
        >
          {create.isPending ? 'Oluşturuluyor…' : 'Taslak oluştur'}
        </button>
      </form>
    </div>
  );
}
