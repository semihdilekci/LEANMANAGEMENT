import type { PrismaClient } from '@leanmgmt/prisma-client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextAuditChainHash } from '@leanmgmt/shared-utils';

import { runAuditChainVerification } from './audit-chain-verify.cron.js';

describe('runAuditChainVerification', () => {
  const creates: unknown[] = [];

  beforeEach(() => {
    creates.length = 0;
  });

  it('bozulmamış zincir için integrity satırı yazar', async () => {
    const t = new Date('2026-01-01T00:00:00.000Z');
    const r1 = {
      id: 'a1',
      timestamp: t,
      action: 'X',
      entity: 'e',
      entityId: null,
      userId: 'u',
      sessionId: null,
      metadata: null,
      ipHash: 'h',
    };
    const h1 = nextAuditChainHash('GENESIS', r1);
    const row1 = { ...r1, chainHash: h1 };
    const prisma = {
      auditLog: {
        findMany: vi.fn().mockResolvedValue([row1]),
      },
      auditChainIntegrityCheck: {
        create: vi.fn().mockImplementation(({ data }) => {
          creates.push(data);
          return { checkedAt: new Date(), ...data };
        }),
      },
    } as unknown as PrismaClient;

    const r = await runAuditChainVerification(prisma);
    expect(r.chainIntact).toBe(true);
    expect(r.totalRecordsChecked).toBe(1);
    expect(prisma.auditChainIntegrityCheck.create).toHaveBeenCalledWith({
      data: {
        chainIntact: true,
        firstBrokenAt: null,
        firstBrokenRecordId: null,
        totalRecordsChecked: 1,
        durationMs: expect.any(Number) as number,
      },
    });
  });
});
