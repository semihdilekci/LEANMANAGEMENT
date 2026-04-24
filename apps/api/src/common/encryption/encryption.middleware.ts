/**
 * Prisma yazma/okuma öncesi PII dönüşümü — docs/04_BACKEND_SPEC.md §7.1
 * Şema doğrudan `*_encrypted` / blind index kullandığından, servis katmanı bu helper ile alan üretir.
 */
import type { EncryptionService } from './encryption.service.js';

export type UserPiiWrite = {
  sicilEncrypted: Buffer;
  sicilBlindIndex: string;
  emailEncrypted: Buffer;
  emailBlindIndex: string;
};

export function buildUserPiiForCreate(
  enc: EncryptionService,
  sicil: string,
  email: string,
): UserPiiWrite {
  return {
    sicilEncrypted: enc.encryptSicil(sicil),
    sicilBlindIndex: enc.sicilBlindIndex(sicil),
    emailEncrypted: enc.encryptEmail(email),
    emailBlindIndex: enc.emailBlindIndex(email),
  };
}
