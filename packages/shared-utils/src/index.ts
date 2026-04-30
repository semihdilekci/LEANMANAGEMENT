/** Cross-app yardımcıları — Faz 2+ ile doldurulacak */
export function noop(): void {
  /* scaffold */
}

export { bufferToPrismaBytes, bytesToNodeBuffer } from './bytes.js';
export { calendarDaysUntilPasswordExpiry } from './password-expiry-calendar.js';
export {
  decryptAes256GcmDeterministic,
  decryptAes256GcmProbabilistic,
  deterministicIvFromNamespace,
  encryptAes256GcmDeterministic,
  encryptAes256GcmProbabilistic,
  hmacBlindIndexHex,
} from './pii-crypto.js';
export { slaPctRemaining } from './sla-pct-remaining.js';
export {
  auditLogCanonicalString,
  nextAuditChainHash,
  stableJsonStringifyForAudit,
} from './audit-chain-canonical.js';
export { verifyAuditLogChain, type AuditChainVerifyInputRow } from './audit-chain-verify.js';
export { sanitizeInternalRedirectPath } from './internal-redirect-path.js';
