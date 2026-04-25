import { describe, it, expect } from 'vitest';
import { TaskStatus } from '@leanmgmt/prisma-client';

import { KtiWorkflow } from './kti.workflow.js';
import { ProcessRollbackInvalidTargetException } from '../processes.exceptions.js';

function t(order: number, status: TaskStatus) {
  return { stepOrder: order, status };
}

describe('KtiWorkflow', () => {
  const kti = new KtiWorkflow();

  it('getStepByOrder — 1,2,3 dönen stepKey beklenen', () => {
    expect(kti.getStepByOrder(1).stepKey).toBe('KTI_INITIATION');
    expect(kti.getStepByOrder(2).stepKey).toBe('KTI_MANAGER_APPROVAL');
    expect(kti.getStepByOrder(3).stepKey).toBe('KTI_REVISION');
  });

  it('getStepByOrder — tanımsız adım → PROCESS_ROLLBACK_INVALID_TARGET', () => {
    expect(() => kti.getStepByOrder(99)).toThrow(ProcessRollbackInvalidTargetException);
  });

  it('isCancelableProcessStatus — INITIATED / IN_PROGRESS true, terminal false', () => {
    expect(kti.isCancelableProcessStatus('INITIATED')).toBe(true);
    expect(kti.isCancelableProcessStatus('IN_PROGRESS')).toBe(true);
    expect(kti.isCancelableProcessStatus('CANCELLED')).toBe(false);
    expect(kti.isCancelableProcessStatus('COMPLETED')).toBe(false);
    expect(kti.isCancelableProcessStatus('REJECTED')).toBe(false);
  });

  it('isRollbackableProcessStatus — yalnız IN_PROGRESS', () => {
    expect(kti.isRollbackableProcessStatus('IN_PROGRESS')).toBe(true);
    expect(kti.isRollbackableProcessStatus('INITIATED')).toBe(false);
  });

  it('findCurrentActiveStepOrder — aktif task yokken null', () => {
    expect(kti.findCurrentActiveStepOrder([t(1, 'COMPLETED')])).toBe(null);
  });

  it('findCurrentActiveStepOrder — en yüksek order aktif alınır', () => {
    expect(
      kti.findCurrentActiveStepOrder([t(1, 'COMPLETED'), t(2, 'PENDING'), t(3, 'PENDING')]),
    ).toBe(3);
  });

  it('assertRollbackTarget — başarılı: current=3 target=1', () => {
    const r = kti.assertRollbackTarget({
      processStatus: 'IN_PROGRESS',
      tasks: [t(1, 'COMPLETED'), t(2, 'COMPLETED'), t(3, 'PENDING')],
      targetStepOrder: 1,
    });
    expect(r.currentStepOrder).toBe(3);
    expect(r.targetStep.order).toBe(1);
    expect(r.targetStep.stepKey).toBe('KTI_INITIATION');
  });

  it('assertRollbackTarget — COMPLETED süreç 422', () => {
    expect(() =>
      kti.assertRollbackTarget({
        processStatus: 'COMPLETED',
        tasks: [t(1, 'COMPLETED')],
        targetStepOrder: 1,
      }),
    ).toThrow(ProcessRollbackInvalidTargetException);
  });

  it('assertRollbackTarget — aktif task yok 422', () => {
    expect(() =>
      kti.assertRollbackTarget({
        processStatus: 'IN_PROGRESS',
        tasks: [t(1, 'COMPLETED'), t(2, 'COMPLETED')],
        targetStepOrder: 1,
      }),
    ).toThrow(ProcessRollbackInvalidTargetException);
  });

  it('assertRollbackTarget — target >= current 422', () => {
    expect(() =>
      kti.assertRollbackTarget({
        processStatus: 'IN_PROGRESS',
        tasks: [t(1, 'PENDING')],
        targetStepOrder: 1,
      }),
    ).toThrow(ProcessRollbackInvalidTargetException);
  });

  it('resolveAssigneeUserIdForStep — adım1 ve 3 başlatıcı, adım2 yönetici', () => {
    const s1 = kti.getStepByOrder(1);
    expect(
      kti.resolveAssigneeUserIdForStep(s1, { startedByUserId: 'u1', managerUserId: 'mgr' }),
    ).toBe('u1');
    const s3 = kti.getStepByOrder(3);
    expect(
      kti.resolveAssigneeUserIdForStep(s3, { startedByUserId: 'u1', managerUserId: 'mgr' }),
    ).toBe('u1');
    const s2 = kti.getStepByOrder(2);
    expect(
      kti.resolveAssigneeUserIdForStep(s2, { startedByUserId: 'u1', managerUserId: 'mgr' }),
    ).toBe('mgr');
  });

  it('resolveAssigneeUserIdForStep — yönetici yoksa 422', () => {
    const s2 = kti.getStepByOrder(2);
    expect(() =>
      kti.resolveAssigneeUserIdForStep(s2, { startedByUserId: 'u1', managerUserId: null }),
    ).toThrow(ProcessRollbackInvalidTargetException);
  });

  it('getListActiveStepLabel — terminal ve adım etiketleri', () => {
    expect(kti.getListActiveStepLabel(null, 'COMPLETED')).toBe('Tamamlandı');
    expect(kti.getListActiveStepLabel(null, 'REJECTED')).toBe('Reddedildi');
    expect(kti.getListActiveStepLabel(null, 'CANCELLED')).toBe('İptal Edildi');
    expect(kti.getListActiveStepLabel('KTI_MANAGER_APPROVAL', 'IN_PROGRESS')).toBe(
      'Yönetici Onayında',
    );
    expect(kti.getListActiveStepLabel('KTI_REVISION', 'IN_PROGRESS')).toBe(
      'Revizyonda (Başlatıcıda)',
    );
    expect(kti.getListActiveStepLabel(null, 'IN_PROGRESS')).toBe('Devam ediyor');
  });
});
