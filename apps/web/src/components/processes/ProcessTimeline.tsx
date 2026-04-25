'use client';

import { useState } from 'react';

import type { ProcessTaskItem } from '@/lib/queries/processes';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor',
  CLAIMED: 'Üstlenildi',
  IN_PROGRESS: 'Devam ediyor',
  COMPLETED: 'Tamamlandı',
  SKIPPED_BY_ROLLBACK: 'Geri alma ile atlandı',
  SKIPPED_BY_PEER: 'Eş atama ile atlandı',
  SKIPPED: 'Atlandı',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function ProcessTimeline({ tasks }: { tasks: ProcessTaskItem[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <ol className="relative space-y-[var(--space-4)] border-l border-[var(--color-neutral-200)] pl-[var(--space-5)]">
      {tasks.map((task) => {
        const isOpen = expanded[task.id] ?? false;
        const hasExpandable = task.formData !== undefined && task.formData !== null;
        return (
          <li key={task.id} className="relative">
            <span
              className="absolute -left-[calc(var(--space-5)+5px)] mt-1.5 h-2.5 w-2.5 rounded-full border border-[var(--color-neutral-200)] bg-[var(--color-neutral-0)]"
              aria-hidden
            />
            <div className="ls-card space-y-[var(--space-3)] p-[var(--space-4)]">
              <div className="flex flex-wrap items-start justify-between gap-[var(--space-2)]">
                <div>
                  <p className="text-sm font-medium text-[var(--color-neutral-900)]">
                    {task.stepKey}
                  </p>
                  <p className="text-xs text-[var(--color-neutral-500)]">
                    Adım {task.stepOrder} · {statusLabel(task.status)}
                  </p>
                </div>
                {task.completedAt ? (
                  <time
                    className="text-xs text-[var(--color-neutral-500)]"
                    dateTime={task.completedAt}
                  >
                    {new Date(task.completedAt).toLocaleString('tr-TR')}
                  </time>
                ) : null}
              </div>
              {task.assignedTo ? (
                <p className="text-sm text-[var(--color-neutral-700)]">
                  Atanan: {task.assignedTo.firstName} {task.assignedTo.lastName}
                  {task.assignedTo.sicil ? ` · Sicil ${task.assignedTo.sicil}` : ''}
                </p>
              ) : null}
              {task.completedBy ? (
                <p className="text-sm text-[var(--color-neutral-700)]">
                  Tamamlayan: {task.completedBy.firstName} {task.completedBy.lastName}
                </p>
              ) : null}
              {task.completionAction ? (
                <p className="text-xs text-[var(--color-neutral-600)]">
                  İşlem: {task.completionAction}
                </p>
              ) : null}
              {task.slaDueAt ? (
                <p className="text-xs text-[var(--color-neutral-600)]">
                  SLA: {new Date(task.slaDueAt).toLocaleString('tr-TR')}
                </p>
              ) : null}
              {hasExpandable ? (
                <div>
                  <button
                    type="button"
                    className="ls-btn ls-btn--neutral ls-btn--sm"
                    aria-expanded={isOpen}
                    onClick={() => toggle(task.id)}
                  >
                    {isOpen ? 'Formu gizle' : 'Form verisini göster'}
                  </button>
                  {isOpen ? (
                    <pre className="mt-[var(--space-2)] max-h-64 overflow-auto rounded-[var(--radius-md)] bg-[var(--color-neutral-50)] p-[var(--space-3)] text-xs text-[var(--color-neutral-800)]">
                      {JSON.stringify(task.formData, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
