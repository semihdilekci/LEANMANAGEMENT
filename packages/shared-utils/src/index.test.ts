import { describe, expect, it } from 'vitest';
import { noop } from './index';

describe('shared-utils', () => {
  it('noop runs', () => {
    expect(noop()).toBeUndefined();
  });
});
