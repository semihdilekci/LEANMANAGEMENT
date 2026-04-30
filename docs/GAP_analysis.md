# GAP Analizi — Doküman ↔ Kod Uyumsuzlukları

> **Amaç:** Projede tespit edilen dokümantasyon / yol haritası / katalog gereksinimleri ile mevcut kod arasındaki farkları tek yerde toplamak. Gelecekteki geliştirme oturumlarında agent veya geliştirici buradan **kapsam, kaynak doküman, kabul kriterleri ve dokunulacak kod bölgelerini** hızlıca çıkarabilsin.

**Son güncelleme:** 2026-04-26  
**İlgili faz:** Öncelikle **Faz 8 (Admin Panel)**; bazı maddeler **Faz 9** ile çakışabilir (dashboard).

---

## Nasıl kullanılır

1. Bir GAP satırına göre çalışırken ilgili **Kaynak dokümanlar** bölümündeki dosyaları context’e ekleyin.
2. Backend dokunuşu için: `@40-add-new-endpoint.mdc`, `@43-add-new-permission.mdc` (izin gerekiyorsa), `@03-security-baseline.mdc`.
3. Frontend ekranı için: `@41-add-new-screen.mdc` veya `@47-implement-screen-from-catalog.mdc`, `@26-lean-design-system.mdc`.
4. PR öncesi: Bu dosyada ilgili GAP’ı **Kapalı** olarak işaretleyin veya ADR/doküman güncellemesi notunu ekleyin.

---

## Kaynak hiyerarşisi (çakışma halinde)

| Öncelik | Doküman                                     | Not                                               |
| ------- | ------------------------------------------- | ------------------------------------------------- |
| 1       | `docs/03_API_CONTRACTS.md`                  | HTTP sözleşmesi, error kodları                    |
| 2       | `docs/06_SCREEN_CATALOG.md`                 | UX / ekran davranışı                              |
| 3       | `docs/10_IMPLEMENTATION_ROADMAP.md`         | Faz deliverable / Human Gate                      |
| 4       | `.cursor/rules/58-phase-08-admin-panel.mdc` | Faz 8 çalışma modeli (bazen repo yapısından eski) |

**Altın kural:** Kod ile `03` çelişiyorsa ya kod düzeltilir ya `03` güncellenir (`docs/10_IMPLEMENTATION_ROADMAP.md` §9 Doküman yaşam döngüsü).

---

## Özet tablo

| ID          | Başlık                                              | Tür              | Öncelik    |
| ----------- | --------------------------------------------------- | ---------------- | ---------- |
| GAP-ADM-001 | Bakım modu (`503` / `SYSTEM_MAINTENANCE`)           | Özellik          | Yüksek     |
| GAP-ADM-002 | Audit CSV export — async job / büyük veri           | Özellik / ölçek  | Yüksek     |
| GAP-ADM-003 | Audit export — JSON (forensic)                      | Özellik          | Orta       |
| GAP-ADM-004 | Audit detay — old/new JSON diff viewer              | UX               | Orta       |
| GAP-ADM-005 | Audit liste — gelişmiş filtreler (`06` seviyesi)    | UX               | Orta       |
| GAP-ADM-006 | Rıza yayın — önceki `PUBLISHED` → `ARCHIVED`        | İş kuralı        | Orta       |
| GAP-ADM-007 | Rıza — `DELETE` draft API (+ UI)                    | API + UX         | Orta       |
| GAP-ADM-008 | Sistem ayarları — bulk güncelleme (tek transaction) | API              | Orta–Düşük |
| GAP-ADM-009 | Admin shell — yetkisiz girişte `403` vs redirect    | UX / güvenlik    | Orta       |
| GAP-DOC-001 | `effectiveFrom` min süre: 1 saat vs 1 dk            | Doküman uyumu    | Düşük      |
| GAP-DOC-002 | Audit export: `GET` vs `POST` + job (`06` vs `03`)  | Doküman uyumu    | Düşük      |
| GAP-DOC-003 | Faz 8 kural dosyası — modül yolları ve export rate  | Kural güncelliği | Düşük      |

---

## GAP kayıtları (detay)

### GAP-ADM-001 — Bakım modu (`503`)

- **Durum:** Açık
- **Öncelik:** Yüksek

**Beklenen (kaynak):**

- `docs/10_IMPLEMENTATION_ROADMAP.md` — Faz 8 **Deliverable**: “System settings: maintenance mode toggle → real effect (non-admin user `503` görür)” (yaklaşık satır ~797).
- `docs/06_SCREEN_CATALOG.md` — **S-ADMIN-SETTINGS** kategori **Sistem (MAINTENANCE)**; `MAINTENANCE_MODE_ENABLED`, `MAINTENANCE_MESSAGE` (`06` içinde sistem ayarları tablosu).
- `docs/06_SCREEN_CATALOG.md` — **S-ERROR-MAINT**: bakım sayfası; backend tüm API’leri `503` ile reddeder; süperadmin bypass (`2937` civarı bölüm).
- `docs/03_API_CONTRACTS.md` — error kodu `SYSTEM_MAINTENANCE` (`503`) tablosu.

**Mevcut kod:**

- `packages/shared-schemas/src/admin.schemas.ts` — `SYSTEM_SETTING_KEYS` içinde bakım anahtarları **yok**.
- API’de ayarı okuyup mutating/read isteklerinde `503` dönen global middleware/guard **yok** (arama: maintenance / `MAINTENANCE_MODE`).

**Uygulama notları (agent için):**

1. `02_DATABASE_SCHEMA.md` § sistem ayarları + `prisma/seed.ts` ile `MAINTENANCE_MODE_ENABLED` (bool), `MAINTENANCE_MESSAGE` (string) ekle; migration + Zod `parseSystemSettingValue`.
2. Okuma yolu: seed veya runtime default `false`.
3. Nest: global guard veya middleware — **Public** rotalar (`/auth/login`, OIDC callback path'leri (`/auth/oauth/*` vb.), health, `csp-report`) muaf; süperadmin bypass stratejisi `06` ile uyumlu tanımlanmalı.
4. Web: axios interceptor `503` + `SYSTEM_MAINTENANCE` → `/maintenance` (`05_FRONTEND_SPEC.md` public routes).
5. Test: integration — bakım açıkken normal kullanıcı `GET /dashboard` kaynaklı API `503`; admin bypass doğrulaması.

**İlgili kurallar:** `@03-security-baseline.mdc` (permission, rate limit); `@41-add-new-screen.mdc` (`/maintenance`).

---

### GAP-ADM-002 — Audit CSV export — async job / büyük veri

- **Durum:** Açık
- **Öncelik:** Yüksek

**Beklenen (kaynak):**

- `docs/10_IMPLEMENTATION_ROADMAP.md` — Faz 8 **Human Gate**: “Audit log CSV export async job pattern (>10K kayıt için)” (~804).
- Aynı dosya **Vibe Coding Risk**: client-side tüm veri yasak; “Backend async job + S3 pre-signed URL” (~818).
- `docs/06_SCREEN_CATALOG.md` — **S-ADMIN-AUDIT**: büyük export için backend job, hazır olunca indirme; `POST` + presigned URL anlatımı (`2576`–`2580` civarı).

**Mevcut kod:**

- `apps/api/src/audit-logs/audit-logs.controller.ts` — `GET export`: senkron CSV string; `AuditLogsService.exportCsvString` tüm satırları işler.
- Üst sınır: `VALIDATION_FAILED` ile 100.000 satır (servis sabiti) — job yok.

**Uygulama notları:**

1. Karar: `03` §9.9’u mu genişleteceksiniz (yeni endpoint: `POST .../export-jobs`) yoksa mevcut `GET`’i eşik altında senkron, üstünde job mu?
2. Worker (`apps/worker`): BullMQ job + S3 yazma + audit `EXPORT_AUDIT_LOG` (metadata’da job id).
3. Rate limit: mevcut Redis saatlik 10 istek (`AuditLogsService`) korunmalı.
4. Test: integration — > eşik satırda job oluşumu; veya unit job handler.

**Kaynak çelişkisi:** `GAP-DOC-002` ile birlikte planlayın.

---

### GAP-ADM-003 — Audit export — JSON (forensic)

- **Durum:** Açık
- **Öncelik:** Orta

**Beklenen (kaynak):**

- `.cursor/rules/58-phase-08-admin-panel.mdc` — **Constraints**: “Audit log export: CSV + JSON (forensic)” (~satır 91).
- Aynı dosya **Done Definition**: “Audit export: CSV + JSON (rate-limited …)” (~102). Not: kuralda “5/hour” yazıyor; `docs/03_API_CONTRACTS.md` export için **10/saat/kullanıcı** — implementasyon ve `03` ile hizalayın.

**Mevcut kod:** Yalnız CSV export.

**Uygulama notları:**

1. `packages/shared-schemas`: query şeması CSV ile aynı filtreler; `format=csv|json` veya ayrı path (`GET .../export.json`).
2. Rate limit: CSV ile **aynı saatlik sayaç** mı ayrı mı — ürün kararı.
3. UI: `AuditLogsPageClient` ikinci indirme seçeneği.

---

### GAP-ADM-004 — Audit detay — old/new JSON diff viewer

- **Durum:** Açık
- **Öncelik:** Orta

**Beklenen (kaynak):**

- `docs/10_IMPLEMENTATION_ROADMAP.md` — Faz 8 Human Gate: “Diff viewer: old_value vs new_value side-by-side JSON” (~805).
- `docs/06_SCREEN_CATALOG.md` — **S-ADMIN-AUDIT** detay modal: UPDATE aksiyonlarında JSON diff; MVP’de basit side-by-side yeter (`2537`–`2539`).

**Mevcut kod:**

- `apps/web/src/components/admin/AuditLogsPageClient.tsx` — modal içinde tek `JSON.stringify(detailRow)`; ayrı diff yok.

**Uygulama notları:**

1. `oldValue` / `newValue` alanlarını API zaten döndürüyorsa UI’da iki sütun + basit structural diff (kütüphane seçimi: proje ADR veya mevcut dependency uyumu).
2. PII maskelenmiş alanlarda diff davranışı `03` §9.9 ile uyumlu kalmalı.

---

### GAP-ADM-005 — Audit liste — gelişmiş filtreler

- **Durum:** Açık
- **Öncelik:** Orta

**Beklenen (kaynak):**

- `docs/06_SCREEN_CATALOG.md` — **S-ADMIN-AUDIT**: UserSelect, aksiyon multi-select, entity tipi select, IP, arama, hazır tarih aralıkları (`2512`–`2520`).

**Mevcut kod:**

- `AuditLogsPageClient`: tarih aralığı + serbest metin `action` / `entity`; backend `AuditLogListQuerySchema` ile uyumlu minimal set.

**Uygulama notları:**

1. API’de eksik filtre varsa (ör. `search` metni) önce `shared-schemas` + `AuditLogsService.buildWhereFromListQuery`.
2. UI: mevcut `MasterDataSelect` / multi-select pattern’leri (`05_FRONTEND_SPEC.md`).

---

### GAP-ADM-006 — Rıza yayın — önceki `PUBLISHED` → `ARCHIVED`

- **Durum:** Açık
- **Öncelik:** Orta

**Beklenen (kaynak):**

- `docs/10_IMPLEMENTATION_ROADMAP.md` — Faz 8 Human Gate: “Publish sonrası mevcut PUBLISHED version otomatik ARCHIVED” (~809).

**Mevcut kod:**

- `apps/api/src/consent-versions/consent-versions.service.ts` — `adminPublish`: draft → `PUBLISHED`, `ACTIVE_CONSENT_VERSION_ID` güncellenir; **diğer PUBLISHED satırları ARCHIVED yapmıyor**.

**Uygulama notları:**

1. Transaction içinde: `id != publishedId` ve `status == PUBLISHED` olanları `ARCHIVED` yap (iş kuralı: tek aktif yayın `ACTIVE_CONSENT_VERSION_ID` ile de tutarlı olsun).
2. `docs/01_DOMAIN_MODEL.md` / `02_DATABASE_SCHEMA.md` — `consent_versions.status` enum doğrulaması.
3. Test: integration publish sonrası eski sürüm `ARCHIVED`.

**ADR:** `@58-phase-08-admin-panel.mdc` — ADR-0027 ile ilişki (re-accept akışı).

---

### GAP-ADM-007 — Rıza — `DELETE` draft API (+ UI)

- **Durum:** Açık
- **Öncelik:** Orta

**Beklenen (kaynak):**

- `docs/06_SCREEN_CATALOG.md` — **S-ADMIN-CONSENT-LIST**: DRAFT için silme; `DELETE /api/v1/consent-versions/:id` (~2881).

**Mevcut kod:**

- `apps/api/src/consent-versions/admin-consent-versions.controller.ts` — **DELETE yok**.

**Uygulama notları:**

1. Yetki: `CONSENT_VERSION_EDIT` veya ayrı izin — `03` ve `packages/shared-types` ile netleştir.
2. Sadece `DRAFT`; audit + typed exception.
3. Web: liste sayfasında ConfirmDialog (`ConsentVersionsPageClient`).

---

### GAP-ADM-008 — Sistem ayarları — bulk güncelleme

- **Durum:** Açık
- **Öncelik:** Orta–Düşük

**Beklenen (kaynak):**

- `docs/10_IMPLEMENTATION_ROADMAP.md` — Faz 8 Human Gate: “System settings bulk update atomic (tek transaction)” (~805).

**Mevcut kod:**

- `apps/api/src/system-settings/system-settings.service.ts` — yalnız `updateByKey` (tek key).

**Uygulama notları:**

1. `PUT /api/v1/admin/system-settings` body: `{ updates: [{ key, value }, ...] }` — `prisma.$transaction`; Redis cache tek sefer invalidate.
2. `shared-schemas` strict array Zod.

---

### GAP-ADM-009 — Admin shell — yetkisiz kullanıcı (`403` vs redirect)

- **Durum:** Açık
- **Öncelik:** Orta

**Beklenen (kaynak):**

- `docs/10_IMPLEMENTATION_ROADMAP.md` — Faz 8 Human Gate: “AdminLayout: normal kullanıcı URL ile girerse **403**” (~810).

**Mevcut kod:**

- `apps/web/src/app/(admin)/layout.tsx` — yetkisizde `router.replace('/dashboard')`; HTTP `403` sayfası yok.

**Uygulama notları:**

1. `/admin` için middleware veya layout’ta **403 sayfasına** yönlendir (`S-ERROR-403` — Faz 9 roadmap ile ilişkili; `@59-phase-09-dashboard-polish.mdc`).
2. UX: “Yönlendiriliyor” yerine açık “Erişim yok” mesajı.

---

### GAP-DOC-001 — `effectiveFrom` minimum süre (1 saat vs 1 dakika)

- **Durum:** Doküman çelişkisi; kod **1 dk** tarafında
- **Öncelik:** Düşük

**Kaynaklar:**

- `docs/10_IMPLEMENTATION_ROADMAP.md` Human Gate: “effective_from min **now+1h**” (~807).
- `docs/03_API_CONTRACTS.md` §9.10 `POST .../consent-versions/:id/publish`: “min: **now + 1 dakika**” (~3055–3056).
- `packages/shared-schemas/src/admin.schemas.ts` — `AdminConsentVersionPublishBodySchema`: **now + 1 dk**.

**Aksiyon:** Tek karar seçilsin; kaybeden doküman güncellensin. Kod değişmeden sadece `10` düzeltmek en düşük maliyetli olabilir.

---

### GAP-DOC-002 — Audit export HTTP semantiği (`06` vs `03`)

- **Durum:** Doküman / katalog çelişkisi
- **Öncelik:** Düşük

**Kaynaklar:**

- `docs/03_API_CONTRACTS.md` §9.9 — `GET /admin/audit-logs/export` (query filtreleri).
- `docs/06_SCREEN_CATALOG.md` — **S-ADMIN-AUDIT** bazen `POST` + job + presigned URL tarif ediyor (`2546`–`2579`).

**Mevcut kod:** `GET` senkron CSV — **`03` ile uyumlu**.

**Aksiyon:** `06` senaryoyu `03` ile hizala veya “async varyant Faz X” diye ayır. `GAP-ADM-002` tamamlanınca katalog güncellenmeli.

---

### GAP-DOC-003 — Faz 8 kural dosyası — dizin yapısı ve export rate

- **Durum:** Kural dosyası eski
- **Öncelik:** Düşük

**Kaynak:** `.cursor/rules/58-phase-08-admin-panel.mdc`

**Çelişkiler:**

- Önerilen path’ler: `apps/api/src/audit/`, `apps/worker/src/admin/` — gerçek repo: `audit-logs/`, `apps/worker/src/audit-chain-verify.cron.ts` vb.
- Done Definition: export “**5/hour**” — `docs/03_API_CONTRACTS.md` ve kod: **10/saat**.

**Aksiyon:** `.mdc` dosyası repo yapısı ve `03` ile yeniden hizalanmalı (özellik kod değil dokümantasyon).

---

## Kapatma checklist’i (PR için)

- [ ] İlgili GAP için unit/integration test eklendi mi? (`08_TESTING_STRATEGY.md`)
- [ ] `docs/03_API_CONTRACTS.md` güncellendi mi (endpoint değiştiyse)?
- [ ] `docs/06_SCREEN_CATALOG.md` güncellendi mi (ekran davranışı değiştiyse)?
- [ ] Permission / audit / rate limit (`03-security-baseline.mdc`) kontrol edildi mi?
- [ ] Bu dosyada GAP durumu **Kapalı** veya tarihli not düşüldü mü?

---

## İlişkili proje dosyaları (hızlı atlas)

| Konu            | Kod giriş noktaları                                                                  |
| --------------- | ------------------------------------------------------------------------------------ |
| Audit           | `apps/api/src/audit-logs/`, `apps/web/src/components/admin/AuditLogsPageClient.tsx`  |
| Sistem ayarları | `apps/api/src/system-settings/`, `packages/shared-schemas/src/admin.schemas.ts`      |
| Rıza (admin)    | `apps/api/src/consent-versions/`, `apps/web/src/app/(admin)/admin/consent-versions/` |
| Admin özet      | `apps/api/src/admin-summary/`, `apps/web/src/app/(admin)/admin/page.tsx`             |
| Worker          | `apps/worker/src/audit-chain-verify.cron.ts`, `data-retention-cleanup.cron.ts`       |

---

_Bu dosya “tek doğruluk kaynağı” değildir; ürün kararı `docs/_.md` ve ADR’lerdedir. Çelişkide önce ilgili ana doküman güncellenir, sonra bu GAP listesi.\*
