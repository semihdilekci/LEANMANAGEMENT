import { Injectable } from '@nestjs/common';
import { ProcessType, type Task, type TaskStatus } from '@leanmgmt/prisma-client';

import {
  type ProcessAssigneeContext,
  type ProcessStepDefinition,
  type ProcessWorkflow,
} from './base-workflow.interface.js';
import { ProcessRollbackInvalidTargetException } from '../processes.exceptions.js';

const ACTIVE_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set([
  'PENDING',
  'CLAIMED',
  'IN_PROGRESS',
]);

/** 01/02 domain: KTİ adımları — step_order tek doğruluk kaynağı */
const KTI_STEPS: readonly ProcessStepDefinition[] = [
  { order: 1, stepKey: 'KTI_INITIATION', slaHours: 48 },
  { order: 2, stepKey: 'KTI_MANAGER_APPROVAL', slaHours: 72 },
  { order: 3, stepKey: 'KTI_REVISION', slaHours: 48 },
];

@Injectable()
export class KtiWorkflow implements ProcessWorkflow {
  readonly processType: ProcessType = 'BEFORE_AFTER_KAIZEN';

  getOrderedSteps(): readonly ProcessStepDefinition[] {
    return KTI_STEPS;
  }

  getStepByOrder(order: number): ProcessStepDefinition {
    const step = KTI_STEPS.find((s) => s.order === order);
    if (!step) {
      throw new ProcessRollbackInvalidTargetException({ targetStepOrder: order });
    }
    return step;
  }

  isCancelableProcessStatus(status: string): boolean {
    return status === 'INITIATED' || status === 'IN_PROGRESS';
  }

  isRollbackableProcessStatus(status: string): boolean {
    return status === 'IN_PROGRESS';
  }

  findCurrentActiveStepOrder(tasks: Pick<Task, 'stepOrder' | 'status'>[]): number | null {
    const actives = tasks.filter((t) => ACTIVE_TASK_STATUSES.has(t.status));
    if (actives.length === 0) return null;
    return Math.max(...actives.map((t) => t.stepOrder));
  }

  assertRollbackTarget(args: {
    processStatus: string;
    tasks: Pick<Task, 'stepOrder' | 'status'>[];
    targetStepOrder: number;
  }): { currentStepOrder: number; targetStep: ProcessStepDefinition } {
    if (!this.isRollbackableProcessStatus(args.processStatus)) {
      throw new ProcessRollbackInvalidTargetException({ reason: 'not_in_progress' });
    }
    const current = this.findCurrentActiveStepOrder(args.tasks);
    if (current === null) {
      throw new ProcessRollbackInvalidTargetException({ reason: 'no_active_task' });
    }
    if (args.targetStepOrder >= current) {
      throw new ProcessRollbackInvalidTargetException({
        targetStepOrder: args.targetStepOrder,
        currentStepOrder: current,
      });
    }
    if (args.targetStepOrder < 1) {
      throw new ProcessRollbackInvalidTargetException({ targetStepOrder: args.targetStepOrder });
    }
    return {
      currentStepOrder: current,
      targetStep: this.getStepByOrder(args.targetStepOrder),
    };
  }

  resolveAssigneeUserIdForStep(
    step: ProcessStepDefinition,
    context: ProcessAssigneeContext,
  ): string {
    if (step.order === 1 || step.order === 3) {
      return context.startedByUserId;
    }
    if (step.order === 2) {
      if (context.managerUserId === null) {
        throw new ProcessRollbackInvalidTargetException({ reason: 'manager_user_required' });
      }
      return context.managerUserId;
    }
    throw new ProcessRollbackInvalidTargetException({ stepOrder: step.order });
  }

  getListActiveStepLabel(activeStepKey: string | null, processStatus: string): string {
    if (processStatus === 'COMPLETED') return 'Tamamlandı';
    if (processStatus === 'REJECTED') return 'Reddedildi';
    if (processStatus === 'CANCELLED') return 'İptal Edildi';
    if (!activeStepKey) return 'Devam ediyor';
    if (activeStepKey === 'KTI_MANAGER_APPROVAL') return 'Yönetici Onayında';
    if (activeStepKey === 'KTI_REVISION') return 'Revizyonda (Başlatıcıda)';
    if (activeStepKey === 'KTI_INITIATION') return 'Başlatıldı';
    return 'Devam ediyor';
  }
}
