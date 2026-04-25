import { describe, expect, it } from 'vitest';

import { buildZodFromTaskFormFields } from '@/lib/task-form-schema';

describe('buildZodFromTaskFormFields', () => {
  it('yorum alanı opsiyonel ve max uzunluk uygular', () => {
    const schema = buildZodFromTaskFormFields([
      { name: 'comment', type: 'textarea', label: 'Not', maxLength: 1000, required: false },
    ]);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ comment: '' }).success).toBe(true);
    expect(schema.safeParse({ comment: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('strict: bilinmeyen alan reddedilir', () => {
    const schema = buildZodFromTaskFormFields([
      { name: 'comment', type: 'textarea', label: 'Not', required: false },
    ]);
    expect(schema.safeParse({ comment: 'ok', extra: 1 }).success).toBe(false);
  });
});
