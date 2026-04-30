# Faz 2.1 — Google OIDC ön hazırlık (senin yapman gerekenler)

Bu dosya `.cursor/rules/52.1-phase-02-GoogleSSOAuth.mdc` içindeki **“Geliştirme öncesi — son hazırlık”** maddelerini tek tek **tıklanabilir iş**e çevirir. Agent veya CI **Google Cloud Console’a girip OAuth istemcisi oluşturamaz**; bunlar hesabına bağlıdır.

**Ne zaman gerekli?**

| Aşama                                                             | Google Console şart mı? |
| ----------------------------------------------------------------- | ----------------------- |
| Faz 2.1 İterasyon 1 (path + env şeması + `OIDC_ENABLED=false`)    | Hayır                   |
| Faz 2.1 İterasyon 2+ (gerçek redirect, token takası, lokal smoke) | **Evet**                |

---

## 1) Google Cloud projesi ve OAuth istemcisi

1. [Google Cloud Console](https://console.cloud.google.com/) → üstten doğru projeyi seç (yoksa **Yeni proje**).
2. Sol menü: **API’ler ve Hizmetler** → **Kitaplık** → **Google+ API** veya doğrudan **“Google People API” / “People API”** gerekmez; OIDC için yeterli olan **OAuth izin ekranı** + **OAuth istemci kimlikleri** yoludur.
3. **API’ler ve Hizmetler** → **OAuth izin ekranı**:
   - Kullanıcı türü: genelde **Dahili** (Workspace hesabın varsa) veya **Harici** (kişisel Gmail ile test).
   - Uygulama adı, destek e-postası gibi zorunlu alanları doldur.
   - **Harici** seçtiysen: test aşamasında yalnızca **Test kullanıcıları** listesindeki Google hesapları giriş yapabilir — kendi e-postanı ekle.
4. **API’ler ve Hizmetler** → **Kimlik bilgileri** → **Kimlik bilgisi oluştur** → **OAuth istemci kimliği**:
   - Uygulama türü: **Web uygulaması**.
   - İsim: örn. `Lean Management — local API`.

---

## 2) Yetkili yönlendirme URI’leri (zorunlu — birebir aynı olmalı)

Repo’daki API kontratı ve `apps/api/.env.example` şu callback pathname’i sabitler:

**Tam callback URL (yerel, API doğrudan):**

`http://127.0.0.1:3001/api/v1/auth/oauth/google/callback`

Google Console → OAuth istemcisi → **Yetkili yönlendirme URI’leri** → yukarıdaki satırı **ekle**.

> **Not:** `localhost` ile `127.0.0.1` Google tarafında farklı origin sayılır. `.env` içinde hangisini kullanıyorsan redirect URI de **aynı host** olmalı.

### 2b) Next.js proxy ile tek origin (önerilen — Faz 2.1 İterasyon 3)

- Tarayıcı **Next kökünde** kalır (örn. `http://localhost:3000`); `/api/*` istekleri `apps/web/next.config.mjs` rewrite ile Nest’e gider (`API_UPSTREAM_URL`).
- **`OIDC_REDIRECT_URI`**: tarayıcıda görünen tam URL olmalı, örn. `http://localhost:3000/api/v1/auth/oauth/google/callback` — Google Console’a **bu** satırı ekle.
- **`WEB_PUBLIC_ORIGIN`** (API `.env`): `http://localhost:3000` — callback sonrası Set-Cookie + `302` → `/login?oidc=success` (ham JSON sayfası olmaz). Boş bırakılırsa callback yanıtı JSON kalır (CI / entegrasyon).
- **“Kurumsal hesap ile giriş”** butonu: `NEXT_PUBLIC_OIDC_LOGIN_BUTTON=true` ve start URL aynı origin üzerinden `GET /api/v1/auth/oauth/google` (tam sayfa; `oidc_state` çerezi ile aynı host).

Staging/dev sunucu kullanacaksan, o ortamın **HTTPS** tabanlı tam callback URL’sini de ayrı satır olarak ekle (ör. `https://app-dev.sirketin.com/api/v1/auth/oauth/google/callback`).

---

## 3) Yetkili JavaScript kaynakları

OAuth istemcisinde **Yetkili JavaScript kaynakları**:

- Yerel Next.js örneği: `http://localhost:3000` ve/veya `http://127.0.0.1:3000` (hangi origin ile açıyorsan).
- Tarayıcıyı API’ye doğrudan yönlendiriyorsan ek origin gerekmez; Faz 2.1 İterasyon 3’teki UX’e göre sadece web origin yeterli olabilir.

Yalnızca **güvendiğin** origin’leri yaz.

---

## 4) İstemci gizliliği (client secret)

1. OAuth istemcisi oluşturulunca **İstemci kimliği** ve **İstemci gizliliği** gösterilir.
2. Gizliliği **asla** repoya koyma. `apps/api/.env` veya `apps/api/.env.local` (gitignore’da) kullan.
3. Holding’de Secrets Manager kullanılacaksa: gizliliği oraya koy; rotasyon sorumlusunu (sen veya güvenlik) not düş.

`apps/api/.env.example` içindeki tablo hangi değişkenlerin dolacağını özetler (`OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, vb.).

---

## 5) OAuth izin ekranı ve test kullanıcıları

- **Harici** uygulama + “Testing” modunda: **Test kullanıcıları** listesine giriş deneyeceğin tüm `@gmail.com` / Workspace hesaplarını ekle.
- **Dahili** (Workspace): şirket politikasına göre alan genelinde açılabilir; yine de güvenlik ekibiyle hizala.

---

## 6) Kullanıcı eşleme ve JIT (yazılı karar — ADR ile uyumlu)

**MVP önerisi (ADR 0008 ve şema `external_subject` ile uyumlu):**

| Konu                                                  | Önerilen karar                                                                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eşleme anahtarı                                       | IdP’den gelen **doğrulanmış e-posta** (`email_verified=true`) ile `users` tablosunda kayıt aranır.                                                                            |
| JIT (IdP’de görünen herkesi otomatik `users` oluştur) | **Kapalı** — yalnızca önceden provision edilmiş (seed/admin) kullanıcılar OIDC ile giriş yapabilsin. Bulunamazsa kontrollü hata (401/403 + anlamlı kod).                      |
| `sub` (Google / Keycloak)                             | DB’de `external_subject` (veya eşdeğer alan) ile saklanır; prod’da Keycloak `sub` farklı olacağı için e-posta tek başına kalıcı kimlik yerine platform `user.id` birincildir. |

Bu paragrafı takım içi onay için yeterli “yazılı politika” sayabilirsin; holding hukuk/KVKK süreci ayrıca istiyorsa `docs/mimari-kararlar.md` veya iç bilgi notuna aynen taşı.

---

## 7) Red Hat SSO (staging / prod) — şimdilik

İterasyon 1–2 için **zorunlu değil**. İleride:

- Keycloak realm **Issuer URL** (ör. `https://sso.sirketin.com/realms/holding`),
- İstemci id / secret (realm’e göre),

değerlerini aynı `OIDC_*` env isimleriyle doldurursun (`OIDC_ISSUER` değişir). Şimdilik bir not dosyası veya wiki’de “planlanan issuer URL” yeterli.

---

## 8) Public route + güvenlik disiplini (mühendislik)

Kod tarafında (Faz 2.1 iterasyonlarında):

- `GET /api/v1/auth/oauth/google` ve `GET /api/v1/auth/oauth/google/callback` → `@Public()` + uygun **throttle** (`03-security-baseline.mdc`).
- `state` + **PKCE** zorunlu; `id_token` **aud** / **iss** doğrulaması; `returnTo` **whitelist** (Faz 2 ile aynı).

Bunlar holding “imza”sı değil; geliştirme PR’ında uygulanır. Özet tehdit modeli: [OWASP OAuth 2.0 Threat Model](https://oauth.net/2/oauth-threat-model/) (okuma).

---

## 9) `.env` doldurma (API)

Yerel API `3001` varsayımıyla (`apps/api/.env`):

| Değişken             | Örnek                                                     |
| -------------------- | --------------------------------------------------------- |
| `OIDC_ENABLED`       | `true`                                                    |
| `OIDC_ISSUER`        | `https://accounts.google.com`                             |
| `OIDC_CLIENT_ID`     | Google Web client ID                                      |
| `OIDC_CLIENT_SECRET` | Web client secret                                         |
| `OIDC_REDIRECT_URI`  | `http://127.0.0.1:3001/api/v1/auth/oauth/google/callback` |
| `OIDC_SCOPES`        | `openid email profile` (varsayılan genelde yeterli)       |

`OIDC_ENABLED=false` iken diğerleri yok sayılır (CI / hızlı yerel).

---

## 10) Kendi checklist’in (kopyala — iş bitince işaretle)

- [ ] Google Cloud’da proje + OAuth **Web** istemcisi oluşturuldu.
- [ ] Yetkili yönlendirme URI: tam callback URL eklendi (`127.0.0.1` **veya** `localhost` — `.env` ile tutarlı).
- [ ] Yetkili JavaScript kaynakları: kullandığın web origin(ler).
- [ ] Client secret repoda değil; `.env` / Secrets Manager’da.
- [ ] OAuth izin ekranı + (Harici ise) test kullanıcıları.
- [ ] Eşleme: verified email; JIT kapalı — yukarıdaki tablo onaylandı / kopyalandı.
- [ ] (İsteğe bağlı) Keycloak issuer için gelecekteki not.

**İlgili dokümanlar:** `docs/adr/0008-dev-google-oidc-prod-redhat-sso.md`, `docs/03_API_CONTRACTS.md` (OIDC path’leri), `apps/api/.env.example`.
