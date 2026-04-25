'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';

import { Permission } from '@leanmgmt/shared-types';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PermissionGate } from '@/components/shared/PermissionGate';
import {
  computeKtiRollbackTargetStepOrder,
  isProcessCancelableStatus,
} from '@/lib/process-workflow-ui';
import { useProcessCancelMutation, useProcessRollbackMutation } from '@/lib/queries/processes';

import type { ProcessDetail, ProcessTaskItem } from '@/lib/queries/processes';

const PHRASE = 'ONAYLIYORUM';

function activeStepLabel(tasks: ProcessTaskItem[]): string {
  const active = tasks.filter((t) => ['PENDING', 'CLAIMED', 'IN_PROGRESS'].includes(t.status));
  if (active.length === 0) return '—';
  const maxOrder = Math.max(...active.map((t) => t.stepOrder));
  const t = active.find((x) => x.stepOrder === maxOrder);
  return t?.stepKey ?? '—';
}

export function ProcessDetailActions({ detail }: { detail: ProcessDetail }) {
  const { displayId, status, tasks } = detail;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelPhrase, setCancelPhrase] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollbackPhrase, setRollbackPhrase] = useState('');

  const cancelMutation = useProcessCancelMutation(displayId);
  const rollbackMutation = useProcessRollbackMutation(displayId);

  const rollbackTarget = computeKtiRollbackTargetStepOrder(tasks);
  const showCancel = isProcessCancelableStatus(status);
  const showRollback = status === 'IN_PROGRESS' && rollbackTarget !== null;

  const resetCancel = () => {
    setCancelReason('');
    setCancelPhrase('');
  };
  const resetRollback = () => {
    setRollbackReason('');
    setRollbackPhrase('');
  };

  return (
    <div className="flex flex-wrap gap-2">
      <PermissionGate permission={Permission.PROCESS_CANCEL}>
        {showCancel ? (
          <button
            type="button"
            className="ls-btn ls-btn--sm border border-[var(--color-error-600)] text-[var(--color-error-800)]"
            onClick={() => setCancelOpen(true)}
          >
            Süreci iptal et
          </button>
        ) : null}
      </PermissionGate>
      <PermissionGate permission={Permission.PROCESS_ROLLBACK}>
        {showRollback ? (
          <button
            type="button"
            className="ls-btn ls-btn--sm border border-[var(--color-error-600)] text-[var(--color-error-800)]"
            onClick={() => setRollbackOpen(true)}
          >
            Geri al
          </button>
        ) : null}
      </PermissionGate>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={(o) => {
          setCancelOpen(o);
          if (!o) resetCancel();
        }}
        title="Süreci iptal et"
        description="Bu süreç iptal edilecek; aktif görevler atlanmış sayılır. Bu işlem geri alınamaz."
        confirmLabel="İptali onayla"
        destructive
        confirmDisabled={cancelMutation.isPending}
        onConfirm={async () => {
          const reason = cancelReason.trim();
          if (reason.length < 10) {
            toast.error('İptal gerekçesi en az 10 karakter olmalıdır.');
            throw new Error('validation');
          }
          if (cancelPhrase.trim() !== PHRASE) {
            toast.error(`Onay için "${PHRASE}" yazın.`);
            throw new Error('validation');
          }
          try {
            await cancelMutation.mutateAsync(reason);
            toast.success('Süreç iptal edildi.');
            resetCancel();
          } catch (e) {
            if (isAxiosError(e)) {
              toast.error(e.response?.data?.error?.message ?? 'İptal başarısız.');
            } else {
              toast.error('İptal başarısız.');
            }
            throw e;
          }
        }}
      >
        <div className="space-y-[var(--space-3)]">
          <div>
            <label
              htmlFor="cancel-reason"
              className="mb-1 block text-sm font-medium text-[var(--color-neutral-900)]"
            >
              Gerekçe (en az 10 karakter)
            </label>
            <textarea
              id="cancel-reason"
              rows={4}
              className="ls-input min-h-[5rem] w-full"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="cancel-phrase"
              className="mb-1 block text-sm font-medium text-[var(--color-neutral-900)]"
            >
              Onay — <span className="font-mono">{PHRASE}</span> yazın
            </label>
            <input
              id="cancel-phrase"
              type="text"
              className="ls-input w-full font-mono"
              value={cancelPhrase}
              onChange={(e) => setCancelPhrase(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={rollbackOpen}
        onOpenChange={(o) => {
          setRollbackOpen(o);
          if (!o) resetRollback();
        }}
        title="Süreci geri al"
        description={`Aktif adım: ${activeStepLabel(tasks)}. Bir önceki adıma (${rollbackTarget ?? '—'}) dönülecek; mevcut görev atlanmış olur.`}
        confirmLabel="Geri almayı onayla"
        destructive
        confirmDisabled={rollbackMutation.isPending || rollbackTarget === null}
        onConfirm={async () => {
          if (rollbackTarget === null) {
            throw new Error('validation');
          }
          const reason = rollbackReason.trim();
          if (reason.length < 10) {
            toast.error('Geri alma gerekçesi en az 10 karakter olmalıdır.');
            throw new Error('validation');
          }
          if (rollbackPhrase.trim() !== PHRASE) {
            toast.error(`Onay için "${PHRASE}" yazın.`);
            throw new Error('validation');
          }
          try {
            await rollbackMutation.mutateAsync({ targetStepOrder: rollbackTarget, reason });
            toast.success('Süreç geri alındı.');
            resetRollback();
          } catch (e) {
            if (isAxiosError(e)) {
              toast.error(e.response?.data?.error?.message ?? 'Geri alma başarısız.');
            } else {
              toast.error('Geri alma başarısız.');
            }
            throw e;
          }
        }}
      >
        <div className="space-y-[var(--space-3)]">
          <div>
            <label
              htmlFor="rollback-reason"
              className="mb-1 block text-sm font-medium text-[var(--color-neutral-900)]"
            >
              Gerekçe (en az 10 karakter)
            </label>
            <textarea
              id="rollback-reason"
              rows={4}
              className="ls-input min-h-[5rem] w-full"
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="rollback-phrase"
              className="mb-1 block text-sm font-medium text-[var(--color-neutral-900)]"
            >
              Onay — <span className="font-mono">{PHRASE}</span> yazın
            </label>
            <input
              id="rollback-phrase"
              type="text"
              className="ls-input w-full font-mono"
              value={rollbackPhrase}
              onChange={(e) => setRollbackPhrase(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
