'use client';

import DOMPurify from 'isomorphic-dompurify';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { UpdateEmailTemplateInput } from '@leanmgmt/shared-schemas';

import { notificationEventLabel } from '@/lib/notification-ui';
import {
  useEmailTemplateDetailQuery,
  useEmailTemplatePreviewMutation,
  useEmailTemplateSendTestMutation,
  useUpdateEmailTemplateMutation,
} from '@/lib/queries/email-templates';
import { useAuthStore } from '@/stores/auth-store';

const PURIFY_PREVIEW: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'ul',
    'ol',
    'li',
    'a',
    'h1',
    'h2',
    'h3',
    'div',
    'span',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  ALLOWED_ATTR: ['href', 'class', 'style'],
};

export function EmailTemplateEditor({ eventType }: { eventType: string }) {
  const { data, isLoading, isError, refetch } = useEmailTemplateDetailQuery(eventType);
  const update = useUpdateEmailTemplateMutation(eventType);
  const previewMut = useEmailTemplatePreviewMutation(eventType);
  const sendTestMut = useEmailTemplateSendTestMutation(eventType);

  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [text, setText] = useState('');
  const [requiredJson, setRequiredJson] = useState('[]');
  const [varsJson, setVarsJson] = useState('{}');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    const em = useAuthStore.getState().currentUser?.email;
    if (em) setTestEmail(em);
  }, []);

  useEffect(() => {
    if (data) {
      setSubject(data.subjectTemplate);
      setHtml(data.htmlBodyTemplate);
      setText(data.textBodyTemplate);
      setRequiredJson(JSON.stringify(data.requiredVariables, null, 2));
    }
  }, [data]);

  const runPreview = async () => {
    try {
      const vars = JSON.parse(varsJson || '{}') as Record<string, string>;
      const r = await previewMut.mutateAsync({
        subjectTemplate: subject,
        htmlBodyTemplate: html,
        textBodyTemplate: text,
        variables: vars,
      });
      setPreviewSubject(r.subjectRendered);
      setPreviewHtml(DOMPurify.sanitize(r.htmlBodyRendered, PURIFY_PREVIEW));
      if (r.unresolvedVariables.length > 0) {
        toast.message(`Eksik değişkenler: ${r.unresolvedVariables.join(', ')}`);
      }
    } catch {
      toast.error('Önizleme başarısız — JSON veya şablon sözdizimini kontrol edin');
    }
  };

  const save = async () => {
    let requiredVariables: string[];
    try {
      const parsed = JSON.parse(requiredJson) as unknown;
      if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
        toast.error('Zorunlu değişkenler köşeli parantezli bir string dizisi olmalıdır');
        return;
      }
      requiredVariables = parsed;
    } catch {
      toast.error('Zorunlu değişkenler geçerli JSON olmalıdır');
      return;
    }
    const body: UpdateEmailTemplateInput = {
      subjectTemplate: subject,
      htmlBodyTemplate: html,
      textBodyTemplate: text,
      requiredVariables,
    };
    try {
      await update.mutateAsync(body);
      toast.success('Şablon kaydedildi');
    } catch {
      toast.error('Kayıt başarısız — zorunlu değişkenlerin üç şablonda da geçtiğini doğrulayın');
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Alıcı e-postası girin');
      return;
    }
    let variables: Record<string, string> | undefined;
    try {
      if (varsJson.trim()) variables = JSON.parse(varsJson) as Record<string, string>;
    } catch {
      toast.error('Önizleme değişkenleri geçerli JSON olmalıdır');
      return;
    }
    try {
      const r = await sendTestMut.mutateAsync({
        toEmail: testEmail.trim(),
        variables,
      });
      if (r.sent) toast.success('Test e-postası gönderildi');
      else toast.message(`E-posta gönderilmedi (ortam: ${r.mode})`);
    } catch {
      toast.error('Test e-postası başarısız');
    }
  };

  if (isLoading) {
    return (
      <div className="ls-card p-[var(--space-8)] shadow-[var(--shadow-md)]" role="status">
        <p className="text-[var(--color-neutral-600)]">Şablon yükleniyor…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="ls-card p-[var(--space-8)] shadow-[var(--shadow-md)]">
        <p className="text-[var(--color-danger-600)]">Şablon yüklenemedi.</p>
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm mt-3"
          onClick={() => refetch()}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-[var(--space-4)]">
      <nav className="text-sm text-[var(--color-neutral-600)]" aria-label="Breadcrumb">
        <Link href="/admin/email-templates" className="text-[var(--color-primary-600)] underline">
          E-posta şablonları
        </Link>
        <span aria-hidden> / </span>
        <span className="text-[var(--color-neutral-900)]">{notificationEventLabel(eventType)}</span>
      </nav>

      <div className="ls-card shadow-[var(--shadow-md)]">
        <div className="border-b border-[var(--color-neutral-200)] p-[var(--space-4)]">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-neutral-900)]">
            Şablon: {notificationEventLabel(eventType)}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
            Handlebars sözdizimi:{' '}
            <code className="rounded bg-[var(--color-neutral-100)] px-1">{`{{firstName}}`}</code>
          </p>
        </div>

        <div className="grid gap-[var(--space-6)] p-[var(--space-4)] lg:grid-cols-2">
          <div className="space-y-[var(--space-3)]">
            <label className="block text-sm font-medium text-[var(--color-neutral-800)]">
              Konu
              <input
                className="ls-input mt-1 w-full"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={300}
                aria-label="Konu şablonu"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--color-neutral-800)]">
              HTML gövde
              <textarea
                className="ls-textarea mt-1 min-h-[220px] w-full font-mono text-xs"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                spellCheck={false}
                aria-label="HTML şablonu"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--color-neutral-800)]">
              Düz metin gövde
              <textarea
                className="ls-textarea mt-1 min-h-[120px] w-full font-mono text-xs"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                aria-label="Düz metin şablonu"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--color-neutral-800)]">
              Zorunlu değişkenler (JSON dizi)
              <textarea
                className="ls-textarea mt-1 min-h-[72px] w-full font-mono text-xs"
                value={requiredJson}
                onChange={(e) => setRequiredJson(e.target.value)}
                spellCheck={false}
                aria-label="Zorunlu değişken adları JSON"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--color-neutral-800)]">
              Önizleme değişkenleri (JSON nesne)
              <textarea
                className="ls-textarea mt-1 min-h-[72px] w-full font-mono text-xs"
                value={varsJson}
                onChange={(e) => setVarsJson(e.target.value)}
                spellCheck={false}
                aria-label="Önizleme değişkenleri JSON"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="ls-btn ls-btn--neutral ls-btn--sm"
                onClick={() => void runPreview()}
                disabled={previewMut.isPending}
              >
                {previewMut.isPending ? 'Önizleme…' : 'Önizlemeyi yenile'}
              </button>
              <button
                type="button"
                className="ls-btn ls-btn--primary ls-btn--sm"
                onClick={() => void save()}
                disabled={update.isPending}
              >
                {update.isPending ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
            <div className="rounded border border-[var(--color-neutral-200)] p-[var(--space-3)]">
              <p className="text-sm font-medium text-[var(--color-neutral-800)]">Test e-postası</p>
              <input
                type="email"
                className="ls-input mt-2 w-full"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                aria-label="Test alıcı e-postası"
              />
              <button
                type="button"
                className="ls-btn ls-btn--neutral ls-btn--sm mt-2"
                onClick={() => void sendTestEmail()}
                disabled={sendTestMut.isPending}
              >
                {sendTestMut.isPending ? 'Gönderiliyor…' : 'Test e-postası gönder'}
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-[var(--color-neutral-900)]">Önizleme</h2>
            {!previewSubject && !previewHtml ? (
              <p className="mt-2 text-sm text-[var(--color-neutral-600)]">
                Önizlemeyi yenile ile sonuç oluşturun.
              </p>
            ) : (
              <div className="mt-2 space-y-2 rounded border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-[var(--space-3)]">
                <p className="text-sm font-medium text-[var(--color-neutral-900)]">
                  {previewSubject}
                </p>
                <iframe
                  title="HTML önizleme"
                  className="mt-2 h-[min(24rem,50vh)] w-full rounded border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)]"
                  sandbox="allow-same-origin"
                  srcDoc={`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body>${previewHtml}</body></html>`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
