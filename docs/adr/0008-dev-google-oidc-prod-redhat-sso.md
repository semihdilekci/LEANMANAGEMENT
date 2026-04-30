# ADR 0008: Geliştirme — Google OIDC, Canlı — Red Hat SSO

## Durum

Kabul edildi (dokümantasyon — 30 Nisan 2026)

## Bağlam

Platformda kimlik doğrulama başlangıçta email + şifre ile tanımlanmıştı; kurumsal hedef ise holding IdP’si ile tek oturum (SSO) idi. Geliştirme safhasında ekip, üretimde kullanılacak OIDC akışını erken doğrulamak ve tutarlı bir login deneyimi istiyor. Canlı ortamda ise holding standardı **Red Hat SSO (Keycloak)** olacaktır.

## Karar

1. **Geliştirme (dev, lokal, isteğe bağlı erken staging):** Birincil kullanıcı girişi **Google OAuth 2.0 / OpenID Connect** ile yapılır (Authorization Code + PKCE, `openid email profile` kapsamı; uygulama Google Cloud Console’da kayıtlı OAuth istemcisi). Amaç: OIDC token doğrulama, callback güvenliği, kullanıcı eşleme ve mevcut JWT + refresh cookie oturum modeli ile entegrasyonu erken test etmek.
2. **Production (canlı):** Birincil kurumsal kimlik sağlayıcısı **Red Hat SSO (Keycloak)** olacak şekilde yapılandırılır; Google IdP yalnızca geliştirme doğrulaması içindir, canlıda devre dışı veya kullanılmaz.
3. **Email + şifre (`POST /api/v1/auth/login`):** Seed kullanıcılar, otomasyon (CI/E2E), süperadmin bootstrap ve geçiş süresi için **korunur**; mimari kararlar dokümanında yardımcı yol olarak tanımlanır.

## Sonuçlar

- **Olumlu:** Dev ve prod aynı protokol ailesinde (OIDC) kalır; Keycloak’a geçişte çoğunlukla IdP URL, client id/secret ve JWKS yapılandırması değişir.
- **Olumlu:** Google Workspace ile hizalı test hesaplarıyla hızlı onboarding.
- **Dikkat:** Google `sub` ile Keycloak `sub` farklıdır; kullanıcı birincil anahtarı DB’de **platform user id** + isteğe bağlı `external_subject` / IdP kaynak alanı ile tutulmalıdır — email ile JIT eşleme riskleri (tenant policy) ADR ve güvenlik dokümanında ele alınır.
- **Dikkat:** Şifre sıfırlama / lockout akışları OIDC birincil kullanıcıda kısmen IdP’ye devredilir; uygulama içi şifre politikası yalnızca local/legacy hesaplar için anlamlı kalır.

## İlgili dokümanlar

- `docs/mimari-kararlar.md` — [A-007], [A-009], [TS-009]
- `docs/07_SECURITY_IMPLEMENTATION.md` — ortam bazlı giriş
- `docs/00_PROJECT_OVERVIEW.md` — kapsam özeti
- `docs/03_API_CONTRACTS.md` — auth bölümü
