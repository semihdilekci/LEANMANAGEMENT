import { Buffer } from 'node:buffer';

/**
 * Prisma 7+ `Bytes` alanları `Uint8Array`; PII kripto katmanı `Buffer` — sınırda dönüştürür.
 */
export function bytesToNodeBuffer(value: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(value)
    ? value
    : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

/** Prisma 7 `Bytes` alanı `Uint8Array<ArrayBuffer>` — Buffer’ın `ArrayBufferLike` görünümünü daraltır. */
export function bufferToPrismaBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
  const ab = new ArrayBuffer(buf.length);
  const out = new Uint8Array(ab);
  out.set(buf);
  return out;
}
