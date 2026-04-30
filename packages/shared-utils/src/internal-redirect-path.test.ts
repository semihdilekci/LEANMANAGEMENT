import { describe, expect, it } from 'vitest';

import { sanitizeInternalRedirectPath } from './internal-redirect-path.js';

describe('sanitizeInternalRedirectPath', () => {
  it('geçerli iç path döndürür', () => {
    expect(sanitizeInternalRedirectPath('/dashboard')).toBe('/dashboard');
    expect(sanitizeInternalRedirectPath('/tasks/abc')).toBe('/tasks/abc');
  });

  it('protocol-relative ve harici path reddeder', () => {
    expect(sanitizeInternalRedirectPath('//evil.com')).toBeUndefined();
    expect(sanitizeInternalRedirectPath('https://evil.com')).toBeUndefined();
    expect(sanitizeInternalRedirectPath('')).toBeUndefined();
    expect(sanitizeInternalRedirectPath('relative')).toBeUndefined();
  });

  it('tip dışı değerleri reddeder', () => {
    expect(sanitizeInternalRedirectPath(null)).toBeUndefined();
    expect(sanitizeInternalRedirectPath(1)).toBeUndefined();
  });
});
