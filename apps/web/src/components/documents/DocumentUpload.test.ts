import { describe, expect, it } from 'vitest';

import { resolveKtiImageContentType } from './DocumentUpload';

describe('resolveKtiImageContentType', () => {
  it('accepts standard browser MIME types', () => {
    expect(resolveKtiImageContentType({ name: 'x.bin', type: 'image/jpeg' })).toBe('image/jpeg');
    expect(resolveKtiImageContentType({ name: 'x', type: 'image/png' })).toBe('image/png');
    expect(resolveKtiImageContentType({ name: 'x', type: 'image/webp' })).toBe('image/webp');
  });

  it('infers from extension when type is empty (macOS / some exports)', () => {
    expect(resolveKtiImageContentType({ name: 'IMG_0001.JPG', type: '' })).toBe('image/jpeg');
    expect(resolveKtiImageContentType({ name: 'shot.jpeg', type: '' })).toBe('image/jpeg');
    expect(resolveKtiImageContentType({ name: 'diagram.PNG', type: '' })).toBe('image/png');
    expect(resolveKtiImageContentType({ name: 'a.webp', type: '' })).toBe('image/webp');
  });

  it('returns null for unsupported types or extensions', () => {
    expect(resolveKtiImageContentType({ name: 'doc.pdf', type: 'application/pdf' })).toBeNull();
    expect(resolveKtiImageContentType({ name: 'x.heic', type: '' })).toBeNull();
    expect(resolveKtiImageContentType({ name: 'noext', type: '' })).toBeNull();
  });
});
