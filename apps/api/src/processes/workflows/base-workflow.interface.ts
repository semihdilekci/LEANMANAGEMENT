import type { ProcessType, Task } from '@leanmgmt/prisma-client';

/** KTİ ve ilerideki tipler için atama çözümü girdileri (rollback yeni task üretiminde) */
export type ProcessAssigneeContext = {
  startedByUserId: string;
  managerUserId: string | null;
};

/**
 * Adım meta — state machine + rollback hedefi için step_order → step_key eşlemesi.
 */
export type ProcessStepDefinition = {
  order: number;
  stepKey: string;
  /** SLA saat; rollback ile oluşan task’ta due hesabı */
  slaHours: number;
};

/**
 * Workflow sözleşmesi: iptal/rollback ve atama — tamamlama (task complete) Faz 5 ileri iterasyonlarında.
 */
export interface ProcessWorkflow {
  readonly processType: ProcessType;
  getOrderedSteps(): readonly ProcessStepDefinition[];
  getStepByOrder(order: number): ProcessStepDefinition;
  isCancelableProcessStatus(status: string): boolean;
  isRollbackableProcessStatus(status: string): boolean;
  findCurrentActiveStepOrder(tasks: Pick<Task, 'stepOrder' | 'status'>[]): number | null;
  assertRollbackTarget(args: {
    processStatus: string;
    tasks: Pick<Task, 'stepOrder' | 'status'>[];
    targetStepOrder: number;
  }): { currentStepOrder: number; targetStep: ProcessStepDefinition };
  resolveAssigneeUserIdForStep(
    step: ProcessStepDefinition,
    context: ProcessAssigneeContext,
  ): string;

  /**
   * Liste/detay `activeTaskLabel` — terminal süreç durumları ve aktif adım için TR etiket.
   * `activeStepKey`: aktif (PENDING|CLAIMED|IN_PROGRESS) task’ın step_key’i; yoksa null.
   */
  getListActiveStepLabel(activeStepKey: string | null, processStatus: string): string;
}
