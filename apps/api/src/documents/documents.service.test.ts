import { describe, expect, it } from 'vitest';

import { buildStagingObjectKey } from './documents.service.js';

describe('DocumentsService helpers', () => {
  it('buildStagingObjectKey path traversal karakterlerini yumuşatır', () => {
    const key = buildStagingObjectKey('doc-1', 'a/../evil.jpg');
    expect(key).toBe('staging/doc-1-a___evil.jpg');
    expect(key).not.toContain('..');
    expect(key.endsWith('evil.jpg')).toBe(true);
  });
});
