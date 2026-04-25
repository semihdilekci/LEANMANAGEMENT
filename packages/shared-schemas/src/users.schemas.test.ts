import { describe, expect, it } from 'vitest';

import { CreateUserSchema, UpdateUserSchema } from './users.schemas.js';

describe('UpdateUserSchema', () => {
  it('boş string telefonu nulla çevirir', () => {
    const r = UpdateUserSchema.safeParse({ firstName: 'A', phone: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBeNull();
  });

  it('managerEmail boş string → null', () => {
    const r = UpdateUserSchema.safeParse({ lastName: 'B', managerEmail: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.managerEmail).toBeNull();
  });

  it('geçerli managerEmail normalize eder', () => {
    const r = UpdateUserSchema.safeParse({ firstName: 'A', managerEmail: 'Boss@Example.com' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.managerEmail).toBe('boss@example.com');
  });
});

describe('CreateUserSchema', () => {
  it('opsiyonel managerEmail kabul eder', () => {
    const base = {
      sicil: '12345678',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      employeeType: 'WHITE_COLLAR',
      companyId: 'c1',
      locationId: 'l1',
      departmentId: 'd1',
      positionId: 'p1',
      levelId: 'lv1',
      workAreaId: 'wa1',
      managerEmail: 'mgr@corp.com',
    };
    const r = CreateUserSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.managerEmail).toBe('mgr@corp.com');
  });
});
