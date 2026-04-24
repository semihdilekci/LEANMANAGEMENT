import { describe, expect, it } from 'vitest';

import { computePermissionDiff } from '@/lib/roles-permission-diff';

describe('computePermissionDiff', () => {
  it('boş başlangıçta eklemeleri hesaplar', () => {
    const { added, removed } = computePermissionDiff([], ['A', 'B']);
    expect(added.sort()).toEqual(['A', 'B']);
    expect(removed).toEqual([]);
  });

  it('kaldırılanları hesaplar', () => {
    const { added, removed } = computePermissionDiff(['X', 'Y'], ['X']);
    expect(added).toEqual([]);
    expect(removed.sort()).toEqual(['Y']);
  });

  it('değişmeyen kümede boş diff', () => {
    const { added, removed } = computePermissionDiff(['P', 'Q'], ['Q', 'P']);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });
});
