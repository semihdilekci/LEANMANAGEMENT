import { sanitizeInternalRedirectPath } from '@leanmgmt/shared-utils/internal-redirect-path';

import type { AuthUser } from '@/stores/auth-store';

export function resolvePostLoginPath(redirectParam: string | null): string {
  return sanitizeInternalRedirectPath(redirectParam) ?? '/dashboard';
}

export function shouldForcePasswordChangeBeforeApp(user: AuthUser | null): boolean {
  if (!user?.passwordExpiresAt) return false;
  return new Date(user.passwordExpiresAt).getTime() < Date.now();
}
