/** Cross-app yardımcıları — Faz 2+ ile doldurulacak */
export function noop(): void {
  /* scaffold */
}

export { bufferToPrismaBytes, bytesToNodeBuffer } from './bytes.js';
export {
  decryptAes256GcmDeterministic,
  decryptAes256GcmProbabilistic,
  deterministicIvFromNamespace,
  encryptAes256GcmDeterministic,
  encryptAes256GcmProbabilistic,
  hmacBlindIndexHex,
} from './pii-crypto.js';
