# Lean Management Platformu — Mimari Kararlar Dokümanı

> **Versiyon:** 0.7 (Taslak — Bildirim sistemi, altyapı detayları, test kuralları netleşti)
> **Son güncelleme:** 21 Nisan 2026
> **Durum:** 🟢 Bildirim Sistemi (yeni Bölüm 13, 10 karar) + AUTH AND/OR koşul setleri + audit log içerik tablosu + altyapı kararları (Redis ElastiCache, GitHub Actions CI/CD, CloudWatch+Sentry monitoring, Log aggregation+retention matrisi, Secret yönetimi dev/prod ayrımı) + Test kuralları (Coverage hedefleri, user-approval-before-merge zorunluluğu, staging seed stratejisi) dokümana işlendi. Kalan açık maddeler: 4 altyapı detayı + 1 süreç dosyası + MVP sonrası ileri güvenlik iterasyonları.
> **Amaç:** Bu doküman `.md` ve `.mdc` dosyalarının tamamının referans alacağı tek doğruluk kaynağıdır. Tüm mimari ve iş kuralı kararları buraya işlenir.

---

## İçindekiler

- [1. Proje Kimliği ve Kapsam](#1-proje-kimliği-ve-kapsam)
- [2. Kullanıcı Havuzu ve Ölçek](#2-kullanıcı-havuzu-ve-ölçek)
- [3. Kimlik Doğrulama ve Kullanıcı Yapısı](#3-kimlik-doğrulama-ve-kullanıcı-yapısı)
- [4. Yetkilendirme Mimarisi (RBAC + ABAC Hibrit)](#4-yetkilendirme-mimarisi-rbac--abac-hibrit)
- [5. Roller ve Yetki Yönetimi](#5-roller-ve-yetki-yönetimi)
- [6. Süreç (Workflow) Mimarisi](#6-süreç-workflow-mimarisi)
- [7. Görev Yönetimi](#7-görev-yönetimi)
- [8. Doküman Yönetimi](#8-doküman-yönetimi)
- [9. Admin Panelleri](#9-admin-panelleri)
- [10. Güvenlik ve KVKK](#10-güvenlik-ve-kvkk)
- [11. Denetim (Audit Log)](#11-denetim-audit-log)
- [12. Entegrasyonlar](#12-entegrasyonlar)
- [13. Bildirim Sistemi](#13-bildirim-sistemi)
- [14. Tech Stack](#14-tech-stack)
- [15. Altyapı ve Operasyon](#15-altyapı-ve-operasyon)
- [16. Test Stratejisi](#16-test-stratejisi)
- [17. Kod Organizasyonu ve Agent Kuralları](#17-kod-organizasyonu-ve-agent-kuralları)
- [18. Açık Kararlar — Tamamlanması Gerekenler](#18-açık-kararlar--tamamlanması-gerekenler)

---

## 1. Proje Kimliği ve Kapsam

### 1.1. Ürün Tanımı
**Karar [P-001]:** Lean Management, fabrikalarda operasyonel mükemmellik (OpEx) ekibi tarafından yürütülen yalın yönetim, Six Sigma, Kaizen süreçlerinin dijitalleştirilmesi için geliştirilen bir web platformudur.

### 1.2. Ürün Modeli
**Karar [P-002]:** Tek bir holding için özel olarak geliştirilen kurumsal bir uygulamadır. **Multi-tenant (çok kiracılı) bir SaaS ürünü değildir.**

**Karar [P-003]:** Tek platform birden fazla şirkete hizmet edecektir. Ancak her kullanıcı **tek bir şirkette** çalışır. Kullanıcılar farklı şirketlere ve lokasyonlara dağılmış durumdadır.

### 1.3. Platform Stratejisi
**Karar [P-004]:** MVP web uygulaması olarak geliştirilecektir. Mobil uygulama MVP kapsamında değildir, ancak **seçilecek teknoloji yığını mobile genişlemeye izin vermelidir.**

### 1.4. Hedef Kullanıcılar
**Karar [P-005]:** Fabrikalarda yalın yönetim süreçlerine dokunan tüm roller: çalışan, yönetici, danışman vb. firmada çalışan herkes.

### 1.5. Platformun Temel Değer Önerisi
**Karar [P-006]:** Süreçler, görevler, formlar ve yetkiler firma süreçlerine özel ve esnek olacak şekilde tasarlanır. Standart araçlar yerine şirkete özel akışlar sağlanır.

### 1.6. MVP Kapsamı
**Karar [P-007]:** MVP'de aşağıdaki özellikler yer alır:
- Giriş (Login) ve oturum yönetimi
- Kullanıcı yönetimi (CRUD)
- Esnek rol ve yetki mekanizması (RBAC + ABAC hibrit)
- Bir adet hard-coded süreç: **Before & After Kaizen**
- Merkezi görev yönetimi altyapısı
- Amazon S3 tabanlı doküman yönetim yapısı (meta veri DB'de)
- Süreç Yönetimi Paneli (superadmin)
- Audit log altyapısı
- In-app ve email bildirim altyapısı (detay açık — bkz. [Bölüm 18](#18-açık-kararlar--tamamlanması-gerekenler))

### 1.7. Monetizasyon
**Karar [P-008]:** Kurumsal iç uygulama olduğu için monetizasyon, ödeme, abonelik gibi konular **kapsam dışıdır.**

### 1.8. Dil ve Yerelleştirme
**Karar [P-009]:** MVP sadece **Türkçe** olacaktır. Çoklu dil altyapısı ilerleyen aşamalarda düşünülecektir ancak MVP'de gerekli değildir.

---

## 2. Kullanıcı Havuzu ve Ölçek

### 2.1. Toplam Kullanıcı
**Karar [S-001]:** Platform **20.000 kullanıcı**ya hizmet verecek şekilde tasarlanacaktır.

### 2.2. Eşzamanlı Kullanıcı
**Karar [S-002]:** Eşzamanlı olarak **1.000 kullanıcı**yı destekleyecek altyapı kurulacaktır.

### 2.3. Kullanım Yoğunluğu
**Karar [S-003]:** Bir kullanıcı **günde ortalama 10 süreç** başlatabilir. Her süreçte dosya yüklenir ve akıştaki görevler onaylanır. Altyapı bu yükü ve gelecekteki büyümeyi karşılamak için **yüksek performans standartlarında** tasarlanmalıdır.

### 2.4. Coğrafya
**Karar [S-004]:** Kullanıcılar Türkiye'de bulunmaktadır. KVKK uyumu zorunludur.

### 2.5. Bildirim Gerçek Zamanlılığı
**Karar [S-005]:** Bildirimler **near real-time** olması yeterlidir. Ancak altyapı gelecekte real-time (WebSocket/SSE) özelliklere geçişe izin verecek şekilde tasarlanmalıdır.

---

## 3. Kimlik Doğrulama ve Kullanıcı Yapısı

### 3.1. Süper Yönetici (Superadmin)
**Karar [A-001]:** Platformun en yetkili kullanıcısıdır. **Tek kişi** olacaktır.

**Karar [A-002]:** Superadmin kimlik bilgileri environment variable'larda tanımlıdır:
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD_HASH` (bcrypt hash olarak)

**Karar [A-003]:** Uygulama ilk başlatıldığında, env'deki bilgilerle superadmin DB'ye seed edilir. Superadmin şifresi **uygulama içinden değiştirilemez**, yalnızca env değişikliği ile güncellenir.

**Karar [A-004]:** Superadmin her zaman kurtarıcı rolündedir — diğer tüm yönetici rollerini atama/kaldırma yetkisine sahiptir.

### 3.2. Kullanıcı Attribute'ları
**Karar [A-005]:** Kullanıcıların aşağıdaki attribute'ları tutulacaktır:
- Sicil (8 haneli)(unique identifier) 8 
- Şirket Adı
- Şirket Kodu
- Personel Adı
- Personel Soyadı
- Kademe 
- Kademe Kodu
- Departman
- Ekip
- Pozisyon
- Yönetici Sicili (8 haneli)
- Yönetici Adı
- Yönetici Soyadı
- Yönetici Mail
- Çalışma Alanı
- Çalışma Alt Alanı
- Email
- Telefon
- İşe giriş tarihi
- Lokasyon Kodu
- Lokasyon Adı
- Çalışan Tipi (Beyaz Yaka/Mavi Yaka/Stajyer)
- Aktif Durumu (Aktif/Pasif)

**Karar [A-006]:** Ayrı bir organizasyon hiyerarşi tablosu tutulmayacaktır. Organizasyonel bilgiler kullanıcı attribute'larında saklanır.

### 3.3. Attribute Listesi ve Master Data Yönetimi

**Karar [A-010]:** Kullanıcı attribute **listesi (schema) hard-coded**'dır. Yeni attribute eklenmesi (örn: "vardiya", "proje kodu") bir geliştirme işlemidir — DB migration + kod değişikliği gerektirir. MVP'de [A-005]'teki liste sabittir.

**Karar [A-011]:** Attribute **değerleri** (şirket listesi, lokasyon listesi, pozisyon listesi, departman listesi, çalışma alanı listesi vb.) **ayrı master data tablolarında** tutulur. Kullanıcı tablosu bu master data'lara **foreign key ile referans** verir — serbest text olarak tutmaz. Bu model, veri tutarlılığını (aynı şirket için farklı yazımlar oluşamaz), kod tekilliğini ve attribute-based rol kurallarının çalışabilirliğini garanti eder.

Örnek ilişki:
```
companies (id, code, name, is_active)       ← master data tablosu
  ↑ FK
users (id, sicil, company_id, location_id,  ← referans verir
       department_id, position_id, ...)
```

**Karar [A-014]:** Master Data Referential + Usage-Aware Modeli — **"Kullanılmakta olan" konsepti ayrı tabloyla değil, runtime sayım ile** sağlanır:
- Master data ayrı tabloda tutulur ([A-011]).
- Her master data satırı için **kullanım sayısı** canlı hesaplanır: `SELECT COUNT(*) FROM users WHERE company_id = X AND is_active = true`.
- Yönetim ekranında (bkz. [AP-011]) "Kullanıcı Sayısı" kolonu ve "Kullanılmıyor (0 aktif kullanıcı)" etiketi gösterilir.
- "Orphan" (kullanıcısı olmayan) master data otomatik silinmez — attribute-based rol kuralları henüz atanmamış kullanıcılar için önden tanımlanmış olabilir (bkz. [AUTH-011]).
- Bu yaklaşım kullanıcı verisinden türeyen (DISTINCT) modelin aksine, yeni şirket/lokasyon'un henüz kullanıcısı olmasa bile sisteme eklenebilmesini sağlar (rol kuralı önceden yazılabilir; SAP HR [I-002] entegrasyonunda master data önden senkronize edilebilir).

**Karar [A-012]:** Master data yaşam döngüsü ve oluşturma yöntemleri:
- **Development ortamı:** Seed script'leri ile başlangıç değerleri üretilir (örn: demo şirketler, demo lokasyonlar).
- **Production ortamı — MVP:** Yeni master data **sadece Master Data Yönetimi ekranı üzerinden manuel** eklenir (superadmin veya Kullanıcı Yöneticisi tarafından; bkz. [R-006], [AP-011]). Operasyonel disiplin: yeni kullanıcı eklenmeden önce master data hazır olmalıdır.
- **Production ortamı — MVP sonrası:** SAP HR entegrasyonu ([I-002]) geldiğinde, kullanıcı verisinde geçen ve henüz master data tablosunda bulunmayan kodlar **otomatik oluşturulur**; audit log'a `MASTER_DATA_AUTO_CREATED` aksiyonu yazılır. SAP entegrasyonu aktif olana kadar bu otomatik mekanizma devrede değildir.
- **Excel import özelliği MVP'de YOKTUR** — manuel CSV/Excel toplu kullanıcı yükleme kapsam dışı bırakılmıştır. Toplu ekleme ihtiyacı SAP HR entegrasyonu ile karşılanacaktır.
- Seed script'leri production'da **çalıştırılmaz** (kontrolsüz veri eklenmesini önlemek için).

**Karar [A-013]:** Master data tablolarının minimum alanları:
- `id` (PK, cuid veya uuid)
- `code` (unique, immutable — bir kez atandıktan sonra değiştirilemez; referans bütünlüğü için)
- `name` (güncellenebilir)
- `is_active` (soft-disable için; silme yok)
- `created_at`, `updated_at`, `created_by_user_id`

Kod bir kez atandıktan sonra **değiştirilemez** (kullanıcılarla bağlı referansları kırmamak için). İsim güncellenebilir — güncelleme tek noktadan yapılır, tüm kullanıcı görünümlerinde otomatik güncel gösterilir. Silme yoktur; `is_active=false` ile pasifleştirilir.

**Karar [A-015]:** Çalışma Alt Alanı gibi hiyerarşik master data için ek alan:
- `work_sub_areas` tablosunda `parent_work_area_code` (FK → `work_areas.code`) alanı bulunur.
- Alt alan, üst alanın child'ıdır; parent pasifleştirilirse child'lar da pasifleştirilir (cascade soft-disable).

### 3.4. Kimlik Sağlayıcıları
**Karar [A-007]:** MVP'de yalnızca email + şifre ile giriş desteklenir.

**Karar [A-008]:** MFA/2FA MVP'de yoktur, sonraki aşamada eklenecektir.

**Karar [A-009]:** SSO MVP'de yoktur. İlerleyen aşamada **RedHat SSO** entegrasyonu planlanmaktadır.

---

## 4. Yetkilendirme Mimarisi (RBAC + ABAC Hibrit)

### 4.1. Temel Model
**Karar [AUTH-001]:** Platform **RBAC (Role-Based Access Control) + ABAC (Attribute-Based Access Control) hibrit** modeli kullanır.

### 4.2. Yetki Çözümleme Stratejisi
**Karar [AUTH-002]:** **Runtime yetkilendirme + cache** yaklaşımı benimsenir.

**Gerekçe:** Kullanıcı attribute'ları değiştiğinde (örn. şirket değişimi) yetkilerin otomatik olarak güncellenmesi gerekliliği, snapshot modelini kullanışsız kılar. Runtime çözümleme + cache optimum dengeyi sağlar.

### 4.3. Yetki Çözümleme Servisi
**Karar [AUTH-003]:** Merkezi bir servis: `resolveUserPermissions(userId)`
- Direct rol atamalarını okur
- Attribute-based rol atamalarını çözer
- Tüm rollerin yetkilerinin **union**'ını döndürür

### 4.4. Cache Stratejisi
**Karar [AUTH-004]:** Redis cache kullanılır:
- Key format: `permissions:{userId}`
- TTL: **10 dakika**
- Invalidation tetikleyicileri:
  - Kullanıcı attribute değişimi
  - Kullanıcıya rol atanması/kaldırılması
  - Rol-yetki tablosunda rolün yetkilerinin değişmesi

### 4.5. Middleware Kontrolü
**Karar [AUTH-005]:** Her API endpoint'i yetki kontrolü middleware'inden geçer. Yetkilendirme bypass edilemez.

### 4.6. Çoklu Rol ve Yetki Birleştirme
**Karar [AUTH-006]:** Bir kullanıcıya **birden fazla rol** atanabilir. Yetkiler **union (birleşim)** mantığıyla birleştirilir — hangi rolden gelirse gelsin yetki varsa kullanıcı o yetkiye sahiptir.

### 4.7. Attribute Değişiminin Yetkiye Etkisi
**Karar [AUTH-007]:** Attribute-based rol ataması aktifse ve kullanıcının attribute'u değişirse (örn. şirket değişimi), kullanıcının o attribute üzerinden kazandığı roller **otomatik olarak düşer**. Cache invalidate edilir, sonraki istekte yeni yetki seti hesaplanır.

### 4.8. Yetki Kontrol Katmanları
**Karar [AUTH-008]:** Yetki aşağıdaki tüm katmanlarda tanımlanabilir:
- **Menü / sayfa seviyesi** (kullanıcı ekranı görebilir mi?)
- **Aksiyon seviyesi** (kullanıcı bu işlemi yapabilir mi?)
- **Veri seviyesi** (kullanıcı bu kaydı görebilir mi?)
- **Alan seviyesi** (kullanıcı bu alanı görebilir/düzenleyebilir mi?)

### 4.9. Yetkilerin Kod İçinde Tanımı
**Karar [AUTH-009]:** Yetkiler (permissions) **kod içinde enum** olarak hard-coded tanımlanır. Yeni yetki eklenmesi bir geliştirme işlemidir.

### 4.10. Rol Tanımlarının DB'de Tutulması
**Karar [AUTH-010]:** Roller **dinamik** olarak DB'de tutulur. Rol-Yetki Tablosu ekranından yeni rol oluşturulabilir ve o role kod içindeki mevcut yetkilerden seçilerek atama yapılır.

### 4.11. Kurala Göre Rol Atama Mantığı
**Karar [AUTH-011]:** Rol, kullanıcılara üç yöntemle atanabilir:
1. **Doğrudan kullanıcılara** (tek tek seçilen kişiler)
2. **Attribute bazlı** (örn: Firma=X, Pozisyon=Müdür olan tüm kullanıcılara)

**Karar [AUTH-012]:** Attribute bazlı rol atamasında **hem AND hem OR mantığı desteklenir** — bu karar A-OPEN-01'i kapatır. Kural yapısı:

**Mantıksal model:**
- Bir rol kuralı **bir veya birden fazla koşul seti**'nden (condition set) oluşur.
- Her koşul seti **AND** ile bağlı koşulları içerir.
- Koşul setleri birbirine **OR** ile bağlanır.
- Formül: `(koşul1 AND koşul2 AND ...) OR (koşul3 AND koşul4 AND ...) OR ...`

**Örnek kural — "Üretim Müdürleri" rolü:**
```
Koşul Seti 1:  Şirket = ABC      AND  Pozisyon = Müdür     AND  Çalışma Alanı = Üretim
    OR
Koşul Seti 2:  Şirket = XYZ      AND  Pozisyon = Direktör  AND  Departman = Üretim
    OR
Koşul Seti 3:  Lokasyon = Ankara AND  Kademe = L5
```

Bu 3 koşul setinden herhangi birini sağlayan kullanıcı otomatik olarak "Üretim Müdürleri" rolüne sahip olur.

**Karar [AUTH-013]:** Attribute bazlı rol kural yapısı — DB şeması:
- `role_rules` tablosu: `id`, `role_id` (FK), `order` (kural değerlendirme sırası)
- `role_rule_condition_sets` tablosu: `id`, `role_rule_id` (FK), `order`
- `role_rule_conditions` tablosu: `id`, `condition_set_id` (FK), `attribute_key` (enum — `company_id`, `location_id`, `department_id`, `position_id`, `level_id`, `team_id`, `work_area_id`, `work_sub_area_id`, `employee_type`), `operator` (enum — `equals`, `not_equals`, `in`, `not_in`), `value` (string veya JSON array)

**Kural eşleşme algoritması (yetki çözümleme servisi — [AUTH-003]):**
```typescript
function userMatchesRole(user, role): boolean {
  if (role.directly_assigned_users.includes(user.id)) return true;
  for (const rule of role.rules) {
    for (const conditionSet of rule.conditionSets) {  // OR
      const allConditionsMatch = conditionSet.conditions.every(  // AND
        cond => evaluateCondition(user, cond)
      );
      if (allConditionsMatch) return true;
    }
  }
  return false;
}
```

**UI — Rol Yönetimi ekranında kural oluşturma:**
- "Kural Ekle" butonu → yeni koşul seti eklenir (ilk koşul seti "Kural 1" olarak görünür).
- Her koşul seti içinde "+ Koşul Ekle" ile AND koşulları eklenir (attribute dropdown + operator + değer seçimi).
- Koşul setleri arasında büyük "VEYA" ayracı görünür (UX netliği).
- Koşul seti silme, tekrar sıralama (drag & drop) desteklenir.
- "Kuralı Test Et" butonu → eşleşen kullanıcı sayısını ve örnek 10 kullanıcıyı gösterir (gerçek uygulamadan önce doğrulama).

**Karar [AUTH-014]:** Kural değerlendirme performansı:
- Attribute değişiminde [AUTH-007] cache invalidate edilir; sonraki istek'te kurallar yeniden değerlendirilir.
- Bulk kullanıcı güncelleme (SAP senkron, toplu attribute değişimi) sonrası `role_recomputation` queue job'u tetiklenir; tüm etkilenen kullanıcıların rol eşleşmeleri BullMQ worker'da yeniden hesaplanır.
- Rol kural değişikliği (UI'da kaydet) tetiklenirse tüm kullanıcılar için async job çalışır; büyük ölçekte bu dakikalar sürebilir — UI kullanıcıyı bilgilendirir ("Kural değişikliği uygulandı, kullanıcılara yansıtılıyor, tamamlanınca bildirim alacaksınız").

### 4.12. Kendi Rolünü Değiştirme Kısıtı
**Karar [AUTH-015]:** "Rol ve Yetki Yöneticisi" rolüne sahip kullanıcı, **kendi rolünü değiştiremez**. Bu kısıt self-lockout riskini azaltır. Superadmin her zaman kurtarıcı olabilir.

---

## 5. Roller ve Yetki Yönetimi

### 5.1. Sistem Rolleri
**Karar [R-001]:** Sistemde aşağıdaki **sistem rolleri** (built-in, silinemez) bulunur:
- **Superadmin** — env'de tanımlı, tek kişi, her yetkiye sahiptir, tüm kurtarıcı aksiyonları yapabilir
- **Rol ve Yetki Yöneticisi** — rol tanımlarını yönetir, rollere yetki atar, kullanıcılara rol atar
- **Kullanıcı Yöneticisi** — kullanıcıları CRUD eder, kullanıcı attribute'larını günceller (yeni kullanıcı ekleme, attribute düzeltme, aktif/pasif durum)
- **Süreç Yöneticisi** — Süreç Yönetimi Paneli'ne erişir; süreç izleme, iptal ve rollback aksiyonlarını yapabilir (bkz. Bölüm 9)

**Karar [R-002]:** Yukarıdaki sistem rolleri dışındaki tüm roller **dinamik** olarak oluşturulabilir. Sistem rolleri kod içinde enum olarak tanımlıdır ve silinemez; ancak bu rollerin hangi kullanıcılara atandığı Rol Yönetimi ekranından yönetilir.

**Karar [R-005]:** Kullanıcı attribute güncellemesi yapabilecek roller: **Superadmin** ve **Kullanıcı Yöneticisi**. Hiçbir kullanıcı kendi attribute'larını (sicil, şirket, lokasyon, pozisyon vb.) kendi başına değiştiremez.

**Karar [R-006]:** Master Data (şirket, lokasyon, pozisyon vb. listeler) yönetimi yapabilecek roller: **Superadmin** ve **Kullanıcı Yöneticisi**. (Master data değişikliği kullanıcı attribute'larını etkilediğinden aynı yetki ekseninde toplanmıştır.)

### 5.2. Yönetim Ekranları
**Karar [R-003]:** Rol ve yetki yönetimi üç ayrı ekran üzerinden yapılır:

1. **Kullanıcı Yönetimi** — Kullanıcıların CRUD'u, attribute güncellemesi
2. **Rol Yönetimi** — Mevcut rollerin kullanıcı içeriklerinin yönetildiği ekran (kime hangi rol atanmış?) Roller kullanıcıya veya kullanıcılara, bir veya birden fazla kullanıcı attribute'una 
3. **Rol-Yetki Tablosu** — Yeni rol yaratılır, rollerin sahip olduğu yetkiler burada tanımlanır. (Yetkiler ve yetkilerin sınırlamaları hardcoded olarak geliştirilir. Örnek: Raporlama yetkisi: Raporlar sayfasına erişim sağlar.)

### 5.3. Rol-Yetki Tablosu UX Akışı
**Karar [R-004]:** Rol-Yetki Tablosu ekranında:
- Roller liste olarak görünür
- Bir rol seçildiğinde içindeki yetkiler listelenir
- Yetki ekleme / çıkarma işlemi yapılabilir
- Yeni rol yaratılabilir



---

## 6. Süreç (Workflow) Mimarisi

### 6.1. Süreç Tanım Stratejisi
**Karar [W-001]:** Süreçler **hard-coded** olarak geliştirilir. Low-code süreç tasarımcısı **kapsam dışıdır**.

### 6.2. MVP Süreci
**Karar [W-002]:** MVP'de sadece tek bir süreç yer alır: **Before & After Kaizen**.

### 6.3. Süreçlerin Dokümantasyonu
**Karar [W-003]:** Her süreç için ayrı bir `.md` dokümantasyon dosyası oluşturulur. Süreç ilk geliştirilmeye başlamadan önce bu dosya doldurulur: adımlar, onay akışı, form alanları, atama kuralları vb.

> **⚠️ Açık Karar [W-OPEN-01]:** `before-after-kaizen-process.md` dosyası oluşturulacak ancak içerik boş bırakılacak. Süreç geliştirilmeye başlandığında detaylar doldurulacak. (Bkz. [Bölüm 18](#18-açık-kararlar--tamamlanması-gerekenler))

### 6.4. Form Motoru
**Karar [W-004]:** Form alanları **statik** olarak kodlanır. Dinamik form tasarımcısı kapsam dışıdır.

### 6.5. Görev Atama Kuralları
**Karar [W-005]:** Süreç adımlarındaki görev atamaları hem **statik** (örn: "bu adımda fabrika müdürü onaylar") hem **dinamik** (örn: "başlatanın yöneticisi onaylar") olabilir. Her süreç kendi atama kurallarını belirler.

### 6.6. Süreç-Şirket İlişkisi
**Karar [W-006]:** Süreçler şirket bilgisini şöyle taşır:
- Varsayılan olarak **süreci başlatan kullanıcının şirket bilgisi** kullanılır
- Süreçte çoklu şirket seçimi gerekiyorsa kullanıcıya form içinde seçenek sunulur
- Seçilebilecek seçenekler form tanımında kısıtlanır

### 6.7. Onay Akışı Desenleri
**Karar [W-007]:** Sistem şu akış desenlerini destekleyecek altyapıya sahip olmalıdır (her süreç kendi ihtiyacı kadarını kullanır):
- Sıralı onay
- Paralel onay
- Koşullu dallanma
- Delegasyon
- Geri gönderme / revizyon isteme
- Otomatik onay (timeout)

> **⚠️ Açık Karar [W-OPEN-02]:** Görev reddedildiğinde süreç davranışı — bir önceki adıma dönme, alternatif akış, başlatana bildirim — süreç başına ayrı tanımlanacak olan .md dosyasında tariflenecektir.

---

## 7. Görev Yönetimi

### 7.1. Görev Kaynağı
**Karar [T-001]:** Görevler **sadece süreçlerden** doğar. Serbest (ad-hoc) görev oluşturma kapsam dışıdır.

### 7.2. Görev Bağımlılıkları
**Karar [T-002]:** Süreç tanımına göre görevler **sıralı** (bir silsile içinde) veya **paralel** olabilir.

### 7.3. Görev Atama Kapsamı
**Karar [T-003]:** Bir görev şu hedeflere atanabilir:
- Kişi veya kişier
- Rol
- Kombinasyonlar mümkün

**Karar [T-004]:** Görev atama davranış modları desteklenmelidir:
- **Claim (kapma):** Birden fazla aday vardır, ilk claim eden üstlenir
- **All-required:** Atanan herkesin onayı / tamamlaması gerekir
**Not** - Zaten görev bir kişiye atanıyorsa bu davranışlara gerek yoktur. Bir kişi görevi tamamlar ve sıradaki adıma geçer.

### 7.4. Görev SLA ve Gecikme
**Karar [T-005]:** Görevlerin deadline / SLA takibi yapılır. Gecikme hatırlatma bildirimleri üretilir. Mail bildirim yapılacaktır. Sistem ayarları sayfası üzerinde mail şablonu da olmalıdır. 

### 7.5. Kullanıcı Görev Ekranı
**Karar [T-006]:** Kullanıcının görev ekranları şu sekmelere sahiptir:
- Başlattığım Süreçler 
- Onayda Bekleyen
- Tamamlanan Süreçler
** Not: Görev ekranlarında tarih ve süreç filtresi olmalıdır. Liste halinde süreçleri id, başlatan, başlangıç+bitiş tarihi, statü, aktif görev bilgileri görünebilmelidir. Listeden seçildiğinde sürecin farklı görev adımlarındaki formalarına ve detay bilgilerine ulaşabilmelidir görüntüleyebilmelidir.

### 7.6. Claim Sonrası Davranış
**Karar [T-007]:** Çoklu adaylı (claim tipi) bir görev bir kullanıcı tarafından claim edildiğinde:
- Görev tamamlandığında **diğer adayların "Onayda Bekleyen" listesinden düşer**.
- Diğer adaylar sürecin detayını (izleme amaçlı) — sadece o süreç için görüntüleme yetkileri varsa — normal süreç görüntüleme ekranı üzerinden görebilir; ancak o görev adımı artık "başkası tarafından tamamlandı" şeklinde işaretlidir ve kendileri için aksiyon alınabilir bir görev değildir.

### 7.7. All-Required Modu ve Reddetme Davranışı
**Karar [T-008]:** **All-required modundaki kısmi onay davranışı**, **görev reddi sonrası akış**, **başkasına delegasyon / atama** ve **escalation davranışları** her süreç için ayrı tanımlanır ve her sürecin kendi `.md` dokümantasyon dosyasında (`docs/processes/{process-name}.md`) anlatılır. Bu davranışlar ilgili süreç geliştirilirken **hardcoded** olarak implemente edilir. Sistem genelinde jenerik bir "reddet" veya "escalate" davranışı **yoktur** — davranış süreç başına belirlidir.

### 7.8. Süreç Başlatanın Görünürlüğü
**Karar [T-009]:** Süreci başlatan kullanıcı, **kendi başlattığı süreçlerin** tüm adımlarındaki form ve doküman detaylarını (kendisine atanmamış olsalar bile) görüntüleyebilir. Bu varsayılandır — bir sürecin `.md` dosyasında aksi açıkça belirtilmediği sürece geçerlidir. Bir kullanıcı, **kendisinin başlatmadığı** süreçleri (kendisine atanmış bir görev yoksa) göremez.

### 7.9. Görev Yorumları
**Karar [T-010]:** Görev yorumları, thread, @mention gibi işbirliği özellikleri **MVP kapsamı dışındadır**. Bildirim ve değerlendirme iletişimi süreç formu içindeki alanlar ve email bildirimleri üzerinden kurulur.

### 7.10. SLA ve Gecikme Bildirim Konumu
**Karar [T-011]:** Her sürecin adımlarına ait **SLA süreleri** ve **gecikme bildirim tetikleme eşikleri** (örn: %80 eşik hatırlatma, %100 eşik gecikme bildirimi) ilgili sürecin `.md` dokümantasyon dosyasında tanımlanır. Sistem, süreç tanımından okuduğu bu konfigürasyona göre zamanlama ve bildirimleri üretir. Genel (global) bir varsayılan SLA yoktur.

---

## 8. Doküman Yönetimi

### 8.1. Depolama Altyapısı
**Karar [D-001]:** Dokümanlar **Amazon S3** üzerinde depolanır. Meta veri (dosya adı, boyutu, yükleyici, yüklenme zamanı, ilişkili süreç/görev vb.) DB'de tutulur.

### 8.2. Yükleme Kısıtları
**Karar [D-002]:** Dosya yükleme kuralları:
- **Maksimum boyut:** 10 MB / dosya
- **İzin verilen formatlar:** Resim, PDF, Excel, Word
- **Kullanıcı / süreç başına toplam limit:** Yok

### 8.3. S3 Key Yapısı
**Karar [D-003]:** S3'te dosya key formatı:
```
processes/{processId}/{taskId}/{documentId}-{filename}
```

### 8.4. Erişim Kontrolü
**Karar [D-004]:** Doküman erişim modeli **süreç seviyesi**dir. Yani süreci görüntüleme yetkisi olan kullanıcı, o sürecin dokümanlarını da görebilir.

### 8.5. Thumbnail Üretimi
**Karar [D-005]:** Yüklenen resimler için **thumbnail** üretilir.

### 8.6. Versiyonlama
**Karar [D-006]:** Doküman versiyonlama **MVP'de yoktur**. Aynı dosya tekrar yüklenirse ayrı bir doküman olarak kaydedilir.

### 8.7. Doküman Erişim Mimarisi (CloudFront + 7 Katman Defense-in-Depth)
**Karar [D-007]:** Doküman erişimi (download / önizleme / upload) **CloudFront tabanlı 7 katmanlı defense-in-depth** modeli ile korunur. S3 bucket'a **doğrudan hiçbir erişim yoktur**; sadece uygulamanın oturum-bağlı, IP-bağlı, kısa ömürlü imzalı URL'leri üzerinden CloudFront-OAC sandviçi ile erişim mümkündür.

**Üst düzey mimari:**
```
Kullanıcı → Backend: yetki kontrolü + IP tespiti + Signed URL & Signed Cookie üretimi
Backend  → Kullanıcı: imzalı CloudFront URL (5dk TTL, IP-bound) + Signed Cookie (httpOnly)
Kullanıcı → CloudFront (WAF + GeoIP + Rate Limit + Bot Control + CAPTCHA + CFF Edge)
         → S3 (OAC, SSE-KMS, private)
```

---

**Katman 1 — S3 Bucket Lockdown (Zemin)**
- Bucket policy: **sadece CloudFront OAC (Origin Access Control)** okuyabilir. `Deny` kuralı: public, IAM user, S3 presigned URL, cross-account dahil **tüm diğer principal'lar**.
- `Block Public Access` ayarları tamamen aktif.
- Bucket versioning açık (yanlışlıkla silme koruması).
- HTTPS zorunlu: `"aws:SecureTransport": "true"` condition'ı olmayan her istek reject.
- SSE-KMS zorunlu: `"s3:x-amz-server-side-encryption": "aws:kms"` condition'ı olmayan her PUT reject (bkz. Katman 6).

**Katman 2 — IP-Bound CloudFront Signed URL**
- Backend Signed URL üretirken **kullanıcının mevcut request IP'sini** policy'ye gömer:
  ```json
  {
    "Statement": [{
      "Resource": "https://cdn.app/processes/42/task/7/doc.pdf",
      "Condition": {
        "DateLessThan": { "AWS:EpochTime": <now+300> },
        "IpAddress":    { "AWS:SourceIp": "<user_ip>/32" }
      }
    }]
  }
  ```
- **TTL: 5 dakika** (upload ve download için aynı).
- Private key: AWS KMS veya Secrets Manager'da saklı; backend runtime'da çekip imzalar.
- URL her istek için yeni üretilir; **cache edilmez**; CloudFront cache TTL=0.
- Etki: URL sızsa dahi farklı IP'den açılamaz → CloudFront 403 döner. Slack forward, corporate proxy log, browser history saldırı yüzeylerinin %90'ını kapatır.

**Katman 3 — CloudFront Signed Cookie (Path-Scoped)**
- Login sonrası backend, kullanıcıya CloudFront için **Signed Cookie** set eder:
  - `HttpOnly` — JavaScript okuyamaz (XSS korumalı)
  - `Secure` — sadece HTTPS
  - `SameSite=Strict` — cross-site iliştirilmez (CSRF korumalı)
  - `Path=/processes/*` — sadece doküman yollarında etkili
  - Süre: access token süresi ile eşleşir (15dk; refresh'le yenilenir — bkz. [TS-009])
- Her doküman isteğinde Signed Cookie otomatik iliştirilir; ek bir URL parametresi gerekmez.
- Etki: Tam URL kopyalansa dahi başka browser'da cookie olmadığı için çalışmaz. URL + Cookie iki ayrı kanaldan doğrulama yapar (Katman 2 ile birleştirilince).

**Katman 4 — WAF Agresif Rate Limiting + CAPTCHA**
- **GeoIP kısıtı:** Sadece Türkiye (`TR`) + whitelisted kurumsal yönetim IP'leri. Diğer ülke → 403.
- **IP rate limit:** IP başına **30 request / 1 dakika**. Aşan IP → 5dk otomatik blok.
- **User rate limit:** JWT `sub` claim'inden kullanıcı çıkarılarak **kullanıcı başına 50 request / 5 dakika**. Aşan kullanıcı token revoke + email uyarı.
- **CAPTCHA Challenge:** Rate limit ikinci kez ihlal edildiğinde AWS WAF `Captcha` action devreye girer — bot'lar JS challenge'ı geçemez.
- **Bot Control:** AWS Managed Rules `AWSManagedRulesBotControlRuleSet` (Common + Targeted seviyeleri).
- **Known Bad IP List:** `AWSManagedRulesAmazonIpReputationList` + `AWSManagedRulesAnonymousIpList` (VPN, TOR, proxy otomatik bloklanır).

**Katman 5 — Referer Whitelist (İkincil Savunma)**
- WAF kuralı: `request.path` `/processes/*` veya `/staging/*` pattern'inde ise, `Referer` header'ı uygulamanın resmi domain'ini içermelidir. Yoksa 403.
- Not: Referer spoof edilebilir — bu **ana güvenlik katmanı değil**, casual saldırıları (embed, hotlink, naive scripting) filtreler. Defense-in-depth'in bir sapkasıdır.

**Katman 6 — CloudFront Functions (Edge Validation)**
- Her request CloudFront edge'de CFF ile sub-millisecond süzgeçten geçer:
  ```javascript
  function handler(event) {
    var req = event.request;
    // 1. CSRF / uygulama token header kontrolü
    if (!req.headers['x-app-token']) return { statusCode: 403 };
    // 2. Path traversal engelleme
    if (req.uri.indexOf('..') !== -1) return { statusCode: 403 };
    // 3. Sadece izin verilen uzantılar
    if (!req.uri.match(/\.(pdf|jpg|jpeg|png|webp|xlsx|docx)$/i)) return { statusCode: 403 };
    return req;
  }
  ```
- Backend yükü **sıfır** — süzgeç edge'de çalışır, S3'e ulaşmadan reddedilir.

**Katman 7 — SSE-KMS Encryption at Rest**
- Tüm S3 objeleri **AWS KMS ile şifreli** saklanır (SSE-KMS, AES-256).
- KMS Customer Managed Key (CMK), key policy ile yalnızca:
  - Scan Lambda IAM role (upload sonrası tarama için okur/yazar)
  - Uygulama backend IAM role (meta veri okuma — S3 objesini okuma değil; CloudFront erişir)
  - CloudFront OAC service principal (kullanıcıya stream için)
  kullanabilir. Diğer tüm principal'lar için `Deny`.
- Key rotation: AWS KMS otomatik yıllık rotation açık.
- Etki: S3 objesi fiziksel katmanda (AWS disk backup dahil) çalınsa KMS key olmadan okunamaz.

**Katman 8 — Anomali Tespiti ve Otomatik Cevap**
- CloudFront access log + WAF metrics → CloudWatch → EventBridge → Lambda handler.
- Alarm kuralları ve otomatik aksiyonlar:

| Pattern | Eşik | Otomatik Aksiyon |
|---|---|---|
| WAF blok frekansı | Dakikada 50+ | Slack alarm + superadmin email |
| Tek kullanıcıdan hızlı download | 10dk içinde 100+ dosya | Kullanıcı token revoke + email uyarı + 1 saat cooldown |
| Yurt dışı IP'den başarılı login attempt | 1 olay | Critical alert, IP otomatik WAF IPSet'e eklenir (kalıcı ban) |
| KMS decrypt failure | 5+ olay / 5dk | Security incident channel'a alarm |
| `staging/` prefix'ine yetkisiz PUT attempt | 1+ olay | IP ban + superadmin alert |

- Otomatik banlanan IP'ler WAF Managed IPSet'e eklenir; superadmin admin panelinden görüntüler ve gerekirse kaldırır.

---

**Upload Akışı:**
- Backend, kullanıcının IP'sini tespit edip CloudFront Signed URL (IP-bound, 5dk TTL) üretir — `staging/` prefix'i için PUT yetkili.
- Staging prefix'i de CloudFront OAC arkasındadır; doğrudan S3 PUT mümkün değildir.
- Upload sonrası [D-008] ClamAV tarama akışı devreye girer.

**Upload endpoint özel WAF kuralı:** PUT request'leri sadece Content-Type whitelist (image/jpeg, image/png, image/webp, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet) kabul eder.

---

**Audit ve Monitoring:**
- CloudFront access log → S3 (30 gün) + CloudWatch Logs (7 gün hot).
- WAF bloklanan istekler ayrı metrik.
- Uygulama her Signed URL / Signed Cookie üretim isteğini audit'e yazar (upload için; download için [D-010] gereği yazılmaz).
- KMS her encrypt/decrypt operation'ı CloudTrail'e otomatik loglanır.

---

**Saldırı Modeli — 8 Katman Sonrası:**

| Saldırı Senaryosu | Engelleyen Katman(lar) |
|---|---|
| S3 URL'i bilinse bile direkt erişim | Katman 1 (Bucket Lockdown) |
| Signed URL Slack'te paylaşılsa | Katman 2 (IP-bound) + Katman 3 (Cookie eksik) |
| Tam URL başka bilgisayardan açılsa | Katman 2 + Katman 3 |
| Corporate proxy log'undan URL sızıntısı | Katman 2 + Katman 3 |
| Browser history'den erişim (başka user) | Katman 3 (Cookie yok) |
| Yurt dışından saldırı | Katman 4 (GeoIP) |
| Bot scraper / toplu indirme | Katman 4 (Rate limit + CAPTCHA + Bot Control) |
| VPN / TOR / proxy arkasından erişim | Katman 4 (AnonymousIpList) |
| Embed / hotlink saldırısı | Katman 5 (Referer) |
| Path traversal, exploit payload | Katman 6 (CFF edge validation) |
| S3 fiziksel çalınma (AWS internal dahil) | Katman 7 (SSE-KMS) |
| Yetkili kullanıcıdan hızlı anomalik download | Katman 8 (token revoke + cooldown) |
| Saldırı pattern'i ilk kez görülse | Katman 8 (otomatik ban + alert) |

**Mutlak engellenemez tek senaryo:** Yetkili kullanıcının kendi oturumundan dosyayı açıp ekran görüntüsü alması. Bu DLP (Data Loss Prevention) konusudur ve herhangi bir web güvenlik katmanıyla engellenemez — endpoint DLP yazılımları (Forcepoint, Symantec DLP vb.) ile ayrıca azaltılabilir; MVP kapsamı dışındadır.

---

**Teknik Notlar:**
- CloudFront distribution: tek distribution, origin = private S3 bucket (OAC ile).
- CloudFront cache behavior: `/processes/*` ve `/staging/*` path'leri için cache TTL=0, min TTL=0.
- CAPTCHA challenge frontend'de shadcn/ui Dialog içinde AWS CAPTCHA JS SDK ile gösterilir.
- Frontend, 5dk içinde kullanıcı dosyayı açamazsa yeni URL+Cookie talep eder (re-fetch). React Query staleTime=4dk.
- IP değişirse (mobile WiFi geçişi) kullanıcı bir sonraki istek'te yeni URL alır; kesintisiz UX.
- CloudFront Functions cold start yok (V8 isolate), <1ms latency.
- Bu mimari **tüm 8 katmanı config-based** olarak kurar (Terraform / CDK); kod değişikliği gerekmez. Bir katman sorun yaratırsa tek satır config ile devre dışı bırakılır.

### 8.8. Virüs / Malware Taraması
**Karar [D-008]:** Tüm yüklenen dosyalar **asenkron quarantine pattern** ile taranır. Senkron tarama yapılmaz — upload UX'i ve API sunucu performansı etkilenmemelidir.

**Mimari akış:**
1. Kullanıcı dosyayı **CloudFront Signed URL** ile (bkz. [D-007]) `staging/` prefix'ine yükler; key: `staging/{processId}/{taskId}/{documentId}-{filename}`. `staging/` prefix'i de CloudFront OAC arkasındadır; doğrudan S3 PUT mümkün değildir.
2. DB'de `document` kaydı oluşur; `scan_status = PENDING_SCAN`.
3. S3 `ObjectCreated` event → EventBridge → **Scan Lambda** (ClamAV image) tetiklenir.
4. Lambda dosyayı tarar:
   - **Temiz:** Dosya `staging/` → `processes/{processId}/{taskId}/{documentId}-{filename}` key'ine taşınır; DB `scan_status = CLEAN`.
   - **Enfekte:** Dosya S3'ten silinir; DB `scan_status = INFECTED`; yükleyen kullanıcıya bildirim gönderilir; audit log yazılır.
   - **Hata / timeout:** `scan_status = SCAN_FAILED`; DLQ (SQS) üzerinden manuel inceleme kuyruğuna düşer.
5. Frontend, `scan_status = CLEAN` olmadıkça dosya için download/önizleme **CloudFront Signed URL** üretmez (bkz. [D-007]). Upload sonrası kullanıcı ekranında "Dosya taranıyor…" rozeti görünür; status TanStack Query refetch (5 sn interval, max 60 sn) ile güncellenir.

**Teknik notlar:**
- Lambda image: ClamAV bundled, `freshclam` ile güncel definition'lar (pre-warmed image tercih edilir; cold start tarama süresini uzatır).
- Lambda memory: 2048 MB (ClamAV bellek-yoğun).
- Lambda timeout: 5 dakika (10 MB dosya limiti ile bolca yeterli).
- S3 bucket event: `s3:ObjectCreated:*` + prefix filter `staging/`.
- IAM: Lambda'nın `staging/*` üzerinde `s3:GetObject` + `s3:DeleteObject`; `processes/*` üzerinde `s3:PutObject` yetkisi vardır.
- DLQ: SQS — tarama başarısız dosyalar için manuel süperadmin incelemesi.
- Definition güncelleme: Lambda cold start'ta `freshclam`; sıcak instance'larda tekrar tetiklemek için CloudWatch scheduled event (günde 1×).
- MVP sonrası opsiyon: ClamAV yerine AWS Marketplace'ten **Trend Micro / Sophos** gibi yönetilen tarama servisine geçiş (tek satırlık Lambda image değişikliği).

### 8.9. Doküman Önizleme (In-App Görüntüleme)
**Karar [D-009]:** Dokümanlar indirilmeden in-app önizlenebilir. Dosya tipine göre farklı component'ler kullanılır:

| Tip | Component / Yöntem | Notlar |
|---|---|---|
| Resim (jpg/png/webp) | Native `<img>` + lightbox | shadcn/ui Dialog içinde |
| PDF | **`react-pdf`** (pdf.js wrapper) | Client-side render; sayfa sayfa, zoom, download butonu |
| Word (.docx) | **`mammoth.js`** ile HTML'e convert → render | Sadece içerik metni + temel format; karmaşık layout kayıpla gösterilir. `.doc` (eski format) desteklenmez |
| Excel (.xlsx) | **SheetJS (xlsx)** + **TanStack Table** ile grid render | Formüller hesaplanmaz, ham değerler gösterilir; sayfa sekmeleri tab'larla |

- Tüm önizlemeler **client-side**'da yapılır — dosya CloudFront Signed URL ([D-007]) ile browser'a iner, backend'e ek yük olmaz.
- Her önizleme component'inin yanında her zaman bir **"İndir"** butonu bulunur.
- Dosya boyutu > 10 MB senaryosu yok ([D-002]) → client-side render güvenli.
- `.doc` (eski Word), `.xls` (eski Excel), `.ppt` gibi eski formatlar desteklenmez — [D-002]'deki "Word, Excel" tanımı `.docx` ve `.xlsx` ile sınırlıdır.

### 8.10. Upload Audit Logu
**Karar [D-010]:** Doküman **upload** aksiyonları audit log'a yazılır:
- Aksiyon: `DOCUMENT_UPLOAD`
- Alanlar: kullanıcı, processId, taskId, documentId, dosya adı, dosya boyutu, `scan_status` (nihai)
- Tarama sonucu (CLEAN / INFECTED) nihai olduğunda ayrı bir audit kaydı da üretilir (`DOCUMENT_SCAN_RESULT`).

Doküman **download** / **önizleme** aksiyonları **audit log'a yazılmaz**. (Her CloudFront Signed URL üretimi ayrı bir kayıt doğursa audit tablosu hızla şişerdi; erişim kontrolü süreç-seviyesinde [D-004] zaten sağlanıyor, ayrıca CloudFront access log'ları [D-007] CloudWatch'ta ayrıca tutuluyor.)

### 8.11. KVKK Silme ve Anonimleştirme
**Karar [D-011]:** KVKK kapsamında doküman silme ve anonimleştirme talebi karşılama **MVP kapsamı dışındadır**. İleride eklenecek. MVP'de doküman silme ve kullanıcı verisi anonimleştirme API'leri veya ekranları bulunmaz. Yasal bir talep gelirse manuel operasyonel süreç ile karşılanır (DB ve S3 üzerinde superadmin müdahalesi).

---

## 9. Admin Panelleri

### 9.1. Süreç Yönetimi Paneli (Superadmin)
**Karar [AP-001]:** Süreç Yönetimi Paneli oluşturulur. Bu panelde:

- Başlatılmış tüm süreçler **processId** ile listelenir. processId uygulama genelinde global'dir ve +1 şeklinde artar.
- Süreçler listesinde görünür: processId, talep sahibi, başlangıç ve bitiş zamanı, statü
- Süreç detayında görünür: processId, talep sahibi, başlangıç ve bitiş zamanı, statü, tüm süreç tarihçesi (görev geçmişi).
- Görev Geçmişindeki herhangi bir göreve tıklandığında: Göreve ait form detayları, varsa dokümanlar.

**Karar [AP-002]:** Panel üzerinden alınabilecek aksiyonlar:
- **Süreç İptal** (ProcessCancel)
- **Rollback** — herhangi bir önceki adıma geri götürme

**Karar [AP-003]:** **Süreç silme özelliği YOKTUR.** İptal (cancel) yeterlidir. Veri kaybı riskini önler, audit için veri korunur.

**Karar [AP-007]:** Süreç Yönetimi Paneli'ne yalnızca iki rol erişebilir: **Superadmin** ve **Süreç Yöneticisi** (bkz. [R-001]). Diğer hiçbir rol, kullanıcılar kendi başlattıkları süreçler dışında başkasının süreçlerini göremez.

### 9.2. İptal ve Rollback Detayları
**Karar [AP-004]:** Süreç İptal ve Rollback işlemleri için **gerekçe (reason) alanı zorunludur**. Gerekçe audit log'a yazılır.

**Karar [AP-005]:** Rollback davranışı:
- Süreç herhangi bir önceki adıma geri götürülebilir.
- Rollback tetiklendiğinde, geri dönülen adımdan itibaren **görev atamaları süreç tanımına göre yeniden hesaplanır** (orijinal görev sahiplerine eski görev geri düşmez; o an geçerli atama kuralı neyse ona göre atanır).
- Rollback öncesi tamamlanmış olan adımlar ve bu adımlara ait formlar / dokümanlar **kalıcı olarak DB'de ve S3'te saklanır** (görünürlük ve denetim için silinmez).
- Kullanıcıya gösterilen süreç tarihçesinde bu "eski" adımlar **gösterilmez**; kullanıcıya o an geçerli temiz akış görünür.
- Süreç Yönetimi Paneli'nde ve audit'te tüm tarihçe görünür.

**Karar [AP-008]:** Süreç İptal sonrası görünüm:
- İptal edilen bir süreç, başlatan kullanıcının "Başlattığım Süreçler" listesinde **görünmez**.
- İptal edilen sürecin dahil olduğu diğer kullanıcıların "Onayda Bekleyen" listesinden düşer.
- Süreç verisi DB'de saklanmaya devam eder (denetim ve audit için); sadece kullanıcı ekranlarından görünmez hale gelir.
- Süreç Yönetimi Paneli'nde "İptal" statüsü ile görünür ve erişilebilir kalır.

**Karar [AP-009]:** İptal gerekçesi kullanıcılara **görünmez**. Yalnızca audit log ve Süreç Yönetimi Paneli'nde (Superadmin / Süreç Yöneticisi) görüntülenebilir. Kullanıcıya süreç iptal edildiğinde ekranda gerekçe gösterilmez; sadece "süreç iptal edildi" bilgisi ya da süreci hiç listede göstermeme davranışı uygulanır.

### 9.3. Panel Arama Özelliği
**Karar [AP-006]:** Süreç Yönetimi Panelinde süreç numarası ile süreç tipi ile (MVP'de bir adet süreç var, Before After Kaizen), tarih aralığı (başlatılma tarihi) ile filtreleme yapılabilir.

### 9.4. Audit Log Görüntüleme Ekranı
**Karar [AP-010]:** **Audit Log görüntüleme ekranı** admin panelinde yer alır. Erişim **yalnızca Superadmin** ile sınırlıdır. Diğer hiçbir rol (Süreç Yöneticisi, Kullanıcı Yöneticisi, Rol ve Yetki Yöneticisi dahil) bu ekranı göremez.
- Ekranda tüm audit kayıtları listelenir (bkz. [AUD-003]): userId, timestamp, action, entity, entityId, eski/yeni değer, IP, user agent.
- Filtreleme: kullanıcı, aksiyon tipi, entity tipi, tarih aralığı, IP.
- Export: CSV indirme — 1 yıllık saklama süresi dolmadan dışa aktarma ihtiyacı için.
- Kayıtlar **read-only**'dir; bu ekran üzerinden silme / düzenleme mümkün değildir ([AUD-001] + [AUD-OPEN-1] append-only kararı netleştiğinde DB seviyesinde de zorlanır).

### 9.5. Master Data Yönetimi Ekranı
**Karar [AP-011]:** **Master Data Yönetimi ekranı** (bkz. [A-011]), kullanıcı attribute değerlerinin (sabit listelerin) yönetildiği admin ekranıdır. Her master data tipi ayrı bir DB tablosu olarak tutulur; kullanıcı tablosu bu tablolara **foreign key ile** bağlanır (referential model — [A-011]). Ekran aşağıdaki master data tiplerini yönetir:

| Tip | DB Tablosu | Alanlar | Not |
|---|---|---|---|
| Şirketler | `companies` | `id`, `code`, `name`, `is_active` | Kullanıcı [A-005]'teki "Şirket Adı/Kodu" |
| Lokasyonlar | `locations` | `id`, `code`, `name`, `is_active` | Kullanıcı "Lokasyon Adı/Kodu" |
| Departmanlar | `departments` | `id`, `code`, `name`, `is_active` | |
| Kademeler | `levels` | `id`, `code`, `name`, `is_active` | Kullanıcı "Kademe / Kademe Kodu" |
| Pozisyonlar | `positions` | `id`, `code`, `name`, `is_active` | |
| Ekipler | `teams` | `id`, `code`, `name`, `is_active` | |
| Çalışma Alanları | `work_areas` | `id`, `code`, `name`, `is_active` | |
| Çalışma Alt Alanları | `work_sub_areas` | `id`, `code`, `name`, `parent_work_area_code`, `is_active` | Alt alan üst alana bağlıdır (bkz. [A-015]) |

**Karar [AP-012]:** Master Data Yönetimi ekran akışı:
- Sekmeli layout (her tip için ayrı sekme).
- Her sekmede tablo kolonları: **Kod, İsim, Durum (Aktif/Pasif), Kullanıcı Sayısı, Aksiyon (düzenle / pasifleştir-aktifleştir)**.
- **Kullanıcı Sayısı kolonu:** Her satır için o an **bu master data'yı kullanan aktif kullanıcı sayısı** gösterilir (runtime `COUNT(*) WHERE users.is_active = true`). Sayı 0 ise "Kullanılmıyor" rozeti ile işaretlenir.
- **Filtreleme seçenekleri:**
  - "Tümü" (default)
  - "Sadece aktif" (`is_active = true`)
  - "Sadece pasif" (`is_active = false`)
  - "Kullanılmayanlar" (orphan: `users_count = 0` — superadmin temizlik için)
  - Arama kutusu (kod veya isme göre)
- **Ekleme:** Modal form — `code` (zorunlu, unique, kaydedildikten sonra değişmez), `name` (zorunlu), `is_active` (default true). Çalışma Alt Alanı için ek olarak `parent_work_area_code` dropdown'u (sadece aktif üst alanlar).
- **Düzenleme:** Modal form — sadece `name` ve `is_active` değiştirilebilir. `code` read-only gösterilir, uyarı mesajı: "Kod referansları korumak için değiştirilemez."
- **Pasifleştirme (soft-disable) — koşullu:** `is_active=false` yapma girişimi aşağıdaki kural ile yönetilir:
  - **Kullanıcı Sayısı > 0 ise pasifleştirme ENGELLENIR.** Sistem modal uyarısı gösterir:
    > "Bu master data aktif kullanıcılar tarafından kullanılıyor (N aktif kullanıcı). Pasifleştirme için önce bu kullanıcıları başka bir değere taşımalısınız."
    
    Modal içinde "Kullanıcıları Görüntüle" linki ile o master data'yı kullanan aktif kullanıcı listesine yönlendirir.
  - **Kullanıcı Sayısı = 0 ise pasifleştirme izinli** (tek confirmation dialog ile).
  - Pasif master data:
    - Yeni kullanıcı kaydı / güncelleme ekranında dropdown seçeneği olarak **görünmez**.
    - Mevcut kullanıcıların attribute'larında referans olarak **kalmaya devam eder** (FK kırılmaz; kullanıcı görünümünde isim okunabilir).
    - Attribute-based rol kurallarında kullanılıyorsa o kurallar çalışmaya devam eder (ama yeni eşleşen kullanıcı gelmez).
    - Raporlama ve listeleme ekranlarında görünür (geçmiş veri tutarlılığı için).
- **Aktifleştirme:** Pasif master data yeniden `is_active=true` yapılabilir. **Parent master data aktifleştirildiğinde child'lar otomatik aktifleşmez** (örn: `work_areas` aktifleşirse ona bağlı `work_sub_areas` pasif kalmaya devam eder) — superadmin/Kullanıcı Yöneticisi child'ları manuel aktifleştirmelidir. Cascade activate YOK.
- **Cascade deactivate:** Parent pasifleştirilirse (örn: bir çalışma alanı pasifleştirilirse), altındaki aktif child'lar otomatik pasifleştirilir (bkz. [A-015]). Ancak yukarıdaki pasifleştirme engelleme kuralı parent için de geçerlidir — kullanıcıları varsa parent pasifleştirilemez.
- **Silme YOKTUR** — pasifleştirme yeterlidir (bkz. [A-013]). "Kullanıcı Sayısı = 0" olsa bile silme butonu yoktur; attribute-based rol kuralları için önden tanımlanmış master data orphan olarak kalabilir (bkz. [A-014]).
- **Modal içinde hızlı yeni master data ekleme kısa yolu YOKTUR.** Örneğin yeni kullanıcı ekleme modal'ında şirket dropdown'unda istediği şirket yoksa, kullanıcı modal'ı kapatıp Master Data ekranına gitmek zorundadır. Bu kasıtlı bir UX kararıdır — bağlam karışıklığını önler, master data oluşturmanın bilinçli bir aksiyon olmasını sağlar.
- **Toplu import özelliği (Excel/CSV) MVP'de YOKTUR** (bkz. [A-012]). SAP HR entegrasyonu ile toplu ekleme/senkron [I-002] iterasyonunda gelecektir.
- Erişim: **Superadmin** ve **Kullanıcı Yöneticisi** (bkz. [R-006]).

### 9.6. Sistem Ayarları Ekranı
**Karar [AP-013]:** **Sistem Ayarları ekranı** MVP'de aşağıdaki yönetilebilir parametreleri barındırır. Erişim **yalnızca Superadmin** ile sınırlıdır.

**Bölüm A — Email ve Bildirim Şablonları:**
- Mail gönderim ayarları (SMTP host, port, from adresi vb. env'den gelir; ekran sadece görüntüler — değiştirilemez).
- **Bildirim mail şablonları** — her event tipi için düzenlenebilir template:
  - Görev atama bildirimi
  - SLA yaklaşma (gecikme yaklaşıyor) hatırlatması
  - SLA aşım (gecikme) bildirimi
  - Süreç tamamlandı bildirimi
  - Süreç iptal bildirimi
  - Virüs taraması enfekte dosya bildirimi
- Her şablon için: konu (subject) + body (HTML + text fallback). Dinamik değerler `{{processId}}`, `{{taskName}}`, `{{userName}}` gibi değişkenlerle eklenir. Önizleme butonu ile render edilmiş hali test edilir.

**Bölüm B — KVKK Metni:**
- Açık rıza metni — kullanıcıya login sonrası veya ilk girişte gösterilen KVKK aydınlatma / açık rıza içeriği.
- Versiyonlama: metin her güncellendiğinde yeni versiyon numarası alır; kullanıcıların hangi versiyonu kabul ettiği ayrıca DB'de tutulur (bkz. [SEC-042], [SEC-043]).

**Bölüm C — Rate Limiting Parametreleri (Login Güvenliği):**
- `login_attempt_threshold` — başarısız login sayısı eşiği (örn: 5)
- `login_attempt_window_minutes` — eşik hesabının yapıldığı zaman penceresi (örn: 15)
- `lockout_threshold` — hesap kilitleme tetikleyicisi sayısı
- `lockout_duration_minutes` — hesap kilitli kalma süresi (örn: 30)

Bu parametreler runtime'da DB'den okunur (env'den değil) — Superadmin ekrandan değiştirince yeni değerler bir sonraki login denemesinde aktif olur. Değişiklikler audit log'a yazılır.

### 9.7. Dashboard / İstatistik
**Karar [AP-014]:** Dashboard / istatistik ekranı **MVP kapsamı dışındadır**. MVP sonrası ayrı bir iterasyonda ele alınacaktır. PowerBI entegrasyonu ([I-002]) bu ihtiyacı kısmen karşılayabilir.

---

## 10. Güvenlik ve KVKK

Bu bölüm platformun güvenlik mimarisini tanımlar. Hedef: **kurumsal world-class seviye** — bankacılık uygulaması standartlarında defense-in-depth, KVKK + ISO 27001 + OWASP ASVS Level 2 uyumlu. Tüm kararlar `.mdc` rule dosyalarına ve runtime davranışa referans kaynağıdır.

### 10.1. Temel Prensipler ve Threat Model

**Karar [SEC-001]:** Platform **kurumsal bankacılık uygulaması seviyesinde** güvenlik standartlarına göre tasarlanır. Aşağıdaki çerçeveler referans alınır:
- **OWASP ASVS Level 2** (Application Security Verification Standard — critical systems için)
- **OWASP Top 10 (2021 edition)** — tüm saldırı kategorileri kapsanır
- **KVKK (6698 sayılı kanun)** — Türkiye kişisel veri koruma kanunu
- **ISO 27001** prensipleri (gelecekte sertifikasyon opsiyonu)
- **NIST Cybersecurity Framework** — 5 fonksiyon (Identify, Protect, Detect, Respond, Recover)

**Karar [SEC-002]:** **Threat model** aşağıdaki saldırgan profillerine karşı defense-in-depth uygular:
- **Dış saldırgan (opportunistic):** Otomatik tarayıcılar, bot'lar, SQL injection tarayıcıları
- **Dış saldırgan (targeted):** Corporate espionage, rakip firma, siber suç grubu
- **İç saldırgan (malicious insider):** Yetkili kullanıcı veri exfiltration girişimi
- **İç saldırgan (negligent):** Kazara veri paylaşımı, phishing'e yenik düşen kullanıcı
- **Supply chain:** NPM paket zehirlenmesi, compromised dependency, CI/CD kırılması
- **Physical:** AWS çalışanı, disk/backup çalınması (SSE-KMS ile [D-007 Katman 7] korunur)

**Karar [SEC-003]:** **Zero Trust** mimarisi: Hiçbir request varsayılan olarak güvenilir değildir. İç ağ, VPN, corporate proxy varsayımları yoktur. Her request için:
- Authentication doğrulanır (JWT imza + blacklist kontrolü)
- Authorization kontrol edilir ([AUTH-005] middleware)
- Session bütünlüğü doğrulanır (IP + User-Agent fingerprint değişimi tespiti)
- Rate limit uygulanır

### 10.2. Veri Sınıflandırması

**Karar [SEC-004]:** Sistemdeki veriler **4 sınıfa** ayrılır. Her sınıfın kendi koruma, şifreleme, loglama ve saklama kuralları vardır:

| Sınıf | Tanım | Örnek | Şifreleme | Audit | Saklama |
|---|---|---|---|---|---|
| **C1 — Public** | Anonim, halka açık bilgi | Uygulama logo, login sayfası | — | Access log | Sınırsız |
| **C2 — Internal** | Kurumsal iç bilgi, üye olmayan göremez | Süreç isimleri, rol isimleri, menü yapısı | TLS in-transit | Access log | Sınırsız |
| **C3 — Confidential** | Kişisel/ticari veri | Kullanıcı attribute'ları, süreç formu içerikleri, dokümanlar | TLS + SSE-KMS at-rest | Full audit | [SEC-029] politikasına tabi |
| **C4 — Restricted** | Hassas PII + finansal + sağlık | TC kimlik no, şifre hash, MFA secret, KVKK rıza metni, plain-text PII (log'lara sızmasın) | TLS + SSE-KMS + **field-level encryption (envelope)** | Full audit + tamper-evident log | [SEC-029] + legal hold |

**Karar [SEC-005]:** Her kod değişikliğinde agent, dokunduğu verinin sınıfını kontrol eder. C3/C4 veri işleyen endpoint'ler özel review gerektirir (`.mdc` rule'larına işlenecek).

**Karar [SEC-006]:** Sistemde bulunan hassas veri türleri (genişletilmiş — önceki [SEC-003] yerine):
- **C4 (Restricted):**
  - Şifre hash (bcrypt)
  - JWT refresh token (opaque, httpOnly cookie)
  - MFA TOTP secret (gelecek iterasyonda)
  - KVKK rıza metni + kullanıcı onay kayıtları
  - TC kimlik numarası (gelecek iterasyonda toplanırsa)
- **C3 (Confidential):**
  - Kullanıcı PII: sicil, email, telefon, yönetici sicili/email, ad-soyad, işe giriş tarihi
  - Süreç form içerikleri (üretim verileri, sahaya ait tüm veri)
  - Doküman içerikleri (S3'te SSE-KMS ile [D-007 Katman 7])
  - Audit log kayıtları (eski/yeni değer alanları PII içerebilir)
  - Saha fotoğrafları
- **C2 (Internal):** Rol tanımları, yetki listeleri, master data (şirket/lokasyon listeleri)

### 10.3. Şifreleme Stratejisi

**Karar [SEC-007]:** **At-rest encryption — envelope encryption pattern** kullanılır:
- **AWS KMS** Customer Managed Key (CMK) master key
- Her DB kaydı için **Data Encryption Key (DEK)** üretilir (AES-256-GCM)
- DEK, CMK ile şifrelenip kaydın yanında saklanır (envelope pattern)
- Avantaj: CMK asla DB'de açık görünmez; CMK rotation tüm kayıtları yeniden şifrelemeyi gerektirmez (sadece DEK'leri yeniden wrap etmek yeterlidir)

**Karar [SEC-008]:** **Field-level encryption** — C4 sınıfı alanlar DB'de şifreli saklanır:
- `users.email` — **deterministic encryption** (arama/tekillik için) — HMAC-SHA256 ile blind index + AES-256-GCM ciphertext
- `users.phone` — deterministic encryption
- `users.sicil` — deterministic encryption
- `users.manager_email` — deterministic encryption
- `users.password_hash` — bcrypt (zaten tek yönlü, ek şifreleme gerekmez)
- `audit_logs.old_value`, `audit_logs.new_value` (PII içerdiğinde) — AES-256-GCM
- KVKK rıza metni versiyonları + onay kayıtları — AES-256-GCM

**Karar [SEC-009]:** **Deterministic vs probabilistic encryption ayrımı:**
- **Deterministic** (aynı input → aynı ciphertext): Arama ve tekillik gereken alanlar (email, sicil). Blind index ile query yapılır.
- **Probabilistic** (aynı input → farklı ciphertext): Aranmayan sadece okunan alanlar. Security daha yüksek, IV (Initialization Vector) her seferinde farklıdır.

**Karar [SEC-010]:** **At-rest encryption — altyapı seviyesi:**
- **Aurora PostgreSQL** storage encryption: AWS KMS ile otomatik (default aktif).
- **S3** doküman storage: SSE-KMS (bkz. [D-007 Katman 7]).
- **Redis** cache: AWS ElastiCache encryption at-rest ve in-transit aktif; sensitive data (tam PII) cache'lenmez — sadece ID'ler ve non-PII.
- **CloudWatch Logs**: KMS encryption aktif.
- **EBS volumes** (Lambda dahil ephemeral): KMS encryption aktif.

**Karar [SEC-011]:** **In-transit encryption — TLS 1.3 zorunlu:**
- TLS 1.0, 1.1, 1.2 reddedilir (AWS ALB/CloudFront config).
- Cipher suite whitelist: sadece PFS (Perfect Forward Secrecy) cipher'lar (`ECDHE-RSA-AES256-GCM-SHA384`, `ECDHE-ECDSA-AES256-GCM-SHA384`).
- HTTP → HTTPS 301 redirect (CloudFront ve ALB seviyesinde).
- Certificate: AWS Certificate Manager (ACM), otomatik yenileme.
- **HSTS (HTTP Strict Transport Security)** header: `max-age=63072000; includeSubDomains; preload` (2 yıl).

**Karar [SEC-012]:** **Backend ↔ DB ve Backend ↔ Redis iletişimi** de TLS ile şifrelenir. Aurora `rds.force_ssl=1` parameter grubu zorunlu. Redis için `tls-port` aktif.

### 10.4. Şifre Politikası

**Karar [SEC-013]:** **Şifre karmaşıklık kuralları** (NIST SP 800-63B Level 2 + kurumsal sertlik):
- Minimum uzunluk: **12 karakter**
- En az 1 büyük harf, 1 küçük harf, 1 rakam, 1 özel karakter (`!@#$%^&*()_+-=[]{}|;:,.<>?`)
- Tüm boşluklar izinli (şifre cümlesi için)
- Maximum uzunluk: 128 karakter (DoS önlemi)
- Unicode destekli

**Karar [SEC-014]:** **Şifre içerik yasakları:**
- Kullanıcının email'i, adı, soyadı, sicili şifre içinde **geçemez** (backend validation).
- **Have I Been Pwned (HIBP)** k-anonymity API ile kontrol: şifre sızdırılmış listelerde varsa reddedilir. Offline fallback: top 10k pwned passwords bundle'ı backend'de.
- Platform-specific yasak kelimeler: "lean", "kaizen", "admin", "password", "123456", "şirket adları" — config'de tanımlı liste.

**Karar [SEC-015]:** **Şifre hashleme:** bcrypt (cost factor **12**, bkz. [TS-009]). Argon2id gelecek iterasyon opsiyonu. Ek olarak **pepper** (environment variable olarak saklı site-wide secret) şifre hash'ine karıştırılır → DB leak durumunda rainbow table saldırısı zorlaşır.

**Karar [SEC-016]:** **Şifre tekrar yasağı:**
- Kullanıcı son **5 şifresini** tekrar kullanamaz. `password_history` tablosunda bcrypt hash'leri saklanır (tarihli).
- Şifre değişikliği history'ye yazılır, en eski kayıt silinir (ring buffer).

**Karar [SEC-017]:** **Şifre ömrü ve zorunlu değişim:**
- Varsayılan: Şifre **180 günde bir** zorunlu değişim (NIST son rehberi expiry'yi zorunlu kılmıyor ama kurumsal compliance için tutuyoruz).
- Bu süre Sistem Ayarları ekranında Superadmin tarafından değiştirilebilir (`password_expiry_days` parametresi, [AP-013] Bölüm C'ye eklenecek).
- Kullanıcı login'den 14 gün önce uyarı görür ("Şifreniz 14 gün içinde dolacak").
- Süre dolunca login yapılır ama ilk aksiyon zorunlu şifre değişimi ekranıdır (diğer ekranlar kilitli).

**Karar [SEC-018]:** **Şifre sıfırlama akışı:**
- "Şifremi unuttum" → kullanıcı email girer.
- Email varsa **enumeration önlemek için** aynı 200 OK response döner ("Eğer bu email sistemde kayıtlıysa reset linki gönderildi"). Yoksa da aynı response.
- Reset token: **cryptographically secure random 32 byte** (base64 URL-safe). DB'de **SHA-256 hash'i** saklanır (plain token sadece email'e gider).
- Token **15 dakika** geçerli, tek kullanımlık.
- Reset sonrası tüm aktif session'lar invalidate edilir (refresh token'lar revoke).
- Reset başarılı olduğunda kullanıcıya "Şifreniz değişti, siz değilseniz lütfen bize ulaşın" bildirimi gönderilir (alternatif email varsa ona da).

**Karar [SEC-019]:** **Rate limiting — Login güvenliği** (bkz. [AP-013] Bölüm C parametreleri):
- **Başarısız login sayısı eşiği:** 5 deneme / 15 dakika (hem email-bazlı hem IP-bazlı sayıma dikkat).
- **Lockout:** Eşik aşıldığında hesap **30 dakika** kilitlenir. Kullanıcıya "Çok fazla başarısız deneme, 30dk sonra tekrar deneyin" mesajı. Superadmin manuel unlock edebilir.
- **Progressive delay:** Her başarısız login sonrası response gecikmesi artar (1s, 2s, 4s, 8s) — bot saldırısını yavaşlatır.
- Başarılı login sonrası sayaç sıfırlanır.
- IP-bazlı da eşik: aynı IP'den 20 başarısız login / 15dk → IP 1 saat ban.

### 10.5. Oturum Yönetimi

**Karar [SEC-020]:** **Token mimarisi** (bkz. [TS-009] tamamlayıcısı):
- **Access token (JWT):**
  - Süre: **15 dakika** (sert limit, değiştirilemez).
  - Algoritma: **RS256** (asymmetric — private key imzalar, public key doğrular). HS256 kullanılmaz (shared secret leak riski).
  - Claim'ler: `sub` (userId), `iat`, `exp`, `jti` (JWT ID — blacklist için), `sid` (session ID), `ip_hash` (SHA-256 of client IP, session bütünlüğü için).
  - Stateless: middleware sadece JWT verify + blacklist kontrolü + user fetch yapar.
- **Refresh token:**
  - Süre: **7 gün** (sliding window — kullanımda yenilenir).
  - Opaque random 64 byte token; DB'de SHA-256 hash ile saklanır.
  - **httpOnly + Secure + SameSite=Strict** cookie olarak gönderilir.
  - **Rotation:** Her refresh kullanımda yeni refresh token üretilir, eski tek kullanımlıktır. Aynı refresh token ikinci kez kullanılırsa **tüm session chain revoke edilir** (token replay attack tespiti).

**Karar [SEC-021]:** **Session inaktivite timeout:**
- Access token doğal olarak 15dk'da ölür. Frontend her 4dk'da refresh eder (TanStack Query).
- **Idle timeout:** Kullanıcı **30 dakika** hiçbir aksiyon almazsa refresh yapılmaz, refresh token invalidate edilir → kullanıcı sonraki istek'te login ekranına düşer.
- **Absolute timeout:** Refresh token ne olursa olsun **maximum 12 saat**'te otomatik expire olur (session fixation önlemi). Kullanıcı yeniden login yapmak zorundadır.

**Karar [SEC-022]:** **"Beni hatırla" özelliği YOKTUR.** Kurumsal güvenlik seviyesi için uzun ömürlü session riskli. Her kullanıcı her 12 saatte en az bir kez full login yapar.

**Karar [SEC-023]:** **Session bütünlüğü (session hijacking koruması):**
- Access token'da `ip_hash` claim tutulur (session başlangıcındaki IP'nin SHA-256'sı).
- Her request'te middleware, request IP'sinin hash'ini token'daki `ip_hash` ile karşılaştırır.
- **Uyumsuzluk durumunda:**
  - Mobile kullanıcı WiFi/4G geçişinde IP değişir — bu yaygın. Bu yüzden sadece **/24 subnet** karşılaştırılır (IP'nin ilk 3 octet'i).
  - Subnet bile farklıysa (şehir/ülke değişimi) → session revoke + email uyarı + audit log.
- **User-Agent fingerprint:** Her session'da User-Agent string'i saklanır. Değişirse session revoke (browser değiştirme = yeni login).

**Karar [SEC-024]:** **Concurrent session yönetimi:**
- Bir kullanıcı **maximum 3 aktif session**'a sahip olabilir (3 farklı cihaz).
- 4. cihazdan login yapılırsa en eski session otomatik kapatılır (LRU).
- Profil ekranında kullanıcı aktif session'larını görür ("Chrome / İstanbul / 2 saat önce aktif") ve istediğini uzaktan kapatabilir ("Bu cihazdan çıkış yap").
- Şifre değişikliğinde **diğer tüm session'lar zorunlu olarak kapatılır** — kendisi hariç.

**Karar [SEC-025]:** **Superadmin özel kuralları:**
- Superadmin session'ı **maximum 4 saat** (normal 12 yerine).
- Superadmin login'de **IP whitelist** kontrol edilir (Sistem Ayarları'nda tanımlı kurumsal IP aralıkları dışından login reddedilir).
- Superadmin MFA MVP sonrası zorunlu olacak ([SEC-OPEN-MFA]).
- Superadmin her login'i Slack/email ile superadmin ve güvenlik ekibine bildirilir.

### 10.6. Web Güvenlik Header'ları ve Browser Korumaları

**Karar [SEC-026]:** Her HTTP response'a aşağıdaki **security header'lar** zorunlu:

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
Content-Security-Policy: [bkz. SEC-027]
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
X-DNS-Prefetch-Control: off
```

NestJS tarafında **`helmet`** middleware bu header'ları otomatik ekler (opsiyonlar Zod ile validate edilir).

**Karar [SEC-027]:** **Content Security Policy (CSP)** sıkı politika:
```
default-src 'self';
script-src 'self' 'nonce-<random>' 'strict-dynamic';
style-src 'self' 'nonce-<random>';
img-src 'self' data: https://cdn.<domain>;
connect-src 'self' https://api.<domain> https://cdn.<domain>;
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
report-uri /api/v1/csp-report;
report-to csp-endpoint;
```
- `unsafe-inline`, `unsafe-eval` **yasak**.
- Inline script'ler `nonce` (her response için rastgele) ile whitelist edilir. Next.js App Router nonce propagation native destekler.
- CSP violation raporları backend `/api/v1/csp-report` endpoint'ine gelir, audit'e yazılır, alarm kuralı tetikler.

**Karar [SEC-028]:** **CORS politikası** — **strict allowlist**:
- Sadece uygulamanın resmi domain'leri allowlist'te (`https://app.<domain>`, `https://admin.<domain>`).
- `Access-Control-Allow-Credentials: true` (cookie taşıması için).
- Wildcard (`*`) **yasak**.
- Allowed methods: `GET, POST, PATCH, DELETE, OPTIONS`. PUT kullanılmaz (REST tasarım kararı).
- Allowed headers: `Authorization, Content-Type, X-CSRF-Token, X-App-Token`.
- Max-Age: 86400 (preflight cache 1 gün).

**Karar [SEC-029]:** **CSRF koruması:**
- Cookie-based session (refresh token) + SameSite=Strict birinci savunmadır.
- Ek olarak **double-submit cookie pattern**: her form request'inde `X-CSRF-Token` header'ı zorunlu; cookie'deki CSRF token ile eşleşmelidir.
- GET istekleri mutasyon yapmaz (REST disiplini).
- CSP `form-action 'self'` ek katmandır.

**Karar [SEC-030]:** **Clickjacking koruması:** `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`. Uygulama hiçbir sayfada iframe içine gömülemez.

**Karar [SEC-031]:** **XSS koruması — defense-in-depth:**
- React default escaping (dangerouslySetInnerHTML yasak — ESLint rule `.mdc`'de).
- CSP nonce-based script-src.
- Backend'den gelen HTML içerik (örn: bildirim mail template'i önizlemesi) DOMPurify ile sanitize edilir.
- Zod validation ile kullanıcı inputu strict whitelist (regex, enum).
- HttpOnly cookie'ler → JS'in session token'a erişimi yok.

**Karar [SEC-032]:** **SQL injection koruması:**
- **Prisma ORM** parametrized query kullanır — raw query yasak.
- Raw query zorunluysa (reporting vs.) `Prisma.sql` template literal (parametrized).
- Kullanıcı inputu direkt SQL'e interpolate edilmez.
- Linter rule: `.mdc` dosyasına "Prisma raw query kullanımı review gerektirir" notu.

**Karar [SEC-033]:** **SSRF koruması:**
- Backend'den dış URL'e istek atılmaz (webhook feature gelene kadar).
- Webhook [I-004] geldiğinde: allowlist domain, IP metadata endpoint'leri (169.254.169.254) bloklanır, private IP range (10.x, 172.16-31, 192.168, link-local) blocklist.

### 10.7. Giriş Doğrulama ve Çıktı Kodlama

**Karar [SEC-034]:** Tüm kullanıcı inputu Zod şema ile validate edilir (bkz. [TS-008]). Validation olmadan API endpoint'i deploy edilmez (`.mdc` rule).

**Karar [SEC-035]:** **Input validation disiplini:**
- String'ler için `min`, `max` uzunluk zorunlu (DoS önlemi — unbounded string yasak).
- Enum alanlar için Zod `enum` kullanılır, string pass-through yasak.
- Email: `z.string().email()` + max 254 karakter (RFC 5321).
- Sicil: `z.string().regex(/^\d{8}$/)` (8 haneli sayı).
- Telefon: `z.string().regex(/^(\+90|0)?5\d{9}$/)` (TR mobil format).
- Free text alanlar (form input'ları): max 5000 karakter, HTML escape edilir.

**Karar [SEC-036]:** **File upload güvenliği** (bkz. [D-007], [D-008]):
- Content-Type whitelist (WAF seviyesinde [D-007 Upload endpoint WAF kuralı]).
- Magic number kontrolü: backend dosyanın ilk byte'larını okur, declared Content-Type ile eşleşmezse reject.
- Filename sanitization: path traversal karakterleri (`..`, `/`, `\`, null byte) reject.
- Antivirus scan zorunlu (bkz. [D-008]).

### 10.8. Secrets Management

**Karar [SEC-037]:** **Secret storage:**
- **AWS Secrets Manager** ana secret store (rotation desteği için).
- **AWS Systems Manager Parameter Store** (SecureString) düşük-rotation secret'lar için (config).
- Secret'lar koda **asla gömülmez** (`.env.example` yalnızca placeholder içerir, `.env` gitignore'dadır).
- CI/CD pipeline secret injection: GitHub Actions OIDC ile AWS IAM role assume, Secrets Manager'dan okuma.

**Karar [SEC-038]:** **Secret rotation politikası:**
- JWT RS256 private/public key pair: **90 gün** rotation (key-id ile versiyonlanır; eski key 7 gün daha doğrulama yapar — grace period).
- DB password: 90 gün otomatik rotation (Secrets Manager + Aurora native integration).
- KMS CMK: yıllık otomatik rotation (SEC-007).
- API key / webhook secret: manuel rotation, event-driven (compromise şüphesi).
- Bcrypt pepper: **rotation yok** (şifre hash'leri ile bağlı; rotation tüm şifreleri geçersiz kılar).

**Karar [SEC-039]:** **Secret access audit:**
- Her secret erişimi AWS CloudTrail'e loglanır.
- Beklenmedik secret erişimi (yetkili olmayan IAM role, unusual hour) alarm tetikler.

**Karar [SEC-040]:** **Secret leak prevention:**
- Pre-commit hook: **gitleaks** veya **trufflehog** ile secret pattern taraması (Husky'ye bağlı).
- CI pipeline'da aynı tarama tekrarlanır.
- GitHub secret scanning aktif.
- Log output'larından secret maskelemesi (Pino custom serializer).

### 10.9. KVKK Uyumu ve Kişisel Veri Hakları

**Karar [SEC-041]:** **KVKK uyumu prensipleri:**
- **Veri minimalizasyonu:** Sadece süreç için gerekli PII toplanır (bkz. [A-005]).
- **Amaç sınırlılığı:** Toplanan veri sadece platform operasyonu için kullanılır, başka amaçla (pazarlama, üçüncü taraf satışı) **kesinlikle** kullanılmaz.
- **Saklama sınırlılığı:** Veri gerektiği süre boyunca saklanır ([SEC-053]).
- **Hesap verebilirlik:** Tüm veri işleme aksiyonları audit'e yazılır (bkz. [AUD-001], [AUD-004]).

**Karar [SEC-042]:** **Açık rıza metni yönetimi:**
- Rıza metni Sistem Ayarları ekranında Superadmin tarafından düzenlenir (bkz. [AP-013] Bölüm B).
- Her güncelleme yeni bir `consent_version` numarası alır (incremental, immutable).
- `consent_versions` tablosu: `id`, `version`, `content` (AES-256-GCM ile şifreli), `effective_from`, `created_by_user_id`, `published_at`.
- Geçmiş versiyonlar silinmez — kullanıcının hangi versiyonu kabul ettiği tarihsel olarak takip edilebilir olmalıdır.

**Karar [SEC-043]:** **Kullanıcı rıza kaydı:**
- `user_consents` tablosu: `user_id`, `consent_version_id`, `accepted_at`, `ip_address` (SHA-256 hash), `user_agent`.
- Kullanıcı ilk login'de veya rıza metni güncellendikten sonraki ilk login'de **zorunlu olarak** yeni versiyonu onaylar. Onaylamadan hiçbir sayfaya erişemez.
- Rıza kaydı **tamper-evident**: `user_consents.signature` alanında `HMAC-SHA256(user_id || consent_version_id || accepted_at, secret_key)` imzası saklanır.

**Karar [SEC-044]:** **KVKK veri konusu hakları (İlk MVP kapsamı):**
- **Bilgi alma hakkı:** Kullanıcı profil ekranından kendi verilerini görüntüler. "Verilerim" sekmesi tüm PII + rol atamaları + süreç listesini gösterir.
- **Düzeltme hakkı:** Kendi düzenleyemez (kullanıcı attribute'ları Kullanıcı Yöneticisi tarafından yönetilir — [R-005]). Ancak "Verilerimde hata var" butonu → Kullanıcı Yöneticisi'ne ticket açar.
- **İtiraz hakkı:** Rıza geri çekme → Platform kullanımı imkânsız (iç kurumsal araç, rızasız kullanılamaz). Geri çekme talebi İK ile koordineli işlenir.

**Karar [SEC-045]:** **"Verilerimi indir" özelliği — MVP'de VAR**:
- Kullanıcı profil → "Verilerimi İndir" → asenkron job tetiklenir.
- Job tamamlandığında kullanıcının email'ine **şifre korumalı ZIP** dosyası gönderilir. Şifre ayrı bir email ile iletilir (veya kullanıcının telefonuna SMS — MFA sonrası).
- ZIP içeriği: tüm kullanıcı PII (JSON), rol atamaları, süreç/görev listesi (JSON), KVKK rıza geçmişi (JSON), **dokümanlar hariç** (çok büyük olabilir, ayrı talep — ileride).
- Rate limit: kullanıcı başına **ayda 1 kez** indirme hakkı (abuse önlemi).
- Indirme aksiyonu audit log'a yazılır (`USER_DATA_EXPORT`).

**Karar [SEC-046]:** **KVKK silme ve anonimleştirme (bkz. [D-011] tamamlayıcısı):**
- **MVP'de otomatik silme/anonimleştirme YOK.**
- Yasal bir talep gelirse **manuel operasyonel süreç** ile Superadmin tarafından işlenir:
  1. Talep KVKK Sorumlusu'na yazılı olarak gelir.
  2. Superadmin DB'de kullanıcının PII alanlarını **anonimleştirir** (silmek değil — audit bütünlüğü için):
     - `email = 'deleted_<uuid>@anonymized.local'`
     - `phone = null`
     - `first_name = 'Silindi'`, `last_name = 'Silindi'`
     - `sicil = 'DEL' + random`
     - Şifre ve refresh token'lar revoke
     - `deleted_at` = now, `anonymization_reason` = KVKK talebi
  3. S3'teki dokümanlar — ilgili süreçler manuel incelenir, yasal hold altındaysa saklanır, değilse silinir.
  4. Tüm işlemler audit log'a yazılır (`KVKK_ANONYMIZATION`), KVKK Sorumlusu imzası alınır.
- İleride bu akış UI ile otomatikleştirilecek (iterasyon sonrası).

**Karar [SEC-047]:** **Data Processing Agreement (DPA):**
- AWS'in DPA'sı (eu-central-1 region için) kabul edilir — AWS processor, şirket data controller.
- Gelecek third-party entegrasyonları (Datadog, Sentry vb.) DPA imzalı olmadan **aktive edilmez**.

### 10.10. Saklama Bölgesi ve Veri İkametgâhı

**Karar [SEC-048]:** **Veri ikametgâhı:**
- Tüm production verisi **AWS `eu-central-1` (Frankfurt) region**'da saklanır. Bu [INF-OPEN-2]'yi kapatır.
- Backup'lar aynı region'da (cross-AZ) tutulur; cross-region replication yok (maliyeti ve data residency karmaşıklığını azaltmak için).
- CloudFront edge locations global — ama **origin her zaman Frankfurt**, cache'lenmeyen asset'ler Türkiye kullanıcılarına Frankfurt'tan gelir (~30ms latency, kabul edilebilir).

**Karar [SEC-049]:** **Türkiye KVKK açısından:**
- Veri AB'de (Frankfurt) saklanıyor — KVKK md. 9 (yurtdışına aktarım) hükümleri geçerli.
- Açık rıza metninde bu durum açıkça belirtilir ([SEC-042] ile yönetilir).
- Gelecekte KVKK mevzuatı değişirse veya şirket kararı alırsa Türkiye region'a (İstanbul) geçiş yapılabilir (Aurora snapshot → restore).

### 10.11. Audit Log Güvenliği (Tamamlayıcı)

**Karar [SEC-050]:** **Audit log tamper-evidence** (bkz. [AUD-OPEN-1]'i kapatır):
- `audit_logs` tablosu **append-only** davranışı zorlanır:
  - PostgreSQL trigger: UPDATE ve DELETE `audit_logs` üzerinde **exception fırlatır**.
  - IAM policy: application user'ın bu tablo için sadece INSERT ve SELECT yetkisi vardır (superadmin dahil).
  - DELETE sadece **1 yıl retention job** tarafından yapılır (dedicated IAM role).
- Her audit satırında **önceki satırın hash'ini içeren `chain_hash`** alanı var: `SHA-256(prev_hash || current_row_json)`. Bir satır silinse/değiştirilse chain bozulur, nightly integrity check job tespit eder.
- `chain_hash` doğrulama job'u gecelik çalışır, uyumsuzluk tespit ederse Superadmin ve güvenlik ekibine critical alarm.

**Karar [SEC-051]:** **Audit log PII şifreleme** (bkz. [AUD-OPEN-2]'yi kapatır):
- `audit_logs.old_value` ve `audit_logs.new_value` alanları PII içerdiğinde AES-256-GCM ile şifrelenir (bkz. [SEC-008]).
- PII olmayan alanlar (action, entity, entityId, timestamp, IP hash) düz metin kalır — hızlı sorgu için.
- Audit Log görüntüleme ekranında [AP-010] Superadmin'in gördüğü veriler runtime'da decrypt edilir.

**Karar [SEC-052]:** **Log içeriği — PII sızıntı koruması:**
- Pino custom redactor: JWT token, password alanları, refresh token, session ID log'a yazılmaz (`***REDACTED***` olur).
- HTTP request body log'u C3/C4 alanları redact edilir.
- Error stack trace'leri production'da dış response'a sızmaz — sadece internal log'a yazılır.

### 10.12. Veri Saklama ve İmha

**Karar [SEC-053]:** **Veri saklama süreleri**:

| Veri Tipi | Saklama Süresi | Sonrasında |
|---|---|---|
| Aktif kullanıcı verisi | Kullanıcı aktif olduğu sürece | Pasifleştirildiğinde 2 yıl arşiv, sonra anonimleştirilir |
| Tamamlanmış süreç verisi | **7 yıl** (TTK + KVKK hizmet amacı süresi) | Anonimleştirilir (kullanıcı bağlantısı kaldırılır, veri analitik için saklanır) |
| İptal edilmiş süreç | 3 yıl | Silinir |
| Audit log | 1 yıl (bkz. [AUD-002]) | CSV export alındıktan sonra silinir |
| Doküman (süreç tamamlandıktan sonra) | Süreç ile aynı süre (7 yıl) | Süreç imhasıyla birlikte S3'ten silinir |
| Session ve refresh token kayıtları | Süre dolana kadar | Otomatik silinir (cron job) |
| Login log / güvenlik log | 2 yıl | Silinir |
| KVKK rıza kayıtları | Kullanıcı hayatı boyunca | Silinmez (yasal kanıt) |
| Password history | Kullanıcı yaşam süresi | Kullanıcı anonimleştirilince silinir |

**Karar [SEC-054]:** **Otomatik retention job'ları:**
- Gecelik BullMQ cron job'ları retention süresi dolan verileri işler.
- Her job audit'e `DATA_RETENTION_EXECUTED` aksiyonu yazar.
- Silme yerine **anonimleştirme** tercih edilir (referansiyel bütünlük + istatistik için).

### 10.13. Vulnerability Management

**Karar [SEC-055]:** **Dependency scanning:**
- **GitHub Dependabot** aktif, daily scan.
- **npm audit** CI pipeline'da zorunlu — high/critical bulgu varsa build fail.
- **Snyk** veya **Socket.dev** supply chain attack tespiti (MVP sonrası).
- Yeni paket ekleme: `pnpm add` öncesi agent paket yazar sayısını, ihtiyaç konusunu check eder.

**Karar [SEC-056]:** **Container image scanning:**
- Docker image'lar **Trivy** veya **Grype** ile taranır (CI pipeline).
- Base image: **distroless** veya **alpine-slim** tercih edilir (minimal attack surface).
- Image'lar **signed** (Cosign) — deployment öncesi signature doğrulanır.

**Karar [SEC-057]:** **SAST (Static Application Security Testing):**
- **ESLint security plugin** (`eslint-plugin-security`).
- **Semgrep** CI pipeline'da — OWASP Top 10 ve custom kurallar.
- **TypeScript strict mode** [TS-003] zaten type-level güvenlik sağlar.

**Karar [SEC-058]:** **DAST (Dynamic Application Security Testing):**
- **OWASP ZAP** staging environment'ta haftalık otomatik tarama.
- Bulgular tracked, kritik/yüksek 7 gün içinde fix.

**Karar [SEC-059]:** **Penetration testing:**
- Yılda 1 kez dış bağımsız firma ile pen-test (production ortamda, kontrollü).
- Major release öncesi (örn: SAP entegrasyonu, SSO aktivasyonu) ek pen-test.
- Bulgular risk ranking'e göre SLA ile kapatılır: Critical 24 saat, High 7 gün, Medium 30 gün.

**Karar [SEC-060]:** **Bug bounty / responsible disclosure:**
- MVP'de formal program yok.
- `security.txt` file root'ta: `Contact: security@<domain>, Expires: 2027-01-01, Preferred-Languages: tr, en`.
- Dış bildirimler superadmin'e escalate edilir.

### 10.14. Monitoring, Detection ve Incident Response

**Karar [SEC-061]:** **Security monitoring — SIEM benzeri yapı:**
- CloudWatch Logs + Metrics + Alarms kombinasyonu.
- Alarm kanalları: **Slack #security-alerts** + email (superadmin + güvenlik ekibi) + SMS (critical).
- Alarm tier'ları:
  - **P1 (Critical):** Data breach şüphesi, KMS unauthorized access, audit log tampering. SMS + Slack + email; 1 saat response SLA.
  - **P2 (High):** Çoklu başarısız login, WAF saldırı pattern'i, anormal download. Slack + email; 4 saat SLA.
  - **P3 (Medium):** Dependency vulnerability, CSP violation artışı. Slack; 24 saat SLA.

**Karar [SEC-062]:** **Anomali tespiti kuralları (bkz. [D-007 Katman 8] tamamlayıcısı):**
- Tek kullanıcıdan 10dk'da 50+ yetki reddedilmiş istek → session revoke + P2 alarm.
- Aynı kullanıcıdan 3 farklı IP'den paralel aktif session → P2 alarm (credential paylaşımı şüphesi).
- Admin panelleri (AP-010, AP-011, AP-013) mesai dışı (23:00-06:00 TR) saatlerde kullanım → P2 alarm.
- DB'de kısa sürede çok sayıda DELETE/UPDATE (bulk anomaly) → P1 alarm.
- KMS `Decrypt` çağrı frekansı normal eşiği 3× aştıysa → P2 alarm.

**Karar [SEC-063]:** **Incident Response playbook:**
- **Incident runbook** `docs/security/incident-response.md` dosyasında yaşar (MVP sonrası hazırlanır).
- 5 fazlı NIST model: Preparation → Detection & Analysis → Containment → Eradication & Recovery → Post-Incident.
- Her incident için: `incident_id`, timeline, root cause, affected users, remediation, lessons learned.
- **KVKK ihlali** tespit edildiğinde **72 saat içinde** KVKK Kurumuna bildirim yapılır (mevzuat gereği). İlgili kullanıcılara bildirim yapılır.

**Karar [SEC-064]:** **DDoS koruması:**
- **AWS Shield Standard** otomatik aktif (Layer 3/4).
- **AWS Shield Advanced** MVP sonrası değerlendirilecek (kurumsal/kritik attack hedefi olursa).
- CloudFront + WAF birleşimi [D-007] L7 DDoS için birinci savunmadır.
- Backend API Gateway tier'da rate limit: anonim IP başına 100 req/dk, authenticated 300 req/dk.

### 10.15. Supply Chain ve CI/CD Güvenliği

**Karar [SEC-065]:** **CI/CD pipeline güvenliği:**
- GitHub Actions OIDC ile AWS IAM role assume (static AWS access key YOK).
- Secret injection: GitHub Environments + required reviewers (production için).
- Branch protection: `main` branch'e direkt push yasak, PR + 1 reviewer + tüm check'ler yeşil zorunlu.
- Signed commits: `main`'e merge edilecek commit'ler GPG ile imzalı olmalıdır.

**Karar [SEC-066]:** **Deployment güvenliği:**
- **Immutable infrastructure:** production'da manuel SSH/shell yok. Değişiklik = yeni deployment.
- **Blue-green deployment:** Yeni versiyon canlı trafiğin %0'ına deploy edilir, sağlık kontrolleri yeşil olursa trafik kademeli geçer (canary).
- **Rollback:** son 10 deployment saklanır, 1 komutla önceki versiyona dönülür.

**Karar [SEC-067]:** **Principle of least privilege:**
- IAM role'ler granular — her servis kendi role'ü, sadece ihtiyacı olan kaynaklara erişir.
- Superadmin DB erişimi de granular — production DB'ye SSH/psql doğrudan erişim YOK, sadece Session Manager + kısa süreli temporary credential (audit'li).
- Developer'lar production data'ya erişemez — sadece staging (seed data ile).

### 10.16. Frontend ve Mobil Güvenlik

**Karar [SEC-068]:** **Frontend güvenlik hijyeni:**
- Source map'ler production'a deploy edilmez (minified bundle).
- Debug log'lar production build'de strip edilir (Pino level `silent` → `error`).
- Feature flag'ler build-time değil runtime (client'ta if-else ile güvenlik kontrolü yapılmaz — backend'de yapılır).
- Browser storage kullanımı: **localStorage'da PII ve token yasak** (httpOnly cookie + in-memory state).

**Karar [SEC-069]:** **Subresource Integrity (SRI):**
- Dış CDN'den yüklenen her script/stylesheet için SRI hash'i `integrity` attribute'ta zorunlu.
- MVP'de minimum dış dependency (tercihen hepsi self-hosted).

**Karar [SEC-070]:** **Gelecek mobil uygulama için hazırlık:**
- Backend API bearer token authentication — mobil ile uyumlu ([TS-007] REST kararı).
- Certificate pinning mobil app'te implemente edilecek (MITM koruması).
- Jailbreak/root detection mobil app'te (iterasyon sonrası).

### 10.17. Eğitim ve Güvenlik Kültürü

**Karar [SEC-071]:** **Geliştirici güvenlik eğitimi:**
- Tüm yeni developer'lar onboarding'de OWASP Top 10 eğitimi tamamlar.
- Yıllık güvenlik refresher.
- Phishing simülasyonu — 6 ayda bir.

**Karar [SEC-072]:** **Security champion rolü:**
- Ekipte 1 kişi "security champion" olarak atanır — güvenlik gündemi, pen-test follow-up, Dependabot PR review önceliği.

### 10.18. Açık Kararlar — Güvenliğin İleri İterasyonları

Bu iterasyonda kapsam dışı bırakılan ancak planlı güvenlik geliştirmeleri:

- **[SEC-OPEN-MFA]** MFA/2FA — TOTP (Google Authenticator uyumlu), kritik rol (Superadmin) için zorunlu, diğer roller için opsiyonel. İlgili: [A-008].
- **[SEC-OPEN-WEBAUTHN]** WebAuthn / FIDO2 passkey desteği — phishing-resistant authentication.
- **[SEC-OPEN-HSM]** AWS CloudHSM geçişi — FIPS 140-2 Level 3 compliance gerektiğinde.
- **[SEC-OPEN-SIEM]** Dedicated SIEM (Datadog Security Monitoring, Splunk, Elastic Security) — CloudWatch yetersiz kaldığında.
- **[SEC-OPEN-DLP]** Endpoint DLP (Forcepoint, Symantec) — ekran görüntüsü, panoya kopyalama gibi kullanıcı ihlalleri için (bkz. [D-007] mutlak engellenemeyen senaryo).
- **[SEC-OPEN-RLS]** PostgreSQL Row-Level Security aktivasyonu — uygulama bug'ı durumunda DB seviyesinde ek katman.
- **[SEC-OPEN-AUDIT-EXTERNAL]** Audit log external WORM storage (S3 Object Lock) replikasyonu — compliance maksimum seviyesi için.

---

## 11. Denetim (Audit Log)

### 11.1. Kapsam
**Karar [AUD-001]:** **Tüm admin işlemleri ve tüm kullanıcı işlemleri** loglanır.

**Karar [AUD-004]:** **Superadmin aksiyonları** da istisnasız audit log'a yazılır. Superadmin'in kurtarıcı veya olağanüstü aksiyonlarının (örn: başka bir kullanıcı adına rollback, rol atama, iptal) izlenebilirliği sağlanır. Superadmin audit kayıtlarından muaf değildir.

### 11.2. Saklama Süresi
**Karar [AUD-002]:** Audit log kayıtları **1 yıl** süreyle saklanır.

### 11.3. Log İçeriği
**Karar [AUD-003]:** Her audit log kaydı aşağıdaki alanları içerir (bu karar v0.5 öncesi AUD-OPEN-3'ü kapatır ve [SEC-050]/[SEC-051] ile uyumludur):

| Alan | Tip | Not |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID (nullable) | Aksiyonu yapan kullanıcı; sistem aksiyonları için null |
| `timestamp` | TIMESTAMPTZ | ISO 8601 UTC |
| `action` | VARCHAR | Enum değer (örn: `CREATE_USER`, `APPROVE_TASK`, `DOCUMENT_UPLOAD`) |
| `entity` | VARCHAR | Enum değer (örn: `user`, `role`, `process`, `document`) |
| `entity_id` | VARCHAR (nullable) | İlgili varlık ID'si |
| `old_value` | JSONB (encrypted) | Değişiklik öncesi değer (C3/C4 PII içerirse [SEC-051] ile AES-256-GCM şifreli) |
| `new_value` | JSONB (encrypted) | Değişiklik sonrası değer |
| `metadata` | JSONB | Serbest metadata (örn: iptal gerekçesi, rollback hedef adım, scan_status) |
| `ip_address_hash` | VARCHAR(64) | Ham IP değil, SHA-256 hash (KVKK veri minimalizasyonu) |
| `user_agent` | VARCHAR(512) | Truncate edilir (ilk 512 karakter) |
| `session_id` | VARCHAR (nullable) | JWT `sid` claim — oturum izlenebilirliği için |
| `chain_hash` | VARCHAR(64) | SHA-256 tamper-evident zincir hash (bkz. [SEC-050]) |

Log kayıtları append-only'dir — UPDATE ve DELETE DB trigger'ı ile engellenir ([SEC-050]). Retention süresi 1 yıl [AUD-002]; retention job dedicated IAM role ile çalışır.

---

## 12. Entegrasyonlar

### 12.1. MVP Kapsamı
**Karar [I-001]:** MVP'de dış sistem entegrasyonu **yoktur**.

### 12.2. Planlanan Entegrasyonlar (İleriki Aşama)
**Karar [I-002]:** Gelecekte planlanan entegrasyonlar:
- SAP MM
- SAP HR
- PowerBI
- RedHat SSO (kimlik doğrulama)

### 12.3. Public API
**Karar [I-003]:** Public API **yoktur**.

### 12.4. Webhook
**Karar [I-004]:** Diğer sistemlerle iletişimde webhook gönderme veya dinleme ihtiyacı çıkabilir. Altyapı bunu destekleyecek şekilde tasarlanır.

---

## 13. Bildirim Sistemi

Bu bölüm kullanıcıya gönderilen in-app ve email bildirimlerinin mimarisini ve kurallarını tanımlar.

### 13.1. Bildirim Kanalları
**Karar [N-001]:** MVP'de iki bildirim kanalı desteklenir (bu karar v0.5 öncesi N-OPEN-1'i kapatır):
- **In-app bildirim** — Uygulama içi bildirim merkezi (header'daki çan ikonu)
- **Email** — SMTP üzerinden

Push notification, SMS, Slack, Teams vb. kanallar **MVP dışıdır**. Altyapı [N-005] event-driven olarak tasarlanır; yeni kanal eklemek provider implementasyonu eklemekten ibarettir.

### 13.2. Email Servisi
**Karar [N-002]:** Email gönderimi **SMTP** üzerinden yapılır (bu karar N-OPEN-2'yi kapatır).
- AWS SES kullanılmaz; kurumsal SMTP sunucusu tercih edilir (şirket mail altyapısıyla entegre).
- SMTP konfigürasyonu environment variable'lardan okunur: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (prod'da Secret Manager), `SMTP_FROM_ADDRESS`, `SMTP_FROM_NAME`.
- TLS **zorunlu** — `SMTP_SECURE=true` (TLS 1.2+). Kurumsal SMTP TLS desteklemiyorsa alternatif değerlendirilir (SEC ekibi onayı).
- **Nodemailer** kütüphanesi ile gönderim; NestJS `@nestjs-modules/mailer` wrapper.
- Email gönderim retry policy: başarısız teslim → BullMQ ile 3 deneme (exponential backoff: 1dk, 5dk, 15dk), sonra DLQ.
- **DKIM + SPF** kayıtları kurumsal DNS'te yapılandırılır (spam filtresine girmemek için).
- Bounce ve complaint işleme: SMTP response koduna göre mail kaydı DB'de `BOUNCED` veya `COMPLAINED` işaretlenir; kullanıcıya SMS/in-app alternatif bildirim devreye alınır (MVP sonrası).

### 13.3. Zorunlu Bildirim Politikası
**Karar [N-003]:** Kullanıcı bildirim tercihi ayarları **YOKTUR** (bu karar N-OPEN-3'ü kapatır). Tüm kullanıcılar tüm sistem bildirimlerini almak zorundadır — bildirim almama opsiyonu yok. Gerekçe:
- Platform kurumsal bir görev yönetimi aracıdır; görev atama bildirimi kritik iş süreci bilgisidir.
- Opt-out olması kullanıcının SLA aşımı veya süreç ilerlemesi konusunda kritik bilgiyi kaçırmasına neden olur.
- KVKK kapsamında açık rıza metni ([SEC-042]) sistem bildirimlerini kapsar.

### 13.4. Digest (Toplu Bildirim)
**Karar [N-004]:** Bildirim toplu işleme (digest / rollup) **MVP dışıdır** (bu karar N-OPEN-4'ü kapatır). Her event ayrı bir bildirim üretir. MVP sonrası eklenebilir — özellikle "günde 5+ bildirim alan kullanıcılar için günlük özet" opsiyonu kullanıcı deneyimi analizi sonrası değerlendirilecek.

### 13.5. Bildirim Tetikleyici Olaylar
**Karar [N-005]:** MVP'de aşağıdaki olaylar bildirim tetikler (bu karar N-OPEN-5'i kapatır). Diğer olaylar bildirim üretmez:

| Olay | Kime | Kanal | İçerik |
|---|---|---|---|
| Görev atandı | Göreve atanan kullanıcı(lar) | In-app + Email | "Size [süreç adı] sürecinde [görev adı] görevi atandı" |
| Claim tipi görev claim edildi | Aynı göreve aday diğer kullanıcılar | In-app | "[Görev adı] başka bir kullanıcı tarafından üstlenildi" |
| SLA yaklaşma uyarısı (%80 eşik — bkz. [T-011]) | Göreve atanan kullanıcı + yöneticisi (eğer süreç `.md` dosyasında tanımlıysa) | In-app + Email | "[Görev adı] SLA süresi yaklaşıyor, kalan: X saat" |
| SLA aşımı (%100 eşik) | Göreve atanan kullanıcı + yöneticisi + süreç başlatan | In-app + Email | "[Görev adı] SLA süresi aşıldı" |
| Süreç tamamlandı | Süreci başlatan kullanıcı | In-app + Email | "[Süreç adı] süreciniz başarıyla tamamlandı" |
| Süreç iptal edildi | Süreci başlatan + süreçte aktif görevi olan kullanıcılar | In-app + Email | "[Süreç adı] süreci iptal edildi" (gerekçe gösterilmez, bkz. [AP-009]) |
| Rollback yapıldı | Süreci başlatan + rollback sonrası göreve atanan kullanıcılar | In-app | "[Süreç adı] süreci [X adımına] geri alındı" |
| Virüs taraması enfekte dosya | Dosyayı yükleyen kullanıcı | In-app + Email | "Yüklediğiniz [dosya adı] güvenlik taramasında zararlı tespit edildi ve silindi" |
| Hesap kilitlendi (başarısız login) | Hesap sahibi | Email | "Hesabınız çok fazla başarısız giriş nedeniyle 30dk kilitli" |
| Şifre sıfırlama talebi | Talep eden | Email | Reset link (bkz. [SEC-018]) |
| Şifre değişti | Hesap sahibi | Email | "Şifreniz değiştirildi; siz değilseniz bize ulaşın" (bkz. [SEC-018]) |
| Şifre süresi yaklaşıyor (14 gün kala) | Hesap sahibi | In-app + Email | "Şifreniz 14 gün içinde dolacak, değiştirmeniz önerilir" |
| Yetkisiz IP'den login denemesi (SEC-023) | Hesap sahibi | Email | "Yeni bir konumdan giriş tespit edildi" |
| Superadmin login (SEC-025) | Superadmin + güvenlik ekibi | Slack + Email | "Superadmin login olduğunu bilgilendirir" |
| Anomali tespiti (SEC-062) | Kullanıcı + güvenlik ekibi | In-app + Email | Anomali türüne göre şablon |
| Audit log zincir bozulması (SEC-050) | Superadmin + güvenlik ekibi | Email (P1 alarm) | Critical alarm |
| Süreç `.md` dosyasında tanımlı özel olaylar | Süreç tanımına göre | Süreç tanımına göre | Süreç tanımına göre |

Yukarıdaki listeye ek bildirim eklemek bir geliştirme işlemidir — `NotificationEvent` enum'una yeni değer eklenir ([AUTH-009] pattern'i gibi).

### 13.6. Bildirim Mimarisi
**Karar [N-006]:** Bildirim sistemi **event-driven** tasarım kullanır:

**Mimari akış:**
```
Domain event (örn: TaskAssigned) 
  → EventEmitter (NestJS built-in veya dedicated event bus)
  → NotificationListener 
  → BullMQ queue ('notifications')
  → NotificationWorker
  → Channel dispatcher (InAppChannel, EmailChannel)
  → Persistence (in-app için DB) + Delivery (SMTP gönderimi)
```

**Teknik notlar:**
- Senkron API response'undan ayrıktır — kullanıcı görev onayladığında bildirim gönderimi bekletilmez.
- Queue job başarısız olursa retry + DLQ.
- Her bildirim audit log'a yazılmaz (çok fazla gürültü) — sadece kritik bildirimler ([N-005]'teki P1 alarm seviyesindekiler) audit'e gider.
- Multi-channel desteği: bir event birden fazla kanala gönderilebilir (in-app + email). Her kanal ayrı queue job'udur → biri başarısız olursa diğeri etkilenmez.

### 13.7. In-App Bildirim Merkezi
**Karar [N-007]:** In-app bildirim UI:
- Header'da çan ikonu + okunmamış sayısı rozeti.
- Tıklama → dropdown panel, son 20 bildirim listelenir.
- Her bildirim: ikon (tip), başlık, timestamp, "Okundu işaretle" butonu, ilgili sürece/göreve link.
- "Tümünü gör" linki → `/notifications` sayfası (tam liste, filtreleme: okunmamış, tip, tarih).
- "Tümünü okundu işaretle" butonu.
- **Near real-time** güncelleme ([S-005] uyumlu): TanStack Query polling 30 saniye interval. MVP sonrası WebSocket/SSE geçişi yapılabilir (altyapı hazır).

### 13.8. Bildirim DB Şeması
**Karar [N-008]:** `notifications` tablosu:
- `id` (UUID, PK)
- `user_id` (FK → users)
- `event_type` (enum — `TASK_ASSIGNED`, `SLA_WARNING`, vb.)
- `channel` (enum — `IN_APP`, `EMAIL`)
- `title` (VARCHAR)
- `body` (TEXT)
- `link_url` (VARCHAR, nullable — ilgili süreç/görev için)
- `metadata` (JSONB — processId, taskId vb.)
- `read_at` (TIMESTAMPTZ, nullable)
- `sent_at` (TIMESTAMPTZ — in-app için created_at'e eşit; email için gerçek gönderim zamanı)
- `delivery_status` (enum — `PENDING`, `SENT`, `FAILED`, `BOUNCED`)
- `created_at`

In-app bildirimler `SELECT ... WHERE user_id = X AND channel = 'IN_APP'` ile çekilir. Email bildirimleri delivery tracking için tutulur.

### 13.9. Bildirim Retention
**Karar [N-009]:** Bildirim saklama politikası:
- In-app bildirimler **90 gün** saklanır, sonra otomatik silinir (cron job).
- Okunmuş bildirimler 30 gün sonra da silinebilir (opsiyonel, kullanıcı seçimi MVP sonrası).
- Email delivery kayıtları **2 yıl** saklanır (delivery dispute için).

### 13.10. Email Şablon Yönetimi
**Karar [N-010]:** Email şablonları Sistem Ayarları ekranında Superadmin tarafından düzenlenir ([AP-013] Bölüm A).
- Şablon formatı: HTML (rich) + text (fallback).
- Dinamik değişkenler `{{variable}}` syntax ile.
- Her şablonun kendi required variables listesi enum'da tanımlı — şablon kaydında validation yapılır (eksik variable → hata).
- Şablon güncelleme audit'e yazılır (`EMAIL_TEMPLATE_UPDATED`).
- Şablon versiyonlama MVP'de yok — her düzenleme üzerine yazar.

---

## 14. Tech Stack

Bu bölüm platformun teknoloji seçimlerini tek tek tanımlar. Her karar, kod standardı, kütüphane sürümü ve agent davranışları için referans kaynağıdır.

### 14.1. Frontend Framework
**Karar [TS-001]:** **Next.js 15 (App Router)** kullanılır.
- Rationale: File-based routing, RSC, layout yapısı, shadcn/ui kanonik kurulumu. Internal dashboard/form ağırlıklı senaryoya optimal uyum. En geniş AI-training veri havuzuna sahip framework — vibe coding için düşük hata oranı.
- Rendering: MVP'de çoğunlukla `"use client"` bileşenler + korumalı route'lar. RSC katmanı kritik değildir ancak gelecekte kullanılabilir.

### 14.2. Backend Framework
**Karar [TS-002]:** **NestJS** kullanılır.
- Rationale: Guard + Decorator pattern yetki mimarisi [AUTH-005] için birebir uyumlu. Modüler DDD-lite yapısı [CODE-001] klasör önerisiyle örtüşür. Built-in DI, Interceptor (audit için), Pipe (validation), Exception Filter enterprise ihtiyacını karşılar.
- Node.js 20 LTS üzerinde çalıştırılır.

### 14.3. Dil
**Karar [TS-003]:** **TypeScript (strict mode)** zorunludur.
- `tsconfig.json` içinde `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true` açıktır.
- `any` tipi yasaktır (bkz. [CODE-003]). Gerçekten bilinmeyen tipler için `unknown` kullanılır.

### 14.4. Repo Yapısı
**Karar [TS-004]:** **Monorepo** — pnpm workspaces + **Turborepo**.
- Paket yöneticisi: **pnpm** (npm / yarn yerine).
- Build orkestrasyonu: **Turborepo** (lokal cache, paralel task).
- Klasör düzeni:
```
apps/
  web/               # Next.js (frontend)
  api/               # NestJS (backend)
packages/
  shared-types/      # Enum'lar, permission listesi, DTO tipler
  shared-schemas/    # Zod şemaları (form + API)
  config-eslint/     # Paylaşılan ESLint preset
  config-ts/         # Paylaşılan tsconfig base
  config-tailwind/   # Paylaşılan Tailwind preset (opsiyonel)
```

### 14.5. UI Kütüphanesi ve Styling
**Karar [TS-005]:** **shadcn/ui + Tailwind CSS**.
- Bileşenler copy-paste modeli ile `apps/web/components/ui/` altına kendi kodumuz olarak girer; library dependency tutulmaz.
- Radix UI tabanlı → a11y built-in.
- Form stack: **react-hook-form + @hookform/resolvers/zod + shadcn/ui Form** üçlüsü.
- Icon: `lucide-react` (shadcn varsayılanı).
- Data table: **TanStack Table** + shadcn DataTable pattern.

### 14.6. State Yönetimi
**Karar [TS-006]:** İki ayrı sorumluluk, iki ayrı kütüphane:
- **Server state (cache, fetch, invalidation):** **TanStack Query** — yetki cache invalidation, süreç listesi, görev listesi vb.
- **Client state (UI/geçici state):** **Zustand** — sidebar, filtreler, modal durumu.
- Redux Toolkit **kullanılmaz** (bu uygulamada global mutasyon-ağır client state yoktur).

### 14.7. API Stili
**Karar [TS-007]:** **REST + OpenAPI** (Swagger).
- NestJS'te `@nestjs/swagger` decorator'larından otomatik OpenAPI spec üretilir (`/api/docs`).
- Frontend tipli API client: **orval** veya **openapi-typescript** ile OpenAPI spec'inden otomatik üretilir.
- Endpoint naming: `kebab-case`, resource-based (örn: `POST /api/v1/processes/{id}/tasks/{taskId}/approve`).
- Versiyonlama: URL path üzerinden (`/api/v1/...`), gelecekte major değişiklik için `/api/v2/`.
- tRPC ve GraphQL **kullanılmaz** (SAP, mobile, PowerBI entegrasyonlarında REST daha uyumlu).

### 14.8. Validation
**Karar [TS-008]:** **Zod** — hem frontend'de hem backend'de, **tek kaynaktan** (`packages/shared-schemas/`).
- Frontend: `react-hook-form` + `@hookform/resolvers/zod`.
- Backend: `nestjs-zod` ile DTO ve Pipe entegrasyonu.
- class-validator, Yup **kullanılmaz**.

### 14.9. Authentication
**Karar [TS-009]:** **Custom implementasyon** — NestJS Passport + JWT.
- Şifre hash: **bcrypt** (cost factor 12).
- Token modeli: **Access token (JWT, 15 dk) + Refresh token (opaque, httpOnly cookie, 7 gün, rotation'lı)**.
- Passport stratejileri: `LocalStrategy` (login), `JwtStrategy` (API guard); ilerleyen aşamada `OidcStrategy` (RedHat SSO — Keycloak).
- Token revoke/blacklist: Redis üzerinde.
- Auth.js / Clerk / Auth0 **kullanılmaz** (superadmin seed, KVKK veri kontrolü, RedHat SSO uyumu ve maliyet gerekçesi).
- MFA/2FA MVP'de yoktur (bkz. [A-008]); eklenirken TOTP (Google Authenticator uyumlu) tercih edilir.

### 14.10. Veritabanı Engine
**Karar [TS-010]:** **Amazon Aurora — PostgreSQL uyumlu** (Aurora PostgreSQL). Bu [INF-OPEN-1]'i kapatır.
- Rationale: JSONB (audit log eski/yeni değer), array / enum tipleri, Prisma olgunluğu, pg_trgm (full-text), Row-Level Security opsiyonu, CTE ve window function gücü.
- Engine major sürümü: Aurora PostgreSQL 16 uyumlu (veya mevcut en yüksek LTS sürüm).
- MySQL kullanılmaz.

### 14.11. Destekleyici Tooling (Bağlı Kararlar)
Aşağıdakiler tech stack seçimlerinin doğal uzantısıdır; burada sabitlenir ki agent her proje kurulumunda aynı kütüphaneyi seçsin:

| Alan | Seçim | Not |
|---|---|---|
| ORM | **Prisma** | [INF-002] ile onaylı; PostgreSQL migration + type-safe client |
| Queue / Worker | **BullMQ** (Redis tabanlı) | Bildirim, SLA kontrolü, audit log async yazma |
| Logger | **Pino** (+ `nestjs-pino`) | Structured JSON log; `console.log` yasak [CODE-003] |
| Unit test | **Vitest** | Jest'ten daha hızlı, ESM uyumlu |
| API integration test | **Supertest** | NestJS testing ekosistemi ile uyumlu |
| E2E test | **Playwright** | Multi-browser, auth storageState desteği |
| Linting | **ESLint** (typescript-eslint flat config) | `packages/config-eslint/` ortak preset |
| Formatter | **Prettier** | ESLint ile `eslint-config-prettier` ile çakışmasız |
| Git hooks | **Husky + lint-staged** | Pre-commit lint + format |
| Commit standard | **Conventional Commits** + commitlint | CHANGELOG üretimi için |
| Error tracking | **Sentry** | Frontend + backend tekil DSN ile |
| Container | **Docker + docker-compose** | Lokal dev: Postgres + Redis + MinIO (S3 mock) |

### 14.12. Sürüm Stratejisi
**Karar [TS-011]:** Tüm kütüphaneler **pinned major + minor** (örn: `"next": "^15.1.0"`) olarak kurulur. `package.json` içinde wildcard (`*`) veya latest kullanılmaz. `pnpm-lock.yaml` repo'ya commit edilir.

---

## 15. Altyapı ve Operasyon

### 15.1. Veritabanı
**Karar [INF-001]:** **Amazon Aurora PostgreSQL** (bkz. [TS-010]).

### 15.2. ORM
**Karar [INF-002]:** **Prisma** ORM kullanılır.

### 15.3. Obje Depolama
**Karar [INF-003]:** **Amazon S3**.

### 15.4. Uptime Hedefi
**Karar [INF-004]:** Uptime SLA **%99**.

### 15.5. Redis Yönetimi
**Karar [INF-005]:** Redis için **AWS ElastiCache for Redis** kullanılır (bu karar INF-OPEN-11'i kapatır).
- **Gerekçe:**
  - VPC içi iletişim (private subnet) — backend ile düşük latency.
  - AWS IAM + KMS entegrasyonu [SEC-010] encryption kararı ile uyumlu.
  - Managed (backup, upgrade, failover otomatik).
  - BullMQ [TS-011] Redis 6+ ile uyumlu.
- **Yapılandırma:**
  - Engine: **Redis 7.x** (en güncel stabil).
  - Node tipi MVP: `cache.t4g.small` (2 vCPU, 1.37 GB RAM, ~$25-30/ay).
  - **Multi-AZ:** Aktif (primary + replica, otomatik failover).
  - **Cluster mode:** MVP'de **disabled** (tek primary + 1 replica yeterli). Kullanım artarsa cluster mode açılır.
  - **Encryption in-transit:** Aktif (TLS).
  - **Encryption at-rest:** Aktif (KMS CMK).
  - **AUTH token:** Aktif (ElastiCache Redis AUTH, Secrets Manager'da saklı).
  - **Backup:** Günlük snapshot, 7 gün saklanır.
  - **Maintenance window:** Pazar 03:00 TRT.
- **Kullanım amaçları:**
  - Yetki cache [AUTH-004] (10dk TTL, key prefix `permissions:*`)
  - JWT blacklist/revoke [TS-009] (TTL access token ömrüne eşit)
  - BullMQ queue'ları (bildirim, SLA kontrolü, audit async, virüs tarama)
  - Rate limiting counters [SEC-019] (başarısız login sayımı)
  - Session store (refresh token hash'leri)
- **Resilience:** Redis down olursa backend graceful degradation — yetki cache miss'te DB'den çözer (yavaş ama çalışır), queue'lar BullMQ tarafından retry edilir.

### 15.6. CI/CD
**Karar [INF-006]:** CI/CD platformu **GitHub Actions** kullanılır (bu karar INF-OPEN-5'i kapatır).
- **Gerekçe:**
  - Tek developer geliştirme modeli için overhead düşük — platform setup'ı GitHub repo ile tek çatıda.
  - AWS OIDC entegrasyonu native [SEC-065] — static AWS access key yok.
  - Public marketplace actions zengin (Turborepo, Prisma migration, Playwright vb. hazır actions).
  - Monthly free tier: 2000 dk (private repo). Tek developer projesi için bolca yeterli.
- **Pipeline yapısı:**

  **1. Pull request pipeline** (her PR'da çalışır):
  - Dependency install: `pnpm install --frozen-lockfile`
  - Lint: `pnpm lint` (ESLint flat config)
  - Type check: `pnpm type-check` (tsc --noEmit)
  - Unit test: `pnpm test:unit` (Vitest)
  - Integration test: `pnpm test:integration` (Supertest, ephemeral Postgres + Redis Docker)
  - Build: `pnpm build` (Next.js + NestJS)
  - Security: `pnpm audit --audit-level=high`, gitleaks, Semgrep [SEC-055, SEC-057]
  - Docker image build + Trivy scan [SEC-056]
  - Coverage report → GitHub PR comment

  **2. Main branch pipeline** (merge sonrası):
  - Tüm PR pipeline adımları
  - E2E test: `pnpm test:e2e` (Playwright, staging'e deploy sonrası)
  - Staging deploy (otomatik)
  - Sentry release + source map upload
  - Slack bildirim (#deployments)

  **3. Production deploy pipeline** (manuel trigger, superadmin onayı ile):
  - Main pipeline'dan başarılı artifact kullanılır (yeniden build edilmez)
  - Database migration dry-run (Prisma `migrate diff`) — review için çıktı PR'a yazılır
  - Blue-green deployment [SEC-066]
  - Smoke test (production endpoint health check)
  - Rollback hazır (önceki image tag 30 dk bekletilir)

- **Branch protection:**
  - `main` branch'e direkt push yasak; sadece PR merge.
  - Required status checks: Lint + Type + Unit + Integration + Security.
  - Required reviewers: MVP'de solo developer için bu zorlayıcıdır — **self-review yeterli** (PR template'te checklist doldurma), ama `CODEOWNERS` dosyası `main` branch kritik path'ler için future-proofing amaçlı eklenir.
  - Signed commits [SEC-065]: GPG veya SSH key ile imzalı.

### 15.7. Monitoring
**Karar [INF-007]:** **CloudWatch + Sentry** kombinasyonu kullanılır; MVP'de ek tool yoktur.
- **CloudWatch:**
  - Logs: tüm pod/container stdout → CloudWatch Logs (log group başına retention).
  - Metrics: CPU, memory, network, custom application metrics.
  - Alarms: [SEC-061] P1/P2/P3 tier kurallarına göre Slack/email/SMS.
  - CloudWatch Dashboards: operasyonel sağlık paneli (response time, error rate, DB connection pool vb.).
- **Sentry:**
  - Frontend + backend tekil DSN (proje başına ayrı).
  - Error tracking, release tracking, performance (tracing).
  - Source map upload CI pipeline'da otomatik.
  - PII scrubber aktif [SEC-052] uyumlu (email, phone, sicil maskelenmiş).
- Datadog, Splunk, ELK gibi alternatifler MVP dışı — büyümeyle birlikte [SEC-OPEN-SIEM] iterasyonunda değerlendirilecek.

### 15.8. Log Toplama Stratejisi
**Karar [INF-008]:** Log stratejisi (bu karar INF-OPEN-7'yi kapatır):

**Aggregation (merkezi toplama):**
- Tüm uygulama log'ları (backend pods, worker, scan Lambda, Next.js) **CloudWatch Logs**'a gönderilir.
- Her servis kendi log group'una yazar: `/app/leanmgmt/api`, `/app/leanmgmt/web`, `/app/leanmgmt/scan-lambda`.
- Log format: **Pino JSON structured** — `timestamp, level, msg, traceId, userId, reqId, ...`.
- TraceId propagation: Request başlarken middleware traceId üretir → tüm downstream call'larda taşınır (log'larda görünür).

**Retention (saklama + imha):**

| Log Tipi | CloudWatch (hot) | S3 Archive (cold) | Tam İmha |
|---|---|---|---|
| Application log (info, debug) | 7 gün | 30 gün | 30 gün sonra |
| Application log (error, warn) | 30 gün | 1 yıl | 1 yıl sonra |
| Access log (CloudFront) | 7 gün | 30 gün | 30 gün sonra |
| Security log (WAF, auth events) | 30 gün | 2 yıl | 2 yıl sonra (bkz. [SEC-053]) |
| Audit log (DB tablosu) | — | 1 yıl (bkz. [AUD-002]) | 1 yıl sonra |
| KMS CloudTrail | 90 gün | 2 yıl | 2 yıl sonra |

- **Hot storage (CloudWatch):** Hızlı sorgu, pahalı. Canlı troubleshooting için.
- **Cold storage (S3 + Lifecycle policy):** CloudWatch Logs'tan otomatik export, Glacier'a kademeli geçiş (30 gün sonra Glacier Instant Retrieval, 90 gün sonra Glacier Flexible Retrieval). Compliance ve post-incident inceleme için.
- S3 archive bucket SSE-KMS şifreli [SEC-010], Object Lock ile immutable (WORM).
- Otomatik imha: S3 Lifecycle policy belirtilen sürelerden sonra objeyi siler.

**Log içeriği PII koruması:** [SEC-052] uyumlu — Pino redactor JWT, password, refresh token, email (kısmen) maskeler.

### 15.9. Secret Yönetimi Detayları
**Karar [INF-009]:** Secret yönetimi ortamlara göre ayrılır (bu karar INF-OPEN-8'i kapatır; [SEC-037] baz kararını detaylandırır):

**Development ortamı:**
- `.env.local` dosyası (gitignore'da).
- `.env.example` dosyası repo'da — placeholder değerlerle, yapılandırma referansı.
- Her developer kendi `.env.local`'ini kurar — test credentials, local Docker compose config.
- Secret pattern taraması (gitleaks) `.env*` dosyalarında aktif, yanlışlıkla commit önlemi.

**Staging ve Production ortamı:**
- `.env` **yoktur** — uygulama secret'ları runtime'da secret store'dan çeker.
- **AWS Secrets Manager** ana secret store:
  - DB credentials (otomatik rotation)
  - SMTP credentials
  - JWT RS256 private/public key pair
  - CloudFront signing key
  - KMS key references
  - SMTP password
  - Redis AUTH token
- **AWS Systems Manager Parameter Store** (SecureString) düşük-rotation config:
  - Feature flag'ler
  - External API endpoint URL'leri
  - Rate limit parametreleri (zaten [AP-013] Sistem Ayarları ekranında DB'de tutuluyor; Parameter Store sadece bootstrap config için)
- Erişim: IAM role-based (servis başına granular role), CloudTrail'e loglanır [SEC-039].
- Rotation politikası [SEC-038] uyumlu.

**Secret injection pattern (NestJS):**
```typescript
// apps/api/src/config/config.module.ts
@Module({
  providers: [{
    provide: 'APP_CONFIG',
    useFactory: async () => {
      if (process.env.NODE_ENV === 'development') {
        return loadFromDotEnv();  // dev: .env.local
      }
      return await loadFromSecretsManager();  // prod/staging: AWS
    },
  }],
  exports: ['APP_CONFIG'],
})
```
- Config Zod şemasıyla validate edilir — eksik/invalid secret → uygulama boot'ta fail-fast.
- Agent **asla** secret'ı `console.log` veya response'a yazmaz ([CODE-003], [SEC-052]).

### 15.10. Açık Altyapı Detayları
Mevcut ama henüz kararlaştırılmamış altyapı kararları Bölüm 18'de listelenir.

---

## 16. Test Stratejisi

### 16.1. Temel Prensip
**Karar [TEST-001]:** Test kültürü önemlidir. Agent mutlaka **smoke test** yapar, geliştirdiği şeyi kendi kontrol eder, ardından kullanıcıya test ettirir.

### 16.2. Test Araçları
**Karar [TEST-003]:** Test araçları (bkz. [TS-011]):
- **Vitest** — unit testler
- **Supertest** — NestJS API integration testleri
- **Playwright** — E2E testler (multi-browser, auth state yönetimi ile)

### 16.3. Agent Test Davranışı — Zorunlu Akış
**Karar [TEST-002]:** Agent her feature için aşağıdaki test akışını **zorunlu** olarak uygular (bu karar TEST-OPEN-4'ü kapatır):

**Feature geliştirme sırasında:**
1. Agent kod yazar, ESLint ve tip kontrollerini geçer.
2. Agent **unit test** yazar (Vitest). En az bir test dosyası olmadan feature tamamlanmış sayılmaz.
3. Agent **integration test** yazar (Supertest) — API endpoint'i varsa ve business logic kritikse.
4. Feature ile ilgili smoke test senaryolarını `.mdc` rule dosyasında veya feature branch'teki `README.md`'de tariflendirir.

**Smoke test (agent kendi kontrol eder):**
5. Agent feature'ı çalıştırır — local dev server'da veya test container'da.
6. HTTP endpoint varsa curl / HTTPie ile örnek çağrı yapar.
7. DB etkisi varsa DB'yi sorgular (Prisma Studio veya psql).
8. Dosya yükleme varsa yükler, tarama sonucunu bekler.
9. Sonuçları **açık bir rapor** olarak sunar:
   > "Feature X implemente edildi. Şunu denedim:
   > - POST /api/v1/users — 201 Created, DB'de kullanıcı oluştu
   > - Invalid payload — 400 Bad Request, beklenen Zod hatası
   > - Yetkisiz request — 403 Forbidden
   > Tüm senaryolar beklendiği gibi çalıştı."

**Kullanıcı test süreci — zorunlu:**
10. Agent **kullanıcıya test etmesi için talimat verir** — hangi ekrandan, hangi adımlarla test yapılabilir, beklenen davranış ne.
11. Kullanıcı test etmeden agent **merge / push yapmaz**. Bu kritik kuraldır — kullanıcı explicit "test ettim, çalışıyor" demeden `main` branch'e merge yasaktır.
12. Kullanıcı test sırasında sorun bulursa agent düzeltir, testi tekrar eder, yeniden kullanıcıya verir.
13. Kullanıcı onayından sonra CI pipeline otomatik olarak çalışır [INF-006].

Bu kural `.mdc` agent rule dosyalarına çevrileceğinde "user-approval-before-merge" zorunluluğu haline gelir.

### 16.4. Test Coverage Hedefleri
**Karar [TEST-004]:** Test coverage hedefleri — kategori bazlı (bu karar TEST-OPEN-1'i kapatır):

| Kategori | Line Coverage | Branch Coverage | Not |
|---|---|---|---|
| **Yetkilendirme + Auth** (auth, roles, permissions modülleri) | **%90+** | **%85+** | Güvenlik kritik — regression riski yüksek |
| **Şifreleme + Güvenlik** (encryption, password, session) | **%95+** | **%90+** | En kritik iş mantığı |
| **Workflow engine** (süreç motoru, görev atama, SLA) | **%85+** | **%80+** | Business logic çekirdeği |
| **Service layer** (modules/*/service.ts) | **%80+** | **%75+** | İş mantığı genel |
| **Repository layer** (Prisma erişim) | **%70+** | **%60+** | Çoğunlukla Prisma wrapper |
| **Controller layer** | **%60+** | **%50+** | E2E testle tamamlanır |
| **Utility / helper** | **%90+** | **%85+** | Saf fonksiyonlar, test kolay |
| **Shared schemas / types** | **%90+** | - | Zod şema testleri |
| **UI component (frontend)** | **%50+** | - | Visual regression ve E2E daha önemli |
| **Genel ortalama** | **%75-80** | - | Proje geneli minimum eşik |

**Coverage kuralları:**
- CI pipeline'da Vitest `--coverage` flag'i ile ölçülür.
- **Feature PR'ı coverage'ı düşürüyorsa CI fail.**
- Coverage raporu GitHub PR comment'inde görünür.
- Belirli dosyalar coverage dışında bırakılabilir: DTO, index.ts, config, mock dosyalar, storybook stories — `vitest.config.ts` `coverage.exclude` listesinde tanımlı.
- `critical` tag'li testler — auth, encryption, audit chain — `test.concurrent.only` ile çalıştırılamaz (sıralı + izole).

### 16.5. Test Piramidi
**Karar [TEST-005]:** Proje testleri klasik piramidi takip eder:
- **~70% unit tests** (Vitest) — hızlı, izole, yüksek sayı
- **~20% integration tests** (Supertest + Prisma test DB) — module etkileşimi
- **~10% E2E tests** (Playwright) — kritik user journey'ler (login, süreç başlat, görev onayla, dosya yükle)

E2E testleri CI'da main branch merge sonrası çalışır (staging'de). PR pipeline sadece unit + integration.

### 16.6. Staging Seed Data
**Karar [TEST-006]:** Staging ortamı seed data stratejisi (bu karar TEST-OPEN-3'ü kapatır):
- Staging DB'de **sentetik (fake) veri** kullanılır — production veri KOPYALANMAZ [SEC-067] principle of least privilege.
- Seed script'i (`apps/api/prisma/seed.ts`) aşağıdaki veriyi üretir:
  - 3 test şirketi (ABC, XYZ, DEF)
  - 10 lokasyon (fabrika ve ofis karışık)
  - 15 departman, 10 pozisyon, 5 kademe
  - 500 fake kullanıcı (Faker.js ile üretilmiş Türkçe ad/soyad, sicil, email `<sicil>@staging.leanmgmt.local`)
  - Her kullanıcıya rastgele 1-3 rol
  - 100 başlatılmış süreç (farklı statülerde — active, completed, cancelled)
  - 200 doküman (fake PDF, 1-500KB boyutlarında)
- Seed her staging deploy'unda çalıştırılmaz; sadece **manuel trigger** ile yeniden yüklenebilir (DB reset gereken durumlarda).
- Production'da seed **asla çalıştırılmaz** (bkz. [A-012]).

---

## 17. Kod Organizasyonu ve Agent Kuralları

> Tech stack seçimleri (Bölüm 13) netleştikten sonra bu bölüm TypeScript + NestJS + Next.js kabulleriyle sabitlenmiştir.

### 17.1. Klasör Yapısı
**Karar [CODE-001]:** Monorepo (bkz. [TS-004]) yapısı içinde her uygulama **feature-based + DDD-lite** düzen kullanır.

`apps/api/` (NestJS):
```
apps/api/src/
  modules/
    auth/
    users/
    roles/
    permissions/
    master-data/
    processes/
      kaizen-before-after/
    tasks/
    documents/
    notifications/
    audit/
  shared/
    database/        # Prisma client, migrations yardımcıları
    cache/           # Redis client + key builder
    storage/         # S3 + CloudFront client, Signed URL üretim yardımcıları
    guards/          # PermissionGuard, OwnershipGuard vb.
    interceptors/    # AuditInterceptor, LoggingInterceptor
    pipes/           # ZodValidationPipe
    filters/         # GlobalExceptionFilter
    decorators/      # @RequirePermission, @CurrentUser
    utils/
  config/            # env schema (Zod), config modülleri
  main.ts
```

`apps/web/` (Next.js App Router):
```
apps/web/
  app/
    (auth)/          # login, şifre sıfırlama route group
    (app)/           # login-gated route group
      dashboard/
      processes/
      tasks/
      users/
      roles/
      admin/
        process-monitor/
        master-data/
        audit-log/
      layout.tsx
    layout.tsx
  components/
    ui/              # shadcn/ui copy-paste bileşenler
    forms/           # react-hook-form + zod form wrappers
    data-table/      # TanStack Table ortak bileşenler
  features/          # feature-based organizasyon
    auth/
    users/
    processes/
    tasks/
  lib/
    api-client/      # openapi-typescript ürettiği tipli client
    query-client/    # TanStack Query setup
    zustand-stores/
  hooks/
  config/
```

### 17.2. Modül İçi Alt Klasör Yapısı (NestJS)
**Karar [CODE-005]:** Her NestJS modülünün standart alt klasör yapısı:
```
modules/<feature>/
  <feature>.module.ts
  <feature>.controller.ts         # HTTP endpoint tanımı
  <feature>.service.ts            # İş mantığı
  <feature>.repository.ts         # Prisma erişim katmanı (opsiyonel; karmaşık sorgular için)
  dto/                            # Zod şemaları ve DTO'lar (shared-schemas'tan import)
  types/                          # Dahili tipler
  __tests__/                      # Unit + integration testler
```

### 17.3. Naming Conventions
**Karar [CODE-002]:**
- Klasör: `kebab-case`
- Dosya: `kebab-case.ts` (örn: `user.service.ts`, `create-user.dto.ts`)
- Class / Type / Interface: `PascalCase`
- Fonksiyon / değişken: `camelCase`
- Constant / Enum: `UPPER_SNAKE_CASE`
- DB tablo adı: `snake_case` çoğul (örn: `users`, `role_permissions`)
- DB kolon: `snake_case` (Prisma tarafında `camelCase` → `@map` ile `snake_case`'e bağlanır)
- API endpoint: `kebab-case` (örn: `/api/v1/process-instances`)
- Git branch: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`

### 17.4. Commit Standardı
**Karar [CODE-006]:** **Conventional Commits** + commitlint zorunludur.
- Formatlar: `feat(users): add user attribute editor`, `fix(auth): correct token rotation on refresh`, `chore: bump prisma to 6.1`, `docs(decisions): close T-OPEN-1`
- Tipler: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`
- Breaking change'ler `feat!:` veya footer'da `BREAKING CHANGE:` ile işaretlenir.

### 17.5. Agent'ın Yapmaması Gerekenler
**Karar [CODE-003]:**
- DB şemasını kullanıcı onayı olmadan değiştirmez (migration üretmez)
- Production'a etki edecek migration'ı otomatik çalıştırmaz
- Secret / API key'i koda gömmez — `process.env.*` + Zod ile validate edilmiş config modülü kullanır
- Yetki kontrolünü atlamaz — her controller'da `@RequirePermission(...)` decorator'u eklenir veya module-level `PermissionGuard` zincirine bağlanır
- Kopya-yapıştır kod yazmaz (DRY); tekrarlanan validation / mapping / utility'ler `shared/` veya `packages/shared-*` altına taşınır
- Test yazmadan feature'ı "bitti" demez (unit + en az bir integration test)
- `console.log` bırakmaz — Pino logger (`nestjs-pino`) kullanır
- TypeScript'te `any` kullanmaz; gerçek bilinmezlik için `unknown` + type guard
- Hard-coded string yerine enum / constant kullanır (özellikle permission, statü, rol adları)
- Error handling'siz try-catch bırakmaz; `catch` ile yakalanan her hata loglanır veya typed exception olarak yeniden fırlatılır
- Shared types / enum'ları `apps/web` veya `apps/api` altına koymaz — `packages/shared-types/` kullanır
- Zod şemalarını tek tarafta (sadece backend ya da sadece frontend) tanımlamaz — `packages/shared-schemas/` üzerinden paylaşır

### 17.6. Her Feature İçin Kontrol Listesi
**Karar [CODE-004]:** Agent her feature eklerken şu listeyi kontrol eder:
1. Yetki kontrolü (`@RequirePermission(...)` veya guard) eklendi mi?
2. Şirket bazlı veri filtresi (gerekiyorsa) eklendi mi?
3. Audit log yazıldı mı (AuditInterceptor veya servis içinden)?
4. PII alanları şifrelendi / doğru kolon tipine yazıldı mı?
5. Input validation (Zod şeması + ZodValidationPipe) var mı?
6. Error handling + kullanıcı dostu hata mesajı (Türkçe) var mı?
7. Smoke test yapıldı mı (agent manuel çağrı + rapor)?
8. Unit test yazıldı mı?
9. OpenAPI (`@nestjs/swagger`) decorator'ları güncellendi mi?
10. İlgili `.md` dokümantasyonu (süreç, karar, runbook) güncellendi mi?
11. `shared-types` / `shared-schemas` eklenmesi gereken yeni enum / şema var mı?
12. Commit mesajı Conventional Commits formatına uygun mu?

---

## 18. Açık Kararlar — Tamamlanması Gerekenler

Aşağıdaki kararlar henüz alınmamıştır. Bu kararlar tamamlanmadan ilgili kod parçalarının geliştirilmesine başlanmamalıdır.

### 18.1. Altyapı Detayları
**Öncelik: 🟠 Yüksek**

- [ ] **[INF-OPEN-3]** Aurora Multi-AZ onayı (production için)
- [ ] **[INF-OPEN-4]** Deployment platformu (ECS Fargate / Lambda / EC2 / EKS?)
- [ ] **[INF-OPEN-9]** Backup süresi ve PITR (Point-in-Time Recovery) konfigürasyonu
- [ ] **[INF-OPEN-10]** Environment yapısı — dev/staging/prod AWS hesap izolasyonu stratejisi

### 18.2. Süreç Detayları
**Öncelik: 🟠 Yüksek**

- [ ] **[W-OPEN-1]** `before-after-kaizen-process.md` dosyasının içeriği (adımlar, atamalar, SLA, reddetme akışı, all-required/claim modları)

### 18.3. Güvenlik — İleri İterasyon Maddeleri
**Öncelik: 🟢 Düşük (MVP sonrası)**

Bu maddeler Bölüm 10.18'de detaylandırıldı; takip için burada da listelenir:

- [ ] **[SEC-OPEN-MFA]** MFA/2FA — TOTP, Superadmin için zorunlu
- [ ] **[SEC-OPEN-WEBAUTHN]** WebAuthn / FIDO2 passkey desteği
- [ ] **[SEC-OPEN-HSM]** AWS CloudHSM geçişi (FIPS 140-2 Level 3)
- [ ] **[SEC-OPEN-SIEM]** Dedicated SIEM (Datadog/Splunk/Elastic)
- [ ] **[SEC-OPEN-DLP]** Endpoint DLP (Forcepoint/Symantec)
- [ ] **[SEC-OPEN-RLS]** PostgreSQL Row-Level Security aktivasyonu
- [ ] **[SEC-OPEN-AUDIT-EXTERNAL]** Audit log external WORM storage (S3 Object Lock)
- [ ] **[SEC-OPEN-BOUNCE]** Email bounce + complaint handling otomatik işleme (MVP sonrası [N-002])
- [ ] **[SEC-OPEN-DIGEST]** Bildirim digest / rollup özelliği ([N-004] MVP sonrası)
- [ ] **[SEC-OPEN-WS]** In-app bildirimler için WebSocket/SSE geçişi ([N-007] MVP sonrası real-time)

---

## Versiyon Geçmişi

| Versiyon | Tarih | Açıklama |
|----------|-------|----------|
| 0.1 | 20 Nisan 2026 | İlk taslak. Proje kimliği, kullanıcı yapısı, yetkilendirme mimarisi, süreç temelleri, görev yönetimi, doküman yönetimi, admin panel ve temel güvenlik kararları alındı. Tech stack, bildirim, güvenlik detayları, operasyon ve test detayları açık bırakıldı. |
| 0.2 | 21 Nisan 2026 | Tech stack netleştirildi (TS-001..TS-011): Next.js 15 + NestJS + TypeScript strict + pnpm/Turborepo monorepo + shadcn/ui + TanStack Query + Zustand + REST/OpenAPI + Zod + Custom JWT (Passport) + Aurora PostgreSQL. Attribute master data yönetimi (A-010..A-013), sistem rollerine Kullanıcı Yöneticisi ve Süreç Yöneticisi eklendi (R-001 güncellendi, R-005, R-006). Görev davranışları (T-007..T-011), admin panel akışları (AP-007..AP-009, AP-005 güncellendi) ve superadmin audit (AUD-004) kapatıldı. Kod organizasyonu Next.js + NestJS + monorepo yapısına göre sabitlendi (CODE-001 genişletildi, CODE-005, CODE-006). Açık karar listesi sadeleştirildi; kapanan 40+ madde çıkarıldı. |
| 0.3 | 21 Nisan 2026 | Doküman yönetimi tamamen kapatıldı: Presigned URL 10dk (D-007), asenkron ClamAV quarantine pattern (D-008), in-app önizleme react-pdf/mammoth/SheetJS (D-009), upload audit yazılır-download yazılmaz (D-010), KVKK silme MVP dışı (D-011). Admin panelleri genişletildi: Audit Log sadece superadmin (AP-010), Master Data Yönetimi ekranı tam detay (AP-011, AP-012), Sistem Ayarları (bildirim şablonları + KVKK metni + rate limiting parametreleri) sadece superadmin (AP-013), Dashboard MVP dışı (AP-014). Bölüm 17 açık kararlar listesinden kapanan 9 madde çıkarıldı; alt bölümler 17.3-17.7'ye kaydırıldı. |
| 0.4 | 21 Nisan 2026 | Doküman erişim güvenliği sağlamlaştırıldı: D-007 yeniden yazıldı — CloudFront + WAF (Türkiye GeoIP + rate limit + bot protection) + S3 OAC defense-in-depth modeli, Signed URL 5dk TTL, S3 bucket public erişim tamamen kapalı. D-008 ve D-009 CloudFront Signed URL terminolojisine uyumlandı. Master data modeli netleştirildi: A-011 referential FK yapısı, A-014 usage-aware sayım modeli, A-012 otomatik oluşum (Excel import / SAP senkron) akışı, A-015 work_sub_areas cascade hierarchy. AP-011 ve AP-012 "Kullanıcı Sayısı" kolonu, "Kullanılmayanlar" filtresi ve `MASTER_DATA_AUTO_CREATED` audit aksiyonu ile genişletildi. |
| 0.5 | 21 Nisan 2026 | Doküman erişim güvenliği maksimum seviyeye çıkarıldı — D-007 tamamen yeniden yazıldı: **8 katmanlı defense-in-depth** (S3 Lockdown + IP-bound Signed URL + Signed Cookie httpOnly/SameSite-Strict + agresif WAF rate limit + CAPTCHA + Bot Control + AnonymousIpList + Referer whitelist + CloudFront Functions edge validation + SSE-KMS encryption + anomali tespiti + otomatik ban). 8 saldırı senaryosu tablosu ile doğrulandı; sadece DLP kapsamındaki ekran görüntüsü açık bırakıldı. Master data kararları 6 stress-test senaryosu ile doğrulandı ve sertleştirildi: A-012 yeniden yazıldı (Excel import MVP dışı, sadece manuel + SAP HR ileride), AP-012 yeniden yazıldı (aktif kullanıcısı olan master data **pasifleştirilemez** — kullanıcı taşınması zorunlu, "Kullanıcıları Görüntüle" linki; parent reactivate cascade yok; modal içi hızlı ekleme yok; toplu import MVP dışı). |
| 0.6 | 21 Nisan 2026 | **Güvenlik ve KVKK bölümü bankacılık seviyesinde tamamen yeniden yazıldı** — Bölüm 10 sıfırdan kuruldu, 72 karar (SEC-001..SEC-072), 18 alt bölüm. Threat model + zero trust (SEC-001..SEC-003), veri sınıflandırması C1-C4 (SEC-004..SEC-006), envelope encryption + field-level şifreleme (SEC-007..SEC-012), şifre politikası 12 karakter + HIBP + history + 180gün expiry + progressive delay (SEC-013..SEC-019), RS256 JWT + refresh rotation + replay tespiti + session bütünlüğü + concurrent session + superadmin özel kuralları (SEC-020..SEC-025), HSTS + CSP nonce-based + CORS strict + CSRF double-submit + XSS/SQL/SSRF koruması (SEC-026..SEC-033), Zod validation disiplini + file upload güvenlik (SEC-034..SEC-036), Secrets Manager + rotation + leak prevention (SEC-037..SEC-040), KVKK veri hakları + "Verilerimi indir" MVP'de var + anonimleştirme akışı (SEC-041..SEC-047), eu-central-1 veri ikametgâhı (SEC-048..SEC-049), **audit log tamper-evident chain hash + PII şifreleme** (SEC-050..SEC-052 — AUD-OPEN-1 ve AUD-OPEN-2 kapandı), veri saklama matrisi (SEC-053..SEC-054), Dependabot + SAST + DAST + pen-test (SEC-055..SEC-060), P1/P2/P3 alarm tier + anomaly kuralları + incident response playbook + DDoS (SEC-061..SEC-064), CI/CD OIDC + signed commits + blue-green + least privilege (SEC-065..SEC-067), frontend hygiene + SRI + mobil hazırlık (SEC-068..SEC-070), developer eğitim + security champion (SEC-071..SEC-072). MVP sonrası 7 iterasyon planlandı (MFA, WebAuthn, HSM, SIEM, DLP, RLS, external audit WORM). SEC-OPEN-1..9 ve AUD-OPEN-1..2 tamamen kapandı. INF-OPEN-2 (AWS region=eu-central-1) SEC-048 içinde kapandı. Açık madde sayısı 32'den 22'ye düştü. |
| 0.7 | 21 Nisan 2026 | **Bildirim Sistemi, altyapı detayları ve test kuralları dokümana işlendi.** Yetkilendirme: AUTH-012/013/014 — AND + OR koşul setleri (3-katmanlı DB şeması role_rules → condition_sets → conditions, UI kural oluşturma akışı, bulk recomputation queue). Audit: AUD-003 resmileştirildi — 13 alan tablosu, chain_hash + encrypted old_value/new_value. **Yeni Bölüm 13 Bildirim Sistemi** (N-001..N-010, eski Bölüm 13-17 → 14-18 kaydırıldı): in-app + SMTP (AWS SES değil, kurumsal SMTP), zorunlu bildirim (opt-out yok), digest MVP dışı, 17 tetikleyici olay tablosu, event-driven mimari (EventEmitter → BullMQ → dispatcher), in-app UI (çan ikonu, TanStack Query 30sn polling), notifications DB şeması, retention (90gün in-app, 2yıl email), email şablon yönetimi. Altyapı: INF-005 Redis = AWS ElastiCache (cache.t4g.small, Multi-AZ, KMS, Redis 7.x), INF-006 CI/CD = GitHub Actions (solo-developer adaptasyonlu, 3 pipeline — PR/main/production), INF-007 Monitoring = CloudWatch + Sentry, INF-008 Log stratejisi (Pino JSON aggregation, retention tablosu hot 7-30gün + S3 Glacier cold 30gün-2yıl), INF-009 Secret yönetimi (dev'de .env.local, prod'da Secrets Manager + Parameter Store ayırımı, Zod fail-fast). Test: TEST-002 Agent test akışı — **kullanıcı onayı olmadan merge yasağı** kritik kuralı, TEST-004 Coverage hedefleri tablosu (auth %90+, encryption %95+, workflow %85+, ortalama %75-80), TEST-005 test piramidi (70/20/10), TEST-006 staging seed (500 fake user, prod'da seed yok). Kapanan maddeler: A-OPEN-01, AUD-OPEN-3, N-OPEN-1..5, INF-OPEN-5/6/7/8/11, TEST-OPEN-1/3/4. Açık madde 27'den 15'e düştü. |

---

## Nasıl Kullanılır?

Bu doküman **canlı bir dokümandır** — kararlar netleştikçe güncellenecektir. Her yeni karar için:

1. İlgili bölüme karar eklenir (Karar ID formatı: `[KATEGORI-SIRA]`)
2. Açık kararlar listesinden (Bölüm 18) işaretlenir ve kapanan madde listeden silinir
3. Versiyon geçmişine not düşülür

`.md` ve `.mdc` dokümanları oluşturulurken bu dokümandaki karar ID'leri **referans** olarak kullanılır. Böylece hiçbir kural boşlukta kalmaz, her kural bir mimari karara bağlıdır.

**Sonraki adım:** Kalan açık kararların kapatılması (özellikle 17.4 Güvenlik ve 17.6 Bildirim) → `before-after-kaizen-process.md` süreç dokümanının yazılması → `.mdc` Cursor rule dosyalarının üretilmesi.
