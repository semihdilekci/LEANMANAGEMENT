# Lean Management — Kullanıcı Kabul Testi (UAT) Planı

> **Amaç:** Faz 8 (Admin panel) dahil MVP kapsamındaki davranışları, farklı **persona** hesaplarıyla gerçek ortamda doğrulamak.  
> **Kaynak:** `docs/00_PROJECT_OVERVIEW.md` … `docs/10_IMPLEMENTATION_ROADMAP.md`, `docs/06_SCREEN_CATALOG.md`, `docs/03_API_CONTRACTS.md`, `docs/01_DOMAIN_MODEL.md`, `.cursor/rules/58-phase-08-admin-panel.mdc`.

---

## 1. Doküman kontrol bilgileri

| Alan                         | Değer |
| ---------------------------- | ----- |
| UAT sürümü                   | 1.0   |
| Hedef build / commit         |       |
| Ortam (dev / staging / prod) |       |
| Test tarihi                  |       |
| Yürüten                      |       |
| Onaylayan (ürün)             |       |

**Durum kodları (tüm senaryolarda aynı):** Geçti · Başarısız · Bloke · Atlandı · N/A

---

## 2. Persona matrisi

Aşağıdaki rolleri seed veya manuel atama ile **ayrı kullanıcı hesapları** üzerinden temsil edin. Gerçek sicil/email’leri buraya yazmayın; test sicilleri kullanın.

| Kod    | Persona                  | Tipik yetkiler / bağlam                                         | Birincil odak                          |
| ------ | ------------------------ | --------------------------------------------------------------- | -------------------------------------- |
| **P0** | Ürün admini / Superadmin | Sistem geneli; audit, sistem ayarları, rıza, e-posta şablonları | Faz 8 admin, güvenlik görünürlüğü      |
| **P1** | Kullanıcı yöneticisi     | Kullanıcı CRUD, master data yönetimi                            | Kullanıcı yaşam döngüsü, attribute’lar |
| **P2** | Rol ve yetki yöneticisi  | Rol görüntüleme, yetki matrisi, ABAC kuralları                  | Yetki değişiminin etkisi               |
| **P3** | Süreç yöneticisi         | Tüm süreçler, iptal / rollback                                  | Operasyonel süreç müdahalesi           |
| **P4** | Standart çalışan         | KTİ başlatma (varsa), kendi görevleri, bildirimler              | Günlük iş akışı                        |
| **P5** | Yönetici (onaylayan)     | Başlatanın yöneticisi; onay/red görevleri                       | KTİ onay hattı                         |
| **P6** | Yetkisiz / minimal rol   | Dashboard + kendi profili seviyesi                              | Negatif test (403, menü gizleme)       |

**Oturum kuralı:** Her persona için ayrı tarayıcı profili veya gizli pencere kullanın; token/çerez karışmasını önleyin.

---

## 3. Yürütme özeti (hızlı takip)

Aşağıdaki tabloda yalnızca **ID + durum + kısa not** tutabilirsiniz; detay adımlar Bölüm 4–10’da.

| ID                         | Durum | Not |
| -------------------------- | ----- | --- |
| TC-GEN-001                 |       |     |
| TC-AUTH-001 … 008          |       |     |
| TC-APP-001 …               |       |     |
| TC-ADM-001 …               |       |     |
| _(liste genişletilebilir)_ |       |     |

---

## 4. Genel ve ortam (tüm persona’lar)

### TC-GEN-001 — Uygulama erişilebilirliği ve sağlık

**Persona:** Herhangi biri (önce oturum açmadan)

1. Platform kök URL’ini açın.
2. `/health` veya dokümantasyondaki public health endpoint’ini (varsa) kontrol edin.

**Beklenen:** Login veya yönlendirme tutarlı; kritik 5xx yok.

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-GEN-002 — Dil ve tutarlılık

**Persona:** P4

1. Ana uygulama ekranlarında menü, buton ve hata mesajlarının Türkçe olduğunu doğrulayın.

**Beklenen:** MVP kapsamında Türkçe UI (tek dil).

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-GEN-003 — Klavye ve odak (özet a11y)

**Persona:** P4

1. Tab ile sidebar ve ana içerik arasında gezinin.
2. Bir modal açıp Esc ve Tab döngüsünü deneyin.

**Beklenen:** Odak kaybı yok; odak halkası görünür; kritik aksiyonlar klavye ile ulaşılabilir.

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

## 5. Kimlik doğrulama ve güvenlik (P0, P4, P6)

**Ortam notu:** Geliştirmede birincil giriş **Google OpenID Connect** ile yapılabilir; canlı UAT hedefi **Red Hat SSO (Keycloak)**’dır. Email+şifre senaryoları yardımcı yol veya bootstrap hesapları için geçerlidir (`docs/mimari-kararlar.md` [A-007], ADR 0008).

### TC-AUTH-001 — Başarılı giriş

**Persona:** P4

1. `/login` üzerinden hedef ortamın birincil yöntemiyle giriş yapın: **Google / kurumsal SSO** (OIDC) veya (yardımcı yol) geçerli email ve şifre.

**Beklenen:** Oturum açılır; dashboard veya son ziyaret rotasına yönlendirme tutarlıdır.

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-AUTH-002 — Hatalı kimlik bilgisi

**Persona:** (yeni oturum)

1. Bilerek yanlış şifre ile giriş deneyin (eşik altında kalın).

**Beklenen:** Anlamlı Türkçe hata; hesap kilidi tetiklenmeden makul deneme sınırı.

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-AUTH-003 — Şifremi unuttum

**Persona:** P4

1. `/forgot-password` akışını baştan sona izleyin (Mailpit / test SMTP ile).

**Beklenen:** Email gelir; link ile `/reset-password` tamamlanır; yeni şifre ile giriş mümkün.

| Takip |     |
| ----- | --- |
| Durum | ok  |
|       |     |

---

### TC-AUTH-004 — KVKK rıza (onaylı kullanıcı)

**Persona:** P4 (güncel rızası olan)

1. Giriş sonrası rıza modalının **görünmediğini** doğrulayın.

**Beklenen:** Engelleme yok; normal uygulama.

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-AUTH-005 — KVKK rıza zorunluluğu (yeni / güncellenmiş rıza sonrası)

**Persona:** P4 (rızası geçersiz kılınmış veya yeni kullanıcı — P0 ile koordine)

1. P0 ile yeni rıza yayını veya test kullanıcısı hazırlığı sonrası P4 ile giriş yapın.
2. Rıza metnini okuyup onaylayın veya çıkışı seçin.

**Beklenen:** Onaylanmadan uygulama kullanılamaz; onay sonrası dashboard’a geçiş.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-AUTH-006 — Şifre değiştirme

**Persona:** P4

1. `/profile/change-password` (veya eşdeğer menü) ile şifre güncelleyin.
2. Yeni şifre ile tekrar giriş yapın.

**Beklenen:** Kurallar (uzunluk/karmaşıklık) anlaşılır şekilde gösterilir; başarılı güncelleme.

| Takip  |                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Durum  |                                                                                                                                      |
| Notlar | şifre değiştirme sadece manuel yaratılan veya seed ile yaratılan kullanıcılarda olmalıdır. Öncesinde Temp_User kurgusu yazılmalıdır. |

---

### TC-AUTH-007 — Şifre süresi dolmuş kullanıcı

**Persona:** P0 ile hazırlanmış test kullanıcısı

1. Süresi dolmuş şifre senaryosu için giriş yapın.

**Beklenen:** Zorunlu şifre değiştirme akışı; tamamlanana kadar uygulama kısıtı.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-AUTH-008 — Oturum kapatma

**Persona:** P4

1. Çıkış yapın; korumalı bir URL’e doğrudan gitmeyi deneyin.

**Beklenen:** Login’e yönlendirme; eski access token ile işlem yapılamaz.

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

## 6. Operasyonel kullanıcı (P4, P5)

### TC-APP-001 — Dashboard

**Persona:** P4

1. `/dashboard` içeriğini inceleyin; widget veya özetlerin yüklendiğini doğrulayın.

**Beklenen:** Hata yok; boş durumda anlamlı mesaj.

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-APP-002 — Bildirim merkezi

**Persona:** P4

1. Bildirim çanı / `/notifications` sayfasını açın.
2. Okunmamış sayacının (varsa) tutarlı güncellendiğini gözlemleyin.

**Beklenen:** Liste yüklenir; tıklanınca ilgili görev veya sürece gidebilir (katalog akışına uygun).

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-APP-003 — Bildirim tercihleri

**Persona:** P4

1. `/settings/notifications` (veya menüdeki eşdeğer) sayfasını açın.
2. Bir olay tipi için in-app / e-posta tercihini değiştirip kaydedin.

**Beklenen:** Kayıt başarılı; sayfa yenilendiğinde değerler korunur (API ile uyumlu).

| Takip  |                                                                                 |
| ------ | ------------------------------------------------------------------------------- |
| Durum  |                                                                                 |
| Notlar | Kullanıcı kendi bildirim ayarlarını kapatamamalıdır. Bu ayar merkezi olmalıdır. |

---

### TC-APP-004 — Görev listesi ve sekmeler

**Persona:** P4

1. `/tasks` üzerinde bekleyen / başlatılan / tamamlanan sekmelerini gezin.
2. Kendinize atanmış bir göreve tıklayın.

**Beklenen:** Yetkisiz görev görünmez; detay sayfası açılır.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-APP-005 — Görev tamamlama / onay / red (KTİ bağlamında)

**Persona:** P5 (yönetici onayı gerektiğinde)

1. Size atanan onay görevini açın.
2. İş kuralına uygun aksiyonlardan birini (onay / red / revize talebi — hangisi tanımlıysa) uygulayın.

**Beklenen:** Durum makinesi ihlali yok; süreç detayı güncellenir; bildirim tetiklenmesi beklenir.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-APP-006 — Claim modu (varsa)

**Persona:** P4 (çoklu aday atanan görevle)

1. Claim gerektiren görevde “üstlen” benzeri aksiyonu deneyin.

**Beklenen:** İlk claim sonrası sorumluluk netleşir; diğer adaylar için kural katalogla uyumlu.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-APP-007 — KTİ süreci başlatma

**Persona:** P4 (`PROCESS_KTI_START` yetkisi varsa)

1. `/processes/kti/start` akışını doldurun; zorunlu alan ve dosya yüklemelerini tamamlayın.
2. Süreci gönderin.

**Beklenen:** Süreç detayına yönlendirme; `displayId` formatı (örn. KTI-…) okunabilir.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-APP-008 — Süreçlerim listesi

**Persona:** P4

1. `/processes?scope=my-started` (veya menüdeki “Süreçlerim”) ile kendi süreçlerinizi listeleyin.

**Beklenen:** Yalnız ilgili süreçler; filtre/pagination kullanılabilir.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-APP-009 — Süreç detayı ve doküman

**Persona:** P4 veya P5 (sürece erişimi olan)

1. Bir süreç detayına girin.
2. İzinli dokümanı önizleyin veya indirin (politikaya göre).

**Beklenen:** Yetkisiz dokümana erişim yok; virüs taraması bekleyen dosya durumu anlaşılır.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-APP-010 — Profil ve “Verilerim”

**Persona:** P4

1. `/profile` üzerinde kişisel bilgileri görüntüleyin.
2. KVKK “Verilerim” veya eşdeğer bölümü varsa inceleyin.

**Beklenen:** Kullanıcı kendi sicil dışı attribute’ları UI’dan değiştiremez (doküman kuralı).

| Takip  |                          |
| ------ | ------------------------ |
| Durum  | Profile ekranı henüz yok |
| Notlar |                          |

---

## 7. Yönetim rolleri (P1, P2, P3)

### TC-MGT-001 — Kullanıcı listesi ve detay

**Persona:** P1

1. `/users` listesini açın; arama/filtre varsa kullanın.
2. Bir kullanıcı detayına gidin.

**Beklenen:** PII makul şekilde gösterilir; yetki dışı aksiyon yok.

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-MGT-002 — Yeni kullanıcı oluşturma

**Persona:** P1

1. `/users/new` ile geçerli attribute’larla yeni kullanıcı oluşturun.

**Beklenen:** Başarı sonrası detay sayfası; duplicate sicil anlamlı hata.

| Takip  |                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Durum  | Eğer var olan bir mailden yeni kullanıcı oluşturmak istersem hata veriyor ancak hata mesajı açıklayıcı değil. KUllanıcı yaratırken yönetici seçmem yeterli olmalıdır, yönetici maili girmemem gerekir. Çünkü zaten yöneticinin bir mail adresi var. Kullanıcıya yönetici atanırken, yöneticiye mail atanamaz. Yönetici maili User detay sayfasında read only olmalıdır, otomatik olarak seçiyen yöneticinin maili gelmelidir. |
| Notlar |                                                                                                                                                                                                                                                                                                                                                                                                                               |

---

### TC-MGT-003 — Kullanıcı attribute güncelleme

**Persona:** P1

1. Mevcut kullanıcıda departman/pozisyon vb. güncelleyin.

**Beklenen:** Kayıt başarılı; audit’te iz bırakılması beklenir (P0 ile doğrulanabilir).

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-MGT-004 — Master data listesi

**Persona:** P1

1. `/master-data/:type` üzerinden bir tip seçip listeleyin.

**Beklenen:** CRUD veya pasifleştirme kuralları dokümana uygun.

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-MGT-005 — Rol listesi ve yetki matrisi

**Persona:** P2

1. `/roles` ve bir rolün `/roles/:id/permissions` ekranını açın.
2. Bir yetkiyi ekleyip/çıkarıp kaydedin (test rolünde).

**Beklenen:** Değişiklik kalıcı; etkilenen kullanıcıların yetkisi makul gecikmeyle güncellenir.

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-MGT-006 — ABAC / rol kuralları

**Persona:** P2

1. `/roles/:id/rules` üzerinde kural seti oluşturun veya düzenleyin.

**Beklenen:** Koşul mantığı (AND/OR) beklendiği gibi; test kullanıcısında rol yansıması doğrulanır.

| Takip  |     |
| ------ | --- |
| Durum  | ok  |
| Notlar |     |

---

### TC-MGT-007 — Tüm süreçler ve müdahale

**Persona:** P3

1. `/processes?scope=admin` ile tüm süreçleri görüntüleyin.
2. Uygun test sürecinde iptal veya rollback (tanımlıysa) akışını **staging** üzerinde deneyin.

**Beklenen:** Onay modalları; state geçişleri tutarlı; yetkisiz işlem 403.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

## 8. Negatif ve sınır testleri (P6)

### TC-NEG-001 — Doğrudan URL ile yetkisiz erişim

**Persona:** P6

1. `/users`, `/roles`, `/admin/audit-logs`, `/processes/kti/start` gibi URL’leri sırayla deneyin.

**Beklenen:** 403 sayfası veya login yönlendirmesi; menüde ilgisi görünmez.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-NEG-002 — CSRF ile mutasyon (manuel)

**Persona:** Teknik tester + P4

1. Mutating istekte `X-CSRF-Token` bilinçli olarak hatalı/boş gönderildiğinde davranışı gözlemleyin (tarayıcı devtools veya API client).

**Beklenen:** İstek reddedilir; güvenlik baseline ile uyumlu.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

## 9. Admin paneli — Faz 8 (P0)

> Kapsam: `58-phase-08-admin-panel.mdc` Done Definition ve `docs/03_API_CONTRACTS.md` §9.9–9.10 ile hizalı.

### TC-ADM-001 — Admin giriş ve özet dashboard

**Persona:** P0

1. `/admin` (veya admin ana sayfa route’u) üzerinde özet KPI’ları görüntüleyin: aktif kullanıcı, açık süreç, gecikmiş görev sayıları.

**Beklenen:** Sayılar makul; yüklenme hatası yok (`GET /api/v1/admin/summary` ile uyumlu izin modeli).

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-ADM-002 — Denetim kaydı listesi ve filtreler

**Persona:** P0

1. `/admin/audit-logs` sayfasını açın.
2. Tarih aralığı, kullanıcı, aksiyon, varlık tipi filtrelerini uygulayın.
3. Sayfalama veya cursor ile sonraki sayfaya geçin.

**Beklenen:** Filtreler API ile tutarlı; hassas alanlar maskeli veya karşılaştırma özeti şeklinde.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-ADM-003 — Denetim dışa aktarma (CSV)

**Persona:** P0

1. Dar filtre ile CSV export başlatın.
2. Dosyayı indirip Excel’de açın (UTF-8).

**Beklenen:** Sütunlar okunaklı; rate limit aşımında anlamlı geri bildirim (saatlik sınır dokümana uygun).

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-ADM-004 — Zincir bütünlüğü özeti ve anlık doğrulama

**Persona:** P0

1. `/admin/audit-logs/chain-integrity` sayfasını açın; son kontrol özetini okuyun.
2. “Şimdi doğrula” (veya eşdeğer) ile anlık doğrulama çalıştırın.

**Beklenen:** `chainIntact` durumu gösterilir; bozuksa kırık kayıt bilgisi; throttling makul.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-ADM-005 — Sistem ayarları görüntüleme ve güncelleme

**Persona:** P0

1. `/admin/system-settings` listesini açın.
2. Test için güvenli bir ayarı (ör. bildirim saklama günü veya eşik değeri — ortam politikasına uygun) değiştirip kaydedin.
3. Sayfayı yenileyip değerin korunduğunu doğrulayın.

**Beklenen:** Geçersiz değer reddedilir; geçerli güncelleme audit’e yansır.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-ADM-006 — E-posta şablonu listesi ve düzenleme

**Persona:** P0

1. `/admin/email-templates` listesini açın.
2. Bir olay tipinde düzenlemeye girin; konu ve gövdeyi değiştirin (test metni).
3. Önizleme (preview) kullanın.
4. İzinliyse test e-postası gönderin (Mailpit).

**Beklenen:** Zorunlu değişken kontrolü; XSS girişi reddedilir veya sanitize edilir.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-ADM-007 — Rıza versiyonu: taslak oluşturma ve düzenleme

**Persona:** P0

1. `/admin/consent-versions` üzerinden yeni taslak oluşturun veya mevcut taslağı düzenleyin.
2. İçeriği kaydedin.

**Beklenen:** Yayınlanmamış sürüm DRAFT olarak kalır; yayınlı sürüm kilitli.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-ADM-008 — Rıza yayını ve kullanıcı etkisi (kritik)

**Persona:** P0 + P4 (koordineli)

1. P0: Taslağı **gelecekte** geçerli olacak `effectiveFrom` ile yayınlayın (dokümandaki kural: geçmiş olamaz).
2. `effectiveFrom` anından önce ve sonra P4 ile giriş/rıza davranışını gözlemleyin.

**Beklenen:** Yayın sonrası aktif sürüm güncellenir; kullanıcılar yeni metni onaylamaya zorlanır; audit’te publish kaydı.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

### TC-ADM-009 — Superadmin dışı kullanıcı ile admin URL

**Persona:** P1 veya P6

1. `/admin` ve alt path’lere doğrudan erişmeyi deneyin.

**Beklenen:** 403 veya yönlendirme; hassas veri sızıntısı yok.

| Takip  |     |
| ------ | --- |
| Durum  |     |
| Notlar |     |

---

## 10. Kapanış ve karar

### TC-CLOSE-001 — Kabul kriterleri özeti

Tüm **kritik** senaryolar (Auth, KTİ mutasyon, Admin audit/consent, negatif yetki) için durumları gözden geçirin.

| Karar                   | ☐ Kabul (go) ☐ Koşullu kabul ☐ Ret (no-go) |
| ----------------------- | ------------------------------------------ |
| Koşullar / açık konular |                                            |
| İmzalar / tarih         |                                            |

---

## Ek A: Senaryo — uçtan uca “KTİ + onay + bildirim”

**Katılımcılar:** P4 (başlatan), P5 (onaylayan), P0 (isteğe bağlı audit kontrolü)

| Adım | Kim | Aksiyon                                             |
| ---- | --- | --------------------------------------------------- |
| 1    | P4  | KTİ başlat, dosya yükle, gönder                     |
| 2    | P5  | Bildirimden veya görev listesinden onay görevini aç |
| 3    | P5  | Onayla veya reddet                                  |
| 4    | P4  | Süreç durumunu ve bildirimleri kontrol et           |
| 5    | P0  | İlgili audit kayıtlarını filtreleyerek doğrula      |

**UAT notları (serbest metin):**

---

## Ek B: Ortam ve veri hazırlığı kontrol listesi

- PostgreSQL + Redis + worker süreçleri çalışıyor
- Mailpit / SMTP test alıcıları tanımlı
- Seed’de en az: P0, P1, P2, P3, P4, P5, P6 kullanıcıları
- KTİ için örnek süreç veya sıfırdan oluşturma yolu biliniyor
- Yedek / geri alma: staging’de yıkıcı admin testleri için reset planı

---

_Bu doküman canlıdır: sprint veya faz sonunda başarısız senaryolar için bug linki ve kök neden notu eklenebilir._
