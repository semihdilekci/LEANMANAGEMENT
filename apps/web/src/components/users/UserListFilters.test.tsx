import { describe, expect, it } from 'vitest';

import { hasUserListActiveFilters, userListFilterSignature } from './UserListFilters';

function mockParams(entries: Record<string, string>) {
  return {
    get: (k: string) => entries[k] ?? null,
  } as Pick<URLSearchParams, 'get'>;
}

describe('userListFilterSignature', () => {
  it('aynı filtreler için aynı imzayı üretir', () => {
    const a = mockParams({ companyId: 'x', search: 'foo' });
    const b = mockParams({ companyId: 'x', search: 'foo' });
    expect(userListFilterSignature(a)).toBe(userListFilterSignature(b));
  });

  it('farklı filtreler için imza değişir', () => {
    const a = mockParams({ companyId: 'x' });
    const b = mockParams({ companyId: 'y' });
    expect(userListFilterSignature(a)).not.toBe(userListFilterSignature(b));
  });
});

describe('hasUserListActiveFilters', () => {
  it('varsayılan URL için false', () => {
    expect(hasUserListActiveFilters(mockParams({}))).toBe(false);
  });

  it('şirket seçilince true', () => {
    expect(hasUserListActiveFilters(mockParams({ companyId: 'c1' }))).toBe(true);
  });

  it('sıralama varsayılan dışına çıkınca true', () => {
    expect(hasUserListActiveFilters(mockParams({ sort: 'sicil_asc' }))).toBe(true);
  });
});
