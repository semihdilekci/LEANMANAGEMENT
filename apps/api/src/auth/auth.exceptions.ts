import { AppException } from '../common/exceptions/app.exception.js';

export class AuthInvalidCredentialsException extends AppException {
  constructor() {
    super('AUTH_INVALID_CREDENTIALS', 'Email veya şifre hatalı.', 401);
  }
}

export class AuthTokenExpiredException extends AppException {
  constructor() {
    super('AUTH_TOKEN_EXPIRED', 'Oturumunuz sona erdi, lütfen yeniden giriş yapın.', 401);
  }
}

export class AuthTokenInvalidException extends AppException {
  constructor() {
    super('AUTH_TOKEN_INVALID', 'Oturumunuz geçersiz, lütfen yeniden giriş yapın.', 401);
  }
}

export class AuthSessionRevokedException extends AppException {
  constructor() {
    super('AUTH_SESSION_REVOKED', 'Oturumunuz kapatıldı, lütfen yeniden giriş yapın.', 401);
  }
}

export class AuthAccountLockedException extends AppException {
  constructor(unlocksAt: Date) {
    super(
      'AUTH_ACCOUNT_LOCKED',
      'Çok fazla başarısız deneme. Hesabınız geçici olarak kilitlendi.',
      423,
      {
        unlocksAt: unlocksAt.toISOString(),
      },
    );
  }
}

export class AuthAccountPassiveException extends AppException {
  constructor() {
    super('AUTH_ACCOUNT_PASSIVE', 'Hesabınız pasif durumdadır, sistem yöneticinize başvurun.', 403);
  }
}

export class AuthConsentRequiredException extends AppException {
  constructor() {
    super(
      'AUTH_CONSENT_REQUIRED',
      'Devam etmek için KVKK rıza metnini onaylamanız gerekmektedir.',
      403,
    );
  }
}

export class AuthIpNotWhitelistedException extends AppException {
  constructor() {
    super('AUTH_IP_NOT_WHITELISTED', 'Bu IP adresinden Superadmin girişi yetkisiz.', 403);
  }
}

export class UserAnonymizedException extends AppException {
  constructor() {
    super('USER_ANONYMIZED', 'Bu hesaba erişim kapatılmıştır.', 403);
  }
}

export class CsrfTokenInvalidException extends AppException {
  constructor() {
    super(
      'CSRF_TOKEN_INVALID',
      'Güvenlik doğrulaması başarısız, sayfayı yenileyip tekrar deneyin.',
      403,
    );
  }
}

export class RateLimitIpException extends AppException {
  constructor() {
    super('RATE_LIMIT_IP', 'Çok fazla istek. Lütfen bir süre sonra tekrar deneyin.', 429);
  }
}

export class RateLimitUserException extends AppException {
  constructor() {
    super('RATE_LIMIT_USER', 'Çok fazla istek. Lütfen biraz bekleyin.', 429);
  }
}

export class RateLimitLoginException extends AppException {
  constructor(retryAfterSeconds: number) {
    super(
      'RATE_LIMIT_LOGIN',
      'Çok fazla başarısız deneme. Lütfen bir süre sonra tekrar deneyin.',
      429,
      {
        retryAfterSeconds,
      },
    );
  }
}

export class ConsentVersionNotFoundException extends AppException {
  constructor() {
    super('CONSENT_VERSION_NOT_FOUND', 'Rıza versiyonu bulunamadı.', 404);
  }
}

export class AuthOidcDisabledException extends AppException {
  constructor() {
    super('AUTH_OIDC_DISABLED', 'Kurumsal giriş bu ortamda yapılandırılmamış.', 404);
  }
}

export class AuthOidcInvalidRequestException extends AppException {
  constructor() {
    super('AUTH_OIDC_INVALID_REQUEST', 'Geçersiz veya eksik OAuth isteği.', 400);
  }
}

export class AuthOidcStateInvalidException extends AppException {
  constructor() {
    super(
      'AUTH_OIDC_STATE_INVALID',
      'Oturum doğrulaması başarısız. Lütfen girişi yeniden başlatın.',
      401,
    );
  }
}

export class AuthOidcTokenException extends AppException {
  constructor() {
    super('AUTH_OIDC_TOKEN_INVALID', 'Kimlik sağlayıcı yanıtı doğrulanamadı.', 401);
  }
}

export class AuthOidcEmailUnverifiedException extends AppException {
  constructor() {
    super(
      'AUTH_OIDC_EMAIL_UNVERIFIED',
      'E-posta adresi kurumsal kimlik sağlayıcıda doğrulanmamış. Yöneticinize başvurun.',
      403,
    );
  }
}

export class AuthOidcUserNotProvisionedException extends AppException {
  constructor() {
    super(
      'AUTH_OIDC_USER_NOT_PROVISIONED',
      'Bu e-posta ile ön tanımlı platform kullanıcısı bulunamadı. Yöneticinize başvurun.',
      403,
    );
  }
}

export class AuthOidcInvalidClaimsException extends AppException {
  constructor() {
    super('AUTH_OIDC_INVALID_CLAIMS', 'Kimlik sağlayıcıdan gelen kullanıcı bilgisi eksik.', 400);
  }
}
