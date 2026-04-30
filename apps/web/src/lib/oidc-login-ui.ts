import { sanitizeInternalRedirectPath } from '@leanmgmt/shared-utils/internal-redirect-path';

/** OIDC hata query (`?error=`) — API typed exception kodları ile hizalı */
const OIDC_ERROR_MESSAGES: Record<string, string> = {
  AUTH_OIDC_DISABLED: 'Kurumsal giriş bu ortamda yapılandırılmamış.',
  AUTH_OIDC_INVALID_REQUEST: 'Geçersiz veya eksik OAuth isteği.',
  AUTH_OIDC_STATE_INVALID:
    'Kurumsal giriş yarım kaldı veya süresi doldu. Aşağıdaki "Kurumsal hesap ile giriş" düğmesine tekrar tıklayın.',
  AUTH_OIDC_TOKEN_INVALID: 'Kimlik sağlayıcı yanıtı doğrulanamadı.',
  AUTH_OIDC_EMAIL_UNVERIFIED:
    'E-posta adresi kurumsal kimlik sağlayıcıda doğrulanmamış. Yöneticinize başvurun.',
  AUTH_OIDC_USER_NOT_PROVISIONED:
    'Bu e-posta ile ön tanımlı platform kullanıcısı bulunamadı. Yöneticinize başvurun.',
  AUTH_OIDC_INVALID_CLAIMS: 'Kimlik sağlayıcıdan gelen kullanıcı bilgisi eksik.',
  AUTH_ACCOUNT_LOCKED: 'Çok fazla başarısız deneme. Hesabınız geçici olarak kilitlendi.',
  AUTH_ACCOUNT_PASSIVE: 'Hesabınız pasif durumdadır, sistem yöneticinize başvurun.',
  USER_ANONYMIZED: 'Bu hesaba erişim kapatılmıştır.',
  AUTH_IP_NOT_WHITELISTED: 'Bu IP adresinden Superadmin girişi yetkisiz.',
};

export function messageForOidcLoginError(code: string): string | undefined {
  return OIDC_ERROR_MESSAGES[code];
}

export function buildOidcGoogleStartHref(redirectParam: string | null): string {
  const safe = sanitizeInternalRedirectPath(redirectParam);
  if (!safe) {
    return '/api/v1/auth/oauth/google';
  }
  return `/api/v1/auth/oauth/google?redirect=${encodeURIComponent(safe)}`;
}

export function isOidcLoginButtonEnabled(): boolean {
  return process.env.NEXT_PUBLIC_OIDC_LOGIN_BUTTON === 'true';
}

export function isPasswordLoginFormEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PASSWORD_LOGIN_ENABLED !== 'false';
}
