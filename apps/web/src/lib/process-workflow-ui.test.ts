import { describe, expect, it } from 'vitest';

import {
  computeKtiRollbackTargetStepOrder,
  isProcessCancelableStatus,
} from './process-workflow-ui';

describe('computeKtiRollbackTargetStepOrder', () => {
  it('aktif adım 2 iken hedef 1 döner', () => {
    expect(
      computeKtiRollbackTargetStepOrder([
        { stepOrder: 1, status: 'COMPLETED' },
        { stepOrder: 2, status: 'PENDING' },
      ]),
    ).toBe(1);
  });

  it('aktif adım 1 iken null döner', () => {
    expect(computeKtiRollbackTargetStepOrder([{ stepOrder: 1, status: 'PENDING' }])).toBeNull();
  });

  it('aktif görev yoksa null döner', () => {
    expect(
      computeKtiRollbackTargetStepOrder([
        { stepOrder: 1, status: 'COMPLETED' },
        { stepOrder: 2, status: 'COMPLETED' },
      ]),
    ).toBeNull();
  });
});

describe('isProcessCancelableStatus', () => {
  it('IN_PROGRESS iptal edilebilir', () => {
    expect(isProcessCancelableStatus('IN_PROGRESS')).toBe(true);
  });
  it('COMPLETED iptal edilemez', () => {
    expect(isProcessCancelableStatus('COMPLETED')).toBe(false);
  });
});
