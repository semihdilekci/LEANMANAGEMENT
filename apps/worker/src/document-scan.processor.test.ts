import { describe, expect, it } from 'vitest';

import { bufferLooksInfected, EICAR_SUBSTRING } from './document-scan.processor.js';

describe('bufferLooksInfected', () => {
  it('EICAR test string tespit eder', () => {
    const buf = Buffer.from(`X5O!P%@AP[4\\PZX54(P^)7CC)7}$${EICAR_SUBSTRING}!$H+H*`, 'utf8');
    expect(bufferLooksInfected(buf)).toBe(true);
  });

  it('temiz içerik false döner', () => {
    expect(bufferLooksInfected(Buffer.from('hello world', 'utf8'))).toBe(false);
  });
});
