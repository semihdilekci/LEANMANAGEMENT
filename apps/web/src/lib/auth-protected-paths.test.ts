import { describe, expect, it } from 'vitest';

import { isAuthProtectedAppPath } from './auth-protected-paths.js';

describe('isAuthProtectedAppPath', () => {
  it('admin ve bildirim yollarını korur', () => {
    expect(isAuthProtectedAppPath('/admin/email-templates')).toBe(true);
    expect(isAuthProtectedAppPath('/notifications')).toBe(true);
    expect(isAuthProtectedAppPath('/login')).toBe(false);
  });
});
