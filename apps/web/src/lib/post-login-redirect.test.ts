import { describe, expect, it } from 'vitest';

import { resolvePostLoginPath, shouldForcePasswordChangeBeforeApp } from './post-login-redirect';

describe('post-login-redirect', () => {
  it('resolvePostLoginPath open redirect reddeder', () => {
    expect(resolvePostLoginPath('//evil')).toBe('/dashboard');
    expect(resolvePostLoginPath('/ok')).toBe('/ok');
  });

  it('shouldForcePasswordChangeBeforeApp süresi dolmuşsa true', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(
      shouldForcePasswordChangeBeforeApp({
        id: '1',
        sicil: '12345678',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        permissions: [],
        activeConsentVersionId: null,
        consentAccepted: true,
        passwordExpiresAt: past,
      }),
    ).toBe(true);
    expect(
      shouldForcePasswordChangeBeforeApp({
        id: '1',
        sicil: '12345678',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        permissions: [],
        activeConsentVersionId: null,
        consentAccepted: true,
        passwordExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ).toBe(false);
  });
});
