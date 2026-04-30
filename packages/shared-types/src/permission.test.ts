import { describe, expect, it } from 'vitest';

import { Permission, PERMISSION_METADATA } from './permission.js';

describe('Permission metadata', () => {
  it('her enum değeri için PERMISSION_METADATA tanımlı ve key eşleşir', () => {
    const keys = Object.keys(Permission) as Permission[];
    for (const key of keys) {
      expect(PERMISSION_METADATA[key]).toBeDefined();
      expect(PERMISSION_METADATA[key].key).toBe(key);
    }
  });

  it('admin consent permission anahtarları mevcut', () => {
    expect(Permission.CONSENT_VERSION_VIEW).toBe('CONSENT_VERSION_VIEW');
    expect(Permission.CONSENT_VERSION_EDIT).toBe('CONSENT_VERSION_EDIT');
    expect(Permission.CONSENT_VERSION_PUBLISH).toBe('CONSENT_VERSION_PUBLISH');
    expect(PERMISSION_METADATA[Permission.CONSENT_VERSION_PUBLISH].isSensitive).toBe(true);
  });
});
