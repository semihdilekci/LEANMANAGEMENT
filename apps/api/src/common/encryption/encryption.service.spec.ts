import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Env } from '../../config/env.schema.js';
import { EncryptionService } from './encryption.service.js';

const keyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const pepperHex = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('EncryptionService', () => {
  let enc: EncryptionService;

  beforeEach(() => {
    const mockConfig = {
      get(key: keyof Env): string {
        if (key === 'APP_PII_ENCRYPTION_KEY') return keyHex;
        if (key === 'APP_PII_PEPPER') return pepperHex;
        throw new Error(`unexpected ${String(key)}`);
      },
    } as unknown as ConfigService<Env, true>;
    enc = new EncryptionService(mockConfig);
  });

  it('sicil round-trip', () => {
    const plain = '12345678';
    const ct = enc.encryptSicil(plain);
    expect(enc.decryptSicil(ct)).toBe(plain);
  });

  it('email deterministic', () => {
    const e = 'User@Example.COM';
    const a = enc.encryptEmail(e);
    const b = enc.encryptEmail(e);
    expect(a.equals(b)).toBe(true);
    expect(enc.decryptEmail(a)).toBe('user@example.com');
  });

  it('blind index email lowercase tutarlı', () => {
    expect(enc.emailBlindIndex('A@B.COM')).toBe(enc.emailBlindIndex('a@b.com'));
  });

  it('phone probabilistic round-trip', () => {
    const { ciphertext, dek } = enc.encryptPhone('+905551112233');
    expect(enc.decryptPhone(ciphertext, dek)).toBe('+905551112233');
  });
});
