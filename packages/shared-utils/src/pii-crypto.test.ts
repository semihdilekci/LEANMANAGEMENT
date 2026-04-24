import { describe, expect, it } from 'vitest';
import {
  decryptAes256GcmDeterministic,
  encryptAes256GcmDeterministic,
  hmacBlindIndexHex,
} from './pii-crypto.js';

const key = Buffer.alloc(32, 7);
const pepper = Buffer.alloc(32, 11);

describe('pii-crypto deterministic', () => {
  it('round-trips sicil', () => {
    const ns = 'user:sicil:v1';
    const plain = '12345678';
    const ct = encryptAes256GcmDeterministic(plain, key, ns);
    expect(decryptAes256GcmDeterministic(ct, key, ns)).toBe(plain);
  });

  it('aynı email her zaman aynı ciphertext (deterministic)', () => {
    const ns = 'user:email:v1';
    const email = 'superadmin@leanmgmt.local';
    const a = encryptAes256GcmDeterministic(email, key, ns);
    const b = encryptAes256GcmDeterministic(email, key, ns);
    expect(a.equals(b)).toBe(true);
  });

  it('blind index tutarlı ve lowercase normalize edilmiş girdide aynı', () => {
    const n1 = hmacBlindIndexHex('a@b.com', pepper);
    const n2 = hmacBlindIndexHex('a@b.com', pepper);
    expect(n1).toBe(n2);
    expect(n1).toHaveLength(64);
  });
});
