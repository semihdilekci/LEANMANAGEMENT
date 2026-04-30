import { describe, it, expect } from 'vitest';

import { nextAuditChainHash, stableJsonStringifyForAudit } from './audit-chain-canonical.js';

describe('stableJsonStringifyForAudit', () => {
  it('nesne key sırasından bağımsız aynı sonucu verir', () => {
    const a = stableJsonStringifyForAudit({ z: 1, a: 2 });
    const b = stableJsonStringifyForAudit({ a: 2, z: 1 });
    expect(a).toBe(b);
  });
});

describe('nextAuditChainHash', () => {
  it('append ile aynı alan setinde deterministik', () => {
    const h = nextAuditChainHash('GENESIS', {
      action: 'A',
      entity: 'e',
      entityId: null,
      userId: 'u1',
      sessionId: null,
      metadata: { k: 1, b: 2 },
      ipHash: 'x',
    });
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});
