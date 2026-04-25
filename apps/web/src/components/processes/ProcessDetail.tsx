'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { useProcessDetailQuery } from '@/lib/queries/processes';

import { ProcessDetailActions } from './ProcessDetailActions';
import { ProcessTimeline } from './ProcessTimeline';

export function ProcessDetail({ displayId }: { displayId: string }) {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useProcessDetailQuery(displayId);

  const handleDownload = async (docId: string) => {
    try {
      const res = await apiClient.get<{ success: boolean; data: { downloadUrl: string } }>(
        `/api/v1/documents/${encodeURIComponent(docId)}/download-url`,
      );
      const url = res.data.data.downloadUrl;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      if (isAxiosError(e)) {
        const code = e.response?.data?.error?.code as string | undefined;
        if (code === 'DOCUMENT_SCAN_PENDING') {
          toast.message('Belge hâlâ taranıyor, lütfen bekleyin.');
          return;
        }
        if (code === 'DOCUMENT_INFECTED') {
          toast.error('Güvenlik taramasında zararlı tespit edildi.');
          return;
        }
        toast.error(e.response?.data?.error?.message ?? 'İndirilemedi.');
        return;
      }
      toast.error('İndirilemedi.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-[var(--space-4)]" role="status" aria-live="polite">
        <span className="sr-only">Yükleniyor...</span>
        <div className="h-12 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]" />
        <div className="h-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]" />
      </div>
    );
  }

  if (isError) {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      const code = error.response?.data?.error?.code as string | undefined;
      if (status === 403 && code === 'PROCESS_ACCESS_DENIED') {
        return (
          <div className="ls-alert ls-alert--danger" role="alert">
            <p>Bu sürece erişim yetkiniz yok.</p>
            <button
              type="button"
              className="ls-btn ls-btn--neutral ls-btn--sm mt-[var(--space-2)]"
              onClick={() => router.push('/processes')}
            >
              Süreç listesine dön
            </button>
          </div>
        );
      }
      if (status === 404) {
        return (
          <div className="ls-alert ls-alert--danger" role="alert">
            <p>Süreç bulunamadı.</p>
            <Link
              href="/processes"
              className="ls-btn ls-btn--neutral ls-btn--sm mt-[var(--space-2)] inline-flex"
            >
              Süreç listesine dön
            </Link>
          </div>
        );
      }
    }
    return (
      <div className="ls-alert ls-alert--danger" role="alert">
        <p>Detay yüklenemedi.</p>
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm mt-[var(--space-2)]"
          onClick={() => refetch()}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-[var(--space-8)]">
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-4)]">
        <div>
          <nav className="text-sm text-[var(--color-neutral-500)]" aria-label="Breadcrumb">
            <Link href="/processes" className="hover:text-[var(--color-primary-600)]">
              Süreçler
            </Link>
            <span className="mx-[var(--space-2)]">›</span>
            <span className="font-mono text-[var(--color-neutral-800)]">{data.displayId}</span>
          </nav>
          <h1 className="mt-[var(--space-2)] font-mono text-2xl font-semibold text-[var(--color-neutral-900)]">
            {data.displayId}
          </h1>
          <p className="mt-[var(--space-1)] text-sm text-[var(--color-neutral-600)]">
            {data.processType} · {data.status} · {data.activeTaskLabel}
          </p>
        </div>
        <ProcessDetailActions detail={data} />
      </div>

      <section
        className="ls-card space-y-[var(--space-4)] p-[var(--space-5)]"
        aria-labelledby="process-meta-heading"
      >
        <h2
          id="process-meta-heading"
          className="text-lg font-semibold text-[var(--color-neutral-900)]"
        >
          Özet
        </h2>
        <dl className="grid gap-[var(--space-3)] text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-neutral-500)]">Başlatan</dt>
            <dd className="text-[var(--color-neutral-800)]">
              {data.startedBy.firstName} {data.startedBy.lastName}
              {data.startedBy.sicil ? ` · Sicil ${data.startedBy.sicil}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-neutral-500)]">Şirket</dt>
            <dd className="text-[var(--color-neutral-800)]">{data.company.name}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-neutral-500)]">Başlangıç</dt>
            <dd className="text-[var(--color-neutral-800)]">
              {new Date(data.startedAt).toLocaleString('tr-TR')}
            </dd>
          </div>
          {data.completedAt ? (
            <div>
              <dt className="text-[var(--color-neutral-500)]">Tamamlanma</dt>
              <dd className="text-[var(--color-neutral-800)]">
                {new Date(data.completedAt).toLocaleString('tr-TR')}
              </dd>
            </div>
          ) : null}
          {data.cancelledAt ? (
            <div>
              <dt className="text-[var(--color-neutral-500)]">İptal</dt>
              <dd className="text-[var(--color-neutral-800)]">
                {new Date(data.cancelledAt).toLocaleString('tr-TR')}
              </dd>
            </div>
          ) : null}
        </dl>
        {data.cancelReason ? (
          <div className="rounded-[var(--radius-md)] bg-[var(--color-primary-a14)] p-[var(--space-3)] text-sm text-[var(--color-neutral-800)]">
            <strong className="font-medium">İptal gerekçesi:</strong> {data.cancelReason}
          </div>
        ) : null}
      </section>

      <section className="space-y-[var(--space-4)]" aria-labelledby="process-tasks-heading">
        <h2
          id="process-tasks-heading"
          className="text-lg font-semibold text-[var(--color-neutral-900)]"
        >
          Görev zinciri
        </h2>
        <ProcessTimeline tasks={data.tasks} />
      </section>

      <section className="space-y-[var(--space-4)]" aria-labelledby="process-docs-heading">
        <h2
          id="process-docs-heading"
          className="text-lg font-semibold text-[var(--color-neutral-900)]"
        >
          Dokümanlar ({data.documents.length})
        </h2>
        {data.documents.length === 0 ? (
          <p className="text-sm text-[var(--color-neutral-600)]">Görüntülenebilir doküman yok.</p>
        ) : (
          <ul className="grid gap-[var(--space-3)] sm:grid-cols-2">
            {data.documents.map((doc) => (
              <li
                key={doc.id}
                className="ls-card flex flex-col gap-[var(--space-2)] p-[var(--space-4)]"
              >
                <span className="truncate text-sm font-medium text-[var(--color-neutral-900)]">
                  {doc.filename}
                </span>
                <span className="text-xs text-[var(--color-neutral-500)]">{doc.scanStatus}</span>
                {doc.scanStatus === 'CLEAN' ? (
                  <button
                    type="button"
                    className="ls-btn ls-btn--neutral ls-btn--sm self-start"
                    onClick={() => void handleDownload(doc.id)}
                  >
                    İndir
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
