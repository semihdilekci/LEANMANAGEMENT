import { describe, expect, it } from 'vitest';

import { buildPostOidcLoginUrl } from './oidc-login-redirect.js';

describe('buildPostOidcLoginUrl', () => {
  it('başarı ve güvenli redirect query üretir', () => {
    expect(
      buildPostOidcLoginUrl('http://127.0.0.1:3000/', {
        oidc: 'success',
        redirect: '/dashboard',
      }),
    ).toBe('http://127.0.0.1:3000/login?oidc=success&redirect=%2Fdashboard');
  });

  it('hata kodu ekler', () => {
    expect(
      buildPostOidcLoginUrl('https://app.example.com', {
        oidc: 'error',
        errorCode: 'AUTH_OIDC_STATE_INVALID',
      }),
    ).toBe('https://app.example.com/login?oidc=error&error=AUTH_OIDC_STATE_INVALID');
  });

  it('tehlikeli redirect query’ye eklemez', () => {
    expect(
      buildPostOidcLoginUrl('http://localhost:3000', {
        oidc: 'success',
        redirect: '//evil.com',
      }),
    ).toBe('http://localhost:3000/login?oidc=success');
  });
});
