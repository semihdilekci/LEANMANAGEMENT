'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { isAxiosError } from 'axios';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { useTaskDetailQuery } from '@/lib/queries/tasks';

import { SlaBadge } from './SlaBadge';
import { TaskActions } from './TaskActions';

interface TaskDetailProps {
  taskId: string;
}

async function openDocumentDownload(docId: string) {
  try {
    const res = await apiClient.get<{ success: boolean; data: { downloadUrl: string } }>(
      `/api/v1/documents/${encodeURIComponent(docId)}/download-url`,
    );
    const url = res.data.data.downloadUrl;
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e) {
    if (isAxiosError(e)) {
      toast.error(e.response?.data?.error?.message ?? 'İndirme bağlantısı alınamadı');
      return;
    }
    toast.error('İndirme bağlantısı alınamadı');
  }
}

export function TaskDetail({ taskId }: TaskDetailProps) {
  const { data: task, isLoading, isError, error, refetch } = useTaskDetailQuery(taskId);
  const [openPrev, setOpenPrev] = useState<Record<string, boolean>>({});

  const togglePrev = useCallback((key: string) => {
    setOpenPrev((s) => ({ ...s, [key]: !s[key] }));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-[var(--space-4)]" role="status" aria-live="polite">
        <span className="sr-only">Yükleniyor…</span>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-neutral-100)]"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const code = isAxiosError(error)
      ? (error.response?.data as { error?: { code?: string } })?.error?.code
      : undefined;
    if (status === 404 || code === 'TASK_NOT_FOUND') {
      return (
        <div className="ls-alert ls-alert--danger" role="alert">
          <p>Görev bulunamadı.</p>
          <Link href="/tasks" className="mt-2 inline-block text-sm underline">
            Görevlerime dön
          </Link>
        </div>
      );
    }
    if (status === 403 || code === 'TASK_ACCESS_DENIED') {
      return (
        <div className="ls-alert ls-alert--danger" role="alert">
          <p>Bu görevi görüntüleme yetkiniz yok.</p>
          <Link href="/tasks" className="mt-2 inline-block text-sm underline">
            Görevlerime dön
          </Link>
        </div>
      );
    }
    return (
      <div className="ls-alert ls-alert--danger" role="alert">
        <p>Yüklenemedi.</p>
        <button
          type="button"
          className="ls-btn ls-btn--neutral ls-btn--sm mt-2"
          onClick={() => refetch()}
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  return (
    <div className="space-y-[var(--space-6)]">
      <nav className="text-sm text-[var(--color-neutral-600)]" aria-label="Breadcrumb">
        <Link href="/tasks" className="hover:text-[var(--color-primary-600)]">
          Görevlerim
        </Link>
        <span className="mx-2" aria-hidden>
          ›
        </span>
        <span className="text-[var(--color-neutral-900)]">
          {task.process.displayId} — {task.stepLabel}
        </span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-[var(--space-4)]">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-neutral-900)]">
            {task.stepLabel}
          </h1>
          <div className="mt-[var(--space-2)] flex flex-wrap items-center gap-[var(--space-3)]">
            <span className="rounded-full bg-[var(--color-neutral-100)] px-2 py-0.5 text-xs font-medium text-[var(--color-neutral-800)]">
              {task.status}
            </span>
            <SlaBadge
              slaDueAt={task.slaDueAt}
              slaBaselineAt={task.slaBaselineAt ?? null}
              isSlaOverdue={task.isSlaOverdue}
            />
          </div>
        </div>
        <Link
          href={`/processes/${encodeURIComponent(task.process.displayId)}`}
          className="ls-btn ls-btn--neutral ls-btn--sm shrink-0"
        >
          Süreç detayı
        </Link>
      </div>

      <section className="ls-card space-y-[var(--space-3)] p-[var(--space-5)]">
        <h2 className="text-sm font-semibold text-[var(--color-neutral-800)]">Süreç özeti</h2>
        <dl className="grid gap-[var(--space-2)] text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--color-neutral-500)]">Süreç no</dt>
            <dd>
              <Link
                href={`/processes/${encodeURIComponent(task.process.displayId)}`}
                className="text-[var(--color-primary-700)] underline"
              >
                {task.process.displayId}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-neutral-500)]">Durum</dt>
            <dd>{task.process.status}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-neutral-500)]">Başlatan</dt>
            <dd>
              {task.process.startedBy.firstName} {task.process.startedBy.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-neutral-500)]">Şirket</dt>
            <dd>{task.process.company.name}</dd>
          </div>
        </dl>
      </section>

      {task.previousTasks.length > 0 ? (
        <section className="space-y-[var(--space-3)]">
          <h2 className="text-sm font-semibold text-[var(--color-neutral-800)]">Önceki adımlar</h2>
          <ul className="space-y-[var(--space-2)]">
            {task.previousTasks.map((pt, idx) => {
              const key = `${pt.stepKey}-${idx}`;
              const open = openPrev[key] ?? false;
              return (
                <li key={key} className="ls-card overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 p-[var(--space-3)] text-left text-sm font-medium text-[var(--color-neutral-900)]"
                    onClick={() => togglePrev(key)}
                    aria-expanded={open}
                  >
                    <span>
                      {pt.stepLabel}
                      {pt.completedAt
                        ? ` · ${new Date(pt.completedAt).toLocaleString('tr-TR')}`
                        : ''}
                    </span>
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                  </button>
                  {open ? (
                    <div className="border-t border-[var(--color-neutral-100)] px-[var(--space-3)] py-[var(--space-3)] text-sm text-[var(--color-neutral-700)]">
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-[var(--color-neutral-50)] p-2 font-mono text-xs">
                        {JSON.stringify(pt.formData, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {task.documents.length > 0 ? (
        <section>
          <h2 className="mb-[var(--space-2)] text-sm font-semibold text-[var(--color-neutral-800)]">
            Dokümanlar
          </h2>
          <ul className="divide-y divide-[var(--color-neutral-100)] rounded-[var(--radius-md)] border border-[var(--color-neutral-200)]">
            {task.documents.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 px-[var(--space-3)] py-[var(--space-2)] text-sm"
              >
                <span className="text-[var(--color-neutral-900)]">{d.originalFilename}</span>
                <span className="text-xs text-[var(--color-neutral-500)]">{d.scanStatus}</span>
                {d.scanStatus === 'CLEAN' ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--color-primary-700)] underline"
                    onClick={() => void openDocumentDownload(d.id)}
                  >
                    İndir
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <TaskActions task={task} onRefetch={() => void refetch()} />
    </div>
  );
}
