import { describe, it, expect } from 'vitest';

import { nextAuditChainHash } from './audit-chain-canonical.js';
import { verifyAuditLogChain } from './audit-chain-verify.js';

describe('verifyAuditLogChain', () => {
  it('tutarlı zinciri doğrular', () => {
    const a = {
      id: 'a1',
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
      action: 'X',
      entity: 'e',
      entityId: null,
      userId: 'u1',
      sessionId: null,
      metadata: null,
      ipHash: 'h1',
    };
    const b = {
      id: 'b1',
      timestamp: new Date('2026-01-01T00:00:01.000Z'),
      action: 'Y',
      entity: 'e',
      entityId: 'e1',
      userId: 'u1',
      sessionId: null,
      metadata: { n: 1 } as const,
      ipHash: 'h2',
    };
    const h1 = nextAuditChainHash('GENESIS', a);
    const h2 = nextAuditChainHash(h1, b);
    const result = verifyAuditLogChain([
      { ...a, chainHash: h1 },
      { ...b, chainHash: h2 },
    ]);
    expect(result).toEqual({ chainIntact: true });
  });

  it('bozuk hash tespit eder', () => {
    const row = {
      id: 'a1',
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
      action: 'X',
      entity: 'e',
      entityId: null,
      userId: null,
      sessionId: null,
      metadata: null,
      ipHash: 'h1',
      chainHash: 'deadbeef',
    };
    const r = verifyAuditLogChain([row]);
    expect(r.chainIntact).toBe(false);
    if (!r.chainIntact) {
      expect(r.firstBrokenRecordId).toBe('a1');
    }
  });
});
