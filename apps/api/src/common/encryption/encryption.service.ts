import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  bufferToPrismaBytes,
  bytesToNodeBuffer,
  decryptAes256GcmDeterministic,
  decryptAes256GcmProbabilistic,
  encryptAes256GcmDeterministic,
  encryptAes256GcmProbabilistic,
  hmacBlindIndexHex,
} from '@leanmgmt/shared-utils';

import type { Env } from '../../config/env.schema.js';

const NS_SICIL = 'user:sicil:v1';
const NS_EMAIL = 'user:email:v1';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  private readonly pepper: Buffer;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {
    const keyHex: string = this.config.get('APP_PII_ENCRYPTION_KEY', { infer: true });
    const pepperHex: string = this.config.get('APP_PII_PEPPER', { infer: true });
    this.key = Buffer.from(keyHex, 'hex');
    this.pepper = Buffer.from(pepperHex, 'hex');
  }

  sicilBlindIndex(sicil: string): string {
    return hmacBlindIndexHex(sicil, this.pepper);
  }

  encryptSicil(sicil: string): Uint8Array {
    return bufferToPrismaBytes(encryptAes256GcmDeterministic(sicil, this.key, NS_SICIL));
  }

  decryptSicil(payload: Buffer | Uint8Array): string {
    return decryptAes256GcmDeterministic(bytesToNodeBuffer(payload), this.key, NS_SICIL);
  }

  normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  emailBlindIndex(email: string): string {
    return hmacBlindIndexHex(this.normalizeEmail(email), this.pepper);
  }

  encryptEmail(email: string): Uint8Array {
    return bufferToPrismaBytes(
      encryptAes256GcmDeterministic(this.normalizeEmail(email), this.key, NS_EMAIL),
    );
  }

  decryptEmail(payload: Buffer | Uint8Array): string {
    return decryptAes256GcmDeterministic(bytesToNodeBuffer(payload), this.key, NS_EMAIL);
  }

  /** docs/03-security-baseline — phone probabilistic */
  encryptPhone(phone: string): { ciphertext: Uint8Array; dek: Uint8Array } {
    const { ciphertext, dek } = encryptAes256GcmProbabilistic(phone);
    return { ciphertext: bufferToPrismaBytes(ciphertext), dek: bufferToPrismaBytes(dek) };
  }

  decryptPhone(ciphertext: Buffer | Uint8Array, dek: Buffer | Uint8Array): string {
    return decryptAes256GcmProbabilistic(bytesToNodeBuffer(ciphertext), bytesToNodeBuffer(dek));
  }
}
