# Lean Management Platformu — Frontend Mimarisi ve Kuralları

> Bu doküman frontend'in nasıl organize edildiğini, hangi kütüphanelerin nerede kullanıldığını, state'in nerede yaşadığını ve ortak etkileşim pattern'lerini tanımlar. Ekran bazlı spesifikasyon bu dokümanda **yok** — o `06_SCREEN_CATALOG`'da. Bu doküman kural kitabıdır; ekran kataloğu oyun planıdır.

---

## 1. Framework ve Render Model

### 1.1 Stack

| Bileşen | Versiyon | Not |
|---|---|---|
| Next.js | 15.x | App Router zorunlu; Pages Router kullanılmaz |
| React | 19.x | Server Components varsayılan |
| TypeScript | 5.4+ | `strict: true`; backend ile aynı tsconfig preset (`packages/config/tsconfig.base.json`) |
| Node.js (build) | 20 LTS | `.nvmrc` ile pinned |
| shadcn/ui | kopya model | Radix UI primitives üzerinde; bileşenler `src/components/ui/` altında yaşar |
| Tailwind CSS | 3.x | shadcn default preset |
| TanStack Query | v5 | Server state yönetimi |
| Zustand | v5 | UI transient state + auth state |
| react-hook-form | v7 | `@hookform/resolvers/zod` ile Zod adaptörü |
| Zod | 3.x | `packages/shared-schemas` paketiyle aynı sürüm |
| lucide-react | latest | Icon set |
| date-fns + date-fns-tz | latest | TR locale |
| sonner | latest | Toast (shadcn native) |

Yeni major kütüphane eklenmesi ADR gerektirir — özellikle bundle bütçesi (200 KB gzipped initial) katıdır.

### 1.2 Render Model Politikası

**Varsayılan:** React Server Component. Yani `'use client'` direktifi olmayan her bileşen server'da render edilir.

**`'use client'` gerekli yerler:**
- State kullanan bileşenler (`useState`, `useReducer`)
- Effect kullanan bileşenler (`useEffect`, `useLayoutEffect`)
- Event handler bağlayan bileşenler (`onClick`, `onChange`, `onSubmit`)
- Browser-only API'leri kullanan bileşenler (`localStorage`, `document`, `window`)
- TanStack Query hook'ları (`useQuery`, `useMutation`)
- Form bileşenleri (react-hook-form client-side)

**Pratik kural:** Route'un `page.tsx` dosyası çoğunlukla client — çünkü neredeyse her sayfa TanStack Query kullanır. `layout.tsx` dosyaları server (sabit shell) + client alt bileşenler (sidebar state, user dropdown).

### 1.3 Data Fetching Stratejisi

Server-side data fetching **kullanılmaz.** Tüm veri TanStack Query ile client-side çekilir. Nedeni:

- Backend auth modeli JWT Bearer header — access token client tarafında yaşıyor
- RSC'de SSR fetch yapmak için httpOnly cookie JWT'ye geçmek gerekir, bu backend mimarisini değiştirir
- TanStack Query stale-while-revalidate davranışı SSR'dan daha iyi UX sağlar (instant cache + background refresh)
- Kodu tek pattern'de tutmak — "bu sayfa SSR mi CSR mi?" sorusu hiç sorulmaz, daima CSR

RSC rolü: statik shell (layout, navigation skeleton), client component'leri mount eden hydration boundary. Server-side rendering boot time için yararlı (HTML hızlı gelir), ama veri daima client'ta çekilir.

### 1.4 Static vs Dynamic Rendering

**Statik:** `/login`, `/forgot-password`, `/reset-password`, `/404`, `/403`, `/maintenance` — public sayfalar, CDN'de cache edilir.

**Dinamik:** Authenticated tüm route'lar. `middleware.ts` cookie varlığını kontrol ettiği için bu sayfalar varsayılan olarak dinamik.

---

## 2. Klasör Yapısı — `apps/web/`

```
apps/web/
├── src/
│   ├── app/                             # Next.js App Router kökü
│   │   ├── layout.tsx                   # Root layout — <html>, <body>, Providers wrapper
│   │   ├── providers.tsx                # QueryClientProvider, Toaster, ThemeProvider
│   │   ├── page.tsx                     # / — dashboard redirect
│   │   ├── globals.css                  # Tailwind + shadcn CSS değişkenleri
│   │   │
│   │   ├── (auth)/                      # Unauthenticated route grubu
│   │   │   ├── layout.tsx               # AuthLayout — centered logo + card
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   └── reset-password/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (app)/                       # Authenticated route grubu
│   │   │   ├── layout.tsx               # AppLayout — sidebar + topbar + main
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── processes/
│   │   │   │   ├── page.tsx             # Liste
│   │   │   │   ├── [displayId]/
│   │   │   │   │   └── page.tsx         # Detay
│   │   │   │   └── kti/
│   │   │   │       └── start/
│   │   │   │           └── page.tsx     # KTİ başlatma formu
│   │   │   ├── tasks/
│   │   │   │   ├── page.tsx             # Liste (tabs: started/pending/completed)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx         # Görev detayı + form
│   │   │   ├── users/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── edit/page.tsx
│   │   │   ├── roles/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── permissions/page.tsx   # Rol-Yetki Tablosu
│   │   │   │       ├── rules/page.tsx         # Attribute-based kurallar
│   │   │   │       └── users/page.tsx
│   │   │   ├── master-data/
│   │   │   │   └── [type]/
│   │   │   │       └── page.tsx         # Generic master data yönetimi
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx
│   │   │   └── profile/
│   │   │       └── page.tsx             # "Verilerim" dahil
│   │   │
│   │   ├── (admin)/                     # Superadmin-only route grubu
│   │   │   ├── layout.tsx               # AdminLayout (AppLayout extends — farklı sidebar)
│   │   │   ├── admin/
│   │   │   │   ├── audit-logs/page.tsx
│   │   │   │   ├── system-settings/page.tsx
│   │   │   │   ├── email-templates/page.tsx
│   │   │   │   └── consent-versions/page.tsx
│   │   │
│   │   ├── 403/page.tsx
│   │   ├── 404/page.tsx
│   │   ├── error.tsx                    # Global error boundary
│   │   └── not-found.tsx                # 404 fallback
│   │
│   ├── components/
│   │   ├── ui/                          # shadcn kopyaları — ham bileşenler
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   ├── table.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ... (kullanılan her shadcn bileşeni)
│   │   │
│   │   ├── shared/                      # Uygulama-özel ortak bileşenler
│   │   │   ├── PermissionGate.tsx       # Permission-bazlı conditional render
│   │   │   ├── DataTable.tsx            # TanStack Table + Pagination + Filter
│   │   │   ├── FormLayout.tsx           # Form wrapper (label + input + error)
│   │   │   ├── ConfirmDialog.tsx        # Silme/iptal onay dialog
│   │   │   ├── EmptyState.tsx           # İkon + mesaj + CTA
│   │   │   ├── LoadingSkeleton.tsx      # Liste skeleton
│   │   │   ├── ErrorBoundary.tsx        # Feature-level error boundary
│   │   │   ├── UnsavedChangesWarning.tsx
│   │   │   ├── CsrfInterceptor.tsx      # Mount-time CSRF setup
│   │   │   └── ConsentModal.tsx         # Blocking rıza modal
│   │   │
│   │   ├── layout/
│   │   │   ├── AppSidebar.tsx           # Rol-gated menu
│   │   │   ├── Topbar.tsx               # Search + notifications + user menu
│   │   │   ├── NotificationBell.tsx     # Çan ikonu + dropdown
│   │   │   ├── UserMenu.tsx             # Avatar + logout
│   │   │   └── PasswordExpiryBanner.tsx
│   │   │
│   │   ├── users/
│   │   │   ├── UserForm.tsx
│   │   │   ├── UserListTable.tsx
│   │   │   └── UserDetailCard.tsx
│   │   │
│   │   ├── roles/
│   │   │   ├── PermissionMatrix.tsx     # Rol-Yetki Tablosu
│   │   │   ├── RoleRuleBuilder.tsx
│   │   │   └── RoleForm.tsx
│   │   │
│   │   ├── processes/
│   │   │   ├── ProcessListTable.tsx
│   │   │   ├── ProcessDetailCard.tsx
│   │   │   └── kti/
│   │   │       ├── KtiStartForm.tsx
│   │   │       └── KtiApprovalForm.tsx
│   │   │
│   │   └── tasks/
│   │       ├── TaskListTable.tsx
│   │       └── TaskDetailForm.tsx
│   │
│   ├── hooks/
│   │   ├── usePermissions.ts            # Auth store'dan permission set
│   │   ├── useCurrentUser.ts            # /auth/me wrapper
│   │   ├── useDebounce.ts
│   │   ├── useIdempotencyKey.ts         # UUID generate + request lifecycle
│   │   ├── useUnsavedChangesWarning.ts
│   │   └── useInvalidateOnMutation.ts
│   │
│   ├── lib/
│   │   ├── api-client.ts                # Axios instance + interceptor'lar
│   │   ├── query-client.ts              # TanStack QueryClient config
│   │   ├── query-keys.ts                # Query key factory (tek kaynak)
│   │   ├── queries/                     # Query function'lar per-entity
│   │   │   ├── users.ts
│   │   │   ├── roles.ts
│   │   │   ├── processes.ts
│   │   │   ├── tasks.ts
│   │   │   ├── documents.ts
│   │   │   ├── notifications.ts
│   │   │   └── admin.ts
│   │   ├── csrf.ts                      # CSRF token helper
│   │   ├── cuid.ts
│   │   └── format.ts                    # Tarih/sayı format helper
│   │
│   ├── stores/                          # Zustand
│   │   ├── auth-store.ts                # currentUser + permissions + tokens
│   │   ├── ui-store.ts                  # Sidebar collapsed, active modal id
│   │   └── unsaved-changes-store.ts     # Global dirty form kaydı
│   │
│   ├── i18n/
│   │   └── tr.ts                        # UI metinleri — tek kaynak
│   │
│   └── middleware.ts                    # Next middleware — cookie guard
│
├── public/
│   ├── favicon.ico
│   └── logo.svg
│
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── .env.example
└── package.json
```

---

## 3. Route Konfigürasyonu

### 3.1 Route Grupları

Next.js App Router'ın parantezli gruplama özelliği ile URL yapısını bozmadan farklı layout'lar uygulanır:

| Grup | Layout | Erişim | Örnek route |
|---|---|---|---|
| `(auth)` | AuthLayout — ortada logo + card | Unauth | `/login`, `/forgot-password` |
| `(app)` | AppLayout — sidebar + topbar | Auth | `/dashboard`, `/processes`, `/tasks` |
| `(admin)` | AdminLayout — AppLayout + kısıtlı sidebar | Auth + Superadmin | `/admin/audit-logs` |

URL'de grup adı görünmez (parantezli segmentler Next tarafından URL'den çıkarılır): `/admin/audit-logs` gerçek route, `(admin)/admin/` sadece dosya yapısı.

### 3.2 Protected Route — `middleware.ts`

İlk savunma katmanı Next middleware'dir. Cookie varlığını kontrol eder:

```typescript
// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/403', '/404', '/maintenance'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Statik asset'ler ve API proxy'leri pass-through
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Public path'ler guardsız
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Refresh token cookie'si yok → login'e yönlendir
  const refreshToken = request.cookies.get('refresh_token');
  if (!refreshToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg).*)'],
};
```

**Önemli:** Middleware yalnız cookie **varlığını** kontrol eder; cookie'nin geçerliliğini doğrulamaz. Geçersiz refresh token ile korumalı sayfaya giriş denemesi → backend ilk `/auth/me` çağrısında 401 → frontend auth store clear + login redirect. Bu iki-katmanlı savunma (middleware cookie-presence + API 401 handling) UX'i akıcı tutar.

### 3.3 Layout Auth Guard

`(app)/layout.tsx` mount olduğunda `useCurrentUser()` ile `/auth/me` çağrılır. Dönen response'a göre davranış:

```typescript
// src/app/(app)/layout.tsx
'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ConsentModal } from '@/components/shared/ConsentModal';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Topbar } from '@/components/layout/Topbar';
import { PasswordExpiryBanner } from '@/components/layout/PasswordExpiryBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, error } = useCurrentUser();

  if (isLoading) return <LoadingSkeleton variant="full-page" />;
  if (error) return null;  // axios interceptor login'e yönlendirir

  // Rıza onaylanmamışsa blocking modal
  if (!user.consentAccepted) {
    return <ConsentModal user={user} />;
  }

  return (
    <div className="flex h-screen">
      <AppSidebar user={user} />
      <div className="flex-1 flex flex-col">
        <PasswordExpiryBanner expiresAt={user.passwordExpiresAt} />
        <Topbar user={user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

### 3.4 Redirect Davranışı

| Durum | Davranış |
|---|---|
| Unauth + korumalı route | `/login?returnTo=<original>` redirect (middleware) |
| Auth + token geçersiz | `/auth/me` 401 → auth store clear → `/login` redirect (axios interceptor) |
| Auth + `consentAccepted=false` | ConsentModal blocking (layout) |
| Auth + `passwordExpired` response | `/profile/change-password?required=true` redirect (global error handler) |
| Auth + yetki yok (403) | `/403` redirect (global error handler) |
| Route bulunamadı | `/404` (Next default) |
| Login başarılı + `returnTo` var | `returnTo`'ya redirect, yoksa `/dashboard` |

### 3.5 `loading.tsx` ve `error.tsx`

**`loading.tsx`:** Her route seviyesinde opsiyonel. Next server-rendering sırasında mount olur. Tipik içerik: sayfa-level skeleton. Route transition sırasında anlık görünür.

**`error.tsx`:** Her route grubunda zorunlu. Route seviyesindeki exception'ları yakalar. İçerik:
- Hata mesajı (generic — teknik detay göstermez)
- "Tekrar Dene" butonu (`reset()` çağrısı)
- Ana sayfaya dön linki
- Sentry'e otomatik rapor (useEffect içinde)

```typescript
// src/app/(app)/error.tsx
'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Beklenmeyen bir hata oluştu</h2>
      <p className="text-muted-foreground">Ekibimize bildirildi. Lütfen tekrar deneyin.</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Tekrar Dene</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>Ana Sayfa</Button>
      </div>
    </div>
  );
}
```

---

## 4. State Boundaries — Sıkı Kural

Frontend'de dört farklı state türü vardır. Her biri tek bir tool'la yönetilir; çift yazma yasak.

| State tipi | Tool | Kullanım örneği | Yasak |
|---|---|---|---|
| **Server state (API cache)** | TanStack Query | User list, process detail, notifications | Zustand'a yazma; kendi cache'ini tutma |
| **UI transient** | Zustand | Sidebar collapsed, modal open, drawer state | API data buraya koyma; URL state buraya koyma |
| **Shareable (URL)** | `useSearchParams` | Liste filtreleri, pagination cursor, aktif tab | Zustand'a çift yazma; stale olma riski |
| **Form draft** | React Hook Form (local) | Kullanıcı düzenleme formu, KTİ başlatma | Zustand'a kaydırma (dirty state kontrolü için ayrıca global store var — [5.3](#53-unsaved-changes-tracking)) |
| **Auth state (istisna)** | Zustand | currentUser, permissions, csrfToken, accessToken | TanStack Query'ye kaydırma — aşağıda açıklanıyor |

### 4.1 Auth State İstisnası

State boundaries tablosundaki "API cache → TanStack Query" kuralının tek istisnası **auth state**. Neden:

- Auth state birden çok bileşen tree'sinde eşzamanlı okunur (sidebar, topbar, route guard, axios interceptor)
- TanStack Query invalidation ile senkron tutmak race condition eğilimli — `/auth/me` cache expire olduğunda interceptor yeni token ile yanlış user'ı gösterebilir
- Axios interceptor React tree dışında çalışır; TanStack Query hook'ları kullanamaz. Bu yüzden interceptor'ın `csrfToken` ve `accessToken`'a doğrudan erişmesi gerekir → Zustand store

Zustand `useAuthStore`:

```typescript
// src/stores/auth-store.ts
import { create } from 'zustand';
import type { Permission } from '@leanmgmt/shared-types';

interface AuthState {
  user: CurrentUser | null;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
  csrfToken: string | null;
  permissions: Set<Permission>;

  setSession: (input: { user: CurrentUser; accessToken: string; accessTokenExpiresAt: Date; csrfToken: string }) => void;
  updateAccessToken: (input: { accessToken: string; accessTokenExpiresAt: Date; csrfToken: string }) => void;
  updateUser: (user: CurrentUser) => void;
  clear: () => void;
  hasPermission: (p: Permission) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,
  csrfToken: null,
  permissions: new Set(),

  setSession: ({ user, accessToken, accessTokenExpiresAt, csrfToken }) => {
    set({
      user,
      accessToken,
      accessTokenExpiresAt,
      csrfToken,
      permissions: new Set(user.permissions as Permission[]),
    });
  },

  updateAccessToken: ({ accessToken, accessTokenExpiresAt, csrfToken }) => {
    set({ accessToken, accessTokenExpiresAt, csrfToken });
  },

  updateUser: (user) => {
    set({ user, permissions: new Set(user.permissions as Permission[]) });
  },

  clear: () => {
    set({ user: null, accessToken: null, accessTokenExpiresAt: null, csrfToken: null, permissions: new Set() });
  },

  hasPermission: (p) => get().permissions.has(p),
}));
```

### 4.2 URL State Örneği

Liste sayfalarındaki filtre, pagination cursor ve aktif tab URL query param'da yaşar. Kullanıcı linki paylaşabilir, geri butonu mantıklı çalışır, sayfa yenilenince state kaybolmaz.

```typescript
// Liste sayfasında — /users?search=ali&isActive=true&cursor=...&sort=last_name_asc
'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function UsersListFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const isActive = searchParams.get('isActive') ?? 'true';

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
    params.delete('cursor');  // Filtre değişiminde pagination sıfırla
    router.push(`${pathname}?${params.toString()}`);
  };

  // ... input'lar updateParam çağırır
}
```

Filtre değerleri TanStack Query key'ine girer: `queryKeys.users.list({ search, isActive, cursor, sort })`. Zustand'a yazılmaz.

### 4.3 Unsaved Changes Tracking

Kullanıcı formda değişiklik yaptı ve kaydetmeden sayfadan ayrılmaya çalışıyorsa onay modal'ı gösterilir. Bunun için global `useUnsavedChangesStore` — her form mount olduğunda kendini register eder, `isDirty` değiştikçe günceller:

```typescript
// src/stores/unsaved-changes-store.ts
import { create } from 'zustand';

interface UnsavedChangesState {
  dirtyFormIds: Set<string>;
  register: (id: string) => void;
  unregister: (id: string) => void;
  setDirty: (id: string, dirty: boolean) => void;
  hasAny: () => boolean;
}

export const useUnsavedChangesStore = create<UnsavedChangesState>((set, get) => ({
  dirtyFormIds: new Set(),
  register: (id) => set((s) => { s.dirtyFormIds.delete(id); return { dirtyFormIds: new Set(s.dirtyFormIds) }; }),
  unregister: (id) => set((s) => { const next = new Set(s.dirtyFormIds); next.delete(id); return { dirtyFormIds: next }; }),
  setDirty: (id, dirty) => set((s) => {
    const next = new Set(s.dirtyFormIds);
    if (dirty) next.add(id); else next.delete(id);
    return { dirtyFormIds: next };
  }),
  hasAny: () => get().dirtyFormIds.size > 0,
}));
```

Hook (form tarafında):

```typescript
// src/hooks/useUnsavedChangesWarning.ts
'use client';
import { useEffect, useId } from 'react';
import { useUnsavedChangesStore } from '@/stores/unsaved-changes-store';

export function useUnsavedChangesWarning(isDirty: boolean) {
  const id = useId();
  const register = useUnsavedChangesStore((s) => s.register);
  const unregister = useUnsavedChangesStore((s) => s.unregister);
  const setDirty = useUnsavedChangesStore((s) => s.setDirty);

  useEffect(() => {
    register(id);
    return () => unregister(id);
  }, [id, register, unregister]);

  useEffect(() => {
    setDirty(id, isDirty);
  }, [id, isDirty, setDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
```

Next route change için ayrıca `useRouter().events` dinleyicisi (Next 15'te `useRouter` patch'i) — formda dirty state varsa `router.push` interceptor'ı modal açar; kullanıcı onaylarsa navigation devam eder.

---

## 5. Data Fetching Pattern — TanStack Query

### 5.1 Query Client Konfigürasyonu

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,                // 30 sn default
      gcTime: 5 * 60_000,               // 5 dk cache tutma
      retry: (failureCount, error) => {
        const status = (error as any)?.response?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,       // Tab focus'ta stale data refetch
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,  // Mutation'lar idempotent değil — retry yasak
    },
  },
});
```

### 5.2 Query Key Factory — Tek Kaynak

Query key'ler uygulamada tek yerde tanımlıdır — invalidation tutarlılığı için:

```typescript
// src/lib/query-keys.ts
export const queryKeys = {
  me: ['me'] as const,

  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: UserListFilters) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    roles: (id: string) => [...queryKeys.users.detail(id), 'roles'] as const,
    sessions: (id: string) => [...queryKeys.users.detail(id), 'sessions'] as const,
    meData: () => [...queryKeys.users.all, 'me-data'] as const,
  },

  roles: {
    all: ['roles'] as const,
    lists: () => [...queryKeys.roles.all, 'list'] as const,
    list: (filters: RoleListFilters) => [...queryKeys.roles.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.roles.all, 'detail', id] as const,
    permissions: (id: string) => [...queryKeys.roles.detail(id), 'permissions'] as const,
    users: (id: string) => [...queryKeys.roles.detail(id), 'users'] as const,
    rules: (id: string) => [...queryKeys.roles.detail(id), 'rules'] as const,
  },

  permissions: {
    metadata: ['permissions', 'metadata'] as const,
  },

  processes: {
    all: ['processes'] as const,
    list: (filters: ProcessListFilters) => [...queryKeys.processes.all, 'list', filters] as const,
    detail: (displayId: string) => [...queryKeys.processes.all, 'detail', displayId] as const,
    history: (displayId: string) => [...queryKeys.processes.detail(displayId), 'history'] as const,
    documents: (displayId: string) => [...queryKeys.processes.detail(displayId), 'documents'] as const,
  },

  tasks: {
    all: ['tasks'] as const,
    list: (tab: 'started' | 'pending' | 'completed', filters: TaskListFilters) =>
      [...queryKeys.tasks.all, 'list', tab, filters] as const,
    detail: (id: string) => [...queryKeys.tasks.all, 'detail', id] as const,
  },

  documents: {
    detail: (id: string) => ['documents', 'detail', id] as const,
    scanStatus: (id: string) => ['documents', 'scan-status', id] as const,
  },

  notifications: {
    all: ['notifications'] as const,
    list: (filters: NotificationFilters) => [...queryKeys.notifications.all, 'list', filters] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },

  masterData: {
    list: (type: MasterDataType, filters: MasterDataListFilters) => ['master-data', type, 'list', filters] as const,
    detail: (type: MasterDataType, id: string) => ['master-data', type, 'detail', id] as const,
    users: (type: MasterDataType, id: string) => [...queryKeys.masterData.detail(type, id), 'users'] as const,
  },

  admin: {
    auditLogs: (filters: AuditLogFilters) => ['admin', 'audit-logs', filters] as const,
    auditChainIntegrity: ['admin', 'audit-chain-integrity'] as const,
    systemSettings: ['admin', 'system-settings'] as const,
    emailTemplates: ['admin', 'email-templates'] as const,
    emailTemplate: (eventType: string) => ['admin', 'email-templates', eventType] as const,
    consentVersions: ['admin', 'consent-versions'] as const,
  },
} as const;
```

Hierarchical yapı invalidation'ı kolaylaştırır: `queryClient.invalidateQueries({ queryKey: queryKeys.users.all })` çağrısı tüm user-ilişkili query'leri invalidate eder.

### 5.3 Stale Time Politikası

| Entity | Stale time | Gerekçe |
|---|---|---|
| `me` (currentUser) | 60 sn | Sık değişmez; ama role/permission değişikliği canlı yansımalı |
| User detail | 30 sn | |
| User list | 10 sn | Filtre değişince refetch olur |
| Role detail | 60 sn | Role değişiklikleri nadir |
| Role list | 30 sn | |
| Permission metadata | 1 saat | Neredeyse statik — release'de değişir |
| Process detail | 10 sn | Task state değişimi takip edilmeli |
| Process list | 15 sn | |
| Task list | 15 sn | |
| Task detail | 10 sn | Başkası claim ederse hızlı yansıma |
| Notifications list | 30 sn | |
| Notifications unread count | 30 sn (polling ile refetchInterval) | Çan ikonu live |
| Document detail | 5 dk | Metadata değişmez; scan-status ayrı polling |
| Document scan-status | 5 sn (polling) | Upload sonrası aktif polling |
| Master data list | 5 dk | Nadir değişir |
| Audit log list | 30 sn | |
| System settings | 60 sn | |
| Email templates | 5 dk | |
| Consent versions | 5 dk | |

### 5.4 Mutation + Invalidation

Mutation başarılı olduğunda ilgili query'ler invalidate edilir:

```typescript
// src/lib/queries/users.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => apiClient.post('/api/v1/users', input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      toast.success('Kullanıcı oluşturuldu');
    },
  });
}

export function useUpdateUserMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateUserInput) => apiClient.patch(`/api/v1/users/${userId}`, input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      toast.success('Değişiklikler kaydedildi');
    },
  });
}
```

### 5.5 Optimistic Update

Optimistic update yalnız iki yerde kullanılır — server-of-truth prensibi öncelikli:

1. **Notification mark-read:** Kullanıcı bildirime tıkladığında okunmamış sayı anında azalır; network gecikmesi görünmez.
2. **Task claim:** Kullanıcı "Üstlen" butonuna bastığında task hemen kendi atamasına geçer; race condition'da rollback ile geri alınır.

Diğer tüm mutation'lar stale-and-refetch pattern'i kullanır — optimistic update karmaşıklığı ve tutarsızlık riski taşır.

```typescript
export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/notifications/${id}/mark-read`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.unreadCount });
      const prev = queryClient.getQueryData<{ inAppUnreadCount: number }>(queryKeys.notifications.unreadCount);
      queryClient.setQueryData(queryKeys.notifications.unreadCount, (old: any) => ({
        inAppUnreadCount: Math.max(0, (old?.inAppUnreadCount ?? 1) - 1),
      }));
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(queryKeys.notifications.unreadCount, context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
```

### 5.6 Global Error Handler

Axios interceptor `03_API_CONTRACTS`'teki frontend davranış matrisine uygun davranır:

```typescript
// src/lib/api-client.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

// Request interceptor — Authorization + CSRF header
apiClient.interceptors.request.use((config) => {
  const { accessToken, csrfToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (['post', 'patch', 'delete', 'put'].includes(config.method?.toLowerCase() ?? '') && csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Refresh token race control
let refreshInFlight: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await axios.post<{ data: { accessToken: string; accessTokenExpiresAt: string; csrfToken: string } }>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`,
        {},
        { withCredentials: true, headers: { 'X-CSRF-Token': useAuthStore.getState().csrfToken ?? '' } },
      );
      useAuthStore.getState().updateAccessToken({
        accessToken: res.data.data.accessToken,
        accessTokenExpiresAt: new Date(res.data.data.accessTokenExpiresAt),
        csrfToken: res.data.data.csrfToken,
      });
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// Response interceptor — error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    // Access token expired → silent refresh + retry
    if (status === 401 && code === 'AUTH_TOKEN_EXPIRED' && !original._retried) {
      original._retried = true;
      try {
        await refreshAccessToken();
        return apiClient(original);
      } catch {
        useAuthStore.getState().clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    // Session revoked → logout + redirect
    if (status === 401 && (code === 'AUTH_SESSION_REVOKED' || code === 'AUTH_TOKEN_INVALID')) {
      useAuthStore.getState().clear();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Consent required
    if (status === 403 && code === 'AUTH_CONSENT_REQUIRED') {
      // Layout ConsentModal otomatik açılır; yalnız error'u propagate et
      return Promise.reject(error);
    }

    // Password expired
    if (status === 403 && code === 'AUTH_PASSWORD_EXPIRED') {
      window.location.href = '/profile/change-password?required=true';
      return Promise.reject(error);
    }

    // Rate limit → toast (component kendi context'ine göre)
    if (status === 429) {
      const retryAfter = error.response?.data?.error?.details?.retryAfterSeconds ?? 60;
      toast.error(`Çok fazla istek. ${retryAfter} saniye sonra tekrar deneyin.`);
      return Promise.reject(error);
    }

    // System errors
    if (status === 500) {
      toast.error('Beklenmeyen bir hata oluştu, ekibimize bildirildi.');
      return Promise.reject(error);
    }
    if (status === 503) {
      toast.error('Sistem geçici olarak erişilemiyor.');
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);
```

Diğer error'lar (400, 403 PERMISSION_DENIED, 404, 409, 422) component/form seviyesinde handle edilir — interceptor yutmaz, yalnız propagate eder.

---

## 6. Form Pattern — Referans İmplementasyon

### 6.1 Üçlü Stack

- `react-hook-form` — form state, validation, submit flow
- `zod` + `@hookform/resolvers/zod` — schema-based validation
- shadcn `<Form>` primitives — accessible label + error display

Zod şemaları `packages/shared-schemas/` paketinden import edilir — backend ile **aynı şema**. Tek doğruluk kaynağı, tek sync noktası.

### 6.2 Tam Örnek — Yeni Kullanıcı Oluşturma Formu

```typescript
// src/components/users/UserForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { CreateUserSchema, CreateUserInput } from '@leanmgmt/shared-schemas';
import { useCreateUserMutation } from '@/lib/queries/users';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MasterDataSelect } from '@/components/shared/MasterDataSelect';
import { UserSelect } from '@/components/shared/UserSelect';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function UserForm() {
  const router = useRouter();
  const createUser = useCreateUserMutation();

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      sicil: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      employeeType: 'WHITE_COLLAR',
      companyId: '',
      locationId: '',
      departmentId: '',
      positionId: '',
      levelId: '',
      teamId: null,
      workAreaId: '',
      workSubAreaId: null,
      managerUserId: null,
    },
  });

  useUnsavedChangesWarning(form.formState.isDirty);

  const onSubmit = async (values: CreateUserInput) => {
    try {
      const user = await createUser.mutateAsync(values);
      router.push(`/users/${user.id}`);
    } catch (err) {
      if (err instanceof AxiosError) {
        const errorData = err.response?.data?.error;
        // Server-side validation hatalarını form'a enjekte et
        if (errorData?.code === 'VALIDATION_FAILED' && errorData.details?.fields) {
          for (const [fieldName, message] of Object.entries(errorData.details.fields)) {
            form.setError(fieldName as any, { message: message as string });
          }
          return;
        }
        // Field-spesifik unique hataları
        if (errorData?.code === 'USER_SICIL_DUPLICATE') {
          form.setError('sicil', { message: 'Bu sicil numarası zaten kayıtlı.' });
          return;
        }
        if (errorData?.code === 'USER_EMAIL_DUPLICATE') {
          form.setError('email', { message: 'Bu email adresi zaten kayıtlı.' });
          return;
        }
        // Diğer hatalar — toast
        toast.error(errorData?.message ?? 'Kullanıcı oluşturulamadı.');
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="sicil"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sicil Numarası *</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={8} placeholder="12345678" />
                </FormControl>
                <FormDescription>8 haneli numerik</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="ad.soyad@holding.com" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ad *</FormLabel>
                <FormControl><Input {...field} maxLength={100} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Soyad *</FormLabel>
                <FormControl><Input {...field} maxLength={100} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefon</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="05xx xxx xx xx" value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="employeeType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Çalışan Tipi *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="WHITE_COLLAR">Beyaz Yaka</SelectItem>
                    <SelectItem value="BLUE_COLLAR">Mavi Yaka</SelectItem>
                    <SelectItem value="INTERN">Stajyer</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Şirket *</FormLabel>
                <FormControl><MasterDataSelect type="companies" value={field.value} onChange={field.onChange} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Diğer master data seçimleri aynı pattern ile */}

          <FormField
            control={form.control}
            name="managerUserId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Yönetici</FormLabel>
                <FormControl><UserSelect value={field.value} onChange={field.onChange} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>İptal</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Kullanıcı Oluştur
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

### 6.3 Form Pattern Kuralları

- **Zod şema shared-schemas'tan** — tip güvenliği + backend sync
- **`defaultValues` zorunlu** — uncontrolled input riskini önler
- **`form.formState.isSubmitting`** ile button disable + spinner
- **`form.setError(fieldName, ...)`** ile server-side validation hataları forma enjekte edilir
- **Field-spesifik hatalar inline, generic hatalar toast**
- **`useUnsavedChangesWarning(isDirty)` hook'u** her uzun form'da zorunlu
- **Async validation nadir** — unique kontroller server-side'da, optimistic submit + hata yakalama pattern'i tercih edilir

---

## 7. Loading ve Error UX

### 7.1 Skeleton vs Spinner

| Durum | Component | Örnek |
|---|---|---|
| Liste / kart grid yüklemesi | `<Skeleton>` satırları (5 adet default) | Kullanıcı listesi, süreç listesi |
| Sayfa içi detay yüklemesi | `<Skeleton>` form-shaped | Kullanıcı detay, süreç detay |
| Button submit aksiyonu | `<Loader2 className="animate-spin">` | Form submit, onay butonu |
| Inline action (mark-read, claim) | Text → inline spinner → text | Bildirim tıklama |
| Full-page ilk yükleme | Centered spinner | Auth layout mount |

### 7.2 Toast

shadcn `sonner` entegrasyonu. Kullanım:
- **Success:** Başarılı mutation'lar ("Kullanıcı oluşturuldu", "Değişiklikler kaydedildi")
- **Error:** Recoverable hatalar, rate limit, system error — field-spesifik olmayan
- **Warning:** Password expiry yaklaşıyor, SLA breach yakın
- **Info:** Genellikle kullanılmaz — UX'i boğar

Toast süresi default 4 saniye; error toast'lar 6 saniye. Action button (toast üstünde "Geri Al") destructive olmayan işlemlerde eklenebilir.

### 7.3 Error Boundary

Her route seviyesinde `error.tsx` zorunlu (Section 3.5). Feature-level error boundary yalnız dashboard widget'ları gibi izole alanlarda kullanılır — bir widget'ın hatası tüm dashboard'u devirmemeli.

```typescript
// src/components/shared/ErrorBoundary.tsx — feature-level
'use client';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error, { extra: info as any }));
  }
  reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return this.props.fallback ? this.props.fallback(this.state.error, this.reset) : (
        <div className="p-4 border rounded-md">
          <p className="text-destructive mb-2">Bu bölüm yüklenemedi.</p>
          <Button size="sm" variant="outline" onClick={this.reset}>Tekrar Dene</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 7.4 Empty State

Liste boş olduğunda `<EmptyState>` bileşeni:
- Icon (lucide, 48px, muted renk)
- Başlık — durum açıklaması
- Açıklama metni (opsiyonel)
- CTA butonu (varsa)

İki varyant:
- **İlk yüklemede boş:** "Henüz kullanıcı eklenmedi" + "Yeni Kullanıcı Ekle" CTA
- **Filtre sonrası boş:** "Filtreye uyan sonuç bulunamadı" + "Filtreleri Temizle" linki

```typescript
// src/components/shared/EmptyState.tsx
import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-2 max-w-md">{description}</p>}
      {action && <Button className="mt-4" onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
```

---

## 8. Modal ve Dialog Konvansiyonu

### 8.1 Routing-Modal vs State-Modal

**Routing-modal yok.** Yeni kullanıcı oluşturma, rol düzenleme gibi kalıcı state içeren formlar **ayrı route** olarak çözülür (`/users/new`, `/roles/:id/edit`). Nedeni:
- Kullanıcı URL'i paylaşabilir
- Geri butonu mantıklı çalışır
- Browser history düzgün
- Form state route değişikliğine dirençli

**State-modal yalnız geçici aksiyonlar için:**
- Confirmation (silme, iptal)
- Inline edit (küçük alan değişiklikleri)
- Bilgi gösterme (örn. permission detayı tooltip büyütmesi)

### 8.2 Confirmation Dialog

```typescript
// src/components/shared/ConfirmDialog.tsx
'use client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Onayla', cancelLabel = 'İptal', variant = 'default', onConfirm, isConfirming }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant={variant === 'destructive' ? 'destructive' : 'default'} onClick={onConfirm} disabled={isConfirming}>
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 8.3 Destructive Confirmation Pattern

Geri dönülemez aksiyonlar (süreç iptal, rol silme, süreç rollback) için **"evet" yazmayı şart koşan** özel pattern:
- Başlık: aksiyon tanımı
- Açıklama: neyin olacağı + geri alınamayacağı bilgisi
- Text input: kullanıcı "ONAYLIYORUM" (veya "SİL", "İPTAL ET") yazmalı
- Confirm button yalnız doğru yazıldığında aktif

Bu pattern süreç iptal, rollback, rol silme ekranlarında kullanılır.

### 8.4 Stacked Modal Yasağı

Herhangi bir anda en fazla **bir** modal açık olabilir. Modal içinden başka modal açma yasak. Form içinde confirmation gerekiyorsa: form submit → modal kapan → confirmation modal aç → onay → orijinal aksiyonu yeni modal state ile çalıştır.

---

## 9. Accessibility

### 9.1 Standartlar

- **WCAG 2.1 AA** minimum seviye
- Tarayıcı testleri: Chrome DevTools Lighthouse, axe DevTools extension
- CI: `@axe-core/playwright` ile her kritik ekrana a11y test

### 9.2 Klavye Navigasyonu

Tüm etkileşimli element'ler klavye ile erişilebilir olmalı:
- `Tab` — sıralı focus; focus ring görünür (Tailwind default)
- `Shift+Tab` — geri
- `Enter` / `Space` — button aktivasyonu
- `Escape` — modal/dropdown kapatma
- `Arrow` tuşları — select, tab, radio group
- `Home` / `End` — liste başı/sonu

Table satırları focusable değildir — satırdaki spesifik aksiyon button'ları focusable.

### 9.3 ARIA

- Icon-only button'larda `aria-label` zorunlu (örn. `<Button aria-label="Sil"><Trash2 /></Button>`)
- Dinamik içerik değişimlerinde `aria-live="polite"` — Toast, notification count update, form submit status
- Modal'lar `role="dialog"` + `aria-labelledby` + `aria-describedby` (Radix otomatik)
- Loading state'lerinde `aria-busy="true"`
- Form hataları `aria-invalid="true"` + `aria-describedby` ile error message

### 9.4 Color Contrast

- Normal metin 4.5:1 minimum
- Büyük metin (18pt+) 3:1
- İkon-only UI element'leri 3:1
- Tailwind varsayılan renk paleti uygun; custom renk eklenirken contrast checker zorunlu

### 9.5 Screen Reader Desteği

- Landmark roller: `<header>`, `<nav>`, `<main>`, `<footer>` — semantic HTML
- Heading hiyerarşisi: her sayfada tek `<h1>`, sıralı nested heading'ler
- Liste yapıları: `<ul>` / `<ol>` / `<li>` — gerçek listeler
- Form label — her input'un `<Label htmlFor>` ile eşleştirilmesi zorunlu (shadcn Form otomatik yapar)

Manuel test: NVDA (Windows) + VoiceOver (macOS) — her release öncesi kritik akışlar.

### 9.6 Focus Management

- Modal açılınca ilk focusable element'e focus (Radix built-in)
- Modal kapanınca trigger button'a focus geri döner
- Route değişiminde ana heading'e focus (sağır/görme engelli kullanıcılar sayfa değişimini algılar)
- Form submit başarısızsa ilk hatalı field'a focus

---

## 10. Web Vitals Hedefleri

### 10.1 Metrik Hedefleri

| Metric | Hedef | Ne zaman ölçülür |
|---|---|---|
| **LCP** (Largest Contentful Paint) | < 2.5s | Kritik ekranlarda (dashboard, liste sayfaları, login) |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Tüm sayfalarda |
| **INP** (Interaction to Next Paint) | < 200ms | Tüm etkileşimlerde |
| **TTFB** (Time to First Byte) | < 500ms | Dynamic route'larda |
| **Initial JS bundle (gzipped)** | < 200 KB | Ana entry chunk |
| **Route-level chunk** | < 100 KB | Her route için kod splitting |

### 10.2 Monitoring

- **Production:** Vercel Analytics + Web Vitals CloudWatch custom metric
- **CI:** Lighthouse CI her PR'da 3 kritik sayfada çalışır; eşik ihlali PR block

### 10.3 Optimizasyon Prensipleri

- **Image:** Next `<Image>` zorunlu — `priority` attribute LCP imajlarda, `loading="lazy"` default
- **Font:** `next/font` ile local serve (FOUT/FOIT yok)
- **Route code splitting:** Next otomatik per-route; `dynamic(() => import(...), { ssr: false })` ile büyük client bileşenleri lazy
- **Bundle analizi:** `@next/bundle-analyzer` — PR yorumu ile bundle delta; 5 KB+ artış review soru işareti
- **Third-party script'ler:** `next/script` ile strategy="afterInteractive" veya "lazyOnload"
- **CSS:** Tailwind purge aktif (`content` config); custom CSS minimum

### 10.4 Bundle Bütçesi

200 KB gzipped initial bundle bütçesi **sert sınırdır.** Şu andaki minimum kurulumla (Next + React + shadcn + Tailwind + TanStack Query + Zustand + RHF + Zod + date-fns + lucide-react + sonner) ~150-180 KB civarı.

Yeni major library eklenmesi bu bütçeyi zorlar — her yeni library için ADR zorunlu. Alternatifler:
- Chart: `recharts` (büyük) yerine `chart.js` core + gerekli adapter
- Rich text: `tiptap` yerine basit `<textarea>` (MVP'de rich text yok)
- Date picker: shadcn `<Calendar>` + `<Popover>` yerine native `<input type="date">` (mümkünse)

---

## 11. Tarayıcı Desteği

| Tarayıcı | Desteklenen versiyonlar |
|---|---|
| Chrome | Son 2 major |
| Edge (Chromium) | Son 2 major |
| Firefox | Son 2 major |
| Safari (macOS) | Son 2 major |
| Safari (iOS) | Son 2 major |

**Desteklenmeyenler:** Internet Explorer (tüm versiyonlar), Opera Mini, Safari < 15, eski Android WebView (< Android 10).

Browserslist konfigürasyonu (`package.json`):

```json
{
  "browserslist": [
    "last 2 Chrome versions",
    "last 2 Edge versions",
    "last 2 Firefox versions",
    "last 2 Safari versions",
    "last 2 iOS versions",
    "not IE 11",
    "not dead"
  ]
}
```

Next.js bu konfigürasyona göre polyfill ve transpile stratejisini otomatik belirler.

---

## 12. i18n — Türkçe MVP

### 12.1 Yaklaşım

MVP tek dil: Türkçe (`tr-TR`). Multi-language framework (next-intl, next-i18next) **kullanılmaz** — over-engineering. Ancak:

UI string'leri **JSX'e hardcoded yazılmaz**; merkezi `src/i18n/tr.ts` dosyasında tutulur. İleride multi-language geçişi gerektiğinde:
- String'lerin bulunup çıkarılması zaten yapılmış
- Library eklenir, import yolu değiştirilir
- Tek iterasyonda çoklu dil desteği

### 12.2 String Yönetimi

```typescript
// src/i18n/tr.ts
export const copy = {
  common: {
    save: 'Kaydet',
    cancel: 'İptal',
    delete: 'Sil',
    edit: 'Düzenle',
    confirm: 'Onayla',
    loading: 'Yükleniyor...',
  },
  auth: {
    login: {
      title: 'Giriş Yap',
      emailLabel: 'Email',
      passwordLabel: 'Şifre',
      submitButton: 'Giriş Yap',
      forgotPasswordLink: 'Şifremi unuttum',
    },
    consent: {
      title: 'Aydınlatma ve Açık Rıza',
      description: 'Platformu kullanmak için aşağıdaki rıza metnini onaylamanız gerekmektedir.',
      acceptButton: 'Onaylıyorum',
      logoutButton: 'Çıkış Yap',
    },
  },
  users: {
    list: {
      title: 'Kullanıcılar',
      newButton: 'Yeni Kullanıcı',
      searchPlaceholder: 'Sicil, ad veya email ile ara',
      emptyTitle: 'Henüz kullanıcı eklenmedi',
      emptyDescription: 'İlk kullanıcıyı oluşturarak başlayın.',
    },
    form: {
      sicilLabel: 'Sicil Numarası',
      sicilHelp: '8 haneli numerik',
      emailLabel: 'Email',
      // ...
    },
  },
  // ... diğer feature'lar
} as const;
```

JSX kullanımı:

```typescript
import { copy } from '@/i18n/tr';

<Button>{copy.common.save}</Button>
<h1>{copy.users.list.title}</h1>
```

Tip güvenliği: `as const` sayesinde TypeScript tüm yolları bilir; var olmayan key compile hatası.

### 12.3 Tarih ve Sayı Formatı

- **Tarih:** `date-fns` + `date-fns/locale/tr` locale'i — `format(date, 'd MMMM yyyy', { locale: tr })` → "24 Nisan 2026"
- **Göreceli tarih:** `formatDistanceToNow(date, { locale: tr, addSuffix: true })` → "2 saat önce"
- **Saat dilimi:** `date-fns-tz` ile UTC → TR dönüşümü (backend UTC gönderir, frontend lokal gösterir)
- **Sayı:** `Intl.NumberFormat('tr-TR').format(15000)` → "15.000"
- **Para birimi:** `Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(15000)` → "₺15.000,00"

### 12.4 RTL Desteği

Yoktur. Türkçe LTR; Arapça/İbranice MVP kapsamı dışı.

---

## 13. Rol-Yetki Tablosu UX

Bu ekran kullanıcı deneyimi açısından özel gereksinime sahip: permission'lar kategori bazında gruplanır, her permission'ın description tooltip'i gösterilir, toplu değişiklik diff UI'ı ile onaylanır.

### 13.1 Veri Akışı

```typescript
// src/lib/queries/permissions.ts
export function usePermissionMetadata() {
  return useQuery({
    queryKey: queryKeys.permissions.metadata,
    queryFn: () => apiClient.get('/api/v1/permissions').then((r) => r.data.data as PermissionMetadata[]),
    staleTime: 60 * 60 * 1000,  // 1 saat
    gcTime: 2 * 60 * 60 * 1000,
  });
}

export function useRolePermissions(roleId: string) {
  return useQuery({
    queryKey: queryKeys.roles.permissions(roleId),
    queryFn: () => apiClient.get(`/api/v1/roles/${roleId}/permissions`).then((r) => r.data.data),
    staleTime: 30_000,
  });
}

export function useUpdateRolePermissionsMutation(roleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permissionKeys: string[]) =>
      apiClient.put(`/api/v1/roles/${roleId}/permissions`, { permissionKeys }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.permissions(roleId) });
      toast.success('Rol yetkileri güncellendi');
    },
  });
}
```

### 13.2 UI Yapısı

`<PermissionMatrix>` bileşeni:

1. **Üst bölüm — Özet kartı:** Rol adı, toplam atanmış permission sayısı, son güncelleme.
2. **Kategori sekmeleri:** MENU / ACTION / DATA / FIELD — her kategorinin rozetinde atanmış sayı göstergesi.
3. **Permission listesi:**
   - Her permission satırı: checkbox + permission key (monospace font) + description (inline) + isSensitive rozeti (kırmızı "Hassas" badge)
   - Kategori başlığında "Tümünü seç/bırak" checkbox
   - Description'un 100 karakteri aşan kısmı tooltip'te gösterilir
4. **Alt bölüm — Diff özeti:**
   - "Kaydedilmemiş değişiklikler: 3 yetki eklenecek, 1 yetki kaldırılacak" uyarı kartı
   - Değişen permission'lar açıkça listelenir (+USER_DELETE, +PROCESS_ROLLBACK, -AUDIT_LOG_VIEW)
5. **Kaydet butonu:** Disabled if no changes; confirmation dialog açar.

### 13.3 Confirmation Dialog İçeriği

```
Başlık: "Rol Yetkilerini Güncelle"
Açıklama:
  - "<Rol Adı>" rolü için aşağıdaki değişiklikleri onaylıyor musunuz?
  - [+] USER_DELETE — Kullanıcı silme yetkisi
  - [+] PROCESS_ROLLBACK — Süreç geri alma yetkisi
  - [-] AUDIT_LOG_VIEW — Denetim kayıtları görüntüleme yetkisi (HASSAS)
  - Bu değişiklik bu role atanmış tüm kullanıcıları etkileyecektir.
Butonlar: "İptal" | "Güncellemeyi Kaydet"
```

### 13.4 Önemli UX Noktaları

- **Diff pattern:** Kullanıcı checkbox'ları değiştirirken state lokal; backend'e sadece final set "Kaydet" ile gider. Bu arada sayfa kapanırsa `useUnsavedChangesWarning` devreye girer.
- **Description tooltip:** Her permission'ın `isSensitive: true` olanları ek uyarı ile (kırmızı renk + "Bu yetki hassas veri erişimi sağlar").
- **Kategori sekme rozetinde** "4/12" gibi görünüm — "12 yetkiden 4'ü atanmış".
- **Search:** Permission key veya description içinde arama — kategorilerin üstünde search input.
- **Erişilebilirlik:** Her checkbox label'ı `<Label htmlFor>` ile bağlı; category "tümünü seç" checkbox'ı `aria-controls` ile alt checkbox'ları bağlar.

---

## 14. Bildirim Merkezi UX

### 14.1 Çan İkonu (Topbar)

```typescript
// src/components/layout/NotificationBell.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { queryKeys } from '@/lib/query-keys';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';

export function NotificationBell() {
  const { data } = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => apiClient.get('/api/v1/notifications/unread-count').then((r) => r.data.data),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const count = data?.inAppUnreadCount ?? 0;
  const display = count > 99 ? '99+' : String(count);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Bildirimler (${count} okunmamış)`} className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs">{display}</Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <NotificationDropdownContent />
        <div className="border-t p-2">
          <Link href="/notifications" className="block text-center text-sm text-primary hover:underline">Tümünü Gör</Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 14.2 Dropdown İçeriği

Son 10 bildirim liste — her satırda:
- Okunmamış → mavi nokta
- İkon (event_type'a göre — `TASK_ASSIGNED` için `CheckSquare`, `SLA_WARNING` için `AlarmClock` vs.)
- Title + body (truncate 2 satır)
- Relative time ("2 saat önce")
- Tıklanınca: mark-read mutation (optimistic) + `linkUrl`'e navigate

### 14.3 `/notifications` Sayfası

Tam sayfa: sayfalama + filtre (okunmamış/tümü/tip). Bulk action: "tümünü okundu işaretle". Boş state: "Henüz bildirim yok".

---

## 15. PermissionGate Component

Kullanıcının permission setinde belirli bir permission yoksa çocukları render etmeyen bileşen. Sidebar menu item'ları, action button'lar için kullanılır.

```typescript
// src/components/shared/PermissionGate.tsx
'use client';

import type { ReactNode } from 'react';
import type { Permission } from '@leanmgmt/shared-types';
import { useAuthStore } from '@/stores/auth-store';

interface Props {
  requires: Permission | Permission[];
  mode?: 'all' | 'any';
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({ requires, mode = 'all', fallback = null, children }: Props) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const required = Array.isArray(requires) ? requires : [requires];
  const ok = mode === 'all' ? required.every(hasPermission) : required.some(hasPermission);
  return ok ? <>{children}</> : <>{fallback}</>;
}
```

Kullanım:

```typescript
// Action button
<PermissionGate requires={Permission.USER_CREATE}>
  <Button onClick={() => router.push('/users/new')}>Yeni Kullanıcı</Button>
</PermissionGate>

// Sidebar menu item
<PermissionGate requires={Permission.AUDIT_LOG_VIEW}>
  <SidebarItem href="/admin/audit-logs" icon={FileText}>Denetim Kayıtları</SidebarItem>
</PermissionGate>

// Alternatif gösterim fallback ile
<PermissionGate requires={Permission.PROCESS_CANCEL} fallback={<span className="text-muted-foreground">Yetkiniz yok</span>}>
  <Button variant="destructive" onClick={handleCancel}>İptal Et</Button>
</PermissionGate>
```

### 15.1 Önemli Uyarı — Güvenlik Katmanı Değil

**PermissionGate bir UX çözümüdür, güvenlik katmanı değildir.** Kullanıcı DOM'u düzenleyerek veya doğrudan endpoint'i çağırarak permission kontrolünü bypass edebilir. Backend daima her endpoint'te `@RequirePermission` decorator'ı ile kontrol yapar — frontend gizleme sadece kullanıcıyı görünmeyecek butonları tıklamaktan korur.

---

## 16. Auth ve Consent Akışı UX

### 16.1 Login Akışı

```
1. Kullanıcı /login'e gelir
2. Form submit → POST /api/v1/auth/login
3. 200 response → useAuthStore.setSession(...)
4. Response'da consentAccepted:false → /dashboard'a redirect, layout ConsentModal açar
5. Response'da consentAccepted:true → returnTo veya /dashboard'a redirect
6. Response'da passwordExpired → /profile/change-password?required=true'ya redirect
```

### 16.2 Consent Modal

Rıza onaylanmamış kullanıcılar için **blocking** modal. X butonu yok, dışarı tıklama yok, Escape kapatmıyor.

```typescript
// src/components/shared/ConsentModal.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuery, useMutation } from '@tanstack/react-query';

export function ConsentModal({ user }: { user: { activeConsentVersionId: string } }) {
  const [agreed, setAgreed] = useState(false);
  const clearAuth = useAuthStore((s) => s.clear);

  const { data: consent } = useQuery({
    queryKey: ['consent-version', user.activeConsentVersionId],
    queryFn: () => apiClient.get(`/api/v1/consent-versions/${user.activeConsentVersionId}`).then((r) => r.data.data),
  });

  const accept = useMutation({
    mutationFn: () => apiClient.post('/api/v1/auth/consent/accept', { consentVersionId: user.activeConsentVersionId }),
    onSuccess: () => window.location.reload(),
  });

  const handleLogout = async () => {
    await apiClient.post('/api/v1/auth/logout').catch(() => {});
    clearAuth();
    window.location.href = '/login';
  };

  return (
    <Dialog open={true}>
      <DialogContent
        className="max-w-2xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle>Aydınlatma ve Açık Rıza</DialogTitle>
          <DialogDescription>Platformu kullanmak için aşağıdaki rıza metnini onaylamanız gerekmektedir.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] rounded border p-4">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">{consent?.content}</div>
        </ScrollArea>
        <div className="flex items-center gap-2">
          <Checkbox id="consent-agree" checked={agreed} onCheckedChange={(c) => setAgreed(c === true)} />
          <label htmlFor="consent-agree" className="text-sm">Rıza metnini okudum ve onaylıyorum.</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleLogout}>Çıkış Yap</Button>
          <Button disabled={!agreed || accept.isPending} onClick={() => accept.mutate()}>
            {accept.isPending ? 'Kaydediliyor...' : 'Onaylıyorum'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 16.3 Password Expiry Banner

Topbar'da sarı/kırmızı banner — kalan gün sayısına göre:

```typescript
// src/components/layout/PasswordExpiryBanner.tsx
'use client';
import { differenceInDays } from 'date-fns';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export function PasswordExpiryBanner({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;
  const days = differenceInDays(new Date(expiresAt), new Date());
  if (days > 14) return null;

  const color = days <= 3 ? 'bg-destructive text-destructive-foreground' : 'bg-yellow-500 text-yellow-950';
  return (
    <div className={`flex items-center justify-center gap-2 px-4 py-2 text-sm ${color}`}>
      <AlertTriangle className="h-4 w-4" />
      <span>Şifrenizin süresi {days} gün içinde dolacak.</span>
      <Link href="/profile/change-password" className="underline font-medium">Şimdi Değiştir</Link>
    </div>
  );
}
```

### 16.4 Şifre Zorunlu Değiştirme

`AUTH_PASSWORD_EXPIRED` response'u interceptor tarafından yakalanır → `/profile/change-password?required=true` redirect. Bu sayfada "iptal" butonu gizlenir; yalnız şifre değiştirme formu görünür. Başarılı submit sonrası dashboard'a redirect.

---

## 17. Genel Kurallar Özeti

Agent yeni bir ekran veya bileşen yazarken bu dokümanın tamamını tekrar okumak zorunda kalmamalı; aşağıdaki check-list son göz atış:

- [ ] `'use client'` gerekli mi? (state, effect, event handler, TanStack Query)
- [ ] Route grubuna doğru klasörde mi? (`(auth)`, `(app)`, `(admin)`)
- [ ] Erişilecek endpoint'ler için query key factory'de key var mı?
- [ ] Stale time `03_API_CONTRACTS` tablosuyla uyumlu mu?
- [ ] Form varsa: Zod schema shared-schemas'tan mı? `useUnsavedChangesWarning` bağlı mı? Server-side error mapping var mı?
- [ ] İkon-only button'larda `aria-label` var mı?
- [ ] Yeni route için `loading.tsx` veya skeleton component var mı?
- [ ] Mutation sonrası ilgili query'ler invalidate ediliyor mu?
- [ ] Permission-bazlı gizleme için `<PermissionGate>` kullanılıyor mu?
- [ ] Destructive aksiyonda `<ConfirmDialog variant="destructive">` kullanılıyor mu?
- [ ] UI string'leri `src/i18n/tr.ts` içinde mi?
- [ ] Yeni library import edildiyse bundle bütçesi < 200 KB kalıyor mu?

Bu dokümanın her bölümüne ihtiyaç duyulan yerlerden kaynak olarak başvurulur; ekran-bazlı detay için `06_SCREEN_CATALOG`'a geçilir.
