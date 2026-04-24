import { describe, expect, it } from 'vitest';
import { EmptyObjectSchema } from './index';

describe('shared-schemas', () => {
  it('parses empty strict object', () => {
    expect(EmptyObjectSchema.parse({})).toEqual({});
  });
});
