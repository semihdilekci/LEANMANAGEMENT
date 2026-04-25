import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';

import { bufferToPrismaBytes, bytesToNodeBuffer } from './bytes.js';

describe('bytesToNodeBuffer / bufferToPrismaBytes', () => {
  it('round-trips Prisma 7 byte alanı ile Uo8 ↔ Buffer', () => {
    const b = Buffer.from('café-bytes-utf8-π', 'utf8');
    const u8 = bufferToPrismaBytes(b);
    expect(u8).toBeInstanceOf(Uint8Array);
    expect(bytesToNodeBuffer(u8).equals(b)).toBe(true);
  });
});
