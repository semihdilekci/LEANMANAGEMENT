# Lean Management Platformu — Proje Özeti

> Bu doküman platformun ne olduğunu, kime hizmet ettiğini, neyin MVP'de olduğunu, neyin olmadığını ve başarıyı nasıl ölçtüğümüzü tanımlar. Diğer on dokümanın tamamı bu dokümanın okunmuş olduğunu varsayar.

---

## Proje Tanıtımı

Lean Management, fabrikalarda operasyonel mükemmellik (OpEx) ekiplerinin yürüttüğü yalın yönetim, Six Sigma ve Kaizen süreçlerini dijitalleştirmek için geliştirilen kurumsal bir web platformudur.

Ürün, **tek bir holding için** özel olarak geliştirilen bir iç kurumsal uygulamadır; multi-tenant (çok kiracılı) bir SaaS değildir. Tek platform, holding altındaki **birden fazla şirkete** hizmet verir — ancak her kullanıcı yalnızca tek bir şirkette çalışır ve kullanıcılar farklı şirketlere ve lokasyonlara dağılmış durumdadır. Platformun ayırt edici değer önerisi, süreçlerin, görevlerin, formların ve yetkilerin **şirkete özel ve esnek** tasarlanmasıdır — standart görev yönetimi araçları yerine kuruma özel akışlar sağlanır.

MVP bir web uygulaması olarak teslim edilir; mobil uygulama bu faz kapsamında değildir ancak seçilen teknoloji yığını ileride mobile genişlemeye izin verecek şekilde belirlenmiştir. Monetizasyon, ödeme ve abonelik kapsam dışındadır.

---

## Hedef Kullanıcılar

Platformun iki temel kullanıcı kategorisi vardır:

**Sistem kullanıcıları (yönetim rolleri).** Platformun yönetimini yapan sınırlı sayıda kullanıcı. Superadmin tek kişidir ve env seviyesinde tanımlıdır; Rol ve Yetki Yöneticisi rol tanımlarını ve atamalarını yönetir; Kullanıcı Yöneticisi kullanıcıları ve master data'yı yönetir; Süreç Yöneticisi çalışan süreçleri izler, iptal ve rollback aksiyonlarını yürütür. Bu kullanıcıların platformdaki kullanım sıklığı görev bazlıdır ve operasyonel destek karakterindedir.

**Kullanıcılar (çalışanlar).** Holding bünyesindeki şirketlerde çalışan ve yalın yönetim süreçlerine dokunan tüm personel — saha çalışanı, yönetici, OpEx danışmanı dahil herkes. Bu kullanıcılar platformu kendi iş akışlarının bir parçası olarak günlük ritimde kullanır (süreç başlatma, görev onaylama, doküman yükleme). Ürün geliştikçe yeni kullanıcı tipleri ortaya çıkabilir; bu dokümantasyon persona listesini tutmak yerine Rol ve Yetki sisteminin esnekliğine dayanır. Belirli rol tanımları ve yetki matrisleri ayrı dokümanlarda yaşar.

---

## Kapsam

### MVP kapsamı (in-scope)

- **Kimlik doğrulama ve oturum yönetimi** — email + şifre girişi, access/refresh token mimarisi, oturum bütünlüğü koruması, şifre sıfırlama akışı.
- **Kullanıcı yönetimi** — sicil tabanlı kullanıcı CRUD, 23 kullanıcı attribute'unun yönetimi (şirket, lokasyon, pozisyon, kademe, departman, ekip, çalışma alanı vb.).
- **Master data yönetimi** — kullanıcı attribute değerlerinin (şirket listesi, lokasyon listesi, pozisyon listesi, kademe listesi, departman listesi, ekip listesi, çalışma alanı/alt alanı listesi) ayrı tablolar halinde yönetimi; kullanıcı tablosu bu tablolara foreign key ile bağlanır.
- **RBAC + ABAC hibrit yetkilendirme** — dinamik rol tanımı; rollerin kullanıcılara doğrudan veya kullanıcı attribute'larına dayalı kurallarla (AND + OR koşul setleri) atanması; runtime yetki çözümleme ve Redis cache.
- **Before & After Kaizen süreci** — MVP'de yer alan tek hard-coded süreç. Başlatma yetkisi rol bazlı; başlatıcı before/after fotoğraflarını yükler, kazanç tutarı ve açıklama girer; başlatanın yöneticisine 72 saat SLA'lı tek adımlı onaya gider; yönetici Onay / Red / Revize Talebi aksiyonlarından birini alır. Sürecin adım davranışı, form alanları ve özel kuralları ayrı süreç dokümanında yaşar.
- **Merkezi görev yönetimi altyapısı** — süreçlerden doğan görevler, SLA takibi, claim ve all-required atama modları, başlatıcı/onaya bekleyen/tamamlanan sekmeleri.
- **Doküman yönetimi** — S3 tabanlı depolama, CloudFront + 8 katmanlı defense-in-depth erişim kontrolü, asenkron ClamAV virüs taraması, in-app önizleme (PDF, Word, Excel, görsel), 10 MB dosya limiti.
- **Süreç Yönetimi Paneli** — Superadmin ve Süreç Yöneticisi erişimli; başlatılmış süreçlerin listelenmesi, detayları, iptal ve rollback aksiyonları.
- **Audit log altyapısı** — tüm admin ve kullanıcı aksiyonlarının append-only, tamper-evident (chain hash) olarak kaydedilmesi; 1 yıl saklama.
- **Bildirim sistemi** — in-app bildirim merkezi (çan ikonu, 30 saniye polling) ve kurumsal SMTP üzerinden email bildirimi; görev atama, SLA yaklaşma/aşım, süreç tamamlanma/iptal, güvenlik olayları için tanımlı tetikleyici olaylar.
- **Sistem Ayarları ekranı** — Superadmin erişimli; email şablonları, KVKK rıza metni yönetimi, rate limit parametreleri.
- **KVKK uyum katmanı** — açık rıza versiyonlama, kullanıcı profil ekranında "Verilerim" görüntüleme, IP hash + PII encryption + tamper-evident log + veri saklama matrisi.
- **Güvenlik altyapısı** — OWASP ASVS Level 2 ve bankacılık düzeyinde defense-in-depth; field-level encryption (envelope pattern), CSP nonce-based, CORS strict allowlist, CSRF double-submit, rate limiting, dependency + SAST + DAST scanning.

### Kapsam dışı (v2+ veya reddedilen)

- **Mobil uygulama** — teknoloji yığını mobile genişlemeye izin verir; MVP'de yalnızca web.
- **Çoklu dil** — MVP yalnızca Türkçe; çoklu dil altyapısı ileriki aşamada.
- **MFA / 2FA** — sonraki iterasyonda TOTP olarak gelecek; Superadmin için zorunlu olarak planlı.
- **SSO** — RedHat SSO (Keycloak) entegrasyonu planlı ancak MVP dışı.
- **Low-code süreç tasarımcısı** — süreçler hard-coded olarak geliştirilir; dinamik süreç tanımı reddedildi.
- **Dinamik form motoru** — form alanları statik olarak kodlanır; dinamik form tasarımcısı kapsam dışı.
- **Ad-hoc görev oluşturma** — görevler yalnızca süreçlerden doğar; serbest görev oluşturma yoktur.
- **Görev yorumları, thread, @mention** — işbirliği özellikleri kapsam dışı; iletişim süreç formu alanları ve email bildirimleri ile kurulur.
- **Bildirim digest / rollup** — her event ayrı bildirim üretir; günlük/haftalık özet formatı MVP sonrasında değerlendirilir.
- **Kullanıcı bildirim tercihi (opt-out)** — platform kurumsal bir görev yönetimi aracıdır; tüm kullanıcılar tüm sistem bildirimlerini alır.
- **Excel / CSV toplu kullanıcı import** — SAP HR entegrasyonu ile karşılanacaktır; manuel toplu yükleme kapsam dışı.
- **"Verilerimi indir" KVKK özelliği** — kullanıcı kendi verisini görüntüleyebilir (profil → "Verilerim"); export/indirme MVP kapsamında değildir.
- **KVKK otomatik silme / anonimleştirme UI** — yasal talepler manuel operasyonel süreç ile Superadmin tarafından karşılanır.
- **Doküman versiyonlama** — aynı dosya tekrar yüklenirse ayrı bir doküman olarak kaydedilir; versiyon zinciri yoktur.
- **Dashboard / istatistik** — MVP sonrası iterasyonda; PowerBI entegrasyonu ile kısmen karşılanacaktır.
- **Monetizasyon, ödeme, abonelik** — kurumsal iç uygulama için tanımsız.
- **Public API** — dışarıya açık API yoktur.
- **Dış sistem entegrasyonları** — SAP MM, SAP HR, PowerBI, RedHat SSO planlı ancak MVP dışı.
- **Push notification, SMS, Slack, Teams bildirim kanalları** — altyapı event-driven olarak bu kanalların eklenmesine izin verir; MVP'de yalnızca in-app ve email.
- **Audit log external WORM storage, MFA, WebAuthn, dedicated SIEM, endpoint DLP, PostgreSQL Row-Level Security, AWS CloudHSM** — güvenlik ileri iterasyon maddeleri; MVP sonrasında planlı.

---

## Ölçek ve Kısıtlar

- **Toplam kullanıcı:** 20.000
- **Eşzamanlı kullanıcı:** 1.000
- **Kullanım yoğunluğu:** bir kullanıcı günde ortalama 10 süreç başlatabilir; her süreçte dosya yükleme ve görev onayları vardır
- **Coğrafya:** kullanıcılar Türkiye'de bulunur
- **Bildirim gerçek zamanlılığı:** near real-time yeterlidir; altyapı gelecekte real-time (WebSocket / SSE) geçişe izin verecek şekilde tasarlanır
- **Uyumluluk:** KVKK (6698 sayılı kanun) zorunlu; OWASP ASVS Level 2 + OWASP Top 10 hedef standart; ISO 27001 prensipleri referans
- **Dil:** MVP yalnızca Türkçe; çoklu dil ilerleyen aşamada
- **Uptime SLA:** %99

---

## Başarı Kriterleri

| Kriter | Hedef | Ölçüm yöntemi |
|---|---|---|
| API p95 latency | < 300 ms | CloudWatch custom metrics |
| Frontend LCP (p75) | < 2.5 sn | Web Vitals + Sentry |
| Frontend INP (p75) | < 200 ms | Web Vitals + Sentry |
| Frontend CLS (p75) | < 0.1 | Web Vitals + Sentry |
| Uptime | %99 | CloudWatch dashboard |
| Eşzamanlı kullanıcı load testi | 1.000 kullanıcı başarılı oturum + işlem | k6 / Artillery staging load test |
| MVP'de dijitalleşen süreç sayısı | 1 adet (Before & After Kaizen) | Production deploy + ilk gerçek süreç başlatma |
| Auth modülü test coverage | Line %90+, Branch %85+ | Vitest `--coverage` CI raporu |
| Encryption / Security modülü test coverage | Line %95+, Branch %90+ | Vitest `--coverage` CI raporu |
| Workflow engine test coverage | Line %85+, Branch %80+ | Vitest `--coverage` CI raporu |
| Proje genel ortalama coverage | Line %75-80 | Vitest `--coverage` CI raporu |
| KVKK uyum kontrol listesi tamamlanma | %100 | Internal compliance review |
| P1 güvenlik alarm response SLA | ≤ 1 saat | Incident response log |
| Audit log chain integrity kontrol | %100 başarı (gecelik job) | Tamper-evidence verification job raporu |
| Lighthouse Accessibility score | ≥ 90 | CI pipeline Lighthouse report |
| Dependency scan — high/critical bulgu | 0 (build fail) | GitHub Dependabot + `npm audit` |

Her kriter ya ürünün çalıştığını ya da doğru yönü işaret eden ölçülebilir bir göstergedir; subjektif "memnuniyet yüksek" tarzı kriterler bilinçli olarak yoktur.

---

## Kısıtlamalar (Teknik ve Organizasyonel)

- **Geliştirme modeli:** solo developer + AI-assisted ("vibe coding") iş akışı. Tüm kod değişiklikleri agent tarafından üretilir; kullanıcı test onayı olmadan main branch'e merge yasaktır.
- **Cloud vendor:** tüm altyapı AWS üzerinde kurulur — Aurora PostgreSQL (DB), S3 (doküman), CloudFront + WAF (doküman erişim ve CDN), ElastiCache for Redis (cache + queue), Lambda (ClamAV tarama), Secrets Manager + Parameter Store (secret), KMS (encryption key), CloudWatch (log + metric).
- **AWS hesap izolasyonu:** AWS Organizations altında üç ayrı hesap — `leanmgmt-dev`, `leanmgmt-staging`, `leanmgmt-prod` — kendi VPC, KMS key, Secrets Manager ve IAM ile tam izole. CI/CD OIDC ile cross-account role assume yapar; statik access key yoktur.
- **AWS region:** operasyonel baseline **eu-central-1 (Frankfurt)**. Bu bir yasal veri ikametgâhı zorunluluğu değil, operasyonel tercihtir; gerekirse region geçişi Aurora snapshot → restore ile mümkün olacak şekilde tasarlanır. Açık rıza metninde yurtdışı aktarım bilgisi kullanıcıya sunulur.
- **Email altyapısı:** kurumsal SMTP sunucusu kullanılır (AWS SES değil); şirket mail altyapısıyla DKIM + SPF üzerinden entegre.
- **Deployment platformu — MVP baseline:** AWS EC2 varsayımı üzerinden geliştirme yürütülür; container-ready pattern'ler kullanılır. **Final deployment platformu kararı (EC2 / ECS Fargate / EKS / diğer) DevOps ekibi tarafından MVP sonunda verilecektir.** Bu süreçte geliştirme, platform-agnostic kalacak şekilde ilerletilir.
- **Backup ve PITR parametreleri:** Aurora PITR aktif, minimum 7 gün retention baseline. Final backup retention ve PITR parametreleri DevOps ekibi tarafından MVP sonunda belirlenir.
- **Bekleyen entegrasyonlar:** SAP MM, SAP HR, PowerBI, RedHat SSO (Keycloak) — hepsi MVP sonrası; mimari bunları destekleyecek şekilde REST + tipli API ile hazırlanır.
- **Süreç kapsamı:** MVP'de tek bir süreç hard-coded geliştirilir (Before & After Kaizen). Sürecin form alanları, atama kuralları, adım davranışları, SLA eşikleri ve reddetme akışı ayrı bir süreç dokümanında (`docs/processes/before-after-kaizen-process.md`) yaşar; bu süreç dokümanı bu dokümantasyon setinin parçası değildir ve süreç geliştirilmeye başlanırken doldurulur.
- **Bütçe ve takvim kısıtı:** kurumsal iç proje; bütçe kurumsal IT kanalından fonlanır, dış müşteri timeline baskısı yoktur.

---

## Doküman Haritası

Bu dokümantasyon seti 11 dokümandan oluşur. Her doküman kendi içinde bağımsız olarak okunabilir; birbirine cross-reference vermez.

| Doküman | İçerik | Ne zaman bakılır |
|---|---|---|
| `00_PROJECT_OVERVIEW` | Proje tanıtımı, kapsam, başarı kriterleri, kısıtlamalar | Projeye ilk giriş yapıldığında; kapsam / scope sorusu geldiğinde |
| `01_DOMAIN_MODEL` | Ana entity'ler, ilişkiler, iş kuralları, süreç/görev state machine'leri, ABAC kural modeli | Yeni bir entity, iş kuralı veya validation eklerken |
| `02_DATABASE_SCHEMA` | Tablolar, alanlar, tipler, index'ler, ERD, encryption alanları, migration stratejisi | DB'ye dokunmadan önce; şema tasarımı, migration veya sorgu optimizasyonu yaparken |
| `03_API_CONTRACTS` | Tüm REST endpoint'leri, request/response şemaları, error taxonomy, versiyonlama, auth header kuralları | Yeni endpoint açarken, fetch kodu yazarken, OpenAPI spec güncellerken |
| `04_BACKEND_SPEC` | NestJS klasör yapısı, module iskelet, guard/interceptor/pipe/filter pattern'leri, servis ve repository katmanı, background job'lar, logging, exception | Backend kodu yazarken; yeni modül eklerken |
| `05_FRONTEND_SPEC` | Next.js App Router yapısı, routing, state yönetimi (TanStack Query + Zustand), form pattern (react-hook-form + Zod), fetch, error / empty / loading state, a11y, Web Vitals | Frontend feature geliştirirken; yeni sayfa veya component yazarken |
| `06_SCREEN_CATALOG` | Tüm ekranların detayı (kritik ekranlar tam şablon, ikincil ekranlar kısa şablon), ekran haritası, ortak bileşenler | Yeni bir ekran yaparken; mevcut ekranın alanlarını, butonlarını, davranışını kontrol ederken |
| `07_SECURITY_IMPLEMENTATION` | Auth akışı, token ve session yönetimi, yetki kontrolü katmanları, CSP / CORS / CSRF / header'lar, KVKK uyum, şifre ve secret yönetimi, doküman erişim güvenliği (CloudFront 8 katman), audit log, rate limit, incident response | Güvenlik kritik kod değişikliği yaparken; yeni endpoint'in yetki modelini tasarlarken; KVKK etkili feature eklerken |
| `08_TESTING_STRATEGY` | Test piramidi, araçlar, coverage hedef matrisi (modül bazlı), user-approval-before-merge zorunluluğu, smoke test akışı, staging seed stratejisi | Test yazarken; yeni feature'ın test planını kurarken; PR öncesi self-check yaparken |
| `09_DEV_WORKFLOW` | Git flow, branch isimlendirme, commit standardı (Conventional Commits), PR akışı, environment yapısı (3 hesap), local dev setup, CI/CD pipeline (GitHub Actions, 3 pipeline) | Yeni bir iş başlarken; feature branch açarken; commit mesajı yazarken; local environment kurulurken |
| `10_IMPLEMENTATION_ROADMAP` | MVP build order, sprint grupları, modül bağımlılık grafiği, risk kaydı, teknik borç kaydı, MVP sonrası iterasyon planı | Sprint planlama yaparken; hangi modülün önce yazılacağını belirlerken; risk değerlendirmesi yaparken |

---

Dokümanlar canlı artifact'lerdir. Mimari kararlarda değişiklik olduğunda dokümantasyon seti baştan üretilir; incremental merge desteklenmez.
