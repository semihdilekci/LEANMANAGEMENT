import { describe, expect, it } from 'vitest';

import { KtiStartBodySchema } from './processes.schemas.js';

describe('KtiStartBodySchema', () => {
  const base = {
    companyId: 'c1',
    beforePhotoDocumentIds: ['d1'],
    afterPhotoDocumentIds: ['d2'],
    savingAmount: 0,
    description: '1234567890 açıklama en az on karakter',
  };

  it('11 önce fotoğraf reddeder', () => {
    const r = KtiStartBodySchema.safeParse({
      ...base,
      beforePhotoDocumentIds: Array.from({ length: 11 }, (_, i) => `id-${i}`),
    });
    expect(r.success).toBe(false);
  });

  it('10 önce fotoğraf kabul eder', () => {
    const r = KtiStartBodySchema.safeParse({
      ...base,
      beforePhotoDocumentIds: Array.from({ length: 10 }, (_, i) => `id-${i}`),
    });
    expect(r.success).toBe(true);
  });
});
