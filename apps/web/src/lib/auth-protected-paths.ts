/**
 * Oturum gerektiren uygulama yolları — `middleware.ts` ve `AuthHydrator` ile senkron tutulur.
 * Tam sayfa yüklemede refresh + `/auth/me` yalnızca bu prefix’lerde çalışır.
 */
export const AUTH_PROTECTED_APP_PREFIXES = [
  '/dashboard',
  '/profile',
  '/notifications',
  '/settings',
  '/admin',
  '/processes',
  '/tasks',
  '/users',
  '/roles',
  '/master-data',
] as const;

export function isAuthProtectedAppPath(pathname: string): boolean {
  return AUTH_PROTECTED_APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
