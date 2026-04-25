const ACTIVE_TASK_STATUSES = new Set(['PENDING', 'CLAIMED', 'IN_PROGRESS']);

/**
 * KTİ süreç detayında geri alma hedefi — backend KtiWorkflow.assertRollbackTarget ile aynı mantık (current - 1).
 */
export function computeKtiRollbackTargetStepOrder(
  tasks: { stepOrder: number; status: string }[],
): number | null {
  const actives = tasks.filter((t) => ACTIVE_TASK_STATUSES.has(t.status));
  if (actives.length === 0) return null;
  const current = Math.max(...actives.map((t) => t.stepOrder));
  if (current <= 1) return null;
  return current - 1;
}

export function isProcessCancelableStatus(status: string): boolean {
  return status === 'INITIATED' || status === 'IN_PROGRESS';
}
