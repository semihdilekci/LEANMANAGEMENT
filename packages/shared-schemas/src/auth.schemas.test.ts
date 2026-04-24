import { describe, expect, it } from 'vitest';

import { ChangePasswordFormSchema } from './auth.schemas.js';

describe('ChangePasswordFormSchema', () => {
  it('eşleşen yeni şifreleri kabul eder', () => {
    const r = ChangePasswordFormSchema.safeParse({
      currentPassword: 'CurrentPass123!@#',
      newPassword: 'ValidPass123!@#',
      confirmPassword: 'ValidPass123!@#',
    });
    expect(r.success).toBe(true);
  });

  it('eşleşmeyen onayı reddeder', () => {
    const r = ChangePasswordFormSchema.safeParse({
      currentPassword: 'x',
      newPassword: 'ValidPass123!@#',
      confirmPassword: 'OtherPass123!@#',
    });
    expect(r.success).toBe(false);
  });
});
