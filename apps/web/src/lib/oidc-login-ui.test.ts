import { describe, expect, it } from 'vitest';

import { buildOidcGoogleStartHref, messageForOidcLoginError } from './oidc-login-ui';

describe('oidc-login-ui', () => {
  it('buildOidcGoogleStartHref güvenli redirect ekler', () => {
    expect(buildOidcGoogleStartHref('/tasks')).toBe('/api/v1/auth/oauth/google?redirect=%2Ftasks');
    expect(buildOidcGoogleStartHref('//x')).toBe('/api/v1/auth/oauth/google');
    expect(buildOidcGoogleStartHref(null)).toBe('/api/v1/auth/oauth/google');
  });

  it('messageForOidcLoginError bilinen kodları döndürür', () => {
    expect(messageForOidcLoginError('AUTH_OIDC_STATE_INVALID')).toContain('tekrar');
    expect(messageForOidcLoginError('UNKNOWN')).toBeUndefined();
  });
});
