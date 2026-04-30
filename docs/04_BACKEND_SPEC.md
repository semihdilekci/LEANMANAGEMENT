# Lean Management Platformu — Backend Mimarisi ve Kod Organizasyonu

> Bu doküman backend'in nasıl organize edildiğini ve nasıl yazıldığını tanımlar. Agent bu dokümanla yeni bir feature module yazarken: nereye dosya koyacağını, hangi decorator'ı kullanacağını, servisini nasıl yapılandıracağını, hata fırlatma disiplinini, audit ve encryption hook'larının nasıl tetiklendiğini — hepsini tek yerden öğrenir.

---

## 1. Framework ve Runtime

| Bileşen    | Versiyon | Not                                                                                   |
| ---------- | -------- | ------------------------------------------------------------------------------------- |
| Node.js    | 20 LTS   | Pinned minor version CI'da zorlanır (`.nvmrc` + `engines` alanı)                      |
| pnpm       | 9.x      | npm/yarn yerine — monorepo workspaces için hız ve disk verimi                         |
| TypeScript | 5.4+     | `strict: true` zorunlu; `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` açık |
| NestJS     | 10.x     | Fastify adapter ile — Express değil                                                   |
| Fastify    | 4.x      | NestJS'in HTTP transport'u; Express'e göre ~2x throughput                             |

**Framework seçim gerekçesi:** NestJS'in dependency injection container'ı, decorator-driven yapısı ve olgun ekosistemi (Passport, Prisma, BullMQ entegrasyonları, OpenAPI auto-generation) agent-üretimi kod için predictable bir kalıp sunar. Fastify adapter ile Express'in overhead'inden kaçılır — API p95 hedefleri (< 300 ms) için bu tercih kritik.

**TypeScript strict moda kritik kurallar:**

- Her public method'un parametre ve return tipi **explicit**. `any` ve `unknown` yalnız generic helper'larda; business kodda `any` kullanımı CI'da fail olur.
- `null` ve `undefined` ayrımı korunur; optional alanlar `?` ile işaretlenir, nullable alanlar `| null` ile.
- `as` cast kullanımı yalnız Zod parse sonuçlarında ve third-party tip boşluklarında; kontrol mekanizması yorum ile açıklanır.

---

## 2. Monorepo Yapısı (Turborepo)

Proje tek bir git repository'sinde, pnpm workspaces + Turborepo ile yönetilir:

```
leanmgmt/
├── apps/
│   ├── api/                  # NestJS backend (HTTP)
│   ├── web/                  # Next.js frontend
│   └── worker/               # BullMQ worker (ayrı deploy unit)
├── packages/
│   ├── shared-types/         # Permission enum, error codes, domain types
│   ├── shared-schemas/       # Zod şemaları (frontend + backend ortak)
│   └── config/               # Eslint, TSConfig, Prettier paylaşılan preset
├── .github/workflows/        # CI pipeline dosyaları
├── docs/                     # Bu doküman seti + ADR'ler
├── pnpm-workspace.yaml
├── turbo.json
├── package.json              # Root — devDependencies + script'ler
└── .nvmrc
```

**Workspace çözümlemesi:** `apps/api` `packages/shared-types`'a `workspace:*` ile bağlıdır. Aynı paket frontend (`apps/web`) ve worker (`apps/worker`) tarafından da import edilir. Tek doğruluk kaynağı — Permission enum, error code listesi, form schema'ları üç tarafta senkron.

**Turborepo pipeline** (`turbo.json`):

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

Turbo remote cache açık (Vercel remote cache veya kendi S3 bucket'ı). CI build süresi tekrar eden job'larda 10x azalır.

---

## 3. Klasör Yapısı — `apps/api/`

```
apps/api/
├── src/
│   ├── main.ts                        # Bootstrap entry — boot order sırası aşağıda
│   ├── app.module.ts                  # Root module — feature modüllerini import eder
│   │
│   ├── bootstrap/                     # Boot-time işler (HTTP server listen'den önce)
│   │   ├── config.validator.ts        # Zod ile env schema validation (fail-fast)
│   │   ├── secrets.loader.ts          # AWS Secrets Manager'dan secret fetch
│   │   ├── superadmin.seed.ts         # Superadmin create-if-missing (env hash ile)
│   │   ├── system-seed.ts             # SYSTEM master data + sistem rolleri seed
│   │   └── boot-banner.ts             # Boot sonrası log banner (version, env, check özet)
│   │
│   ├── common/                        # Çapraz-kesen (cross-cutting) kod
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts                # @Public() — auth guard bypass
│   │   │   ├── require-permission.decorator.ts    # @RequirePermission(Permission.X)
│   │   │   ├── audit-action.decorator.ts          # @AuditAction(...)
│   │   │   ├── current-user.decorator.ts          # @CurrentUser() param
│   │   │   └── idempotency-key.decorator.ts       # @IdempotencyKey() header param
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts                  # Access token doğrulama
│   │   │   ├── csrf.guard.ts                      # Double-submit cookie check
│   │   │   └── permission.guard.ts                # @RequirePermission decorator'ın guard'ı
│   │   ├── interceptors/
│   │   │   ├── audit.interceptor.ts               # Mutating endpoint'lerde audit yazar
│   │   │   ├── response-envelope.interceptor.ts   # { data: ... } wrapper
│   │   │   └── request-id.interceptor.ts          # X-Request-Id üretimi/forward
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts             # Global DTO validation
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts         # Exception → error envelope
│   │   ├── exceptions/                            # Exception hierarchy (13. bölüm)
│   │   │   ├── base.exception.ts
│   │   │   ├── validation.exception.ts
│   │   │   ├── authentication.exception.ts
│   │   │   ├── authorization.exception.ts
│   │   │   ├── not-found.exception.ts
│   │   │   ├── conflict.exception.ts
│   │   │   ├── unprocessable.exception.ts
│   │   │   ├── rate-limit.exception.ts
│   │   │   └── ... (diğer 5 class)
│   │   ├── middleware/
│   │   │   ├── helmet.middleware.ts               # Güvenlik header'ları
│   │   │   └── request-logger.middleware.ts       # Pino HTTP log
│   │   └── utils/
│   │       ├── crypto.util.ts                     # HMAC, SHA-256, random bytes
│   │       └── cuid.util.ts                       # Prisma cuid wrapper
│   │
│   ├── infrastructure/                # External system adaptörleri
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   ├── prisma.service.ts                  # PrismaClient + encryption middleware bağlantısı
│   │   │   └── encryption.middleware.ts           # Deterministic + probabilistic field'lar (7. bölüm)
│   │   ├── redis/
│   │   │   ├── redis.module.ts
│   │   │   └── redis.service.ts                   # ioredis wrapper
│   │   ├── kms/
│   │   │   ├── kms.module.ts
│   │   │   └── kms.service.ts                     # DEK generate + unwrap/wrap
│   │   ├── s3/
│   │   │   ├── s3.module.ts
│   │   │   └── s3.service.ts                      # HEAD/PUT/GET + CloudFront Signed URL
│   │   ├── email/
│   │   │   ├── email.module.ts
│   │   │   └── email.service.ts                   # AWS SES + template render
│   │   └── queue/
│   │       ├── queue.module.ts
│   │       └── queue.service.ts                   # BullMQ queue registration
│   │
│   ├── modules/                       # Feature modülleri — her biri 4. bölümdeki iskelet
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.repository.ts
│   │   │   ├── permission-resolver.service.ts     # Kullanıcı permission seti hesaplama
│   │   │   ├── jwt.service.ts                     # Custom JWT sign/verify (Passport değil)
│   │   │   ├── session.service.ts
│   │   │   ├── password-policy.service.ts         # HIBP + yasak kelime kontrolü
│   │   │   ├── login-attempts.service.ts
│   │   │   ├── consent.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts                # Passport strategy wrapper
│   │   │   │   └── oidc.strategy.ts               # OpenID Connect — dev: Google, prod: Keycloak (ADR 0008)
│   │   │   ├── events/
│   │   │   │   ├── user-logged-in.event.ts
│   │   │   │   └── user-logged-out.event.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── users/                     # Referans pattern örneği (15. bölüm)
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   ├── events/
│   │   │   │   ├── user-created.event.ts
│   │   │   │   ├── user-attribute-changed.event.ts
│   │   │   │   └── handlers/
│   │   │   │       ├── user-created.handler.ts
│   │   │   │       └── user-attribute-changed.handler.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── master-data/
│   │   │   ├── master-data.module.ts
│   │   │   ├── master-data.controller.ts          # Generic controller, path param :type
│   │   │   ├── master-data.service.ts             # Generic service, type-bazlı resolver
│   │   │   ├── master-data.repository.ts          # Type → Prisma model eşleme
│   │   │   └── __tests__/
│   │   │
│   │   ├── roles/
│   │   │   ├── roles.module.ts
│   │   │   ├── roles.controller.ts
│   │   │   ├── roles.service.ts
│   │   │   ├── roles.repository.ts
│   │   │   ├── role-rule.service.ts               # Attribute-based rule evaluation
│   │   │   ├── role-recomputation.service.ts      # BullMQ job tetikleyici
│   │   │   ├── permissions.controller.ts          # GET /api/v1/permissions (metadata)
│   │   │   └── __tests__/
│   │   │
│   │   ├── processes/                 # Per-process submodule pattern (10. bölüm)
│   │   │   ├── processes.module.ts
│   │   │   ├── processes.controller.ts            # Generic endpoint'ler
│   │   │   ├── processes.service.ts
│   │   │   ├── processes.repository.ts
│   │   │   ├── process-type.registry.ts           # Type → definition map
│   │   │   ├── types/
│   │   │   │   └── before-after-kaizen/
│   │   │   │       ├── kaizen.module.ts
│   │   │   │       ├── kaizen.controller.ts       # POST /api/v1/processes/kti/start
│   │   │   │       ├── kaizen.service.ts
│   │   │   │       ├── kaizen.form-schema.ts      # Zod per-step form schema
│   │   │   │       ├── kaizen.step-definitions.ts # step_key → label + allowedActions + assignment resolver
│   │   │   │       └── __tests__/
│   │   │   └── __tests__/
│   │   │
│   │   ├── tasks/
│   │   │   ├── tasks.module.ts
│   │   │   ├── tasks.controller.ts
│   │   │   ├── tasks.service.ts
│   │   │   ├── tasks.repository.ts
│   │   │   ├── sla-monitor.service.ts             # BullMQ cron consumer
│   │   │   └── __tests__/
│   │   │
│   │   ├── documents/
│   │   │   ├── documents.module.ts
│   │   │   ├── documents.controller.ts
│   │   │   ├── documents.service.ts
│   │   │   ├── documents.repository.ts
│   │   │   ├── scan-callback.controller.ts        # ClamAV Lambda → callback
│   │   │   └── __tests__/
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.controller.ts
│   │   │   ├── notifications.service.ts
│   │   │   ├── notifications.repository.ts
│   │   │   ├── dispatchers/
│   │   │   │   ├── in-app.dispatcher.ts
│   │   │   │   └── email.dispatcher.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── admin/                     # Admin-only modüller (Superadmin)
│   │   │   ├── audit-log/
│   │   │   │   ├── audit-log.module.ts
│   │   │   │   ├── audit-log.controller.ts
│   │   │   │   ├── audit-log.service.ts
│   │   │   │   ├── chain-integrity.service.ts     # Cron job ve API endpoint
│   │   │   │   └── export.service.ts              # CSV streaming
│   │   │   ├── system-settings/
│   │   │   │   ├── system-settings.module.ts
│   │   │   │   ├── system-settings.controller.ts
│   │   │   │   ├── system-settings.service.ts
│   │   │   │   └── system-settings.repository.ts
│   │   │   ├── email-templates/
│   │   │   │   ├── email-templates.module.ts
│   │   │   │   ├── email-templates.controller.ts
│   │   │   │   ├── email-templates.service.ts
│   │   │   │   └── template-renderer.service.ts   # Handlebars render + DOMPurify
│   │   │   └── consent-versions/
│   │   │       ├── consent-versions.module.ts
│   │   │       ├── consent-versions.controller.ts
│   │   │       └── consent-versions.service.ts
│   │   │
│   │   └── health/
│   │       ├── health.module.ts
│   │       └── health.controller.ts               # /health + /health/ready
│   │
│   └── events/                        # Global event bus (EventEmitter2)
│       └── event-bus.module.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/                    # Prisma migration history
│   └── seed.ts                        # Dev/staging seed script
│
├── test/                              # Integration + e2e testler
│   ├── integration/
│   │   └── <feature>.integration.test.ts
│   └── e2e/
│       └── <flow>.e2e.test.ts
│
├── Dockerfile                         # Multi-stage: builder → prod (distroless)
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 4. Modül İskeleti Konvansiyonu

Her feature modülü aynı iç yapıyı takip eder. Aşağıdaki tablo zorunlu ve opsiyonel elemanları gösterir:

| Dosya                     | Zorunlu mu  | Amaç                                                    |
| ------------------------- | ----------- | ------------------------------------------------------- |
| `<feature>.module.ts`     | **Zorunlu** | NestJS DI config — controller, provider, imports        |
| `<feature>.controller.ts` | **Zorunlu** | HTTP endpoint tanımları — decorator'lar + DTO parsing   |
| `<feature>.service.ts`    | **Zorunlu** | Business logic — transaction, validation, orchestration |
| `<feature>.repository.ts` | **Zorunlu** | Prisma erişim — encryption middleware otomatik devrede  |
| `events/`                 | Opsiyonel   | Domain event tanımları ve handler'lar                   |
| `events/handlers/`        | Opsiyonel   | Event handler class'ları (subscriber'lar)               |
| `strategies/`             | Opsiyonel   | Passport strategy wrapper'ları (yalnız auth modülünde)  |
| `__tests__/`              | **Zorunlu** | Unit testler — her public service method'u için         |

**DTO dosyası yok** — Zod şemaları `packages/shared-schemas/` altında tutulur; backend ve frontend aynı şemayı paylaşır. Controller import eder, validation pipe parse eder, service tip-safe değeri alır.

**Service servisi doğrudan çağırmaz.** İki servis aynı modülde ise aynı module'de dependency injection ile; farklı modüldeyse **event üzerinden** (EventEmitter2). Bu circular import'u önler ve test izolasyonunu sağlar. Örnek:

- `UsersService` kullanıcı oluşturduğunda `user.created` event'i emit eder.
- `NotificationsService` bu event'i dinler ve welcome email'i tetikler.
- `UsersService` `NotificationsService`'i import etmez.

**Controller yalnız HTTP taşıma katmanı.** Business logic yok; validation sonucu servise geçirilir, servis yanıtı kontroller üzerinden dönülür. Status code'lar decorator'lar veya exception fırlatma ile belirlenir (`@HttpCode(204)`, `throw new NotFoundException(...)`).

### 4.1 NestJS DI, ESM ve `@Inject` (apps/api)

**Durum:** `apps/api` TypeScript `verbatimModuleSyntax` + NodeNext ESM çözümlemesi ve kaynak import’larında `.js` uzantısı (`./foo.js`) kullanımı ile birlikte, `emitDecoratorMetadata` ürettiği `design:paramtypes` bazı constructor bağımlılıklarında Nest tarafından **tanınmayabiliyor**. Sonuç: runtime’da `undefined` enjekte edilmesi (`Cannot read properties of undefined (reading 'get'|'login'|...)`).

**Proje standardı (MVP):** Aşağıdaki tür bağımlılıklarda **açık `@Inject(Token)`** kullan:

| Bağımlılık         | Örnek token                                                                          |
| ------------------ | ------------------------------------------------------------------------------------ |
| Ortam / config     | `@Inject(ConfigService) private readonly config: ConfigService<Env, true>`           |
| Prisma             | `@Inject(PrismaService) private readonly prisma: PrismaService`                      |
| Redis              | `@Inject(RedisService) private readonly redis: RedisService`                         |
| JWT                | `@Inject(JwtService) private readonly jwt: JwtService`                               |
| Metadata           | `@Inject(Reflector) private readonly reflector: Reflector`                           |
| Diğer provider’lar | `@Inject(AuthService)`, `@Inject(EncryptionService)`, `@Inject(AuditLogService)` vb. |

**`CommonModule`:** `EncryptionService` ve audit gibi global provider’ların `ConfigService`’e güvenli erişimi için `CommonModule` içinde `imports: [ConfigModule]` bulunur (`ConfigModule.forRoot` yalnızca `AppModule`’de bir kez çağrılır).

**Entegrasyon testi:** `AppModule` yüklenmeden önce `process.env` içine `DATABASE_URL`, `REDIS_URL`, PII anahtarları ve `JWT_ACCESS_SECRET_CURRENT` yazılır; ardından `AppModule` **dinamik `import()`** ile yüklenir (statik import, env set edilmeden `ConfigModule` validate’ını tetikleyebilir). Uygulama örneği `NestFactory.create` ile ayağa kaldırılır (`apps/api/test/auth.integration.test.ts`).

**Gelecek (opsiyonel):** Kök nedeni tsconfig/emit stratejisiyle hizalamak için ADR veya `experimentalDecorators` / import stili gözden geçirilebilir; o zamana kadar yeni controller/service/guard yazarken aynı `@Inject` disiplinini koru.

---

## 5. Middleware / Guard / Interceptor / Pipe / Filter Zinciri

Request bir endpoint'e ulaşana kadar ve response döndükten sonra aşağıdaki sıralı zincirden geçer. **Sıra kritiktir** — karıştırılması güvenlik açığı veya yanlış log'lama üretir.

### Request path (istemci → handler)

| #   | Katman                    | Amacı                                                                                                                                                                                                               |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Helmet middleware**     | Güvenlik header'ları: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin                                                                              |
| 2   | **CORS middleware**       | `origin: [CORS_ALLOWED_ORIGINS]` (env) allowlist, `credentials: true`, `methods: [GET, POST, PATCH, DELETE, OPTIONS]`, `allowedHeaders: [Content-Type, Authorization, X-CSRF-Token, X-Request-Id, Idempotency-Key]` |
| 3   | **Body parser**           | JSON max 1 MB; dosya upload'ları direkt S3'e gittiği için API body'si daima küçük                                                                                                                                   |
| 4   | **Cookie parser**         | `refresh_token`, `csrf_token` cookie'lerini parse eder                                                                                                                                                              |
| 5   | **Request ID middleware** | İstemci `X-Request-Id` gönderdiyse onu kullanır, yoksa UUID üretir; response header'ına ekler; Pino context'ine yerleştirir                                                                                         |
| 6   | **Pino HTTP logger**      | Her request için structured log: `requestId`, `method`, `path`, `userAgent`, `ipHash`                                                                                                                               |
| 7   | **Rate limiter**          | Redis token bucket — kapsam (anonim IP / authenticated user / login / password-reset) request meta'dan belirlenir; limit aşımı → 429 `RATE_LIMIT_*`                                                                 |
| 8   | **JWT auth guard**        | `@Public()` decorator yoksa access token doğrulanır; kullanıcı request context'ine enjekte edilir. Hata: 401 `AUTH_TOKEN_*`                                                                                         |
| 9   | **CSRF guard**            | `POST`, `PATCH`, `DELETE` için zorunlu; `X-CSRF-Token` header ile `csrf_token` cookie karşılaştırması. Hata: 403 `CSRF_TOKEN_INVALID`                                                                               |
| 10  | **Permission guard**      | `@RequirePermission(Permission.X)` decorator'ı okur; kullanıcının permission setinde kontrol eder. Hata: 403 `PERMISSION_DENIED`                                                                                    |
| 11  | **Zod validation pipe**   | Controller parametrelerindeki `@Body()`, `@Query()`, `@Param()` schema'larını doğrular. Hata: 400 `VALIDATION_FAILED` (field-level details)                                                                         |
|     | **→ Controller handler**  |                                                                                                                                                                                                                     |

### Response path (handler → istemci)

| #   | Katman                            | Amacı                                                                                                                     |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 12  | **Audit interceptor**             | Mutating endpoint'lerde (`@AuditAction(...)` decorator'lı) — response başarılıysa `audit_logs` insert; chain hash hesapla |
| 13  | **Response envelope interceptor** | Raw response → `{ data: ... }` veya `{ data, pagination }` sarmalama                                                      |
| 14  | **Global exception filter**       | Her exception → `{ error: { code, message, requestId, timestamp, details? } }` + HTTP status. Son savunma.                |

**Boot'ta güvenlik:** Tüm guard'lar **global** olarak register edilir (`APP_GUARD` token ile). `@Public()` dekoratörü olmayan her endpoint JWT auth'a tabidir (fail-closed). Yeni endpoint yazan agent guard eklemeyi unutsa bile default güvenlidir.

---

## 6. Servis Katmanı Kuralları

**Kural 1 — Servis HTTP concern'i bilmez.** Servis method'u status code, cookie, header döndürmez; hata durumunda typed exception fırlatır, veri döndürürken düz obje döner.

**Kural 2 — Servis başka modülün servisini doğrudan çağırmaz.** İki durumda izin vardır:

- **Aynı modül:** Doğrudan DI (örn. `AuthService` kendi modülündeki `SessionService`'i çağırabilir)
- **Farklı modül:** Event üzerinden. `this.eventEmitter.emit('user.created', payload)` → `UserCreatedHandler` başka modülde dinler

**Kural 3 — Transaction boundary servisin sorumluluğu.** `prisma.$transaction` repository'den değil servisten tetiklenir — transactional scope içindeki repository çağrıları aynı Prisma client instance'ını alır:

```typescript
async createUser(input: CreateUserInput) {
  return this.prisma.$transaction(async (tx) => {
    const user = await this.usersRepository.create(tx, input);
    await this.rolesRepository.assignDefault(tx, user.id);
    this.eventEmitter.emit('user.created', { userId: user.id });
    return user;
  });
}
```

**Kural 4 — External call'lar typed exception'la sarılır.** S3, KMS, SES, ClamAV gibi dış servislere yapılan her çağrı try-catch ile sarılır; hata `ExternalServiceException(service: string, originalError: unknown)` olarak yeniden fırlatılır. Global filter bunu 503 `SYSTEM_DEPENDENCY_DOWN` kodlu response'a çevirir.

**Kural 5 — Idempotency mutating kritik endpoint'lerde.** Document upload, process start, task complete gibi endpoint'ler `Idempotency-Key` header'ı kabul eder. Servis Redis'te bu key'e karşılık response cache'ler (24 saat TTL); aynı key tekrar gelirse eski response döner. Duplicate submission (kullanıcı "Gönder"e iki kez basar) sorunu önlenir.

---

## 7. Repository / Data Katmanı

**Prisma 5** ORM olarak kullanılır — migration üretimi, type-safe client, olgun PostgreSQL desteği. Repository pattern zorunlu: **her modül kendi `<feature>.repository.ts`'ini içerir; Prisma client doğrudan servisten çağrılmaz.** Bu kuralın üç faydası vardır:

1. **Encryption middleware burada hook'lanır.** Deterministic field'lar (sicil, email) ve probabilistic field'lar (audit old/new_value) burada şeffaf olarak şifrelenir/çözülür.
2. **Test mock'u kolay.** Servis unit testinde repository jest.mock ile değiştirilir; Prisma'nın tamamını mock etmeye gerek kalmaz.
3. **N+1 koruması tek yerde.** Include/select disiplini repository method'larında zorunlu; servis ne istediğini değil, ne aldığını bilir.

### 7.1 Encryption Middleware

`infrastructure/prisma/encryption.middleware.ts` Prisma `$extends` ile bağlanır. Deterministic ve probabilistic olmak üzere iki pattern içerir.

**Deterministic field'lar** (sicil, email, phone, manager_email): Blind index + encrypted pair halinde DB'de. Servis `user.email` virtual field'ına yazar — middleware insert/update'te `email_encrypted` ve `email_blind_index` kolonlarına böler; select'te birleştirip çözer.

```typescript
// infrastructure/prisma/encryption.middleware.ts
import { Prisma } from '@prisma/client';
import { KmsService } from '../kms/kms.service';
import {
  hmacSha256Hex,
  encryptAes256GcmDeterministic,
  decryptAes256Gcm,
} from '../../common/utils/crypto.util';

interface DeterministicFieldSpec {
  model: string; // 'User'
  virtualField: string; // 'email'
  encryptedCol: string; // 'email_encrypted'
  blindIndexCol: string; // 'email_blind_index'
  normalize?: (v: string) => string; // lowercase, trim, vb.
}

const DETERMINISTIC_FIELDS: DeterministicFieldSpec[] = [
  {
    model: 'User',
    virtualField: 'sicil',
    encryptedCol: 'sicilEncrypted',
    blindIndexCol: 'sicilBlindIndex',
  },
  {
    model: 'User',
    virtualField: 'email',
    encryptedCol: 'emailEncrypted',
    blindIndexCol: 'emailBlindIndex',
    normalize: (v) => v.toLowerCase().trim(),
  },
  {
    model: 'User',
    virtualField: 'phone',
    encryptedCol: 'phoneEncrypted',
    blindIndexCol: 'phoneBlindIndex',
  },
  {
    model: 'User',
    virtualField: 'managerEmail',
    encryptedCol: 'managerEmailEncrypted',
    blindIndexCol: 'managerEmailBlindIndex',
    normalize: (v) => v.toLowerCase().trim(),
  },
];

export function applyEncryptionExtension(prisma: PrismaClient, kms: KmsService, pepper: Buffer) {
  return prisma.$extends({
    query: {
      user: {
        async create({ args, query }) {
          args.data = transformWriteFields(args.data, 'User', pepper);
          const result = await query(args);
          return transformReadFields(result, 'User');
        },
        async update({ args, query }) {
          args.data = transformWriteFields(args.data, 'User', pepper);
          const result = await query(args);
          return transformReadFields(result, 'User');
        },
        async findUnique({ args, query }) {
          args.where = transformWhereFields(args.where, 'User', pepper);
          const result = await query(args);
          return transformReadFields(result, 'User');
        },
        // findMany, findFirst, upsert için aynı pattern
      },
      // AuditLog, ConsentVersion probabilistic için ayrı handler
    },
  });
}
```

Virtual field'ların tip güvenliği için Prisma-generated client TypeScript tipleri manuel olarak extend edilir (`packages/shared-types/src/prisma-extensions.d.ts`). `User.email` type system'de string olarak görünür; encrypted kolonlar gizlenir.

**Probabilistic field'lar** (audit_logs old/new_value, consent_versions content): KMS envelope pattern. Middleware insert'te yeni DEK generate eder, payload'ı AES-256-GCM ile şifreler, DEK'i KMS ile wrap eder; select'te ters akış.

### 7.2 Query Disiplini

- **Include vs select:** Liste endpoint'lerinde `select` zorunlu (only-what-needed). Detay endpoint'lerinde `include` izinli ama derinliğin 2 seviyeyi geçmemesi kuralı.
- **N+1 avı:** Code review sırasında `for (const item of list) await repo.findById(item.id)` pattern'i reject edilir. Liste + detay tek query'de include ile alınır.
- **Raw SQL:** Yalnız performans gereken özel sorgularda (audit chain verify, statistics aggregation). Her raw query için comment header ile gerekçe zorunlu.
- **Transaction timeout:** 30 saniye default; uzun süren işlemler (role_recomputation gibi) background job'a taşınır.

### 7.3 Connection Pool

Her API pod'u Prisma connection pool'u `connection_limit=20` ile başlatır. 8 pod x 20 = 160 concurrent connection; Aurora max_connections yapılandırması buna göre ayarlanır. Worker pod'ları kendi pool'larıyla — API pool'u worker job'lardan etkilenmez.

---

## 8. Permission Kaynağı ve Yönetimi

### 8.1 Tek Doğruluk Kaynağı

Permission tanımı **kod içinde** yaşar — DB'de permission tablosu yoktur, yalnız `role_permissions` junction tablosunda `permission_key VARCHAR(64)` olarak role atamaları tutulur. Tek doğruluk kaynağı:

`packages/shared-types/src/permissions.ts`

```typescript
export enum Permission {
  // USER
  USER_LIST_VIEW = 'USER_LIST_VIEW',
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE_ATTRIBUTE = 'USER_UPDATE_ATTRIBUTE',
  USER_DEACTIVATE = 'USER_DEACTIVATE',
  USER_REACTIVATE = 'USER_REACTIVATE',
  USER_SESSION_VIEW = 'USER_SESSION_VIEW',
  // ROLE
  ROLE_VIEW = 'ROLE_VIEW',
  ROLE_CREATE = 'ROLE_CREATE',
  ROLE_UPDATE = 'ROLE_UPDATE',
  ROLE_DELETE = 'ROLE_DELETE',
  ROLE_ASSIGN = 'ROLE_ASSIGN',
  ROLE_PERMISSION_MANAGE = 'ROLE_PERMISSION_MANAGE',
  ROLE_RULE_MANAGE = 'ROLE_RULE_MANAGE',
  // MASTER_DATA
  MASTER_DATA_MANAGE = 'MASTER_DATA_MANAGE',
  // PROCESS
  PROCESS_KTI_START = 'PROCESS_KTI_START',
  PROCESS_VIEW_ALL = 'PROCESS_VIEW_ALL',
  PROCESS_CANCEL = 'PROCESS_CANCEL',
  PROCESS_ROLLBACK = 'PROCESS_ROLLBACK',
  // DOCUMENT
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  // ADMIN
  AUDIT_LOG_VIEW = 'AUDIT_LOG_VIEW',
  SYSTEM_SETTINGS_VIEW = 'SYSTEM_SETTINGS_VIEW',
  SYSTEM_SETTINGS_EDIT = 'SYSTEM_SETTINGS_EDIT',
  EMAIL_TEMPLATE_VIEW = 'EMAIL_TEMPLATE_VIEW',
  EMAIL_TEMPLATE_EDIT = 'EMAIL_TEMPLATE_EDIT',
  CONSENT_VERSION_VIEW = 'CONSENT_VERSION_VIEW',
  CONSENT_VERSION_EDIT = 'CONSENT_VERSION_EDIT',
  CONSENT_VERSION_PUBLISH = 'CONSENT_VERSION_PUBLISH',
}

export type PermissionCategory = 'MENU' | 'ACTION' | 'DATA' | 'FIELD';

export interface PermissionMetadata {
  key: Permission;
  category: PermissionCategory;
  description: string;
  isSensitive: boolean;
}

export const PERMISSION_METADATA: Record<Permission, PermissionMetadata> = {
  [Permission.USER_CREATE]: {
    key: Permission.USER_CREATE,
    category: 'ACTION',
    description: 'Yeni kullanıcı oluşturma yetkisi.',
    isSensitive: false,
  },
  [Permission.AUDIT_LOG_VIEW]: {
    key: Permission.AUDIT_LOG_VIEW,
    category: 'MENU',
    description: 'Denetim kayıtlarını görüntüleme yetkisi — genellikle Superadmin.',
    isSensitive: true,
  },
  // ... tüm diğer Permission'lar
};
```

TypeScript `Record<Permission, PermissionMetadata>` tipi, enum'a yeni değer eklendiğinde metadata eksikse compile-time hata verir. Sync riski yok.

### 8.2 Permission Guard

`@RequirePermission(Permission.USER_CREATE)` decorator'ı endpoint'e konur. Guard kullanıcının permission setinde bu değeri kontrol eder:

```typescript
// common/guards/permission.guard.ts
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) throw new AuthenticationException({ code: 'AUTH_TOKEN_INVALID' });

    const userPermissions = await this.permissionResolver.resolve(userId);
    const hasAll = required.every((p) => userPermissions.has(p));
    if (!hasAll) throw new AuthorizationException({ code: 'PERMISSION_DENIED' });

    return true;
  }
}
```

### 8.3 Permission Resolver

`PermissionResolverService` kullanıcının direkt + attribute-based tüm rollerinden flat Permission set hesaplar. Redis'te cache'lenir — 5 dakika TTL, mutations cache'i invalidate eder.

```typescript
// modules/auth/permission-resolver.service.ts
@Injectable()
export class PermissionResolverService {
  private readonly CACHE_KEY = (userId: string) => `permissions:${userId}`;
  private readonly CACHE_TTL_SECONDS = 300;

  async resolve(userId: string): Promise<Set<Permission>> {
    const cached = await this.redis.get(this.CACHE_KEY(userId));
    if (cached) return new Set(JSON.parse(cached) as Permission[]);

    const user = await this.usersRepository.findByIdWithAttributes(userId);
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    const directRoleIds = user.userRoles.map((ur) => ur.roleId);
    const ruleMatchedRoleIds = await this.roleRuleService.resolveMatchingRoles(user);
    const allRoleIds = [...new Set([...directRoleIds, ...ruleMatchedRoleIds])];

    const rolePerms = await this.rolesRepository.findPermissionsByRoleIds(allRoleIds);
    const permissions = new Set<Permission>(rolePerms.map((rp) => rp.permissionKey as Permission));

    await this.redis.setex(
      this.CACHE_KEY(userId),
      this.CACHE_TTL_SECONDS,
      JSON.stringify([...permissions]),
    );

    return permissions;
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(this.CACHE_KEY(userId));
  }

  async invalidateByRoleId(roleId: string): Promise<void> {
    const userIds = await this.usersRepository.findIdsWithRoleAccess(roleId);
    const pipeline = this.redis.pipeline();
    userIds.forEach((id) => pipeline.del(this.CACHE_KEY(id)));
    await pipeline.exec();
  }
}
```

### 8.4 Yeni Permission Ekleme — 5 Adım

Yeni bir permission sisteme eklenirken agent şu sırayı izler:

1. **`packages/shared-types/src/permissions.ts`** — `Permission` enum'una değer ekle.
2. **Aynı dosya** — `PERMISSION_METADATA` record'una metadata ekle (`category`, `description`, `isSensitive`). TypeScript compile-time'da eksikse fail eder.
3. **Endpoint'e decorator** — `@RequirePermission(Permission.YOUR_NEW_KEY)` ilgili controller method'una.
4. **Migration ile rol atamaları** — gerekiyorsa sistem rollerinden hangisinin bu permission'a sahip olacağını migration'a ekle (`role_permissions` INSERT).
5. **Integration test** — `<feature>.integration.test.ts`'e iki case ekle: (a) permission'sız kullanıcı 403 alır, (b) permission'lı kullanıcı 200/201 alır.

---

## 9. Audit Interceptor

### 9.1 Decorator + Interceptor

Her mutating endpoint üzerine `@AuditAction(AuditAction.CREATE_USER, { entity: 'user' })` dekoratörü konur. `AuditInterceptor` response'un başarılı olması koşuluyla (exception yoksa) `audit_logs` tablosuna kayıt atar.

```typescript
// common/decorators/audit-action.decorator.ts
export const AUDIT_ACTION_KEY = Symbol('audit-action');

export interface AuditActionMeta {
  action: string;
  entity: string;
  entityIdFrom?: 'response.data.id' | 'params.id' | string; // default: response.data.id
}

export const AuditAction = (action: string, meta: Omit<AuditActionMeta, 'action'>) =>
  SetMetadata(AUDIT_ACTION_KEY, { action, ...meta });
```

```typescript
// common/interceptors/audit.interceptor.ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditActionMeta>(AUDIT_ACTION_KEY, context.getHandler());
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(async (response) => {
        const entityId = this.resolveEntityId(meta, request, response);
        await this.auditService.write({
          action: meta.action,
          entity: meta.entity,
          entityId,
          userId: request.user?.id ?? null,
          oldValue: request.auditPayload?.oldValue ?? null,
          newValue: request.auditPayload?.newValue ?? null,
          metadata: request.auditPayload?.metadata ?? null,
          ipHash: request.ipHash,
          userAgent: request.headers['user-agent']?.slice(0, 512),
          sessionId: request.user?.sessionId ?? null,
        });
      }),
    );
  }
}
```

### 9.2 Service'in Payload Katkısı

Service layer response döndürmeden önce `request.auditPayload`'a old/new value'ları yazar. Interceptor bunu okuyup kaydeder:

```typescript
// modules/users/users.service.ts (bir kısım)
async updateAttribute(userId: string, input: UpdateUserInput, request: Request) {
  const before = await this.usersRepository.findById(userId);
  const after = await this.usersRepository.update(userId, input);

  // Audit payload — PII masking burada yapılır
  request.auditPayload = {
    oldValue: this.pickChangedFieldsMasked(before, input),
    newValue: this.pickChangedFieldsMasked(after, input),
  };

  await this.permissionResolver.invalidate(userId);
  return after;
}
```

### 9.3 Chain Hash

`AuditService.write()` her kayıt eklerken önceki son kaydın `chainHash`'ini okur ve yeni kayıt için `SHA-256(previous_chain_hash || JSON.stringify(current_row))` hesaplar. Transaction içinde — concurrent insert'lerde race yok (`SELECT ... FOR UPDATE` ile son kaydı kilitler).

### 9.4 Append-Only Garantisi

DB seviyesinde `audit_logs` tablosuna UPDATE/DELETE yasaktır (trigger — `02_DATABASE_SCHEMA` detaylı). Retention job (1 yıl sonrası silme) **dedicated IAM role** ile bağlanır; uygulama role'ünün trigger bypass yetkisi yoktur.

### 9.5 Başarısız Audit Davranışı

Audit write başarısız ise (örn. DB bağlantısı koptu) interceptor exception fırlatır — handler'ın başarılı response'u da **geri alınır** (global filter 500 döner). Audit kaybı kabul edilmez; business mantığı audit ile birlikte atomic'tir. Servis içinde transaction boundary `createUser` örneğindeki gibi açılırsa audit de aynı transaction'ın parçasıdır.

---

## 10. Per-Process Module Pattern

### 10.1 Motivasyon

MVP'de yalnız bir süreç tipi vardır: KTİ (Before & After Kaizen). Ancak platform ileride yeni süreç tipleri ekleyebilmelidir (Ramak Kala Bildirimi, 5S Denetim, vb.). Genel endpoint'ler (`GET /api/v1/processes/:displayId`, `POST /api/v1/tasks/:id/complete`) süreç tipini bilmemelidir. Bunun yerine her süreç kendi submodule'ünde:

- Form schema'sı (Zod)
- Adım tanımları (step_key → label + allowed actions + assignment resolver)
- Start endpoint'i (`POST /api/v1/processes/<type>/start`)

tanımlanır ve runtime'da bir **registry**'e kayıt olur.

### 10.2 Process Type Registry

```typescript
// modules/processes/process-type.registry.ts
export interface ProcessTypeDefinition {
  type: string; // 'BEFORE_AFTER_KAIZEN'
  displayIdPrefix: string; // 'KTI'
  steps: StepDefinition[];
  startFormSchema: z.ZodSchema;
  onStart: (input: unknown, context: StartContext) => Promise<StartResult>;
}

export interface StepDefinition {
  key: string; // 'KTI_MANAGER_APPROVAL'
  label: string; // 'Yönetici Onay'
  order: number;
  assignmentMode: 'SINGLE' | 'CLAIM' | 'ALL_REQUIRED';
  assignmentResolver: (process: Process, prevTask?: Task) => AssignmentTarget;
  allowedActions: string[]; // ['APPROVE', 'REJECT', 'REQUEST_REVISION']
  reasonRequiredFor: string[]; // ['REJECT', 'REQUEST_REVISION']
  completionHandler: (
    task: Task,
    action: string | null,
    formData: unknown,
  ) => Promise<CompletionResult>;
  slaHours: number | null;
}

@Injectable()
export class ProcessTypeRegistry {
  private readonly definitions = new Map<string, ProcessTypeDefinition>();

  register(def: ProcessTypeDefinition) {
    if (this.definitions.has(def.type)) {
      throw new Error(`Process type already registered: ${def.type}`);
    }
    this.definitions.set(def.type, def);
  }

  get(type: string): ProcessTypeDefinition {
    const def = this.definitions.get(type);
    if (!def) throw new ValidationException({ code: 'PROCESS_TYPE_UNKNOWN' });
    return def;
  }

  getStep(type: string, stepKey: string): StepDefinition {
    const def = this.get(type);
    const step = def.steps.find((s) => s.key === stepKey);
    if (!step) throw new Error(`Step not found: ${type}/${stepKey}`);
    return step;
  }
}
```

### 10.3 KTİ Submodule (15. bölümde detaylı örnek)

KTİ süreç modülü `onModuleInit` hook'unda registry'e kayıt olur. Böylece generic `ProcessesService` ve `TasksService` süreç tipini bilmeden:

- `/processes/:displayId` detay endpoint'i → registry'den step label'larını çeker
- `/tasks/:id` detay endpoint'i → registry'den `allowedActions`'ı çeker
- `/tasks/:id/complete` → registry'den `completionHandler`'ı çağırır

Yeni süreç tipi eklemek = yeni submodule + registry kaydı + yeni start controller. Generic katman dokunulmaz.

---

## 11. Background Jobs — BullMQ ve Worker Ayrılığı

### 11.1 Worker Ayrı Deploy Unit

BullMQ job'ları **ayrı pod'larda** (`apps/worker/`) çalışır, API pod'larında değil. Neden:

- **Latency izolasyonu:** Email render, document scan callback, role recomputation gibi CPU-intensive işler API latency'yi etkilemez. API p95 < 300 ms hedefi korunur.
- **Independent scale:** API pod'ları HTTP trafiğine, worker pod'ları queue backlog'una göre ayrı scale edilir.
- **Fault isolation:** Worker crash'i API'yi etkilemez; sadece ilgili queue'nun işleme süresi artar.

Worker pod'u `packages/shared-types`, `packages/shared-schemas`, infrastructure adaptörleri (prisma, redis, s3, kms, email) ve job processor'larını içerir. HTTP katmanı yoktur.

### 11.2 Queue ve Worker Listesi

| Queue                | Worker job tipleri                                                                            | Tetikleyici                                                               |
| -------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `notifications`      | `send-in-app`, `send-email`                                                                   | Domain event'ler (user.created, task.assigned, sla.breached vb.)          |
| `documents-scan`     | `scan-invoke`, `scan-callback-handle`                                                         | Document create → ClamAV Lambda tetikle + S3 → EventBridge → API callback |
| `sla-monitor`        | `check-task-sla`                                                                              | Cron — 5 dakikada bir                                                     |
| `retention`          | `cleanup-notifications`, `cleanup-login-attempts`, `cleanup-reset-tokens`, `archive-sessions` | Cron — gecelik 02:00 TRT                                                  |
| `audit-chain-check`  | `verify-chain-integrity`                                                                      | Cron — gecelik 03:00 TRT                                                  |
| `role-recomputation` | `recompute-attribute-roles`                                                                   | Role rule create/update/delete events                                     |

### 11.3 Retry Policy

Tüm job'lar için varsayılan:

- `attempts: 5`
- `backoff: { type: 'exponential', delay: 1000 }` — 1s, 2s, 4s, 8s, 16s
- `removeOnComplete: { age: 3600, count: 1000 }` — 1 saat saklama
- `removeOnFail: false` — başarısız job'lar dead letter queue'ya taşınır

**Dead letter queue:** 5 attempt sonrası başarısız job `<queue>-dlq` queue'sine taşınır; burada 30 gün saklanır. Superadmin admin paneli üzerinden DLQ'yu görüntüleyebilir (MVP dışı — monitoring Sentry + CloudWatch üzerinden).

### 11.4 Idempotency Zorunlu

Cron job'lar replay-safe olmalı: aynı job iki kez çalışırsa sonuç farklı olmamalıdır. Örnek: `cleanup-notifications` job'u `DELETE WHERE created_at < now() - 90 days` sorgusu atomik ve idempotent; çifte çalışma sadece gereksiz IO üretir, veri bütünlüğünü bozmaz.

Event-tetikli job'lar için `jobId` kullanılır — `user.created:${userId}` gibi deterministic ID. Aynı event iki kez emit edilirse BullMQ job'u deduplicate eder.

---

## 12. Logging — Pino

### 12.1 Stack

- `pino` + `nestjs-pino` (HTTP request logger)
- Production: `pino-transport` ile stdout → CloudWatch Logs
- Development: `pino-pretty` ile renkli konsol

### 12.2 Log Seviyeleri

| Seviye  | Ne zaman                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| `trace` | Prisma query'leri, detaylı debug — yalnız dev                                                              |
| `debug` | External service request/response — dev + opsiyonel staging                                                |
| `info`  | HTTP request tamamlandı, domain event emit edildi, job başladı/bitti, boot event'leri — default production |
| `warn`  | Recoverable edge case'ler: retry tetiklendi, cache miss anormal, beklenmedik input                         |
| `error` | Hata — unhandled exception, external service failure, audit write başarısız                                |
| `fatal` | Process crash — boot failure, connection pool exhausted                                                    |

Default log seviyesi `LOG_LEVEL` env değişkeni ile kontrol edilir; production `info`, staging `debug`, dev `trace`.

### 12.3 Zorunlu Alanlar

Her log satırı JSON format; zorunlu alanlar:

| Alan         | Açıklama                                             |
| ------------ | ---------------------------------------------------- |
| `timestamp`  | ISO 8601 UTC                                         |
| `level`      | Seviye string                                        |
| `requestId`  | Request context içinde otomatik                      |
| `userId`     | Authenticated request'lerde otomatik                 |
| `message`    | Human-readable özet                                  |
| `durationMs` | HTTP request'lerde ve job'larda                      |
| `statusCode` | HTTP response'da                                     |
| `err`        | Error log'larında — `{ name, message, stack, code }` |

### 12.4 Yasak Alanlar

Aşağıdaki değerler **log'a asla yazılmaz**. Pino'nun `redact` konfigürasyonu + custom serializer bunları otomatik maskeler:

- `password`, `newPassword`, `currentPassword`
- `accessToken`, `refreshToken`, `jwt`, `token`
- `content` (consent versiyon metni)
- `formData` (iş verisi — business confidentiality)
- `email`, `phone`, `sicil` — PII plain değerleri. Referans gerekirse `userId` kullanılır.
- `ip` plain — yalnız `ipHash` (SHA-256) log'a gider
- `authorization` header tam değeri

```typescript
// main.ts — Pino redact config
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.newPassword',
      'req.body.currentPassword',
      'req.body.token',
      'req.body.content',
      'req.body.formData',
      'req.body.email',
      'req.body.phone',
      'req.body.sicil',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({ id: req.id, method: req.method, url: req.url, ipHash: req.ipHash }),
  },
});
```

---

## 13. Exception Hiyerarşisi

```
BaseException (abstract) — { code, message, statusCode, details? }
├── ValidationException               (400)
├── AuthenticationException           (401)
├── AuthorizationException            (403)
├── NotFoundException                 (404)
├── ConflictException                 (409)
├── GoneException                     (410)
├── PayloadTooLargeException          (413)
├── UnsupportedMediaTypeException     (415)
├── UnprocessableException            (422)
├── LockedException                   (423)
├── RateLimitException                (429)
├── InternalException                 (500)
└── ServiceUnavailableException       (503)
```

Her exception class'ı `code` property taşır; `03_API_CONTRACTS` error taxonomy'sindeki tüm kodlar bir exception class'ına map'lenir.

```typescript
// common/exceptions/base.exception.ts
export abstract class BaseException extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    input: { code: string; message?: string; details?: Record<string, unknown> },
    statusCode: number,
  ) {
    super(input.message ?? userMessageFor(input.code));
    this.code = input.code;
    this.statusCode = statusCode;
    this.details = input.details;
  }
}

// common/exceptions/conflict.exception.ts
export class ConflictException extends BaseException {
  constructor(input: { code: string; message?: string; details?: Record<string, unknown> }) {
    super(input, 409);
  }
}
```

`userMessageFor(code)` helper — `03_API_CONTRACTS`'teki master tablodan gelen Türkçe user-facing mesajları `packages/shared-types/src/error-messages.ts`'den okur.

Servis içinde kullanım:

```typescript
// Servis içinde hata fırlatma
if (existingUser) {
  throw new ConflictException({
    code: 'USER_SICIL_DUPLICATE',
    details: { field: 'sicil' },
  });
}
```

Global exception filter bu exception'ı yakalar → `{ error: { code: 'USER_SICIL_DUPLICATE', message: 'Bu sicil numarası zaten kayıtlı.', requestId, timestamp, details: { field: 'sicil' } } }` response'u üretir, HTTP status 409 döner.

**Unhandled exception** (BaseException'dan değil): Global filter 500 `SYSTEM_INTERNAL_ERROR` döner, stack trace Sentry'e raporlanır, kullanıcıya generic mesaj gösterilir.

---

## 14. Config Yönetimi ve Boot Order

### 14.1 Env Schema

Zod ile şema tanımlanır; boot'ta fail-fast:

```typescript
// bootstrap/config.validator.ts
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // DB
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(5).max(50).default(20),

  // Redis
  REDIS_URL: z.string().url(),

  // AWS
  AWS_REGION: z.string().default('eu-central-1'),
  KMS_KEY_ID: z.string().min(1),
  S3_BUCKET_DOCUMENTS: z.string().min(1),
  CLOUDFRONT_KEY_PAIR_ID: z.string().min(1),
  CLOUDFRONT_PRIVATE_KEY: z.string().min(1),
  CLAMAV_LAMBDA_ARN: z.string().min(1),
  SES_FROM_EMAIL: z.string().email(),

  // Auth secrets
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_PRIVATE_KEY: z.string().min(1),
  COOKIE_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  BLIND_INDEX_PEPPER_BASE64: z.string().min(40),

  // Superadmin bootstrap
  SUPERADMIN_EMAIL: z.string().email(),
  SUPERADMIN_PASSWORD_HASH: z.string().min(60),

  // CORS
  CORS_ALLOWED_ORIGINS: z.string().transform((s) => s.split(',').map((x) => x.trim())),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function validateConfig(raw: NodeJS.ProcessEnv): AppConfig {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    console.error('Config validation failed:', result.error.format());
    process.exit(1);
  }
  return result.data;
}
```

### 14.2 Env Hierarchy

Öncelik sırası (sol en yüksek):

1. Process env (`process.env`)
2. `.env.local` (gitignore'da — dev lokal override)
3. `.env.<NODE_ENV>` (`.env.development`, `.env.staging`, `.env.production`)
4. `.env` (varsayılanlar)

`dotenv-flow` paketi bu hierarchy'yi otomatik yönetir.

### 14.3 Secrets Manager

Staging ve production'da hassas değerler (`JWT_PRIVATE_KEY`, `COOKIE_SECRET`, `CSRF_SECRET`, `BLIND_INDEX_PEPPER_BASE64`, `SUPERADMIN_PASSWORD_HASH`, `CLOUDFRONT_PRIVATE_KEY`) AWS Secrets Manager'dan boot-time'da çekilir. Her secret ayrı bir ARN; IAM role ECS/EC2 task'a inline bağlı. Secret rotation desteği için `SecretsManagerClient.getSecretValue` her boot'ta — runtime rotation MVP kapsamı dışı.

### 14.4 Runtime-Editable Ayarlar

Sürekli değişebilecek parametreler (login attempt threshold, lockout duration, password expiry days, superadmin IP whitelist, active consent version ID) `system_settings` tablosunda. Superadmin Sistem Ayarları ekranından değiştirebilir. **Deploy gerektirmez.**

Hot reload yok — env/secret değişikliği = deploy. Runtime-editable ayarlar da deploy gerektirmez ama kod path'i bunları DB'den okur (cache 5 dk TTL).

### 14.5 Boot Order

`main.ts` açılış sırası — herhangi bir adımın başarısız olması process exit (Kubernetes/ECS restart):

1. **Config Zod validate** — fail-fast, eksik env'de exit
2. **AWS Secrets Manager fetch** — staging/prod'da
3. **KMS client init** — test encrypt/decrypt ping
4. **Prisma client init** — DB ping + migration status kontrolü
5. **Redis client init** — ping
6. **S3 client init** — bucket exists check
7. **Boot seed** — SYSTEM master data + sistem rolleri + Superadmin create-if-missing
8. **Process type registry** — KTİ (ve gelecek tipler) register
9. **NestJS app bootstrap** — modules, guards, interceptors
10. **BullMQ queue'lar connect** (worker pod'unda; API pod'u yalnız producer)
11. **Pino logger boot banner** — `info` seviyede version, env, ready status
12. **HTTP server listen** — `/health` endpoint'i trafiğe açılır

`/health/ready` endpoint'i boot-order tamamlanana kadar 503 döner. Load balancer trafiği ready olmadan yönlendirmez.

---

## 15. Referans Patterns

Agent yeni bir feature yazarken iki örnek pattern'i template olarak kullanır:

1. **Standart CRUD pattern** — User modülü (günlük üretilen kodun %80'i)
2. **Per-process pattern** — KTİ başlatma (yeni süreç tipi eklendiğinde takip edilen kalıp)

### 15.1 Standart CRUD Pattern — User Modülü

Aşağıdaki örnek yeni kullanıcı oluşturma akışını end-to-end gösterir: Controller → Service → Repository → Event handler.

**DTO (Zod schema) — `packages/shared-schemas/src/users.ts`:**

```typescript
import { z } from 'zod';

export const CreateUserSchema = z.object({
  sicil: z.string().regex(/^\d{8}$/, 'Sicil 8 haneli olmalı'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase().trim()),
  phone: z
    .string()
    .regex(/^(\+90|0)?5\d{9}$/)
    .optional(),
  employeeType: z.enum(['WHITE_COLLAR', 'BLUE_COLLAR', 'INTERN']),
  companyId: z.string().cuid(),
  locationId: z.string().cuid(),
  departmentId: z.string().cuid(),
  positionId: z.string().cuid(),
  levelId: z.string().cuid(),
  teamId: z.string().cuid().nullable(),
  workAreaId: z.string().cuid(),
  workSubAreaId: z.string().cuid().nullable(),
  managerUserId: z.string().cuid().nullable(),
  hireDate: z.string().datetime().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
```

**Controller — `apps/api/src/modules/users/users.controller.ts`:**

```typescript
import { Controller, Post, Get, Patch, Param, Body, Req, HttpCode } from '@nestjs/common';
import { CreateUserSchema, CreateUserInput } from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';
import { UsersService } from './users.service';
import { RequirePermission, AuditAction, CurrentUser, ZodBody } from '@/common/decorators';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(201)
  @RequirePermission(Permission.USER_CREATE)
  @AuditAction('CREATE_USER', { entity: 'user' })
  async create(
    @ZodBody(CreateUserSchema) input: CreateUserInput,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.usersService.create(input, currentUser, request);
  }

  @Get(':id')
  @RequirePermission(Permission.USER_LIST_VIEW)
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @RequirePermission(Permission.USER_UPDATE_ATTRIBUTE)
  @AuditAction('UPDATE_USER_ATTRIBUTE', { entity: 'user', entityIdFrom: 'params.id' })
  async update(
    @Param('id') id: string,
    @ZodBody(UpdateUserSchema) input: UpdateUserInput,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.usersService.updateAttribute(id, input, currentUser, request);
  }
}
```

**Service — `apps/api/src/modules/users/users.service.ts`:**

```typescript
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { UsersRepository } from './users.repository';
import { MasterDataRepository } from '@/modules/master-data/master-data.repository';
import { PermissionResolverService } from '@/modules/auth/permission-resolver.service';
import {
  ConflictException,
  NotFoundException,
  UnprocessableException,
  AuthorizationException,
} from '@/common/exceptions';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
    private readonly masterDataRepository: MasterDataRepository,
    private readonly permissionResolver: PermissionResolverService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(input: CreateUserInput, currentUser: AuthenticatedUser, request: Request) {
    // 1. Master data referans aktiflik kontrolü
    await this.assertMasterDataActive(input);

    // 2. Sicil + email unique kontrolü (repository blind_index'ten)
    const [sicilExists, emailExists] = await Promise.all([
      this.usersRepository.existsBySicil(input.sicil),
      this.usersRepository.existsByEmail(input.email),
    ]);
    if (sicilExists)
      throw new ConflictException({ code: 'USER_SICIL_DUPLICATE', details: { field: 'sicil' } });
    if (emailExists)
      throw new ConflictException({ code: 'USER_EMAIL_DUPLICATE', details: { field: 'email' } });

    // 3. Manager aktiflik kontrolü
    if (input.managerUserId) {
      const manager = await this.usersRepository.findById(input.managerUserId);
      if (!manager)
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          details: { field: 'managerUserId' },
        });
      if (!manager.isActive)
        throw new UnprocessableException({
          code: 'USER_NOT_FOUND',
          details: { field: 'managerUserId', reason: 'inactive' },
        });
    }

    // 4. Transaction — user create + audit payload
    return this.prisma.$transaction(async (tx) => {
      const user = await this.usersRepository.create(tx, {
        ...input,
        createdByUserId: currentUser.id,
      });

      // Audit interceptor için payload
      request.auditPayload = {
        newValue: this.snapshotForAudit(user),
      };

      // 5. Domain event emit — notification modülü dinler (welcome email)
      this.eventEmitter.emit('user.created', { userId: user.id, createdByUserId: currentUser.id });

      return this.toPublicDto(user);
    });
  }

  async updateAttribute(
    userId: string,
    input: UpdateUserInput,
    currentUser: AuthenticatedUser,
    request: Request,
  ) {
    if (userId === currentUser.id) {
      throw new AuthorizationException({ code: 'USER_SELF_EDIT_FORBIDDEN' });
    }

    const before = await this.usersRepository.findById(userId);
    if (!before) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

    // Manager cycle check
    if (input.managerUserId) {
      await this.assertNoManagerCycle(userId, input.managerUserId);
    }

    return this.prisma.$transaction(async (tx) => {
      const after = await this.usersRepository.update(tx, userId, input);

      request.auditPayload = {
        oldValue: this.snapshotChangedFieldsMasked(before, input),
        newValue: this.snapshotChangedFieldsMasked(after, input),
      };

      // Attribute değişimi attribute-based rol atamalarını etkileyebilir → cache invalidate
      await this.permissionResolver.invalidate(userId);
      this.eventEmitter.emit('user.attribute-changed', {
        userId,
        changedFields: Object.keys(input),
      });

      return this.toPublicDto(after);
    });
  }

  private async assertMasterDataActive(input: CreateUserInput) {
    const checks = [
      this.masterDataRepository.isActive('companies', input.companyId),
      this.masterDataRepository.isActive('locations', input.locationId),
      this.masterDataRepository.isActive('departments', input.departmentId),
      this.masterDataRepository.isActive('positions', input.positionId),
      this.masterDataRepository.isActive('levels', input.levelId),
      this.masterDataRepository.isActive('work_areas', input.workAreaId),
    ];
    const results = await Promise.all(checks);
    const inactiveFields = [
      'companyId',
      'locationId',
      'departmentId',
      'positionId',
      'levelId',
      'workAreaId',
    ];
    results.forEach((active, i) => {
      if (!active)
        throw new UnprocessableException({
          code: 'MASTER_DATA_IN_USE',
          details: { field: inactiveFields[i] },
        });
    });
  }

  private async assertNoManagerCycle(userId: string, newManagerId: string) {
    let current: string | null = newManagerId;
    const visited = new Set<string>();
    while (current) {
      if (current === userId) throw new UnprocessableException({ code: 'USER_MANAGER_CYCLE' });
      if (visited.has(current)) break; // başka bir cycle, yeni attamada değil
      visited.add(current);
      const m = await this.usersRepository.findManagerUserId(current);
      current = m;
    }
  }

  private snapshotForAudit(user: User) {
    // PII field'ları mask
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeType: user.employeeType,
      companyId: user.companyId,
      ...{ sicil: '***', email: '***', phone: user.phone ? '***' : null },
    };
  }

  private snapshotChangedFieldsMasked(user: User, delta: Partial<UpdateUserInput>) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(delta)) {
      if (['sicil', 'email', 'phone', 'managerEmail'].includes(key)) {
        out[key] = '***';
      } else {
        out[key] = (user as any)[key];
      }
    }
    return out;
  }

  private toPublicDto(user: User) {
    return {
      id: user.id,
      sicil: user.sicil,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async findById(id: string) {
    const user = await this.usersRepository.findByIdWithRelations(id);
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return this.toDetailedDto(user);
  }
}
```

**Repository — `apps/api/src/modules/users/users.repository.ts`:**

```typescript
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // tx parametresi opsiyonel — transaction içinde ise tx'i kullan, aksi halde default client
  async create(tx: Prisma.TransactionClient | PrismaClient, data: CreateUserData) {
    return tx.user.create({ data });
  }

  async update(tx: Prisma.TransactionClient | PrismaClient, id: string, data: UpdateUserData) {
    return tx.user.update({ where: { id }, data });
  }

  async findById(id: string) {
    // Encryption middleware otomatik decrypt eder
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByIdWithRelations(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        company: true,
        location: true,
        department: true,
        position: true,
        level: true,
        team: true,
        workArea: true,
        workSubArea: true,
        manager: { select: { id: true, sicil: true, firstName: true, lastName: true } },
        userRoles: { include: { role: { select: { id: true, code: true, name: true } } } },
      },
    });
  }

  async existsBySicil(sicil: string): Promise<boolean> {
    // Middleware virtualField=sicil → where sicilBlindIndex'e çevirir
    const u = await this.prisma.user.findUnique({ where: { sicil }, select: { id: true } });
    return !!u;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return !!u;
  }

  async findManagerUserId(userId: string): Promise<string | null> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { managerUserId: true },
    });
    return u?.managerUserId ?? null;
  }

  async findIdsWithRoleAccess(roleId: string): Promise<string[]> {
    // Direct assignment'lar
    const direct = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    // Attribute-based kullanıcıları bulmak için RoleRuleService'den yararlanılır — bu örnekte basit tutuldu
    return direct.map((ur) => ur.userId);
  }
}
```

**Event Handler — `apps/api/src/modules/users/events/handlers/user-created.handler.ts`:**

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '@/modules/notifications/notifications.service';

@Injectable()
export class UserCreatedHandler {
  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('user.created', { async: true })
  async handle(payload: { userId: string; createdByUserId: string }) {
    // Welcome email + şifre belirleme linki
    await this.notificationsService.enqueueByEvent('USER_ACCOUNT_CREATED', {
      userId: payload.userId,
    });
  }
}
```

**Module — `apps/api/src/modules/users/users.module.ts`:**

```typescript
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { UserCreatedHandler } from './events/handlers/user-created.handler';
import { UserAttributeChangedHandler } from './events/handlers/user-attribute-changed.handler';
import { MasterDataModule } from '../master-data/master-data.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MasterDataModule, AuthModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserCreatedHandler, UserAttributeChangedHandler],
  exports: [UsersService],
})
export class UsersModule {}
```

**Bu pattern neleri gösterir:**

- Decorator zinciri (`@RequirePermission`, `@AuditAction`, `@ZodBody`, `@CurrentUser`)
- Zod şema paylaşımı (shared-schemas paketi)
- Transaction içinde repository çağrısı + audit payload set
- Event emit ile cross-module iletişim
- PII masking audit snapshot'unda
- Cache invalidation (permission resolver)
- Encryption middleware şeffaflığı (service `user.email` üzerinden çalışır)
- Exception fırlatma pattern'i (`ConflictException`, `NotFoundException`, `UnprocessableException`)

### 15.2 Per-Process Pattern — KTİ Başlatma

Yeni bir süreç tipi eklemek isteyen agent bu pattern'i template olarak kullanır.

**Form schema — `apps/api/src/modules/processes/types/before-after-kaizen/kaizen.form-schema.ts`:**

```typescript
import { z } from 'zod';

export const KtiStartFormSchema = z.object({
  companyId: z.string().cuid(),
  beforePhotoDocumentIds: z.array(z.string().cuid()).min(1).max(10),
  afterPhotoDocumentIds: z.array(z.string().cuid()).min(1).max(10),
  savingAmount: z.number().int().nonnegative(),
  description: z.string().min(10).max(5000),
});

export const KtiManagerApprovalFormSchema = z.object({
  comment: z.string().max(1000).optional(),
});

export const KtiRevisionFormSchema = z.object({
  beforePhotoDocumentIds: z.array(z.string().cuid()).min(1).max(10),
  afterPhotoDocumentIds: z.array(z.string().cuid()).min(1).max(10),
  savingAmount: z.number().int().nonnegative(),
  description: z.string().min(10).max(5000),
  revisionNote: z.string().max(1000).optional(),
});

export type KtiStartFormInput = z.infer<typeof KtiStartFormSchema>;
export type KtiManagerApprovalFormInput = z.infer<typeof KtiManagerApprovalFormSchema>;
```

**Step definitions — `apps/api/src/modules/processes/types/before-after-kaizen/kaizen.step-definitions.ts`:**

```typescript
import { StepDefinition } from '../../process-type.registry';

export const KTI_STEPS: StepDefinition[] = [
  {
    key: 'KTI_INITIATION',
    label: 'Başlatma',
    order: 1,
    assignmentMode: 'SINGLE',
    assignmentResolver: (_process, _prev) => ({ type: 'STARTED_BY_SELF' }),
    allowedActions: [], // Başlatma submit-only, action yok
    reasonRequiredFor: [],
    slaHours: null, // Başlatma SLA'sız
    completionHandler: async (_task, _action, _form) => ({
      nextStepKey: 'KTI_MANAGER_APPROVAL',
      processStatus: 'IN_PROGRESS',
    }),
  },
  {
    key: 'KTI_MANAGER_APPROVAL',
    label: 'Yönetici Onay',
    order: 2,
    assignmentMode: 'SINGLE',
    assignmentResolver: (process, _prev) => ({
      type: 'MANAGER_OF_STARTER',
      userId: process.startedBy.managerUserId,
    }),
    allowedActions: ['APPROVE', 'REJECT', 'REQUEST_REVISION'],
    reasonRequiredFor: ['REJECT', 'REQUEST_REVISION'],
    slaHours: 72,
    completionHandler: async (_task, action, _form) => {
      if (action === 'APPROVE') return { nextStepKey: null, processStatus: 'COMPLETED' };
      if (action === 'REJECT') return { nextStepKey: null, processStatus: 'REJECTED' };
      if (action === 'REQUEST_REVISION')
        return { nextStepKey: 'KTI_REVISION', processStatus: 'IN_PROGRESS' };
      throw new Error(`Unknown action: ${action}`);
    },
  },
  {
    key: 'KTI_REVISION',
    label: 'Revize (Başlatıcıda)',
    order: 3,
    assignmentMode: 'SINGLE',
    assignmentResolver: (process, _prev) => ({
      type: 'STARTED_BY_SELF',
      userId: process.startedByUserId,
    }),
    allowedActions: [],
    reasonRequiredFor: [],
    slaHours: 48,
    completionHandler: async (_task, _action, _form) => ({
      nextStepKey: 'KTI_MANAGER_APPROVAL',
      processStatus: 'IN_PROGRESS',
    }),
  },
];
```

**Service — `apps/api/src/modules/processes/types/before-after-kaizen/kaizen.service.ts`:**

```typescript
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { ProcessesRepository } from '../../processes.repository';
import { TasksRepository } from '@/modules/tasks/tasks.repository';
import { DocumentsService } from '@/modules/documents/documents.service';
import { UsersRepository } from '@/modules/users/users.repository';
import { UnprocessableException } from '@/common/exceptions';
import { KtiStartFormInput } from './kaizen.form-schema';
import { KTI_STEPS } from './kaizen.step-definitions';

@Injectable()
export class KaizenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processesRepository: ProcessesRepository,
    private readonly tasksRepository: TasksRepository,
    private readonly usersRepository: UsersRepository,
    private readonly documentsService: DocumentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async start(input: KtiStartFormInput, starter: AuthenticatedUser, request: Request) {
    // 1. Kullanıcının manager'ı var mı? KTİ manager şart.
    const fullStarter = await this.usersRepository.findByIdWithRelations(starter.id);
    if (!fullStarter?.managerUserId) {
      throw new UnprocessableException({
        code: 'USER_NOT_FOUND',
        details: { field: 'starter.managerUserId' },
      });
    }

    // 2. Tüm dokümanlar CLEAN ve currentUser'a ait mi?
    const allDocIds = [...input.beforePhotoDocumentIds, ...input.afterPhotoDocumentIds];
    await this.documentsService.assertAllCleanAndOwnedBy(allDocIds, starter.id);

    // 3. Transaction
    return this.prisma.$transaction(async (tx) => {
      // 3a. Process insert
      const processNumber = await this.processesRepository.nextProcessNumber(
        tx,
        'BEFORE_AFTER_KAIZEN',
      );
      const displayId = `KTI-${String(processNumber).padStart(6, '0')}`;

      const process = await this.processesRepository.create(tx, {
        processNumber,
        processType: 'BEFORE_AFTER_KAIZEN',
        displayId,
        startedByUserId: starter.id,
        companyId: input.companyId,
        status: 'IN_PROGRESS',
      });

      // 3b. Initiation task (form_data'lı, already-completed)
      const initStep = KTI_STEPS.find((s) => s.key === 'KTI_INITIATION')!;
      await this.tasksRepository.create(tx, {
        processId: process.id,
        stepKey: initStep.key,
        stepOrder: initStep.order,
        assignmentMode: initStep.assignmentMode,
        status: 'COMPLETED',
        completedByUserId: starter.id,
        completedAt: new Date(),
        formData: {
          beforePhotoDocumentIds: input.beforePhotoDocumentIds,
          afterPhotoDocumentIds: input.afterPhotoDocumentIds,
          savingAmount: input.savingAmount,
          description: input.description,
        },
      });

      // 3c. Manager approval task (PENDING)
      const approvalStep = KTI_STEPS.find((s) => s.key === 'KTI_MANAGER_APPROVAL')!;
      const approvalTask = await this.tasksRepository.create(tx, {
        processId: process.id,
        stepKey: approvalStep.key,
        stepOrder: approvalStep.order,
        assignmentMode: approvalStep.assignmentMode,
        status: 'PENDING',
        slaDueAt: new Date(Date.now() + approvalStep.slaHours! * 3600 * 1000),
      });
      await this.tasksRepository.createAssignment(tx, {
        taskId: approvalTask.id,
        userId: fullStarter.managerUserId,
        resolvedByRule: true,
      });

      // 3d. Document'leri bu process'e bağla
      await this.documentsService.attachToProcessAndTask(
        tx,
        allDocIds,
        process.id,
        approvalTask.id,
      );

      // 3e. Audit payload
      request.auditPayload = {
        newValue: {
          displayId,
          processType: 'BEFORE_AFTER_KAIZEN',
          companyId: input.companyId,
          savingAmount: input.savingAmount,
          documentCount: allDocIds.length,
        },
      };

      // 3f. Bildirim event
      this.eventEmitter.emit('task.assigned', {
        taskId: approvalTask.id,
        userId: fullStarter.managerUserId,
        processDisplayId: displayId,
      });

      return {
        id: process.id,
        displayId,
        firstTaskId: approvalTask.id,
        startedAt: process.startedAt,
      };
    });
  }
}
```

**Controller — `apps/api/src/modules/processes/types/before-after-kaizen/kaizen.controller.ts`:**

```typescript
import { Controller, Post, Body, Req, HttpCode } from '@nestjs/common';
import { Permission } from '@leanmgmt/shared-types';
import { KtiStartFormSchema, KtiStartFormInput } from './kaizen.form-schema';
import { KaizenService } from './kaizen.service';
import { RequirePermission, AuditAction, CurrentUser, ZodBody } from '@/common/decorators';

@Controller('api/v1/processes/kti')
export class KaizenController {
  constructor(private readonly kaizenService: KaizenService) {}

  @Post('start')
  @HttpCode(201)
  @RequirePermission(Permission.PROCESS_KTI_START)
  @AuditAction('START_PROCESS', { entity: 'process' })
  async start(
    @ZodBody(KtiStartFormSchema) input: KtiStartFormInput,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.kaizenService.start(input, currentUser, request);
  }
}
```

**Module — `apps/api/src/modules/processes/types/before-after-kaizen/kaizen.module.ts`:**

```typescript
import { Module, OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { ProcessTypeRegistry } from '../../process-type.registry';
import { KaizenController } from './kaizen.controller';
import { KaizenService } from './kaizen.service';
import { KtiStartFormSchema } from './kaizen.form-schema';
import { KTI_STEPS } from './kaizen.step-definitions';
import { ProcessesModule } from '../../processes.module';
import { TasksModule } from '@/modules/tasks/tasks.module';
import { DocumentsModule } from '@/modules/documents/documents.module';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [ProcessesModule, TasksModule, DocumentsModule, UsersModule],
  controllers: [KaizenController],
  providers: [KaizenService],
})
export class KaizenModule implements OnModuleInit {
  constructor(private readonly registry: ProcessTypeRegistry) {}

  onModuleInit() {
    this.registry.register({
      type: 'BEFORE_AFTER_KAIZEN',
      displayIdPrefix: 'KTI',
      steps: KTI_STEPS,
      startFormSchema: KtiStartFormSchema as z.ZodSchema,
      onStart: async () => {
        throw new Error('use KaizenController directly');
      },
    });
  }
}
```

**Bu pattern neleri gösterir:**

- Per-process submodule organizasyonu — her süreç kendi klasöründe
- Zod form schema'ları step bazında ayrı tanımlı
- `StepDefinition` array'i ile state machine decouple
- Generic `ProcessesService` ve `TasksService` bu süreçten habersiz — registry üzerinden resolve eder
- `onModuleInit` hook ile otomatik kayıt
- Controller + Service disiplini standart CRUD pattern ile aynı
- Transaction içinde 6 ayrı işlem (process + 2 task + assignment + documents + audit) atomik

**Yeni süreç eklemek için agent:**

1. `modules/processes/types/<new-type>/` klasörü oluştur
2. Form schema (Zod), step definitions, service, controller, module yaz
3. Root `ProcessesModule`'a import et
4. `Permission` enum'una `PROCESS_<TYPE>_START` ekle
5. Migration: `process_seq_<new_type>` sequence oluştur
6. Integration test yaz
7. `06_SCREEN_CATALOG`'u güncelle (yeni süreç başlatma formu ekranı)

---

## 16. Test Yapılanması — Özet

Detaylı strateji `08_TESTING_STRATEGY` dokümanında. Backend perspektifinden kısa özet:

| Seviye      | Konum                           | Framework                                    | Çalışma süresi (tüm suite) |
| ----------- | ------------------------------- | -------------------------------------------- | -------------------------- |
| Unit        | `<feature>/__tests__/*.spec.ts` | Vitest                                       | < 30 sn                    |
| Integration | `test/integration/*.test.ts`    | Vitest + Testcontainers (PostgreSQL + Redis) | < 5 dk                     |
| E2E         | `test/e2e/*.test.ts`            | Playwright (browser-level)                   | < 15 dk                    |

**Testcontainers:** Her integration test suite kendi PostgreSQL ve Redis container'ını ayağa kaldırır, Prisma migration çalıştırır, test sonunda tear down. In-memory mock yerine gerçek PostgreSQL — encryption middleware, trigger'lar, JSONB, sequence'lar gerçek ortamda test edilir.

**Coverage gereksinimleri:** Auth %90, encryption middleware %95, permission resolver %90, process state transitions %85 — CI'da bu modüllerde coverage altına düşme merge'i blokelar. Diğer modüller %70 genel hedef.

**Mock disiplini:**

- External services (S3, KMS, SES, ClamAV) **daima mock** — integration'da bile
- DB **gerçek** (Testcontainers)
- Redis **gerçek** (Testcontainers)
- Time (`Date.now()`) **frozen** (`vi.useFakeTimers`) — SLA ve expiry testleri deterministik

---

Bu doküman backend mimarisinin canlı referansıdır. Yeni bir feature yazılırken agent 15. bölümdeki pattern'lerden ilgili olanını template alır, 4. bölüm iskeletini takip eder, 5. bölüm middleware zincirini değiştirmez, 8. bölüm permission disiplinini ve 9. bölüm audit disiplinini uygular.
