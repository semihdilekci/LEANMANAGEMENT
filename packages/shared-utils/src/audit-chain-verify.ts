import { nextAuditChainHash } from './audit-chain-canonical.js';

export type AuditChainVerifyInputRow = {
  id: string;
  timestamp: Date;
  action: string;
  entity: string;
  entityId: string | null;
  userId: string | null;
  sessionId: string | null;
  metadata: unknown;
  ipHash: string;
  chainHash: string;
};

/**
 * AuditLogService.append ile aynı: her insert, DB’deki o anki “uç” satıra
 * (timestamp desc, id desc) göre prev alır. Doğrulamada id artan sırada ilerleyip
 * aynı “uç” kuralını (max timestamp, tie-break id) uygularız.
 */
export function verifyAuditLogChain(
  rows: AuditChainVerifyInputRow[],
):
  | { chainIntact: true }
  | { chainIntact: false; firstBrokenRecordId: string; firstBrokenAt: string } {
  const byId = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const inserted: AuditChainVerifyInputRow[] = [];
  for (const row of byId) {
    let prev = 'GENESIS';
    if (inserted.length > 0) {
      const best = inserted.reduce((a, b) => {
        if (a.timestamp > b.timestamp) return a;
        if (a.timestamp < b.timestamp) return b;
        return a.id > b.id ? a : b;
      });
      prev = best.chainHash;
    }
    const expected = nextAuditChainHash(prev, {
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      userId: row.userId,
      sessionId: row.sessionId,
      metadata: row.metadata,
      ipHash: row.ipHash,
    });
    if (expected !== row.chainHash) {
      return {
        chainIntact: false,
        firstBrokenRecordId: row.id,
        firstBrokenAt: row.timestamp.toISOString(),
      };
    }
    inserted.push(row);
  }
  return { chainIntact: true };
}
