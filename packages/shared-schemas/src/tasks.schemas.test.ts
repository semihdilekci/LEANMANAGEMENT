import { describe, expect, it } from 'vitest';

import { TaskCompleteBodySchema, TaskListQuerySchema } from './tasks.schemas.js';

describe('TaskListQuerySchema', () => {
  it('varsayılan tab pending', () => {
    const q = TaskListQuerySchema.parse({});
    expect(q.tab).toBe('pending');
  });

  it('bilinmeyen alan reddeder', () => {
    expect(() => TaskListQuerySchema.parse({ extra: 1 })).toThrow();
  });
});

describe('TaskCompleteBodySchema', () => {
  it('APPROVE gövdesi geçer', () => {
    const b = TaskCompleteBodySchema.parse({
      action: 'APPROVE',
      formData: { comment: 'ok' },
    });
    expect(b.action).toBe('APPROVE');
  });

  it('reason 10 karakterden kısaysa reddeder', () => {
    expect(() => TaskCompleteBodySchema.parse({ action: 'REJECT', reason: 'kısa' })).toThrow();
  });
});
