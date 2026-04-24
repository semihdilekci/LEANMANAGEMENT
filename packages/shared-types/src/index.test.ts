import { describe, expect, it } from 'vitest';
import type { Placeholder } from './index';

describe('shared-types', () => {
  it('exports placeholder type', () => {
    const value = { _brand: 'shared-types' } satisfies Placeholder;
    expect(value._brand).toBe('shared-types');
  });
});
