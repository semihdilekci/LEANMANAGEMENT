/**
 * Deterministic / probabilistic PII şifreleme — docs/02_DATABASE_SCHEMA.md §5, docs/04_BACKEND_SPEC.md §7.1
 * AES-256-GCM; deterministic için alan bazlı sabit IV (SHA-256 türevi).
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

const AES_KEY_LENGTH = 32;
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

function assertKey32(key: Buffer): void {
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error('PII AES key must be exactly 32 bytes');
  }
}

/** docs/02 §5: IV sabit per-field (tenant-wide) — SHA-256 hash'inin ilk 12 byte'ı */
export function deterministicIvFromNamespace(ivNamespace: string): Buffer {
  return createHash('sha256').update(ivNamespace, 'utf8').digest().subarray(0, GCM_IV_LENGTH);
}

/** Blind index: HMAC-SHA256(pepper, plaintext) → 64 hex karakter */
export function hmacBlindIndexHex(plaintext: string, pepper: Buffer): string {
  return createHmac('sha256', pepper).update(plaintext, 'utf8').digest('hex');
}

export function encryptAes256GcmDeterministic(
  plaintext: string,
  key: Buffer,
  ivNamespace: string,
): Buffer {
  assertKey32(key);
  const iv = deterministicIvFromNamespace(ivNamespace);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([enc, tag]);
}

export function decryptAes256GcmDeterministic(
  payload: Buffer,
  key: Buffer,
  ivNamespace: string,
): string {
  assertKey32(key);
  if (payload.length < GCM_TAG_LENGTH) {
    throw new Error('Invalid ciphertext length');
  }
  const iv = deterministicIvFromNamespace(ivNamespace);
  const tag = payload.subarray(payload.length - GCM_TAG_LENGTH);
  const ciphertext = payload.subarray(0, payload.length - GCM_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Probabilistic: IV gömülü (12 | cipher | tag), ayrı rastgele DEK (KMS wrap MVP sonrası) */
export function encryptAes256GcmProbabilistic(plaintext: string): {
  ciphertext: Buffer;
  dek: Buffer;
} {
  const dek = randomBytes(AES_KEY_LENGTH);
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([iv, enc, tag]), dek };
}

export function decryptAes256GcmProbabilistic(payload: Buffer, dek: Buffer): string {
  assertKey32(dek);
  if (payload.length < GCM_IV_LENGTH + GCM_TAG_LENGTH) {
    throw new Error('Invalid probabilistic ciphertext');
  }
  const iv = payload.subarray(0, GCM_IV_LENGTH);
  const tag = payload.subarray(payload.length - GCM_TAG_LENGTH);
  const ciphertext = payload.subarray(GCM_IV_LENGTH, payload.length - GCM_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', dek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
