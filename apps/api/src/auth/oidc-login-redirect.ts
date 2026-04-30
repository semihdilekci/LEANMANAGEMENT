import { sanitizeInternalRedirectPath } from '@leanmgmt/shared-utils';

/**
 * OIDC callback sonrası tarayıcıyı `/login` üzerinde hydrate adımına yönlendirir (token URL’de taşınmaz).
 */
export function buildPostOidcLoginUrl(
  webPublicOrigin: string,
  options: {
    oidc: 'success' | 'error';
    errorCode?: string;
    redirect?: string;
  },
): string {
  const trimmed = webPublicOrigin.replace(/\/+$/, '');
  const u = new URL('/login', `${trimmed}/`);
  u.searchParams.set('oidc', options.oidc);
  if (options.oidc === 'error' && options.errorCode) {
    u.searchParams.set('error', options.errorCode);
  }
  const safe = sanitizeInternalRedirectPath(options.redirect);
  if (safe) {
    u.searchParams.set('redirect', safe);
  }
  return u.toString();
}
