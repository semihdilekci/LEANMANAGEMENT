/**
 * Open redirect önlemi — yalnız uygulama içi mutlak path (`/` ile başlar, `//` ile başlamaz).
 * Post-login ve OIDC dönüşünde `redirect` query paylaşımı için.
 */
export function sanitizeInternalRedirectPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return undefined;
  }
  return value;
}
