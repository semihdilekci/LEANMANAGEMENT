import { createHash } from 'node:crypto';

/**
 * Aynı semantik JSON için tekil string (key sırası; jsonb round-trip ile append uyumu).
 */
export function stableJsonStringifyForAudit(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJsonStringifyForAudit(v)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableJsonStringifyForAudit(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function auditLogCanonicalString(input: {
  action: string;
  entity: string;
  entityId: string | null;
  userId: string | null;
  sessionId: string | null;
  metadata: unknown;
  ipHash: string;
}): string {
  return stableJsonStringifyForAudit({
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    metadata: input.metadata ?? null,
    ipHash: input.ipHash,
  });
}

export function nextAuditChainHash(
  prevChain: string,
  input: {
    action: string;
    entity: string;
    entityId: string | null;
    userId: string | null;
    sessionId: string | null;
    metadata: unknown;
    ipHash: string;
  },
): string {
  const canonical = auditLogCanonicalString(input);
  return createHash('sha256')
    .update(prevChain + canonical)
    .digest('hex');
}
