# Lean Management Platformu — Test Stratejisi

> Bu doküman platformda test yazımı için disiplin kitabıdır. "Her şeyi test et" veya "hiçbir şeyi test etme" yerine **risk-bazlı** yaklaşım: auth, encryption, workflow gibi iş-kritik modüllerde yüksek coverage (%85-95); UI cosmetic ve basit CRUD'larda sağduyulu coverage (%60-75). Agent bir feature eklerken bu dokümanın ilgili bölümünü okur, test planını çıkarır, test dosyasını adlandırma kurallarıyla yazar, coverage eşiklerini CI ile doğrular.

---

## 1. Test Felsefesi ve Piramit

### 1.1 Piramit Dağılımı

```
              /\
             /  \
            / E2E \           %10  — Playwright, kritik user journey
           /──────\
          /        \
         /Integration\        %20  — Vitest + testcontainers (real DB + Redis)
        /────────────\
       /              \
      /     Unit       \      %70  — Vitest (mock external deps)
     /──────────────────\
```

Rakamlar **zorunluluk değil, ideal dağılım**. Proje ilerledikçe e2e oranı büyüyebilir ama asla %20'yi aşmamalı — e2e yavaş, kırılgan, pahalı.

**70% unit** — Hızlı (ms'ler), bol, hedefli. Bir fonksiyon/method/class davranışını izole test eder.

**20% integration** — Orta hız (saniye), bileşenler arası entegrasyonu doğrular. Real PostgreSQL + Redis (testcontainers Docker image'ları). HTTP request level test (supertest ile controller + service + DB zinciri).

**10% E2E** — Yavaş (onlarca saniye), full browser flow. Sadece "login → KTİ başlat → task complete → süreç biter" gibi kritik journey'lerde kullanılır. Her ekran için e2e yazılmaz.

### 1.2 Risk-Bazlı Yaklaşım

Her modülün test önceliği eşit değil. Bu projede iş riskine göre üç seviye:

| Seviye | Modüller | Coverage hedefi | Test türü |
|---|---|---|---|
| **Yüksek** | Auth (login/refresh/logout/password), Encryption (email/phone encrypt/decrypt), Permission resolver (RBAC+ABAC), Process state machine (KTİ workflow), Audit chain | %85-95+ | Unit + integration + e2e |
| **Orta** | User CRUD, Role CRUD, Master data, Document upload, Notification dispatch, Rate limit | %75-85 | Unit + integration |
| **Düşük** | UI styling, Static content render, Navigation links, Layout responsive | %50-70 | Unit + manual QA |

Yüksek seviye modüllerde **hem happy path hem edge case** test yazılır — saldırgan olsa ne yapar, concurrent istek ne olur, invalid state geldiğinde ne olur. Orta seviyede happy + en olası edge case'ler. Düşük seviyede smoke testler (bileşen render oluyor mu, crash yok mu).

### 1.3 Test Yazmama Riskleri

Agent'ın kaçınması gereken iki ekstrem:

**"Mock everything" sendromu:** Servis testinde Prisma + Redis + downstream servisler hep mock'landığında test yalnızca mock davranışını doğrular; gerçek integration problemleri kaçar. Bu yüzden integration test katmanı zorunlu — Prisma call'ları gerçek PostgreSQL'de çalıştırılır (testcontainers).

**"Test everything" sendromu:** Her private helper, her trivial getter için test yazıldığında test maintenance maliyeti feature geliştirme hızını 3x yavaşlatır. Kural: **public API test edilir, implementation detail test edilmez.** Bir method refactor'landığında testin de değişmesi gerekiyor olsa, o test implementation'a coupled demektir → yeniden düşün.

### 1.4 "Write Tests First" Değil, "Write Tests With"

Strict TDD (test-driven development) zorunlu değil. Ancak:
- Her PR'da değişen public method için **en az 1 test** zorunlu
- Bug fix PR'ında önce failing test yazılır, sonra fix — regression önlemi
- Yeni feature'da test + implementation PR'da birlikte gelir; "sonra test yazarız" lafı yasak

---

## 2. Unit Test (%70)

### 2.1 Tool Seçimi — Vitest

Vitest Jest uyumlu API, ES Modules native destek, hızlı (Vite dev server + esbuild), TypeScript out-of-the-box. Hem backend (NestJS) hem frontend (Next.js + React) aynı tool. Tek config şablonu `packages/config/vitest.base.ts`.

```typescript
// packages/config/vitest.base.ts
import { defineConfig } from 'vitest/config';

export const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',  // Frontend'de 'jsdom' override
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        '**/*.config.*',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/migrations/**',
      ],
    },
    testTimeout: 10000,
  },
});
```

### 2.2 Nerede Unit Test Yazılır

| Katman | Örnek dosya | Test dosyası |
|---|---|---|
| Backend service | `apps/api/src/users/users.service.ts` | `users.service.test.ts` (yan yana) |
| Backend util | `apps/api/src/common/utils/encryption.ts` | `encryption.test.ts` |
| Zod schema | `packages/shared-schemas/src/users.ts` | `users.schema.test.ts` |
| React hook | `apps/web/src/hooks/usePermissions.ts` | `usePermissions.test.ts` |
| React component (pure) | `apps/web/src/components/shared/SlaBadge.tsx` | `SlaBadge.test.tsx` |
| Workflow state machine | `apps/api/src/processes/workflow/kti.workflow.ts` | `kti.workflow.test.ts` |

Test dosyaları **source dosyasının yanında** durur (co-location). `__tests__/` alt dizini kullanılmaz — refactor sırasında dosya taşıma + test taşıma aynı anda yapılır.

### 2.3 Mock Stratejisi

**External dependency'ler mock:**
- Prisma Client — in-memory / manual mock
- Redis — `ioredis-mock` veya manual
- AWS SDK (S3, Secrets Manager, CloudFront) — `aws-sdk-client-mock`
- External HTTP — `msw` (Mock Service Worker)
- Email sender — noop spy
- Date/time — `vi.useFakeTimers()`

**Business logic mock'lanmaz:**
- Service'ler birbirini çağırır — gerçek instance kullanılır (DI ile inject, mock değil)
- Pure function'lar mock'lanmaz (util, validator, serializer)
- Domain entity'leri mock'lanmaz

Yanlış pattern (kaçınılmalı):

```typescript
// ✗ Kaçın — mock'lar davranışı tamamen belirliyor
const userRepoMock = { findById: vi.fn().mockResolvedValue(mockUser) };
const userService = new UserService(userRepoMock);
const result = await userService.doSomething(userId);
expect(userRepoMock.findById).toHaveBeenCalledWith(userId);  // Mock verify — gerçek davranış yok
```

Doğru pattern:

```typescript
// ✓ İyi — gerçek service + mock edilmiş external boundary
const prismaMock = mockDeep<PrismaClient>();
prismaMock.users.findUnique.mockResolvedValue({ ...validUser });

const userService = new UserService(prismaMock, redisMock);
const result = await userService.getUser(userId);

expect(result.email).toBe(validUser.email);  // Gerçek davranış verify
expect(result.password_hash).toBeUndefined();  // Service'in serializer çalıştı mı
```

### 2.4 Testcontainers Kullanılmaz (Unit'te)

Unit test **anında** çalışmalı (< 100ms per test). Docker container başlatma integration test katmanına ait. Unit testte `@prisma/client` real instance yerine `prisma-mock` veya `vitest-mock-extended`.

### 2.5 Unit Test Örneği — UserService.create

```typescript
// apps/api/src/users/users.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';
import { UserService } from './users.service';
import { UserSicilDuplicateException, UserManagerCycleException } from './users.exceptions';

describe('UserService', () => {
  let service: UserService;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new UserService(prisma, /* other deps */);
  });

  describe('create', () => {
    const validInput = {
      sicil: '12345678',
      firstName: 'Ali',
      lastName: 'Yılmaz',
      email: 'ali@holding.com',
      employeeType: 'WHITE_COLLAR' as const,
      companyId: 'comp-1',
      // ... diğer zorunlu field'lar
    };

    it('should create user with valid input', async () => {
      prisma.users.findFirst.mockResolvedValue(null);  // Sicil unique
      prisma.users.create.mockResolvedValue({ id: 'new-user-id', ...validInput } as any);

      const result = await service.create(validInput, { id: 'admin-1' });

      expect(result.id).toBe('new-user-id');
      expect(prisma.users.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sicil: '12345678' }) })
      );
    });

    it('should throw UserSicilDuplicateException when sicil exists', async () => {
      prisma.users.findFirst.mockResolvedValue({ id: 'existing' } as any);

      await expect(service.create(validInput, { id: 'admin-1' })).rejects.toThrow(
        UserSicilDuplicateException
      );
      expect(prisma.users.create).not.toHaveBeenCalled();
    });

    it('should throw UserManagerCycleException on edit when manager creates cycle', async () => {
      prisma.users.findUnique
        .mockResolvedValueOnce({ id: 'user-a', manager_user_id: 'user-b' } as any)
        .mockResolvedValueOnce({ id: 'user-b', manager_user_id: 'user-c' } as any)
        .mockResolvedValueOnce({ id: 'user-c', manager_user_id: 'user-a' } as any);

      await expect(
        service.update('user-a', { managerUserId: 'user-c' }, { id: 'admin-1' })
      ).rejects.toThrow(UserManagerCycleException);
    });
  });
});
```

### 2.6 React Component Unit Test

```typescript
// apps/web/src/components/shared/SlaBadge.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlaBadge } from './SlaBadge';

describe('<SlaBadge>', () => {
  it('renders green badge when >80% time remains', () => {
    const slaDue = new Date(Date.now() + 80 * 3600 * 1000).toISOString();
    render(<SlaBadge slaDueAt={slaDue} taskStatus="PENDING" />);
    
    const badge = screen.getByRole('status');
    expect(badge).toHaveClass('bg-green-100');
    expect(badge).toHaveTextContent(/gün kaldı/);
  });

  it('renders red badge when breached', () => {
    const slaDue = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    render(<SlaBadge slaDueAt={slaDue} taskStatus="PENDING" />);
    
    expect(screen.getByRole('status')).toHaveClass('bg-red-100');
    expect(screen.getByText(/gecikti/i)).toBeInTheDocument();
  });

  it('does not render for terminal task status', () => {
    const { container } = render(
      <SlaBadge slaDueAt={new Date().toISOString()} taskStatus="COMPLETED" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when slaDueAt is null', () => {
    const { container } = render(<SlaBadge slaDueAt={null} taskStatus="PENDING" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

### 2.7 Hook Unit Test

```typescript
// apps/web/src/hooks/usePermissions.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from './usePermissions';
import { Permission } from '@leanmgmt/shared-types';

describe('usePermissions', () => {
  it('returns true for permission user has', () => {
    useAuthStore.setState({
      permissions: new Set([Permission.USER_CREATE, Permission.USER_LIST_VIEW]),
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.has(Permission.USER_CREATE)).toBe(true);
  });

  it('returns false for permission user does not have', () => {
    useAuthStore.setState({ permissions: new Set([Permission.USER_LIST_VIEW]) });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.has(Permission.USER_DELETE)).toBe(false);
  });

  it('hasAll returns true only when all permissions present', () => {
    useAuthStore.setState({
      permissions: new Set([Permission.USER_CREATE, Permission.USER_LIST_VIEW]),
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.hasAll([Permission.USER_CREATE, Permission.USER_LIST_VIEW])).toBe(true);
    expect(result.current.hasAll([Permission.USER_CREATE, Permission.USER_DELETE])).toBe(false);
  });
});
```

---

## 3. Integration Test (%20)

### 3.1 Tool — Vitest + Testcontainers

**Testcontainers** Docker container'ları programmatically başlatır. Real PostgreSQL (16) + Redis (7) + ClamAV (mock HTTP) container'ları test suite başında kalkar, sonda durur.

```typescript
// apps/api/test/integration-setup.ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'node:child_process';

let postgres: StartedPostgreSqlContainer;
let redis: StartedRedisContainer;

export async function setupIntegrationEnv() {
  postgres = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('leanmgmt_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  redis = await new RedisContainer('redis:7-alpine').start();

  process.env.DATABASE_URL = postgres.getConnectionUri();
  process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getPort()}`;

  // Prisma migrate deploy — schema oluştur
  execSync('pnpm prisma migrate deploy', { env: process.env });

  return { postgres, redis };
}

export async function teardownIntegrationEnv() {
  await postgres?.stop();
  await redis?.stop();
}
```

### 3.2 Test Dosyaları

Integration test dosyaları `*.integration.test.ts` suffix ile işaretlenir. Vitest config ile ayrı proje:

```typescript
// vitest.integration.config.ts
export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
    testTimeout: 30000,  // DB ops için
    globalSetup: './test/integration-setup.ts',
  },
});
```

Unit ve integration ayrı çalıştırılır:
```bash
pnpm test          # Sadece unit (hızlı — geliştirici local)
pnpm test:integration  # Docker up gerekli
pnpm test:all      # İkisi birlikte (CI)
```

### 3.3 Integration Test Örneği — KTİ Full Flow

```typescript
// apps/api/test/kti.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { userFactory } from '../test/factories/user.factory';
import { authHelper } from '../test/helpers/auth.helper';

describe('KTİ Workflow Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    // Her test'te temiz DB state
    await prisma.$executeRaw`TRUNCATE TABLE users, roles, processes, tasks, documents CASCADE`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete KTİ happy path: start → approve → complete', async () => {
    // Arrange — kullanıcılar + roller + şirket hazırla
    const initiator = await userFactory.create(prisma, { employeeType: 'WHITE_COLLAR' });
    const manager = await userFactory.create(prisma);
    await prisma.users.update({
      where: { id: initiator.id },
      data: { manager_user_id: manager.id },
    });

    // Dokümanları hazırla (pre-scan CLEAN)
    const beforeDoc = await prisma.documents.create({
      data: { scan_status: 'CLEAN', /* ... */ },
    });
    const afterDoc = await prisma.documents.create({
      data: { scan_status: 'CLEAN', /* ... */ },
    });

    const initiatorToken = await authHelper.loginAs(app, initiator);
    const managerToken = await authHelper.loginAs(app, manager);

    // Act 1 — KTİ başlat
    const startRes = await request(app.getHttpServer())
      .post('/api/v1/processes/kti/start')
      .set('Authorization', `Bearer ${initiatorToken.accessToken}`)
      .set('X-CSRF-Token', initiatorToken.csrfToken)
      .send({
        companyId: initiator.company_id,
        beforePhotoDocumentIds: [beforeDoc.id],
        afterPhotoDocumentIds: [afterDoc.id],
        savingAmount: 50000,
        description: 'Hatları değiştirip zamandan tasarruf sağlandı...',
      });

    expect(startRes.status).toBe(201);
    expect(startRes.body.data.displayId).toMatch(/^KTI-\d{6}$/);
    expect(startRes.body.data.status).toBe('IN_PROGRESS');

    const processId = startRes.body.data.id;

    // Assert — manager için task oluştu mu?
    const managerTasks = await prisma.tasks.findMany({
      where: { process_id: processId, status: { in: ['PENDING', 'CLAIMED'] } },
      include: { assignees: true },
    });
    expect(managerTasks).toHaveLength(1);
    expect(managerTasks[0].assignees[0].user_id).toBe(manager.id);
    expect(managerTasks[0].step_label).toBe('Yönetici Onay');

    // Act 2 — Manager onay
    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${managerTasks[0].id}/complete`)
      .set('Authorization', `Bearer ${managerToken.accessToken}`)
      .set('X-CSRF-Token', managerToken.csrfToken)
      .send({
        action: 'APPROVE',
        comment: 'İyi çalışma',
      });

    expect(approveRes.status).toBe(200);

    // Assert — süreç COMPLETED mi?
    const finalProcess = await prisma.processes.findUnique({ where: { id: processId } });
    expect(finalProcess?.status).toBe('COMPLETED');
    expect(finalProcess?.completed_at).not.toBeNull();

    // Assert — audit log kayıtları var mı?
    const auditLogs = await prisma.audit_logs.findMany({
      where: { entity_type: 'PROCESS', entity_id: processId },
      orderBy: { sequence_number: 'asc' },
    });
    expect(auditLogs.map((l) => l.action)).toContain('PROCESS_STARTED');
    expect(auditLogs.map((l) => l.action)).toContain('PROCESS_COMPLETED');

    // Assert — audit chain integrity
    expect(auditLogs[0].prev_hash).toMatch(/^0{64}$/);  // ilk kayıt 0 prev
    for (let i = 1; i < auditLogs.length; i++) {
      expect(auditLogs[i].prev_hash).toBe(auditLogs[i - 1].current_hash);
    }
  });

  it('should handle revision loop: start → request-revision → resubmit → approve', async () => {
    // Happy path benzeri ama manager REQUEST_REVISION seçer
    // → başlatıcıya yeni task oluşur (KTİ_REVISION)
    // → başlatıcı yeni data ile resubmit
    // → manager tekrar onay task'ı
    // → APPROVE
    // Assert: process COMPLETED; 2 KTİ_INITIATION + 1 KTİ_REVISION + 2 KTİ_MANAGER_APPROVAL audit logs
    // ...
  });

  it('should cascade SKIPPED_BY_ROLLBACK when process rolled back', async () => {
    // Setup — manager approval task'ında
    // PROCESS_ROLLBACK triggered
    // Current task SKIPPED_BY_ROLLBACK, new task oluştu KTİ_INITIATION için başlatıcıya
    // ...
  });

  it('should prevent cancel on terminal process', async () => {
    // COMPLETED process için PROCESS_CANCEL → 409 PROCESS_NOT_CANCELLABLE
  });
});
```

### 3.4 Integration Test Scope

Integration test için uygun senaryolar:
- Full flow (başlatma → task completion → süreç bitirme)
- Transaction davranışı (rollback edildiğinde DB state temiz kalmalı)
- Trigger davranışı (audit log append-only, chain hash otomatik compute)
- Concurrent operation (iki user eşzamanlı claim)
- Cache invalidation (rol permission değişimi → user permission cache invalid)
- Rate limit (10 başarısız login → 11. 429 döner)

Integration'a **taşıma değil:**
- Pure validation testi (Zod schema) — unit
- UI component render — unit
- Business logic izole — unit

### 3.5 Test Data Temizleme

Her test'in başında DB reset. İki yaklaşım:

**A. `TRUNCATE CASCADE`** (hızlı, standart):
```typescript
beforeEach(async () => {
  await prisma.$executeRaw`TRUNCATE TABLE users, processes, tasks, documents, audit_logs RESTART IDENTITY CASCADE`;
});
```

**B. Transaction rollback** (daha hızlı ama framework desteği):
```typescript
let tx: PrismaClient;
beforeEach(async () => {
  tx = await prisma.$begin();
});
afterEach(async () => {
  await tx.$rollback();
});
```

Bu projede **Yaklaşım A** — basit, okunur, test paralellik sorunları yok. Yavaşlama kabul edilebilir (suite 30 sn içinde biter).

### 3.6 Fixture Factories

Test data oluşturma tekrarını önlemek için factory pattern:

```typescript
// apps/api/test/factories/user.factory.ts
import { faker } from '@faker-js/faker/locale/tr';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

interface UserOverrides {
  sicil?: string;
  email?: string;
  isActive?: boolean;
  employeeType?: 'WHITE_COLLAR' | 'BLUE_COLLAR' | 'INTERN';
  companyId?: string;
  // ...
}

export const userFactory = {
  async create(prisma: PrismaClient, overrides: UserOverrides = {}) {
    const defaultCompany = await this.ensureDefaultCompany(prisma);
    
    return prisma.users.create({
      data: {
        sicil: overrides.sicil ?? faker.string.numeric(8),
        first_name: faker.person.firstName(),
        last_name: faker.person.lastName(),
        email: overrides.email ?? faker.internet.email().toLowerCase(),
        password_hash: await bcrypt.hash('Test1234!@#$', 12),
        employee_type: overrides.employeeType ?? 'WHITE_COLLAR',
        company_id: overrides.companyId ?? defaultCompany.id,
        is_active: overrides.isActive ?? true,
        password_changed_at: new Date(),
        // ... required fields
      },
    });
  },

  async ensureDefaultCompany(prisma: PrismaClient) {
    return prisma.companies.upsert({
      where: { code: 'TEST_CORP' },
      update: {},
      create: { code: 'TEST_CORP', name: 'Test Corp', is_active: true },
    });
  },
};
```

Faker.js Turkish locale (`@faker-js/faker/locale/tr`) — realistic Turkish isimleri.

---

## 4. E2E Test (%10)

### 4.1 Tool — Playwright

Playwright Chromium + Firefox + WebKit desteği, auto-wait (flakiness minimize), trace viewer (debug), parallel execution. Chromium yeterli MVP için — diğer browser'lar Playwright default setup'ta gelir.

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
  ],
});
```

### 4.2 Kritik User Journey'ler

E2E her ekran için değil, **platform'un çalıştığını kanıtlayan** akışlarda:

1. **Auth full cycle** — Login → consent onay (ilk girişte) → dashboard → logout
2. **KTİ happy path** — Login → KTİ başlat → task atanması e-mail (mock) → manager login → task approve → process COMPLETED
3. **KTİ revision loop** — Manager REQUEST_REVISION → başlatıcı resubmit → manager APPROVE
4. **Role management** — Superadmin login → rol oluştur → permission ata → user'a assign → user bu permission ile endpoint'e erişebiliyor mu
5. **Admin audit search + export** — Superadmin login → audit-logs sayfası → filter uygula → CSV export → dosya indiriliyor mu
6. **Password reset flow** — Forgot password → email link (mock intercept) → reset page → new password → login yeni şifre ile

Her journey 1-3 test case ile temsil edilir — 12-18 e2e test total MVP için yeterli.

### 4.3 E2E Test Örneği — KTİ Happy Path

```typescript
// apps/web/e2e/kti-happy-path.spec.ts
import { test, expect } from '@playwright/test';
import { setupTestUsers, generateTestDocument } from './helpers';

test.describe('KTİ Happy Path', () => {
  test.beforeAll(async () => {
    await setupTestUsers();  // Initiator + Manager users seed
  });

  test('initiator starts KTİ, manager approves, process completes', async ({ page, context }) => {
    // ADIM 1: Initiator login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'initiator@test.com');
    await page.fill('input[name="password"]', 'Test1234!@#$');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // ADIM 2: KTİ başlatma sayfasına git
    await page.click('text=Yeni KTİ Başlat');
    await expect(page).toHaveURL('/processes/kti/start');

    // ADIM 3: Formu doldur
    await page.fill('input[name="savingAmount"]', '50000');
    await page.fill('textarea[name="description"]', 'Üretim hattında iyileştirme yapıldı. 50K TL yıllık tasarruf sağlandı.');

    // ADIM 4: Dokümanları yükle (before/after)
    const beforeFile = await generateTestDocument('before.jpg');
    const afterFile = await generateTestDocument('after.jpg');
    await page.setInputFiles('input[name="before-photos"]', beforeFile);
    await page.setInputFiles('input[name="after-photos"]', afterFile);

    // Scan tamamlanmasını bekle (CLEAN)
    await expect(page.locator('[data-testid="scan-status"]').first()).toHaveText('Temiz', { timeout: 30000 });

    // ADIM 5: Başlat
    await page.click('button:has-text("Süreci Başlat")');

    // Yeni süreç detay sayfasına redirect
    await expect(page).toHaveURL(/\/processes\/KTI-\d{6}/);
    const displayId = page.url().split('/').pop();
    expect(displayId).toMatch(/^KTI-\d{6}$/);

    // ADIM 6: Manager login (yeni tab)
    const managerPage = await context.newPage();
    await managerPage.goto('/login');
    await managerPage.fill('input[name="email"]', 'manager@test.com');
    await managerPage.fill('input[name="password"]', 'Test1234!@#$');
    await managerPage.click('button[type="submit"]');
    await expect(managerPage).toHaveURL('/dashboard');

    // ADIM 7: Manager bekleyen görevlere git
    await managerPage.click('text=Görevlerim');
    await expect(managerPage).toHaveURL('/tasks');

    // Yeni task görünür olmalı
    await expect(managerPage.locator(`text=${displayId}`)).toBeVisible({ timeout: 10000 });

    // ADIM 8: Task detayı aç
    await managerPage.click(`tr:has-text("${displayId}")`);
    await expect(managerPage.locator('h1')).toContainText('Yönetici Onay');

    // ADIM 9: Onayla
    await managerPage.click('label:has-text("Onayla")');
    await managerPage.fill('textarea[name="comment"]', 'İyi iş, onaylandı.');
    await managerPage.click('button:has-text("Kaydet ve Tamamla")');

    // Süreç detay sayfasına redirect
    await expect(managerPage).toHaveURL(new RegExp(`/processes/${displayId}`));
    await expect(managerPage.locator('[data-testid="process-status"]')).toHaveText('Tamamlandı');

    // ADIM 10: Initiator notification görmeli
    await page.reload();
    await page.click('[data-testid="notification-bell"]');
    await expect(page.locator('text=onaylandı')).toBeVisible();
  });
});
```

### 4.4 E2E Best Practices

**Selector stratejisi (öncelik sırası):**
1. `data-testid` attribute (kararlı, refactor safe)
2. Role + accessible name (`page.getByRole('button', { name: 'Kaydet' })`)
3. Text content (`:has-text("Kaydet")`)
4. CSS selector (son çare — kırılgan)

ID/class selector'ları **kullanılmaz** — DOM refactor'da kırılır.

**Wait stratejisi:**
- `await expect(locator).toBeVisible()` — auto-wait (default 5 sn)
- `page.waitForURL()` — redirect bekleme
- `page.waitForResponse()` — specific API call bekleme
- **`page.waitForTimeout(3000)` asla kullanılmaz** — flaky; timeout yerine explicit condition

**Test izolasyonu:**
- Her test kendi data set'ini oluşturur (veya unique ID ile çakışma önler)
- Test sonu cleanup gerekli değil — staging env her e2e suite'te reset edilir

**Secrets:**
- Test user credentials staging environment'ta seed edilir
- `.env.test` dosyası (git ignore) lokalde; CI'da GitHub Secrets

### 4.5 E2E Çalıştırma Ortamı

E2E **staging environment** üzerinde çalışır:
- Production veriye dokunmaz
- Real PostgreSQL + Redis + S3 (staging account)
- Mock email/SMS (Mailpit container — email UI test için)

Lokal geliştirici için `docker-compose.e2e.yml` — Next.js + NestJS + Postgres + Redis + Mailpit birlikte kalkar.

```yaml
# docker-compose.e2e.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: leanmgmt_e2e
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports: ['5433:5432']

  redis:
    image: redis:7-alpine
    ports: ['6380:6379']

  mailpit:
    image: axllent/mailpit
    ports: ['8025:8025', '1025:1025']

  api:
    build: ./apps/api
    environment:
      DATABASE_URL: postgres://test:test@postgres:5432/leanmgmt_e2e
      REDIS_URL: redis://redis:6379
      SMTP_HOST: mailpit
    depends_on: [postgres, redis, mailpit]
    ports: ['3001:3001']

  web:
    build: ./apps/web
    environment:
      NEXT_PUBLIC_API_URL: http://api:3001
    depends_on: [api]
    ports: ['3000:3000']
```

---

## 5. Coverage Matrisi

### 5.1 Modül-Bazlı Coverage Hedefleri

| Modül | Line | Branch | Function | Gerekçe |
|---|---|---|---|---|
| `auth/*` | 95% | 90% | 100% | Giriş kapısı — güvenlik kritik |
| `common/encryption/*` | 95% | 90% | 100% | PII encrypt/decrypt — data loss riski |
| `processes/workflow/*` | 90% | 85% | 100% | State machine — yanlış transition süreç bozar |
| `roles/permission-resolver/*` | 90% | 85% | 100% | RBAC+ABAC — yetki eskalasyon riski |
| `audit/*` | 90% | 85% | 100% | Chain integrity + append-only doğruluk |
| `users/*` | 85% | 75% | 90% | CRUD + manager cycle check |
| `tasks/*` | 85% | 75% | 90% | Claim + complete + SLA |
| `documents/*` | 80% | 70% | 85% | Upload + scan polling |
| `notifications/*` | 75% | 65% | 85% | Dispatch + read state |
| `master-data/*` | 75% | 65% | 80% | CRUD + cascade |
| `admin/settings/*` | 75% | 65% | 80% | Bulk update + atomic |
| `admin/email-templates/*` | 75% | 65% | 80% | Handlebars render + preview |
| `admin/consent-versions/*` | 80% | 70% | 85% | Publish flow atomic |
| **Frontend — hooks** | 85% | 75% | 90% | Custom logic |
| **Frontend — stores (Zustand)** | 90% | 80% | 95% | Auth state kritik |
| **Frontend — UI components (shadcn + shared)** | 65% | 55% | 75% | Smoke + edge case |
| **Frontend — page components** | 60% | 50% | 70% | E2E kapsamı tamamlar |
| **Overall backend** | ≥ 80% | ≥ 70% | ≥ 85% | — |
| **Overall frontend** | ≥ 75% | ≥ 65% | ≥ 80% | — |
| **Proje toplam** | ≥ 75% | ≥ 65% | ≥ 80% | CI gate |

### 5.2 Coverage Raporu

Vitest v8 coverage provider → LCOV format → Codecov upload (GitHub Action). Her PR'da:

- Overall coverage delta (± %X)
- Yeni eklenen dosyalarda coverage
- Düşen dosyalarda uyarı (reviewer kararı)

**Coverage düşüşü zorunlu red değil** — reviewer trade-off'u değerlendirir. Örn. yeni feature için büyük refactor yapılıp legacy code simplify edilmişse coverage düşebilir.

### 5.3 Nicel vs Nitel

Coverage rakamları doğruluğun **proxy'sidir**, doğruluğun kendisi değil. %95 coverage bile yanlış testlerle zayıf güvence. Bu yüzden:

- Coverage eşikleri **minimum** — daha az kesinlikle red, daha fazla otomatik yeşil değil
- Code review test kalitesine bakar: edge case'ler kapsanıyor mu, assertion'lar anlamlı mı, mock davranışı doğru mu
- Mutation testing (Stryker) opsiyonel — ayda bir çalıştır; %60+ mutation score hedef (MVP'de tavsiye, zorunlu değil)

---

## 6. Test Data Stratejisi

### 6.1 Factory Pattern

Her domain entity için factory (`test/factories/`):
- `user.factory.ts`
- `role.factory.ts`
- `process.factory.ts`
- `task.factory.ts`
- `document.factory.ts`
- `notification.factory.ts`
- `master-data.factory.ts`

Factory sorumlulukları:
- Default değerler ile minimal valid entity
- Override parametreleri ile customization
- Bağımlılıkları otomatik çözme (user'a company gerekir → company da yoksa oluştur)

### 6.2 Faker Kullanımı

`@faker-js/faker/locale/tr` — Türkçe isimler, adresler, şirket isimleri. Consistent seed kullanımı:

```typescript
import { faker } from '@faker-js/faker/locale/tr';

beforeEach(() => {
  faker.seed(42);  // Deterministic test data
});
```

Seed kullanımı debugging'i kolaylaştırır — aynı test her çalıştırmada aynı data ile çalışır.

### 6.3 Seed Data — Development

`apps/api/prisma/seed.ts` — dev ortamında database ilk açıldığında:

```typescript
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Master data (şirketler, lokasyonlar, pozisyonlar...)
  const acme = await prisma.companies.upsert({
    where: { code: 'ACME' },
    update: {},
    create: { code: 'ACME', name: 'ACME Corp', is_active: true },
  });

  // 2. Sistem rolleri
  const superadminRole = await prisma.roles.upsert({
    where: { code: 'SUPERADMIN' },
    update: {},
    create: { code: 'SUPERADMIN', name: 'Süperadmin', is_system: true, is_active: true },
  });
  
  // 3. Role-permission seed — tüm permission metadata'yı tara
  const allPermissions = Object.keys(PERMISSION_METADATA);
  await prisma.role_permissions.createMany({
    data: allPermissions.map((key) => ({
      role_id: superadminRole.id,
      permission_key: key,
    })),
    skipDuplicates: true,
  });

  // 4. İlk Superadmin user
  const superadmin = await prisma.users.upsert({
    where: { email: 'superadmin@holding.com' },
    update: {},
    create: {
      sicil: '00000001',
      first_name: 'Super',
      last_name: 'Admin',
      email: 'superadmin@holding.com',
      password_hash: await hash('Superadmin1!', 12),
      employee_type: 'WHITE_COLLAR',
      company_id: acme.id,
      // ... diğer zorunlu field'lar default company'lerden resolve edilir
      is_active: true,
      consent_accepted_at: null,  // İlk login'de onaylayacak
    },
  });

  await prisma.user_roles.upsert({
    where: { user_id_role_id: { user_id: superadmin.id, role_id: superadminRole.id } },
    update: {},
    create: { user_id: superadmin.id, role_id: superadminRole.id, source: 'DIRECT' },
  });

  // 5. Rıza metni (ilk versiyon — published)
  await prisma.consent_versions.upsert({
    where: { code: 'v1.0' },
    update: {},
    create: {
      code: 'v1.0',
      title: 'Aydınlatma ve Açık Rıza Metni v1.0',
      content: '# Aydınlatma Metni\n\n...',
      status: 'PUBLISHED',
      effective_from: new Date(),
      published_at: new Date(),
    },
  });

  // 6. Email template'ler — her event için minimal Handlebars
  const emailEvents = ['TASK_ASSIGNED', 'PROCESS_COMPLETED', /* ... */];
  for (const eventType of emailEvents) {
    await prisma.email_templates.upsert({
      where: { event_type: eventType },
      update: {},
      create: {
        event_type: eventType,
        subject_template: `[Lean Management] ${eventType}`,
        body_template: '<p>{{userFirstName}},</p><p>{{eventDescription}}</p>',
      },
    });
  }

  console.log('✓ Seed completed');
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

Çalıştırma:
```bash
pnpm --filter api prisma db seed
```

### 6.4 Staging Seed — Zengin Dataset

Staging için daha zengin seed (manuel QA + acceptance testing):

`apps/api/prisma/seed-staging.ts` — dev seed üzerine:
- 10 şirket (farklı sektörler)
- 20 lokasyon
- 15 departman × 10 pozisyon = 150 pozisyon kombinasyonu
- 5 rol (Superadmin + 4 özel)
- **100 kullanıcı** — faker ile random
- **50 süreç** — mix of statuses:
  - 20 IN_PROGRESS (farklı task step'lerde)
  - 15 COMPLETED
  - 5 REJECTED
  - 5 CANCELLED
  - 5 INITIATED (başlatılmış, task atanmamış — nadir ama mümkün)
- Her süreçte 2-6 task (farklı tamamlanma durumları)
- 200 doküman (CLEAN scan status)
- 500 bildirim (mix read/unread)
- 1000 audit log

```bash
pnpm --filter api seed:staging
```

QA team bu dataset üzerinde:
- Filtre combinations test (500+ süreç listesi nasıl görünür?)
- Pagination test (cursor-based üçüncü sayfa çalışıyor mu?)
- Permission scenarios test (farklı roller farklı ekranlar görüyor mu?)

### 6.5 Staging Reset

Her sprint başı staging DB reset:
```bash
# Scripts/reset-staging.sh
pnpm prisma migrate reset --force
pnpm --filter api seed:staging
```

QA'nın manual test state'i siliner — reproducible test için doküman önerilir (Notion/Confluence test case'ler).

### 6.6 Production Data Staging'e Kopyalanmaz

Privacy + compliance endişesiyle prod DB snapshot staging'e restore **edilmez**. Gerekliyse:
1. Prod snapshot → ayrı test hesabına restore
2. Anonymization script çalıştır (names, emails, phones replace)
3. Schema subset export (audit log hariç)
4. Staging'e import

Bu playbook `docs/runbooks/prod-subset-to-staging.md`'de; MVP'de nadir kullanılır.

---

## 7. Kritik Test Senaryoları

### 7.1 Auth Modülü

**Login:**
- Happy path — valid email + password → 200 + tokens
- Invalid email (format) → 400 VALIDATION_FAILED
- Non-existent email → 401 AUTH_INVALID_CREDENTIALS (timing attack test: response time benzer)
- Wrong password → 401 + failed_login_count++
- 5. hatalı deneme → 401 AUTH_ACCOUNT_LOCKED + locked_until set
- Locked account login attempt → 401 AUTH_ACCOUNT_LOCKED
- Inactive user login → 401 AUTH_ACCOUNT_PASSIVE
- Password expired → 403 AUTH_PASSWORD_EXPIRED
- Consent missing → successful login, consentAccepted: false in response
- Rate limit: 11. istek /dk → 429 RATE_LIMIT_LOGIN

**Token refresh:**
- Happy — valid refresh → new tokens (generation++)
- Expired refresh → 401 AUTH_TOKEN_EXPIRED
- Revoked family → 401 AUTH_SESSION_REVOKED
- Old token generation (theft detection) → family revoke + 401
- Concurrent refresh (race) → one succeeds, other 401; no duplicate family

**Password reset:**
- Happy — request email → Redis'te key var, email queued
- Non-existent email → 200 (generic), Redis'te key yok
- Rate limit 3/hour per email → 429
- Invalid token → 401 AUTH_TOKEN_INVALID
- Expired token (>1 saat) → 401
- Token reuse → 401 (single use)
- Weak password → 400 VALIDATION_FAILED
- Password in history → 400 PASSWORD_REUSED
- Success → sessions revoked, password_history appended

### 7.2 KTİ Workflow

**Başlatma:**
- Happy — tüm zorunlu field valid, docs CLEAN → 201 + task creation
- Manager yok → 422 USER_NOT_FOUND (uygun error code)
- Doc PENDING_SCAN → 409 DOCUMENT_SCAN_PENDING
- Doc INFECTED → 409 DOCUMENT_INFECTED
- Rate limit user → 429
- Permission yok → 403 PROCESS_START_FORBIDDEN

**Manager approval:**
- APPROVE → process COMPLETED, task COMPLETED, notification sent
- REJECT + reason → process REJECTED, process COMPLETED timestamp, notification
- REJECT without reason → 400 TASK_REASON_REQUIRED
- REQUEST_REVISION + reason → başlatıcıya yeni task, process IN_PROGRESS devam
- Invalid action → 400 TASK_COMPLETION_ACTION_INVALID

**Revision:**
- Happy → yeniden manager'a task
- Third revision cycle → backend kısıtı yok (unlimited — opsiyonel limit ADR ile)

**Cancel:**
- Active süreç → CANCELLED, active task SKIPPED_BY_ROLLBACK
- Terminal süreç → 409 PROCESS_NOT_CANCELLABLE
- Reason missing → 400

**Rollback:**
- Happy (IN_PROGRESS, önceki task var) → new task for previous step
- INITIATED state (henüz task yok) → 409 PROCESS_NOT_ROLLBACKABLE
- Terminal → 409
- Birden fazla rollback (nested) → her biri yeni task_id, eski SKIPPED_BY_ROLLBACK

### 7.3 Permission

**Resolver:**
- Direct role → permission set match
- Attribute rule match → resolved permission set
- Direct + attribute rule union → duplicate permission'lar tekil
- Rol permission değişimi → affected user cache invalidated
- User attribute değişimi (company) → attribute rule re-evaluation

**Enforcement:**
- Auth guard: valid JWT → pass; expired → 401
- Permission decorator: `@RequirePermission(X)` ile X yok → 403 + details.missing
- Resource ownership: process other user's → 403 PROCESS_ACCESS_DENIED
- Field-level: non-owner sees limited fields

**Cache invalidation:**
- Role permission update → tüm rol üyeleri cache silinir
- User role assignment → tek user cache silinir
- Attribute rule update → matching user'lar cache silinir

### 7.4 Audit Chain

**Append-only garanti:**
- INSERT → yeni kayıt, trigger hash compute
- UPDATE audit_logs → PostgreSQL exception
- DELETE audit_logs → PostgreSQL exception
- Application user UPDATE permission yok (test: `grant` inspection)

**Chain integrity:**
- Sequential insert → prev_hash zinciri doğru
- Concurrent insert (100 eşzamanlı) → sequence_number gap yok, chain bozulmaz
- Manual tampering simulation (direct SQL UPDATE ile hash bozma) → verify_audit_chain function `false` return eder + broken_at_id set

**Hash consistency:**
- Trigger compute = manual compute (aynı formül)
- Hash deterministic (aynı input aynı output)

### 7.5 Encryption

**Deterministic encryption (email):**
- Encrypt same value twice → same ciphertext (lookup için)
- Encrypt different values → different ciphertext
- Decrypt → original plaintext
- Wrong key → decrypt fail

**Probabilistic encryption (phone):**
- Encrypt same value twice → different ciphertext (random IV)
- Decrypt both → aynı plaintext

**Key rotation:**
- New encryption key with old data → decrypt fails (until re-encrypt migration)
- Dual-key read support — old + new key fallback

### 7.6 Rate Limit

- IP-based limit reached → 429 + Retry-After header
- User-based limit reached → 429 + retry after
- Different endpoint → separate counter
- Window reset → counter 0
- Blocked IP'den nested endpoint isteği → 429 (WAF katmanı)

### 7.7 Form Validation (Frontend)

- Zod schema client-side reject (inline error)
- Server-side error → field-level setError
- Unsaved changes → warning on route change
- Form submit twice (double-click) → button disabled, second ignored

---

## 8. CI Integration

### 8.1 PR Pipeline

`.github/workflows/pr-check.yml`:

```yaml
name: PR Check

on:
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  unit-test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm test --coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false

  integration-test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: leanmgmt_test
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api prisma migrate deploy
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/leanmgmt_test
      - run: pnpm test:integration
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/leanmgmt_test
          REDIS_URL: redis://localhost:6379

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        continue-on-error: true
        with:
          args: --severity-threshold=high
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      - uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD

  build:
    runs-on: ubuntu-latest
    needs: [unit-test, integration-test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### 8.2 Coverage Gate

CI block eden eşikler:
- Proje line coverage < 75% → fail
- Branch coverage < 65% → fail
- Function coverage < 80% → fail
- Yeni eklenen dosyada coverage < 70% → warning (block değil)

Eşik `vitest.config.ts` içinde:

```typescript
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 75,
        branches: 65,
        functions: 80,
        statements: 75,
      },
    },
  },
});
```

### 8.3 Merge Pipeline

Main'e merge sonrası (`.github/workflows/main.yml`):

```yaml
on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    # ... build + push ECR + deploy ECS staging
  
  e2e-staging:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web playwright install --with-deps chromium
      - run: pnpm --filter web test:e2e
        env:
          E2E_BASE_URL: https://staging.lean-mgmt.holding.com
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
  
  deploy-prod:
    needs: e2e-staging
    environment: production  # Manual approval
    # ... production deploy
```

### 8.4 Nightly Pipeline

`.github/workflows/nightly.yml` — her gece 02:00 UTC:

- Full regression (unit + integration + e2e)
- Security scan (OWASP ZAP baseline against staging)
- Dependency audit (Snyk full scan — PR'dakinden daha geniş)
- Mutation testing (Stryker — haftada 1)
- Backup restore drill (staging DB'ye snapshot restore)

Failure → email + Slack alert.

---

## 9. User Approval Before Merge

### 9.1 PR Template

`.github/pull_request_template.md`:

```markdown
## Özet

[Değişikliğin kısa açıklaması — neden bu değişikliğe ihtiyaç var]

## Değişiklik Türü

- [ ] Bug fix
- [ ] Yeni feature
- [ ] Refactor (davranış değişmez)
- [ ] Dokümantasyon
- [ ] Performance iyileştirme
- [ ] Security fix

## Test Planı

- [ ] Unit testler eklendi/güncellendi
- [ ] Integration testler eklendi/güncellendi (DB/workflow değişikliği varsa)
- [ ] E2E testler etkilendi mi? Evetse güncellendi mi
- [ ] Manuel test yapıldı (staging)

### Test edilen senaryolar

1. [Happy path]
2. [Edge case 1]
3. [Edge case 2]

## Güvenlik Gözden Geçirmesi

- [ ] Yeni endpoint varsa permission decorator eklendi
- [ ] PII değişikliği varsa encryption uygulandı
- [ ] Input validation Zod schema ile bağlandı
- [ ] Audit log action eklendi (gerekiyorsa)
- [ ] Secret/credential git'e commit edilmedi

## Coverage Delta

[Codecov bot yorumu — manuel doldurulmaz]

## Ekran Görüntüleri / Demo

[UI değişikliği varsa before/after screenshot veya GIF]

## Deployment Notu

[Config değişikliği, migration, env var ekleme varsa]
```

### 9.2 Review Checklist — Reviewer

Her PR'da reviewer sormalı:
- Her public method testli mi?
- Test assertion'lar anlamlı mı (trivial `toBeDefined()` yerine davranış doğrulaması)?
- Edge case'ler kapsanmış mı (null input, empty array, concurrent request)?
- Mock davranışı gerçek service ile uyumlu mu?
- Integration test'te DB state assertion yapılıyor mu?
- Sensitive data (password, token) test dosyasında hardcoded mı? (Olmaması gerekir)

### 9.3 Approval Gerekli Senaryolar

| Değişiklik türü | Onay sayısı | Özel onay |
|---|---|---|
| Standard PR | 1 reviewer | — |
| Security-related (auth, encryption, permission) | 2 reviewer | Security lead |
| Database migration | 2 reviewer | DBA/backend lead |
| Infra / IAM değişikliği | 2 reviewer | DevOps lead |
| Production hotfix | 1 reviewer | On-call + post-merge audit |

Solo developer senaryosunda (MVP başı): self-review disiplini zorunlu. PR açılır, 24 saat bekletilir, sonra self-review + merge. Rush merge yasak.

---

## 10. Staging Seed — Detay

(Bölüm 6.4 ile kombine — ekran bazlı senaryo detayı.)

Staging seed'in platform test'leme kapsamı:

**Ekran × scenario test matrix:**

| Ekran | Test senaryosu | Beklenen data |
|---|---|---|
| S-USER-LIST | Filtre: companyId=ACME, isActive=true | ~15 kullanıcı |
| S-USER-LIST | Arama: "ali" | 3-5 sonuç |
| S-PROC-LIST-MY | Happy — aktif user için | 2-5 süreç |
| S-PROC-LIST-ADMIN | CANCELLED toggle on | +5 süreç |
| S-TASK-LIST (pending tab) | Manager user için | 1-3 bekleyen |
| S-TASK-LIST (completed tab) | Çeşitli completion action'lar | 10+ |
| S-PROC-DETAIL | Full chain — 4 adım complete | Her task görünür |
| S-ROLE-USERS | Direct + rule mix | 20+ user |
| S-ADMIN-AUDIT | Son 24 saat filter | 200+ kayıt |
| S-NOTIF-LIST | Mix read/unread | 15+ bildirim |

Seed sonrası manuel QA checklist oluşturulur (QA team + Notion/Confluence doc).

---

## 11. Load ve Stress Test

### 11.1 Tool — k6

k6 JavaScript-based, CloudWatch metric emit, distributed load test desteği. k6 Cloud opsiyonel — MVP'de local runner yeterli.

### 11.2 Hedef Metrikler

**Target kapasite:**
- 1000 eşzamanlı kullanıcı
- 100 req/sec steady state
- Burst: 500 req/sec (login storm simülasyonu)

**Performance SLO:**
- P50 response time < 200ms
- P95 response time < 500ms
- P99 response time < 1000ms
- Error rate < 0.1%
- 0 kritik error (500, 503)

### 11.3 k6 Script Örneği — Login Storm

```javascript
// loadtest/login-storm.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const loginTrend = new Trend('login_duration');

export const options = {
  scenarios: {
    gradual_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 500 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
    login_duration: ['p(95)<800'],  // Login bcrypt hesap ağır
  },
};

const TEST_USERS = JSON.parse(open('./test-users.json'));  // 1000 test user

export default function () {
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];

  const loginRes = http.post(`${__ENV.API_URL}/api/v1/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'login' },
  });

  const loginOk = check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'has access token': (r) => r.json('data.accessToken') !== undefined,
  });

  errorRate.add(!loginOk);
  loginTrend.add(loginRes.timings.duration);

  if (loginOk) {
    const token = loginRes.json('data.accessToken');
    const meRes = http.get(`${__ENV.API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      tags: { endpoint: 'me' },
    });
    check(meRes, { 'me status 200': (r) => r.status === 200 });
  }

  sleep(1);  // Think time
}
```

Çalıştırma:
```bash
API_URL=https://staging.lean-mgmt.holding.com k6 run --out cloudwatch loadtest/login-storm.js
```

### 11.4 Senaryolar

| Script | Target | Sıklık |
|---|---|---|
| `login-storm.js` | Login endpoint 500 VU | Aylık |
| `process-list-pagination.js` | Büyük liste pagination | Aylık |
| `kti-start-burst.js` | 50 eşzamanlı KTİ başlatma | Aylık |
| `dashboard-mixed.js` | Tipik kullanıcı akışı — dashboard + task + process carousel | Çeyrek |
| `sustained-2h.js` | 2 saat steady 100 req/sec — memory leak tespiti | Çeyrek |

### 11.5 Capacity Planning

Load test sonuçları infra ölçeklendirme kararlarına veri sağlar:
- CPU bottleneck varsa → ECS task sayısı ↑ veya instance type ↑
- RDS connection pool exhausted → PgBouncer eklenir veya pool size ↑
- Redis latency spike → memory ↑ veya shard
- S3 throughput limit → prefix dağıtımı iyileştirme

---

## 12. Performance Test — Frontend

### 12.1 Lighthouse CI

Her PR'da kritik 3 sayfa için Lighthouse:
- `/login` (unauthenticated)
- `/dashboard` (authenticated)
- `/processes` (liste — büyük data)

```yaml
# .github/workflows/lighthouse.yml
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            https://pr-${{ github.event.number }}.lean-mgmt.holding.com/login
            https://pr-${{ github.event.number }}.lean-mgmt.holding.com/dashboard
          uploadArtifacts: true
          temporaryPublicStorage: true
          configPath: './lighthouserc.json'
```

`lighthouserc.json`:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.80 }],
        "categories:accessibility": ["error", { "minScore": 0.90 }],
        "categories:best-practices": ["error", { "minScore": 0.90 }],
        "categories:seo": ["warn", { "minScore": 0.80 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }]
      }
    }
  }
}
```

### 12.2 Web Vitals Monitoring

Production'da Real User Monitoring (RUM):
- Vercel Analytics (varsayılan, free tier yeterli)
- Web Vitals API → CloudWatch custom metric
- Sentry Performance Monitoring (browser transactions)

Haftalık özet rapor:
- P75 LCP, INP, CLS
- Yavaş route'lar top 5
- Yavaş API call'lar top 5

### 12.3 Bundle Size Budget

`next.config.mjs`:

```javascript
export default {
  experimental: {
    bundlePagesRouterDependencies: true,
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.performance = {
        hints: 'error',
        maxAssetSize: 200 * 1024,  // 200 KB
        maxEntrypointSize: 250 * 1024,
      };
    }
    return config;
  },
};
```

`@next/bundle-analyzer` PR'da bundle delta report:
- > 10 KB artış → warning (reviewer decision)
- > 50 KB artış → block + justification

---

## 13. Security Test

### 13.1 SAST (Static Application Security Testing)

**Snyk Code** her PR'da:
- Node.js security rules
- OWASP Top 10 patterns
- Custom rule: `eval`, `dangerouslySetInnerHTML`, raw SQL concat
- Severity threshold: HIGH+ → PR block

**ESLint security plugins:**
- `eslint-plugin-security` — detect unsafe patterns
- `eslint-plugin-no-secrets` — credential leaks
- Custom rules: banned imports, require decorator on controllers

### 13.2 Dependency Scanning

**Snyk + Dependabot:**
- Snyk weekly full scan
- Dependabot daily PR for security patches
- Transitive dependency vulnerability tracking
- License compliance check (GPL reject, MIT/Apache/ISC allow)

Vulnerable dependency handling flowchart:
1. Dependabot PR açar
2. Test suite green? → auto-merge (patch version)
3. Manual intervention gerekli (major version) → backlog
4. No upstream fix → workaround (Snyk ignore 30 gün + ticket)

### 13.3 DAST (Dynamic Application Security Testing)

**OWASP ZAP Baseline Scan** nightly:

```yaml
jobs:
  zap-baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: zaproxy/action-baseline@v0.12.0
        with:
          target: 'https://staging.lean-mgmt.holding.com'
          rules_file_name: '.zap/rules.tsv'
          fail_action: true
```

`.zap/rules.tsv` — false positive ignore list (CSP manuel doğrulandı vs.).

### 13.4 Secret Scanning

**gitleaks** her PR'da:

```yaml
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Kural seti: AWS key, GitHub token, JWT secret, private key pattern'leri. `.gitleaksignore` false positive'ler için.

### 13.5 Penetration Test

Yılda 1 kez dış firma ile pen-test:
- Scope: production environment read-only + staging full access
- Duration: 2-3 hafta
- Deliverable: vulnerability report + remediation priority
- Follow-up: 30/60/90 gün içinde HIGH/MEDIUM/LOW fix

---

## 14. Test Naming Convention

### 14.1 Dosya İsmi

- Unit: `[module].test.ts` (veya `.test.tsx` React)
- Integration: `[module].integration.test.ts`
- E2E: `[journey].spec.ts` (Playwright convention)
- Factory: `[entity].factory.ts`
- Helper: `[concern].helper.ts`

### 14.2 describe / it Pattern

```typescript
describe('ClassName / FunctionName / ComponentName', () => {
  describe('methodName / behavior group', () => {
    it('should [expected outcome] when [condition]', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

Örnek:

```typescript
describe('UserService', () => {
  describe('create', () => {
    it('should create user with valid input', () => { /* ... */ });
    it('should throw UserSicilDuplicateException when sicil already exists', () => { /* ... */ });
    it('should throw ValidationError when email format is invalid', () => { /* ... */ });
  });

  describe('update', () => {
    it('should update user attributes when caller has USER_UPDATE_ATTRIBUTE permission', () => { /* ... */ });
    it('should throw PermissionDeniedException when caller lacks permission', () => { /* ... */ });
    it('should throw UserManagerCycleException when manager creates reference cycle', () => { /* ... */ });
  });
});
```

### 14.3 AAA Pattern — Explicit Section

Her test 3 bölümde:

```typescript
it('should create process when all validations pass', async () => {
  // Arrange
  const initiator = await userFactory.create(prisma);
  const manager = await userFactory.create(prisma);
  await linkManager(prisma, initiator.id, manager.id);
  const docs = await documentFactory.createBatch(prisma, 2);
  const input = { /* ... */ };
  
  // Act
  const result = await service.startKti(input, initiator);
  
  // Assert
  expect(result.status).toBe('IN_PROGRESS');
  expect(result.displayId).toMatch(/^KTI-\d{6}$/);
  
  const tasks = await prisma.tasks.findMany({ where: { process_id: result.id } });
  expect(tasks).toHaveLength(1);
  expect(tasks[0].step_label).toBe('Yönetici Onay');
});
```

Küçük testlerde AAA yorumu gereksiz — 2-3 satırlık testlerde mental model yeterli.

### 14.4 Assertion Kalitesi

**Kötü:**
```typescript
expect(result).toBeDefined();
expect(result).toBeTruthy();
expect(result.someProperty).toBeTruthy();
```

**İyi:**
```typescript
expect(result.status).toBe('COMPLETED');
expect(result.tasks).toHaveLength(3);
expect(result.tasks.map((t) => t.status)).toEqual(['COMPLETED', 'COMPLETED', 'COMPLETED']);
expect(result.auditLogs).toContainEqual(
  expect.objectContaining({ action: 'PROCESS_STARTED' })
);
```

Specific assertion → test kırıldığında ne yanlış olduğu net.

---

## 15. Appendix — Full Örnek Kümeleri

### 15.1 Auth — Login Unit Test

```typescript
// apps/api/src/auth/auth.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { AuthService } from './auth.service';
import { AuthInvalidCredentialsException, AuthAccountLockedException, AuthPasswordExpiredException } from './auth.exceptions';

describe('AuthService.login', () => {
  let service: AuthService;
  let prisma: any;
  let redis: any;
  let jwt: any;
  let bcrypt: any;

  beforeEach(() => {
    prisma = mockDeep();
    redis = mockDeep();
    jwt = mockDeep();
    bcrypt = { compare: vi.fn(), hash: vi.fn() };
    service = new AuthService(prisma, redis, jwt, bcrypt as any);
  });

  it('should return tokens on valid credentials', async () => {
    const user = {
      id: 'u1',
      email: 'ali@test.com',
      password_hash: 'hashed',
      is_active: true,
      locked_until: null,
      failed_login_count: 0,
      password_changed_at: new Date(),
      consent_accepted_version_id: 'v1',
    };
    prisma.users.findUnique.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);
    prisma.sessions.create.mockResolvedValue({ id: 's1' });
    jwt.sign.mockReturnValueOnce('access_token').mockReturnValueOnce('refresh_token');

    const result = await service.login('ali@test.com', 'password', '1.1.1.1', 'UA');

    expect(result.accessToken).toBe('access_token');
    expect(result.refreshToken).toBe('refresh_token');
    expect(prisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failed_login_count: 0, last_login_at: expect.any(Date) }),
      })
    );
  });

  it('should throw AuthInvalidCredentialsException when user not found', async () => {
    prisma.users.findUnique.mockResolvedValue(null);
    bcrypt.compare.mockResolvedValue(false);  // Timing protection — dummy hash compare

    await expect(
      service.login('ghost@test.com', 'password', '1.1.1.1', 'UA')
    ).rejects.toThrow(AuthInvalidCredentialsException);

    expect(bcrypt.compare).toHaveBeenCalled();  // Dummy compare çalıştı
  });

  it('should lock account after max failed attempts', async () => {
    const user = {
      id: 'u1',
      email: 'ali@test.com',
      password_hash: 'hashed',
      is_active: true,
      locked_until: null,
      failed_login_count: 4,  // 5. deneme lockout tetikler
      password_changed_at: new Date(),
    };
    prisma.users.findUnique.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      service.login('ali@test.com', 'wrong', '1.1.1.1', 'UA')
    ).rejects.toThrow(AuthAccountLockedException);

    expect(prisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locked_until: expect.any(Date),
          failed_login_count: 5,
        }),
      })
    );
  });

  it('should throw AuthPasswordExpiredException when password older than expiry', async () => {
    const user = {
      id: 'u1',
      email: 'ali@test.com',
      password_hash: 'hashed',
      is_active: true,
      locked_until: null,
      failed_login_count: 0,
      password_changed_at: new Date(Date.now() - 100 * 24 * 3600 * 1000),  // 100 gün önce (> 90)
    };
    prisma.users.findUnique.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);

    await expect(
      service.login('ali@test.com', 'password', '1.1.1.1', 'UA')
    ).rejects.toThrow(AuthPasswordExpiredException);
  });
});
```

### 15.2 Permission Cache Invalidation — Integration Test

```typescript
// apps/api/test/permission-cache.integration.test.ts
describe('Permission Cache Invalidation', () => {
  it('should invalidate cache when role permission is updated', async () => {
    const user = await userFactory.create(prisma);
    const role = await roleFactory.create(prisma, { code: 'TEST_ROLE' });
    await prisma.user_roles.create({ data: { user_id: user.id, role_id: role.id, source: 'DIRECT' } });
    await prisma.role_permissions.create({ data: { role_id: role.id, permission_key: 'USER_LIST_VIEW' } });

    // İlk cache populate
    await permissionResolver.getUserPermissions(user.id);
    const cacheKey = `user_permissions:${user.id}`;
    expect(await redis.get(cacheKey)).toBeTruthy();

    // Role permission güncellemesi
    await prisma.role_permissions.create({ data: { role_id: role.id, permission_key: 'USER_CREATE' } });
    await permissionService.invalidateRolePermissionCache(role.id);

    expect(await redis.get(cacheKey)).toBeNull();  // Cache temizlendi

    // Yeni cache yeni permission içermeli
    const updated = await permissionResolver.getUserPermissions(user.id);
    expect(updated.has('USER_CREATE')).toBe(true);
  });
});
```

### 15.3 Audit Chain — Concurrency Integration Test

```typescript
describe('Audit Log Chain — Concurrent Inserts', () => {
  it('should maintain chain integrity under concurrent inserts', async () => {
    const insertPromises = Array.from({ length: 100 }, (_, i) =>
      prisma.audit_logs.create({
        data: {
          timestamp: new Date(),
          action: 'TEST_ACTION',
          entity_type: 'TEST',
          entity_id: `entity-${i}`,
          details: {},
          ip: '1.1.1.1',
          outcome: 'SUCCESS',
        },
      })
    );

    await Promise.all(insertPromises);

    const logs = await prisma.audit_logs.findMany({ orderBy: { sequence_number: 'asc' } });
    expect(logs).toHaveLength(100);

    // Sequence number gap yok
    for (let i = 0; i < logs.length; i++) {
      expect(Number(logs[i].sequence_number)).toBe(i + 1);
    }

    // Chain hash zinciri doğru
    expect(logs[0].prev_hash).toMatch(/^0{64}$/);
    for (let i = 1; i < logs.length; i++) {
      expect(logs[i].prev_hash).toBe(logs[i - 1].current_hash);
    }

    // verify_audit_chain function
    const [result] = await prisma.$queryRaw<{ is_valid: boolean; total_checked: bigint }[]>`
      SELECT * FROM verify_audit_chain()
    `;
    expect(result.is_valid).toBe(true);
    expect(Number(result.total_checked)).toBe(100);
  });
});
```

### 15.4 E2E — Role Management

```typescript
// apps/web/e2e/role-management.spec.ts
import { test, expect } from '@playwright/test';

test('Superadmin creates role, assigns permissions, assigns to user', async ({ page }) => {
  // Login as Superadmin
  await page.goto('/login');
  await page.fill('input[name="email"]', 'superadmin@test.com');
  await page.fill('input[name="password"]', 'Test1234!@#$');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');

  // Rol oluştur
  await page.goto('/roles');
  await page.click('text=Yeni Rol');
  await page.fill('input[name="code"]', 'TEST_MANAGER');
  await page.fill('input[name="name"]', 'Test Yönetici');
  await page.fill('textarea[name="description"]', 'E2E test için rol');
  await page.click('button:has-text("Oluştur")');
  await expect(page).toHaveURL(/\/roles\/[a-f0-9-]+$/);

  // Permissions sekmesine git
  await page.click('text=Yetkiler');
  await expect(page).toHaveURL(/\/roles\/[a-f0-9-]+\/permissions$/);

  // USER_LIST_VIEW checkbox
  await page.check('input[data-permission="USER_LIST_VIEW"]');
  await page.check('input[data-permission="USER_CREATE"]');

  // Save
  await page.click('button:has-text("Değişiklikleri Kaydet")');
  await page.fill('input[name="confirm-text"]', 'ONAYLIYORUM');
  await page.click('button:has-text("Güncellemeyi Kaydet")');

  await expect(page.locator('[data-testid="toast"]')).toContainText('güncellendi');

  // Kullanıcı sekmesi — user assign
  await page.click('text=Kullanıcılar');
  await page.click('text=Yeni Kullanıcı Ata');
  await page.fill('input[placeholder="Kullanıcı ara"]', 'testuser');
  await page.click('li:has-text("testuser@test.com")');
  await page.click('button:has-text("Ata")');

  await expect(page.locator('[data-testid="toast"]')).toContainText('atandı');
  await expect(page.locator('tr:has-text("testuser@test.com")')).toBeVisible();
});
```

### 15.5 k6 — Dashboard Mixed Scenario

```javascript
// loadtest/dashboard-mixed.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const USERS = JSON.parse(open('./test-users.json'));

export function setup() {
  // Login 100 users, return tokens
  const tokens = [];
  for (const user of USERS.slice(0, 100)) {
    const res = http.post(`${__ENV.API_URL}/api/v1/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password,
    }), { headers: { 'Content-Type': 'application/json' } });
    if (res.status === 200) tokens.push(res.json('data.accessToken'));
  }
  return { tokens };
}

export default function (data) {
  const token = data.tokens[Math.floor(Math.random() * data.tokens.length)];
  const headers = { Authorization: `Bearer ${token}` };

  group('Dashboard load', () => {
    const meRes = http.get(`${__ENV.API_URL}/api/v1/auth/me`, { headers });
    check(meRes, { 'me 200': (r) => r.status === 200 });

    const tasksRes = http.get(`${__ENV.API_URL}/api/v1/tasks?tab=pending&limit=3`, { headers });
    check(tasksRes, { 'tasks 200': (r) => r.status === 200 });

    const notifsRes = http.get(`${__ENV.API_URL}/api/v1/notifications?limit=5`, { headers });
    check(notifsRes, { 'notifications 200': (r) => r.status === 200 });
  });

  sleep(2);

  group('Process list browse', () => {
    const listRes = http.get(`${__ENV.API_URL}/api/v1/processes?scope=my-started&limit=20`, { headers });
    check(listRes, { 'processes list 200': (r) => r.status === 200 });

    const processes = listRes.json('data.items');
    if (processes && processes.length > 0) {
      const randomProc = processes[Math.floor(Math.random() * processes.length)];
      const detailRes = http.get(`${__ENV.API_URL}/api/v1/processes/${randomProc.displayId}`, { headers });
      check(detailRes, { 'process detail 200': (r) => r.status === 200 });
    }
  });

  sleep(3);
}
```

---

## 16. Test Yazım Checklist

Her PR için tamamlanması gereken:

**Backend PR:**
- [ ] Değişen public method için unit test
- [ ] DB schema değişikliği varsa integration test
- [ ] Yeni endpoint için permission enforcement test
- [ ] Error path'ler test edildi (happy path yetersiz)
- [ ] Rate limit test edildi (eklendiyse)
- [ ] Audit log tetikleme test edildi
- [ ] Coverage delta düşürmüyor

**Frontend PR:**
- [ ] Yeni hook için unit test
- [ ] Yeni component için smoke test + kritik behavior
- [ ] Yeni page için e2e flow var (kritik ekransa)
- [ ] Form validation (client-side Zod + server error handling)
- [ ] Accessibility test (axe-core integration)
- [ ] Bundle size delta kabul edilebilir

**Infra PR:**
- [ ] Terraform / CDK değişikliği için unit test (terratest, cdk-nag)
- [ ] IAM policy minimal permission doğrulandı
- [ ] CloudFormation drift detection
- [ ] Rollback planı dokümante edildi

Bu checklist her developer'ın zihinsel model olarak içselleştirmesi beklenir. PR template'te listelenir ama manuel doğrulama reviewer + self-review sorumluluğunda.

---

Bu doküman yaşar — yeni test türü eklendikçe (contract test, chaos test vs.), yeni tool geldikçe, yeni senaryo eklendikçe güncellenir. Her sprint retro'sunda "hangi bug'lar test kaçırdı" sorusu sorulur ve eksik test coverage tespit edilir.
