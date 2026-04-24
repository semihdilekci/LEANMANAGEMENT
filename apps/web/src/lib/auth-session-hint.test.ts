import { describe, it, expect, vi, afterEach } from 'vitest';

import { readCookie, SESSION_HINT_COOKIE } from './auth-session-hint';

describe('auth-session-hint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sabit oturum ipucu çerez adı', () => {
    expect(SESSION_HINT_COOKIE).toBe('lm_session_hint');
  });

  it('readCookie document.cookie içinden okur', () => {
    vi.stubGlobal('document', { cookie: 'csrf_token=abc%3D; other=1' });
    expect(readCookie('csrf_token')).toBe('abc=');
    expect(readCookie('missing')).toBeUndefined();
  });
});
