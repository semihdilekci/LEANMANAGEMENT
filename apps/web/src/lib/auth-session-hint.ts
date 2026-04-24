/** HttpOnly refresh çerezi path=/api/v1/auth olduğu için Next middleware’de görünmez; yalnızca UX yönlendirmesi. */
export const SESSION_HINT_COOKIE = 'lm_session_hint';

const maxAgeSeconds = 14 * 24 * 60 * 60;

export function setSessionHintCookie(): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_HINT_COOKIE}=1; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Strict${secure}`;
}

export function clearSessionHintCookie(): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict${secure}`;
}

export function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
  );
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}
