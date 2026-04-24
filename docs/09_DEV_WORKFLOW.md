# Lean Management Platformu — Geliştirme İş Akışı

> Bu doküman günlük geliştirme disiplinini tanımlar: repository nasıl organize edilir, kod dalları nasıl adlandırılır, commit mesajları nasıl yazılır, PR süreci nasıl işler, lokal ortam nasıl kurulur, deploy pipeline'ları nasıl çalışır, database migration nasıl yapılır. Bir developer ilk günden ezbere uyması beklenen kurallar burada. Agent yeni kod eklerken bu dokümanın ilgili bölümlerini referans alır.

---

## 1. Repository Yapısı — Monorepo

### 1.1 Kök Yapı

```
lean-management/
├── apps/
│   ├── api/                          # NestJS backend API
│   ├── web/                          # Next.js frontend
│   └── worker/                       # BullMQ background worker
│
├── packages/
│   ├── shared-types/                 # TypeScript type definitions + enums (Permission, etc.)
│   ├── shared-schemas/               # Zod schemas (backend + frontend aynı)
│   ├── config/                       # Shared configs (tsconfig, eslint, vitest, prettier)
│   └── shared-utils/                 # Cross-app utilities (date, format, cuid)
│
├── infrastructure/
│   ├── terraform/                    # AWS infra as code (VPC, RDS, ECS, CloudFront, ...)
│   └── clamav-lambda/                # ClamAV scanner Lambda source
│
├── docs/
│   ├── 00_PROJECT_OVERVIEW.md
│   ├── 01_DOMAIN_MODEL.md
│   ├── 02_DATABASE_SCHEMA.md
│   ├── 03_API_CONTRACTS.md
│   ├── 04_BACKEND_SPEC.md
│   ├── 05_FRONTEND_SPEC.md
│   ├── 06_SCREEN_CATALOG.md
│   ├── 07_SECURITY_IMPLEMENTATION.md
│   ├── 08_TESTING_STRATEGY.md
│   ├── 09_DEV_WORKFLOW.md             # bu doküman
│   ├── 10_IMPLEMENTATION_ROADMAP.md
│   ├── adr/                           # Architecture Decision Records
│   ├── runbooks/                      # Incident response playbooks
│   └── onboarding.md
│
├── scripts/
│   ├── reset-staging.sh
│   ├── prod-subset-to-staging.sh
│   └── rotate-jwt-secret.sh
│
├── .github/
│   ├── workflows/
│   │   ├── pr-check.yml
│   │   ├── main.yml
│   │   └── nightly.yml
│   ├── pull_request_template.md
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── CODEOWNERS
│
├── .vscode/
│   ├── settings.json
│   ├── extensions.json
│   └── launch.json
│
├── turbo.json                         # Turborepo task pipeline
├── pnpm-workspace.yaml
├── package.json                       # Root — scripts, devDependencies
├── .gitignore
├── .nvmrc                             # Node version pin
├── .editorconfig
├── README.md
└── docker-compose.yml                 # Local dev services (postgres, redis, mailpit)
```

### 1.2 Neden Monorepo

Tek repo seçimi rationale:
- **Shared types + schemas tek güncellemede** — backend + frontend senkron kalır
- **Atomic PR** — endpoint ekleme + frontend caller + test aynı commit
- **Tek dependency tree** — version skew yok
- **Tek CI konfigürasyonu** — sadeleştirme

Multi-repo'nun avantajı (bağımsız release cycle) MVP'de ihtiyaç değil — web + api + worker aynı release'te deploy edilir.

### 1.3 Turborepo + pnpm

**pnpm:** disk-efficient (shared node_modules store), faster install than npm/yarn. Zorunlu — `preinstall` script kontrol eder:

```json
{
  "scripts": {
    "preinstall": "npx only-allow pnpm"
  }
}
```

**Turborepo:** task orchestration + caching. Her app kendi `build`, `dev`, `test` script'ini tanımlar; Turbo bağımlılık graph'ına göre paralel çalıştırır ve output cache eder.

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env.example", "tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      "env": ["NODE_ENV"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:integration": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

Cache hit rate yüksek olduğunda CI build süresi dramatik düşer (<5 dk).

### 1.4 Workspace Konfigürasyonu

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

Internal package'lar `workspace:*` protokolü ile import:

```json
// apps/api/package.json
{
  "dependencies": {
    "@leanmgmt/shared-types": "workspace:*",
    "@leanmgmt/shared-schemas": "workspace:*",
    "@leanmgmt/shared-utils": "workspace:*"
  },
  "devDependencies": {
    "@leanmgmt/config": "workspace:*"
  }
}
```

---

## 2. Git Workflow — Trunk-Based

### 2.1 Branching Model

**Trunk-based development.** Tek uzun ömürlü branch: `main`. Her feature/fix kısa ömürlü branch (max 3 gün) → PR → squash merge → main.

Karmaşık modeller (Git Flow, develop branch, release branches) **kullanılmaz**:
- Gereksiz complexity — MVP'de 1-2 developer
- Merge conflict karmaşası
- "Release branch" fikri modern CI/CD ile çelişir — main daima deployable

### 2.2 Branch Naming

Pattern: `<type>/<short-description>` — kebab-case, ASCII only.

```
feat/kti-start-form
feat/role-permission-table
fix/login-lockout-counter
fix/audit-chain-concurrent-insert
chore/upgrade-next-15
chore/rotate-jwt-secret
refactor/extract-permission-resolver
docs/update-testing-strategy
perf/optimize-user-list-query
test/add-kti-workflow-integration
build/upgrade-turborepo
ci/add-lighthouse-check
```

**Kaçınılacak patterns:**
- Developer adı ile prefix (`ahmet/kti-form`) — branch ownership belirsizlik yaratır
- Issue number ile prefix (`PROJ-123-kti`) — branch adının kendisi anlamlı olmalı
- Uzun branch adları (50+ karakter) — git log okunmaz

### 2.3 Branch Yaşam Süresi

- **Maksimum 3 gün.** Daha uzun sürecek feature → task'lara böl, her biri ayrı PR
- Her sabah `git pull --rebase origin main` — divergence minimize
- Uzun ömürlü branch'te main'le 2+ conflict varsa → work-in-progress stash et, main'den yeni branch al
- Abandoned branch'ler 2 hafta sonra otomatik silinir (GitHub Action ile)

### 2.4 Merge Strategy

**Squash merge only.** Her PR main'e tek commit olarak giriş.

Rationale:
- `git log main` = feature/fix kronolojisi — temiz, anlamlı
- Feature branch'teki ara commit'ler (`wip`, `fix typo`, `address review`) kaybolur
- Revert tek commit revert eder (cherry-pick karmaşası yok)
- `git bisect` temiz (her commit → bir feature)

Squash commit mesajı PR title'ından türetilir (bkz. 3. bölüm).

GitHub branch protection:
```
Allow squash merging: ✓
Allow merge commits: ✗
Allow rebase merging: ✗
Default to squash on merge
Automatically delete head branches after merge: ✓
```

### 2.5 Commit Sıklığı (Feature Branch İçinde)

Feature branch'te her commit anlamlı bir adım olmalı ama "bu sabah işini kurtar" commit'leri de kabul — squash'ta temizlenecek. Tipik cadence:
- Feature başlangıcında: yapısal kurulum commit'i
- Ara: çalışan prototip commit'leri
- Son: test + polish + review feedback commit'leri

PR açılmadan önce interactive rebase (`git rebase -i`) ile commit'leri düzenlemek opsiyonel — squash merge zaten birleştirecek.

### 2.6 Signed Commits (Önerilen, Zorunlu Değil MVP'de)

GPG veya SSH key ile commit signing — supply chain attack mitigation:

```bash
git config --global user.signingkey <key-id>
git config --global commit.gpgsign true
git config --global tag.gpgsign true
```

GitHub'da "Verified" rozeti. MVP'de zorunlu değil, roadmap'te prod deployment öncesi aktif edilir.

---

## 3. Conventional Commits

### 3.1 Format

```
<type>(<scope>)?: <description>

<body>?

<footer>?
```

**Type (zorunlu):**

| Type | Kullanım |
|---|---|
| `feat` | Yeni feature (user-facing) |
| `fix` | Bug fix (user-facing) |
| `refactor` | Davranış değişmeyen kod düzenlemesi |
| `perf` | Performance iyileştirmesi |
| `test` | Test ekleme/düzenleme |
| `docs` | Dokümantasyon |
| `build` | Build system, dependency, Turborepo config |
| `ci` | CI/CD pipeline |
| `chore` | Housekeeping — lint config, tooling |
| `style` | Format, semicolon, whitespace (lint kapsamadığı) |
| `revert` | Önceki commit'i geri alma |

**Scope (opsiyonel ama önerilen):** Modül/feature area — `auth`, `users`, `processes`, `kti`, `tasks`, `roles`, `admin`, `ui`, `api`, `worker`, `web`, `infra`.

**Description:** imperative mood, lowercase first letter, no period. Türkçe **yazılır** — takım Türkçe çalışır, commit'ler de Türkçe.

### 3.2 Örnekler

```
feat(auth): şifre sıfırlama akışı eklendi

fix(kti): yönetici onay sonrası bildirim gönderilmiyor sorunu düzeltildi

refactor(roles): permission resolver cache invalidation mantığı ayrı servise taşındı

perf(processes): liste query'sine composite index eklendi

test(audit): chain hash concurrent insert integration test'i eklendi

docs(api): KTİ başlatma endpoint'i için OpenAPI örnekleri güncellendi

build(deps): Next.js 15.0 → 15.1 upgrade

ci: nightly pipeline'a Snyk full scan eklendi

chore: .env.example'a yeni secret key entry'leri eklendi

feat(users)!: email adresi artık birincil identifier (BREAKING CHANGE)

Kullanıcıların email adresleri artık tek giriş mekanizması.
Sicil numarası login için kullanılamaz — yalnız görüntüleme/filtreleme.

BREAKING CHANGE: /api/v1/auth/login endpoint'i sicil kabul etmiyor.
Eski istemciler 400 döner.
```

### 3.3 Breaking Change İşareti

İki yol:
1. Type sonrası `!`: `feat(auth)!: refresh token format changed`
2. Footer: `BREAKING CHANGE: <explanation>`

Her breaking change PR açıklamasında **migration path** belirtilir. Production'da breaking change rarely — expand-contract migration ile backward-compatible flow.

### 3.4 commitlint + husky

```bash
pnpm add -Dw @commitlint/cli @commitlint/config-conventional husky
pnpm husky install
```

`commitlint.config.js`:

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'build', 'ci', 'chore', 'style', 'revert'],
    ],
    'scope-enum': [
      1,  // warn (not error)
      'always',
      ['auth', 'users', 'roles', 'processes', 'kti', 'tasks', 'documents', 'notifications',
       'admin', 'master-data', 'audit', 'ui', 'api', 'worker', 'web', 'infra', 'deps', 'config'],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 120],
  },
};
```

Husky hooks:
- `commit-msg` → commitlint validation
- `pre-commit` → lint-staged (lint + prettier staged files)
- `pre-push` → type-check + unit test (fast)

`.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm lint-staged
```

`.lintstagedrc`:

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{md,json,yml,yaml}": ["prettier --write"]
}
```

### 3.5 Changelog Otomasyonu

Main'e merge sonrası `release-please` GitHub Action commit history'den CHANGELOG güncellemesi ve version bump PR'ı açar:

- `feat` → minor version (0.2.0 → 0.3.0)
- `fix`, `perf`, `refactor` → patch version (0.2.0 → 0.2.1)
- `BREAKING CHANGE` → major version (0.2.0 → 1.0.0)

MVP 1.0.0 release'ine kadar major bumps manuel (0.x.y semver serbest).

---

## 4. Pull Request Süreci

### 4.1 PR Template

`.github/pull_request_template.md` zorunlu doldurulur. Şablon içeriği `08_TESTING_STRATEGY` Bölüm 9.1'de.

PR başlığı conventional commit formatında:
```
feat(kti): yönetici onay için SLA rozeti eklendi
```

### 4.2 Draft → Ready for Review

**Draft PR** — henüz review istemeyen ama CI sonucunu görmek isteyen PR. Feature geliştirme sırasında CI test sonuçlarını anlık görmek için:

1. Branch push
2. `gh pr create --draft` veya GitHub UI'dan "Create draft PR"
3. CI çalışır, sonuçlar görülür
4. Geliştirme bittiğinde "Ready for review" tıkla
5. Reviewer otomatik assign (CODEOWNERS)

### 4.3 CODEOWNERS

`.github/CODEOWNERS` — dosya ownership mapping:

```
# Global fallback
* @ahmet @seyma

# Frontend
/apps/web/ @seyma

# Backend
/apps/api/ @ahmet

# Infra — 2 reviewer zorunlu (branch protection)
/infrastructure/ @ahmet @seyma

# Security-critical modules
/apps/api/src/auth/ @ahmet
/apps/api/src/encryption/ @ahmet
/apps/api/src/audit/ @ahmet

# Shared — herkese açık ama bilgi amaçlı review
/packages/shared-types/ @ahmet @seyma
/packages/shared-schemas/ @ahmet @seyma
/docs/ @ahmet @seyma
```

PR açıldığında CODEOWNERS reviewer otomatik istenir. Branch protection rule ile "require review from code owners" aktif.

### 4.4 PR State Machine

```
Draft → CI Running → Review Requested → Approved → Merged
        ↓                ↓                  ↓
     CI Failed    Changes Requested    Merge Conflict
        ↓                ↓                  ↓
     Fix + push   Address + push      Rebase main
```

PR merge için zorunlu:
- Tüm status checks green (lint, unit, integration, security, build)
- En az 1 reviewer approval (security-critical için 2)
- Branch main ile up-to-date (stale branch reject)
- Stale review reset — new commit geldiğinde eski approval iptal

### 4.5 Self-Review

PR açmadan önce developer self-review yapar:

1. `git diff main...HEAD` — her satırı oku
2. Debug `console.log`, TODO, commented code kaldırıldı mı?
3. Test yeni kod için eklendi mi?
4. Dokümantasyon (JSDoc, README) güncellendi mi?
5. Breaking change varsa migration path var mı?
6. Secret/credential hardcoded değil mi?
7. `.env.example` yeni key eklendi mi?

Solo developer senaryosunda (MVP başı) self-review daha kritik — 24 saat bekletme kuralı: PR açıldıktan 24 saat sonra (veya fresh göz ile sabah) tekrar review + merge.

### 4.6 Review Hızı Beklentisi

- PR açıldığında reviewer 1 iş günü içinde ilk bakış
- Küçük PR (< 200 satır değişiklik) → aynı gün merge
- Orta PR (200-500 satır) → 1-2 gün
- Büyük PR (500+ satır) → 2-3 gün + "bölemez miydik?" sorusu

**PR boyut kuralı:** 500+ satır değişiklik → reviewer'a saygı sorunu. Mümkün olduğunca 200-300 satırda kalmalı; yapamazsan PR açıklamasında "bu feature doğası gereği büyük" gerekçesi.

### 4.7 Merge Queue (Opsiyonel)

GitHub merge queue — PR approve sonrası main'e merge edilmeden önce yeniden CI çalıştırılır (semantic conflict detection). MVP'de trafik düşük — enable değil. 3+ developer olduğunda enable edilir.

---

## 5. Lokal Geliştirme Ortamı

### 5.1 Prerequisites

| Tool | Versiyon | Nasıl kurulur |
|---|---|---|
| Node.js | 20 LTS | nvm, volta, veya resmi installer |
| pnpm | 9.x | `npm install -g pnpm` veya `corepack enable` |
| Docker Desktop | Latest | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| Docker Compose | V2 | Docker Desktop ile gelir |
| AWS CLI | V2 | `brew install awscli` veya apt |
| PostgreSQL CLI (psql) | 16 | `brew install postgresql@16` |
| Redis CLI | 7 | `brew install redis` |
| Git | 2.30+ | Sistem default |
| VS Code | Latest | Önerilen editor |

Node version pin: `.nvmrc` dosyası (`20`). `nvm use` otomatik doğru versiyon seçer.

### 5.2 İlk Kurulum

```bash
# 1. Clone
git clone git@github.com:holding/lean-management.git
cd lean-management

# 2. Node setup
nvm install
nvm use

# 3. pnpm setup (Corepack)
corepack enable
corepack prepare pnpm@latest --activate

# 4. Dependencies
pnpm install

# 5. Env setup
cp .env.example .env.local
# .env.local editle — secret'ları Superadmin'den al (1Password / Vault)

# 6. Local servisler başlat
docker compose up -d postgres redis mailpit

# 7. DB migrate + seed
pnpm --filter api prisma migrate deploy
pnpm --filter api prisma db seed

# 8. Dev server başlat
pnpm dev
```

Başarılı ise:
- http://localhost:3000 — Frontend (Next.js)
- http://localhost:3001/api/v1/health — Backend (NestJS)
- http://localhost:8025 — Mailpit UI (test emailleri)
- http://localhost:5432 — PostgreSQL (psql ile bağlan)
- http://localhost:6379 — Redis

Test credentials (dev seed):
```
Email: superadmin@holding.com
Password: Superadmin1!
```

### 5.3 docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: leanmgmt
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: leanmgmt_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql
    ports: ['5432:5432']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U leanmgmt']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports: ['6379:6379']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - '1025:1025'  # SMTP
      - '8025:8025'  # Web UI

volumes:
  postgres_data:
  redis_data:
```

`scripts/init-db.sql` — extension'lar:
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 5.4 `.env.example`

Tam listesi (her developer self-review'da değişiklik eklemek zorunda):

```bash
# Database
DATABASE_URL=postgres://leanmgmt:dev_password@localhost:5432/leanmgmt_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secrets (local dev — hiçbir zaman prod'a kopyalanmaz)
JWT_ACCESS_SECRET_CURRENT=dev_access_secret_min_256_bit_entropy_required_here
JWT_REFRESH_SECRET_CURRENT=dev_refresh_secret_different_from_access_secret

# Encryption Keys (AES-256-GCM — 32 byte base64)
ENCRYPTION_KEY_DETERMINISTIC=<base64_32_bytes>
ENCRYPTION_KEY_PROBABILISTIC=<base64_32_bytes>

# Email (Mailpit local)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM_ADDRESS=noreply@localhost
SMTP_FROM_NAME="Lean Management Dev"

# AWS (dev hesap)
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=<dev_access_key>
AWS_SECRET_ACCESS_KEY=<dev_secret>
S3_DOCUMENTS_BUCKET=leanmgmt-dev-documents
CLOUDFRONT_KEY_PAIR_ID=<key_pair_id>
CLOUDFRONT_PRIVATE_KEY=<base64_encoded_pem>

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001

# Sentry (opsiyonel)
SENTRY_DSN=

# Feature flags
MAINTENANCE_MODE_ENABLED=false

# Logging
LOG_LEVEL=debug
```

### 5.5 VS Code Kurulumu

`.vscode/extensions.json` — önerilen extensions:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "github.vscode-pull-request-github",
    "eamodio.gitlens",
    "christian-kohler.path-intellisense",
    "streetsidesoftware.code-spell-checker",
    "vivaxy.vscode-conventional-commits",
    "vitest.explorer"
  ]
}
```

`.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "cSpell.words": ["leanmgmt", "KTI", "Kaizen", "sicil", "bcryptjs", "ioredis", "zod", "pnpm"]
}
```

`.vscode/launch.json` — debug configs (NestJS, Next.js, Vitest).

### 5.6 Troubleshooting Sıkıntıları

**Postgres "connection refused":** Docker Desktop çalışıyor mu? `docker compose ps`

**Prisma "migration drift":** `pnpm --filter api prisma migrate reset` (dev'de kabul — data kaybeder)

**pnpm install yavaş:** `.npmrc`'de store path SSD'de mi?

**Port 3000/3001 kullanımda:** `lsof -ti:3000 | xargs kill`

**Webpack cache bozuk:** `rm -rf apps/web/.next && pnpm dev`

---

## 6. Geliştirme Döngüsü

### 6.1 Günlük Akış

```bash
# Sabah
git checkout main
git pull --rebase

# Yeni feature başla
git checkout -b feat/kullanici-pasif-aktif-toggle
pnpm dev  # Terminal 1

# Test-watch
pnpm --filter api test --watch  # Terminal 2

# Değişiklik yap, kaydet — hot reload otomatik

# Commit hazırla
git add .
git commit -m "feat(users): kullanıcı pasif/aktif toggle eklendi"

# Push + PR
git push -u origin feat/kullanici-pasif-aktif-toggle
gh pr create --fill

# CI sonucu bekle → review → merge
```

### 6.2 Watch Mode Davranışı

| Tool | Watch davranışı |
|---|---|
| Next.js (`apps/web`) | Fast Refresh — kod değişikliği anında browser'a yansır |
| NestJS (`apps/api`) | `@nestjs/cli start --watch` ile tsc recompile + process restart (~2 sn) |
| Worker (`apps/worker`) | Aynı NestJS pattern |
| Vitest | `--watch` flag ile; değişen file'a bağlı testler yeniden çalışır |
| Prisma | Schema değişiminde `prisma generate` otomatik (husky pre-commit) |
| TypeScript | `tsc --watch` ayrı terminal'de tip hatalarını anlık gösterir |

### 6.3 Hot Reload Sorunları

Next.js hot reload state'i kaybetmez — kullanıcı login durumda kalır. Ancak:
- Middleware değişikliği → full reload
- `layout.tsx` değişikliği → partial rerender
- `server actions` değişikliği → browser refresh gerekli

NestJS state'siz — her restart'ta Redis/DB state korunur, in-memory state (varsa) sıfırlanır.

### 6.4 Prisma Studio

DB'yi görsel incelemek için:

```bash
pnpm --filter api prisma studio
# http://localhost:5555 açar
```

Dev'de hızlı data kontrolü için kullanışlı. Prod'da asla çalıştırılmaz.

---

## 7. AWS Ortam Topolojisi

### 7.1 3-Hesap Yapısı

| Hesap | AWS Account ID | Amaç | Erişim |
|---|---|---|---|
| **lean-mgmt-dev** | 111111111111 | Geliştirme sandbox | Tüm developers (SSO) |
| **lean-mgmt-staging** | 222222222222 | Pre-production, QA, UAT | Developers + QA (SSO) |
| **lean-mgmt-prod** | 333333333333 | Production | Superadmin + on-call (MFA zorunlu) |

AWS Organizations altında birleşik billing + Service Control Policies (SCP).

### 7.2 SSO Setup

AWS IAM Identity Center (eski SSO) — her developer için tek login portal:
```
https://holding.awsapps.com/start
```

SSO group permission set'ler:
- `DeveloperAccess` — dev hesabında admin, staging'te read-only
- `DevOpsAccess` — staging'te admin, prod'da sınırlı admin
- `SuperadminAccess` — prod'da admin (MFA zorunlu)
- `AuditReadOnly` — tüm hesaplarda CloudWatch + audit

CLI setup:
```bash
aws configure sso
aws sso login --profile leanmgmt-dev
aws sts get-caller-identity --profile leanmgmt-dev  # doğrulama
```

### 7.3 Region

**eu-central-1** (Frankfurt) — tüm production kaynakları burada.

Disaster recovery: RDS automated backup **eu-west-1** (Irlanda) replication (MVP dışı, opsiyonel). Production RDS outage için cross-region failover.

### 7.4 Environment Parity

Staging = production clone (anonim subset veri):
- Same VPC topology
- Same ECS task definitions
- Same RDS instance class (daha küçük — staging cost reduction)
- Same CloudFront distribution config
- Same S3 bucket policies

Dev farklı:
- Tek AZ (HA yok)
- Küçük t4g.micro instance'lar
- Spot instance'lar opsiyonel

### 7.5 IAM Roles (CI/CD)

GitHub Actions OIDC provider her hesapta tanımlı. Her hesapta `GitHubActionsDeployRole` role:

```terraform
# infrastructure/terraform/iam-oidc.tf
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_deploy" {
  name = "GitHubActionsDeployRole"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:holding/lean-management:*"
        }
      }
    }]
  })
}
```

Role permission'ları environment'a göre farklı:
- Dev role: geniş permission (developer iteration)
- Staging role: deploy odaklı (ECR push, ECS update, Lambda update)
- Prod role: minimal — sadece ECS service update, ECR image pull; RDS modify yasak (ayrı manual process)

---

## 8. CI/CD Pipeline — 3 Pipeline

### 8.1 Pipeline 1: `pr-check.yml`

Tetik: PR open, synchronize (her push).

Tam YAML içeriği `08_TESTING_STRATEGY` Bölüm 8.1'de. Özet job'lar:
- `lint` (eslint + prettier + tsc)
- `unit-test` (Vitest + coverage upload)
- `integration-test` (postgres + redis service container)
- `security-scan` (Snyk + trufflehog)
- `build` (Turbo build + Next.js bundle analysis)

Tüm job'lar paralel (lint'ten sonra). Toplam süre hedefi: **< 8 dakika**.

Required status checks (branch protection):
- ✓ lint
- ✓ unit-test
- ✓ integration-test
- ✓ build

Security-scan failure uyarı verir ama block etmez (triage opsiyonel — bazen false positive).

### 8.2 Pipeline 2: `main.yml`

Tetik: push to main (squash merge sonrası).

```yaml
name: Main — Deploy Pipeline

on:
  push:
    branches: [main]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

jobs:
  build-push-staging:
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    outputs:
      image-tag: ${{ steps.meta.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::222222222222:role/GitHubActionsDeployRole
          aws-region: eu-central-1
      - uses: aws-actions/amazon-ecr-login@v2
      - id: meta
        run: echo "tag=${{ github.sha }}" >> $GITHUB_OUTPUT
      - name: Build + push API image
        run: |
          docker build -t $ECR_URI/leanmgmt-api:${{ steps.meta.outputs.tag }} \
            --target api apps/api
          docker push $ECR_URI/leanmgmt-api:${{ steps.meta.outputs.tag }}
      - name: Build + push web image
        run: |
          docker build -t $ECR_URI/leanmgmt-web:${{ steps.meta.outputs.tag }} \
            --target web apps/web
          docker push $ECR_URI/leanmgmt-web:${{ steps.meta.outputs.tag }}
      - name: Build + push worker image
        run: |
          docker build -t $ECR_URI/leanmgmt-worker:${{ steps.meta.outputs.tag }} \
            --target worker apps/worker
          docker push $ECR_URI/leanmgmt-worker:${{ steps.meta.outputs.tag }}

  deploy-staging:
    needs: build-push-staging
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::222222222222:role/GitHubActionsDeployRole
          aws-region: eu-central-1
      - name: Prisma migrate deploy
        run: pnpm --filter api prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.STAGING_DB_URL }}
      - name: Update ECS services (blue-green)
        run: |
          aws ecs update-service --cluster staging \
            --service leanmgmt-api --force-new-deployment
          aws ecs update-service --cluster staging \
            --service leanmgmt-web --force-new-deployment
          aws ecs update-service --cluster staging \
            --service leanmgmt-worker --force-new-deployment
      - name: Wait for deployment stable
        run: |
          aws ecs wait services-stable --cluster staging \
            --services leanmgmt-api leanmgmt-web leanmgmt-worker

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
          name: playwright-report-${{ github.sha }}
          path: apps/web/playwright-report/

  deploy-prod:
    needs: e2e-staging
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    environment: production  # Manual approval gate
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::333333333333:role/GitHubActionsDeployRole
          aws-region: eu-central-1
      - name: Copy image staging → prod ECR
        run: |
          docker pull $STAGING_ECR/leanmgmt-api:${{ needs.build-push-staging.outputs.image-tag }}
          docker tag $STAGING_ECR/leanmgmt-api:... $PROD_ECR/leanmgmt-api:...
          docker push $PROD_ECR/leanmgmt-api:...
          # Repeat for web + worker
      - name: Prisma migrate deploy (PROD)
        run: pnpm --filter api prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.PROD_DB_URL }}
      - name: Update ECS services (PROD — blue-green)
        run: |
          aws ecs update-service --cluster production \
            --service leanmgmt-api --force-new-deployment
      - name: Wait for stable
        run: aws ecs wait services-stable --cluster production --services ...
      - name: Smoke test
        run: curl -f https://api.lean-mgmt.holding.com/api/v1/health
      - name: Slack notification
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

**GitHub environment: `production`** manual approval — Superadmin tıklayana kadar bekler. Approval listesi GitHub settings'ten yönetilir.

### 8.3 Pipeline 3: `nightly.yml`

Tetik: cron `0 2 * * *` (her gece 02:00 UTC).

```yaml
name: Nightly — Regression + Security

on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:  # Manuel tetik de mümkün

jobs:
  full-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm test --coverage
      - run: pnpm test:integration
      - run: pnpm --filter web test:e2e
        env:
          E2E_BASE_URL: https://staging.lean-mgmt.holding.com

  zap-baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: zaproxy/action-baseline@v0.12.0
        with:
          target: 'https://staging.lean-mgmt.holding.com'
          rules_file_name: '.zap/rules.tsv'
          fail_action: true

  snyk-full-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        with:
          command: test --all-projects --severity-threshold=medium
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm audit --audit-level=high

  backup-restore-drill:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - name: Trigger RDS snapshot restore to drill DB
        run: |
          aws rds restore-db-instance-from-db-snapshot \
            --db-instance-identifier leanmgmt-drill-$(date +%s) \
            --db-snapshot-identifier $(aws rds describe-db-snapshots \
              --db-instance-identifier leanmgmt-prod \
              --query 'reverse(sort_by(DBSnapshots, &SnapshotCreateTime))[0].DBSnapshotIdentifier' \
              --output text)
      # Verify + cleanup ...
```

Failure → email + Slack alert (`#lean-mgmt-alerts`).

### 8.4 Rollback Prosedürü

Production deploy sonrası sorun fark edilirse:

**A. ECS rollback (5 dakika):**
```bash
# Önceki task definition'a dön
aws ecs update-service \
  --cluster production \
  --service leanmgmt-api \
  --task-definition leanmgmt-api:PREVIOUS_REVISION
```

**B. Full git revert (20 dakika):**
```bash
git revert <merge_commit_sha>
git push origin main
# main pipeline tekrar çalışır, yeni image build edilir, deploy olur
```

**C. Hotfix branch:**
```bash
git checkout -b hotfix/critical-auth-fix
# fix yap
git push origin hotfix/critical-auth-fix
gh pr create --fill --label hotfix
# fast-track review + merge + deploy
```

Rollback sonrası post-mortem zorunlu (`docs/postmortems/YYYY-MM-DD-<title>.md`).

---

## 9. Database Migration

### 9.1 Prisma Migrate

Migration dosyaları `apps/api/prisma/migrations/` altında timestamp prefix ile:

```
20260115120000_initial_schema/
  migration.sql
20260120143000_add_user_phone_column/
  migration.sql
20260125091500_add_process_display_id_sequence/
  migration.sql
```

### 9.2 Yeni Migration Oluşturma

```bash
# schema.prisma düzenle — yeni field ekle
pnpm --filter api prisma migrate dev --name add_user_hire_date
```

Prisma:
1. Dev DB'ye migration uygular
2. Migration SQL dosyası oluşturur
3. `prisma generate` çalıştırır (Prisma Client güncellenir)

Migration dosyası review edilir (hatalı SQL varsa düzelt), commit edilir.

### 9.3 Migration Naming Convention

`<timestamp>_<verb>_<noun>[_<modifier>]`

Verb'ler:
- `add` — yeni tablo/kolon
- `remove` / `drop` — tablo/kolon silme
- `rename` — isim değişikliği
- `alter` — yapı değişikliği
- `backfill` — data migration
- `create_index` — performans

Örnekler:
```
20260115120000_initial_schema
20260120143000_add_user_phone_column
20260125091500_add_process_display_id_sequence
20260201100000_rename_sicil_to_employee_number
20260205142000_create_index_users_email_lower
20260210093000_backfill_audit_log_chain_hashes
20260215110000_drop_legacy_password_reset_table
```

### 9.4 Reversibility (Down Migration)

Prisma **native down migration desteklemez.** Forward-only. Rollback için:

- **Dev:** `prisma migrate reset` — DB sıfırlanır, tüm migration'lar yeniden uygulanır (data kaybedilir)
- **Staging/Prod:** Manuel rollback SQL script (her migration için `rollback.sql` dosyası opsiyonel)

```
20260120143000_add_user_phone_column/
  migration.sql         # forward
  rollback.sql          # manuel rollback
  README.md             # rollback instructions
```

Kritik migration'larda rollback SQL review edilir. Production deploy öncesi staging'de rollback test edilir.

### 9.5 Zero-Downtime Migration — Expand-Contract Pattern

Breaking schema change olmadan production migration. 4-adım:

**Adım 1 — Expand (yeni alan ekle, nullable):**
```sql
ALTER TABLE users ADD COLUMN phone_new VARCHAR(20);
```
Eski kod çalışmaya devam eder (yeni kolon görmez).

**Adım 2 — Dual write (deploy kodu):**
```typescript
// Backend: hem eski hem yeni kolona yaz
await prisma.users.update({
  where: { id },
  data: {
    phone: newPhone,       // eski
    phone_new: newPhone,   // yeni
  },
});
```

**Adım 3 — Backfill (eski data'yı yeni kolona kopyala):**
```sql
UPDATE users SET phone_new = phone WHERE phone_new IS NULL;
```
Büyük tablolarda batch (1000'lik gruplarla, hafif lock).

**Adım 4 — Switch read (deploy kodu):**
```typescript
// Okumayı yeni kolondan yap
const phone = user.phone_new;
```

**Adım 5 — Contract (eski kolonu sil — ayrı migration, 1 hafta sonra):**
```sql
ALTER TABLE users DROP COLUMN phone;
ALTER TABLE users RENAME COLUMN phone_new TO phone;
```

Bu 5-adım sürecine `expand-contract` denir — production'da hiç downtime yok. Her adım production'a deploy edilir; 1-gün staging observation arada.

MVP erken dönemde rare — schema değişikliği çoğunlukla additive (sadece `ALTER TABLE ADD COLUMN nullable`). Breaking change geldiğinde bu pattern uygulanır.

### 9.6 `prisma migrate deploy` vs `prisma db push`

- **`prisma migrate deploy`** — production + staging. Migration dosyalarını uygular. Deterministic, idempotent.
- **`prisma db push`** — sadece dev. Schema'yı direkt DB'ye sync eder, migration dosyası oluşturmaz. Hızlı iteration.
- **Prod'da `prisma db push` asla çalıştırılmaz.**

### 9.7 Migration Review Checklist

Migration PR'ında reviewer soruları:
- [ ] Breaking change mi? Expand-contract pattern uygulanmış mı?
- [ ] Large table ALTER (milyon+ satır) var mı? `CREATE INDEX CONCURRENTLY` kullanılmış mı?
- [ ] DROP operation var mı? Rollback SQL var mı?
- [ ] Backfill gerekiyor mu? Performance impact nedir?
- [ ] Row-level lock uzun süre tutar mı?
- [ ] Prisma schema ile SQL uyumlu mu (`prisma validate` green)?
- [ ] Dev'de test edildi + Prisma Client generate başarılı mı?

---

## 10. Feature Flags

### 10.1 MVP Yaklaşımı — Config-Based

Dedicated feature flag system (LaunchDarkly, Unleash) **yok** MVP'de. Gereksinim dar:
- Maintenance mode toggle
- Email/SMS notification enable/disable
- Specific feature kill-switch

Bu gereksinimler `system_settings` tablosu ile karşılanır:

```sql
-- system_settings table
category: FEATURE_FLAGS
key: FEATURE_KTI_REVISION_ENABLED
value: true
value_type: boolean
```

Backend runtime'da:
```typescript
const isKtiRevisionEnabled = await settingsService.getBoolean('FEATURE_KTI_REVISION_ENABLED');
if (!isKtiRevisionEnabled) {
  throw new FeatureDisabledException();
}
```

Setting cache 60 saniye — flag değişikliği 1 dakika içinde etkili.

### 10.2 Kill Switch Örnekleri

Her riskli feature için default OFF başlar:

| Feature flag | Default | Açıklama |
|---|---|---|
| `MAINTENANCE_MODE_ENABLED` | false | Tüm trafik 503 döner (Superadmin bypass) |
| `FEATURE_KTI_START_ENABLED` | true | KTİ başlatma disable etmek için |
| `FEATURE_EMAIL_NOTIFICATION_ENABLED` | true | Email gönderimi pause (queue'da birikir) |
| `FEATURE_ATTRIBUTE_RULE_MATCHING_ENABLED` | true | Attribute rule engine tamamen off (sadece direct roles) |
| `FEATURE_AUDIT_LOG_CHAIN_VERIFY_CRON_ENABLED` | true | Nightly chain verify kapatılabilir |

### 10.3 Roadmap — Dedicated FF System

Production kullanıcı sayısı arttığında (5K+ user):
- A/B testing ihtiyacı
- Percentage rollout (%10 user için yeni feature)
- User segmentation (company-based feature)
- **Unleash** open source seçimi (self-hosted, MVP öncesi evaluate)

LaunchDarkly vendor lock-in maliyet endişesi — MVP'de gereksiz.

### 10.4 Feature Flag Best Practices

- Her flag'ın **temizleme tarihi** olmalı — flag 6 ay sonra kaldırılır (code removal)
- Flag isimlendirme: `FEATURE_<AREA>_<ACTION>_ENABLED` (prefix konvansiyonu)
- Flag kullanımı **minimal** — her if-else feature flag değil; config-driven yerde
- Nested flag yasak — flag1 && flag2 kombinasyonu karmaşıklık üretir

---

## 11. Branch Protection Rules

### 11.1 `main` Branch Kuralları

GitHub settings → Branches → main için:

- ✓ Require a pull request before merging
  - ✓ Require approvals (1)
  - ✓ Dismiss stale pull request approvals when new commits are pushed
  - ✓ Require review from Code Owners
  - ✓ Require approval of the most recent reviewable push
- ✓ Require status checks to pass before merging
  - ✓ Require branches to be up to date before merging
  - Required status checks:
    - `lint`
    - `unit-test`
    - `integration-test`
    - `build`
- ✓ Require conversation resolution before merging
- ✓ Require signed commits (opsiyonel — roadmap)
- ✓ Require linear history (squash merge zaten garantiler)
- ✗ Require deployments to succeed (staging deploy post-merge)
- ✓ Lock branch (bypass permission yalnız admin)
- ✓ Do not allow bypassing the above settings
- ✓ Restrict who can push to matching branches (sadece admin)

Admin bypass hakkı kullanılmaz — acil hotfix bile standart flow (hotfix branch + fast-track review).

### 11.2 Diğer Branch Korumaları

- `release/*` pattern (roadmap için — MVP'de yok)
- `dependabot/*` pattern — auto-merge için minimal koruma

### 11.3 Merge Queue (Roadmap)

3+ developer olduğunda GitHub Merge Queue aktif edilir:
- PR approve olduğunda merge queue'ya girer
- Queue sırayla çalışır, her PR fresh main ile CI çalıştırır
- Semantic conflict (iki PR aynı anda farklı alanları etkiler ama beraber broken hale getirir) otomatik yakalanır

---

## 12. Release Process

### 12.1 Semantic Versioning

```
MAJOR.MINOR.PATCH

0.x.y — MVP development (breaking changes serbest)
1.0.0 — İlk production stable release
1.x.y — Post-MVP iteration
```

Version bump kuralları (release-please GitHub Action otomatik):
- `fix`, `perf`, `refactor` → patch (`1.2.0` → `1.2.1`)
- `feat` → minor (`1.2.0` → `1.3.0`)
- `BREAKING CHANGE` → major (`1.2.0` → `2.0.0`)

### 12.2 CHANGELOG

`CHANGELOG.md` otomatik generate edilir (release-please). Format:

```markdown
# Changelog

## [1.2.0] - 2026-05-15

### Features
- **kti:** yönetici onay için SLA rozeti eklendi (#127)
- **processes:** süreç rollback aksiyonu eklendi (#130)

### Bug Fixes
- **auth:** lockout counter başarılı login sonrası sıfırlanmıyordu (#128)
- **ui:** mobile'de notification bell badge'i gizleniyordu (#129)

### Performance
- **processes:** liste query'sine composite index eklendi (#131)
```

### 12.3 Release Cadence

**Haftalık production deploy** — her Pazartesi 10:00 TR (09:00 UTC).

Gerekçe:
- Pazartesi sabahı full ekip destek hazır
- Pazartesi-Çarşamba hotfix window (3 gün buffer)
- Perşembe-Cuma feature freeze (test + doc)
- Pazar deploy **yasak** (on-call yorgunluk, destek yok)

Emergency hotfix bu cadence'i bypass edebilir (her zaman deploy mümkün).

### 12.4 Release Öncesi Kontrol Listesi

Pazartesi deploy öncesi:
- [ ] Tüm merged PR'lar staging'te smoke test edildi
- [ ] E2E tests staging'te green (nightly + ad-hoc)
- [ ] CHANGELOG.md güncel
- [ ] Version bump PR merge edildi
- [ ] Breaking change varsa migration runbook hazır
- [ ] Superadmin onay verdi (production environment approval)
- [ ] On-call developer hazır
- [ ] Slack `#lean-mgmt-releases` bildirimi yapıldı

### 12.5 GitHub Releases

Version tag (`v1.2.0`) + CHANGELOG excerpt + build artifacts (opsiyonel — ECS zaten image tag ile tracker).

### 12.6 Deploy Sonrası

Deploy tamamlandıktan sonra 2 saat monitoring odaklı:
- CloudWatch dashboard açık
- Sentry new issue feed açık
- Slack `#lean-mgmt-alerts` takibi
- Smoke test manual (login + dashboard + KTİ start)

Sorun yoksa routine dev işlerine dön. Sorun varsa rollback (Bölüm 8.4).

---

## 13. Incident Response

### 13.1 Severity Seviyeleri

| Seviye | Örnek | Response time SLA |
|---|---|---|
| **CRITICAL** | Production down, data corruption, security breach | 15 dakika |
| **HIGH** | Major feature broken, auth broken, P95 >5sn | 1 saat |
| **MEDIUM** | Minor feature broken, workaround var | 4 saat (iş saati) |
| **LOW** | UI glitch, edge case bug | Sonraki sprint |

### 13.2 On-Call Rotation

MVP'de **solo Superadmin on-call 7/24**. Takım büyüdükçe rotation:
- Haftalık rotation
- Primary + Secondary on-call
- On-call handoff doc (Notion/Confluence)

Tool'lar (MVP sonrası):
- PagerDuty veya OpsGenie — alert → SMS/phone call
- Slack `#oncall` channel

### 13.3 Incident Response Flow

```
Detect → Triage → Contain → Eradicate → Recover → Post-mortem
```

**Detect:** CloudWatch alarm, Sentry issue, user report.

**Triage (ilk 5 dakika):** Severity belirle. Impact scope (kaç kullanıcı etkileniyor?). On-call lead atandı mı?

**Contain (ilk 30 dakika):** Sorunu sınırla — feature flag ile disable, maintenance mode, rollback, circuit breaker.

**Eradicate:** Root cause identification. Fix deploy veya config change.

**Recover:** Service normalize. Customer communication (email, status page).

**Post-mortem (7 gün içinde):** Blameless retrospective. Timeline, root cause, action items, prevention.

### 13.4 Runbook Dizini

`docs/runbooks/`:

```
runbook-audit-chain-broken.md
runbook-db-failover.md
runbook-db-migration-stuck.md
runbook-rds-storage-full.md
runbook-secret-rotation-jwt.md
runbook-secret-rotation-encryption-key.md
runbook-5xx-spike.md
runbook-theft-detection.md
runbook-clamav-lambda-failure.md
runbook-ecs-deployment-stuck.md
runbook-cloudfront-distribution-broken.md
runbook-email-queue-backed-up.md
runbook-maintenance-mode-activate.md
runbook-rollback-production-deploy.md
runbook-prod-subset-to-staging.md
```

Her runbook standart format:

```markdown
# Runbook: [Title]

## Symptoms
Ne görünüyor — alert mesajı, log pattern, user complaint

## Severity
CRITICAL / HIGH / MEDIUM / LOW

## Immediate Actions
1. [Adım 1 — hızlı containment]
2. [Adım 2]

## Diagnosis
Nasıl root cause tespit edilir — komutlar, dashboard linkleri

## Resolution
Çözüm adımları — fix deploy, config change, vs.

## Verification
Fix doğru çalıştığını nasıl kanıtla

## Post-Incident
- Post-mortem template
- Action items
- Related runbooks
```

Runbook'lar yaşar — her incident sonrası update edilir.

### 13.5 Post-Mortem Template

`docs/postmortems/YYYY-MM-DD-[short-title].md`:

```markdown
# Post-Mortem: [Title]

## Summary
2-3 cümle özet — ne oldu, impact, resolution

## Timeline (UTC)
- 14:32 — CloudWatch alarm triggered
- 14:35 — On-call engineer acknowledged
- 14:40 — Root cause identified: ...
- 14:55 — Fix deployed to staging
- 15:10 — Production deployed
- 15:25 — Service normalized

## Impact
- Users affected: [sayı veya %]
- Duration: [X minutes]
- Financial impact: [varsa]
- Data loss: [varsa]

## Root Cause
Teknik detay — neden oldu

## What Went Well
- Alerting çalıştı
- Rollback prosedürü hızlıydı

## What Went Wrong
- Alert 10 dakika gecikti
- Runbook güncel değildi

## Action Items
| Action | Owner | Due |
|---|---|---|
| Alert threshold düşür | Ahmet | 2026-04-30 |
| Runbook güncelle | Seyma | 2026-04-25 |
| Monitoring test senaryosu ekle | Ahmet | 2026-05-07 |

## Lessons Learned
Genel çıkarımlar
```

Blameless kültür: "kim yaptı" yerine "hangi sistem eksik". İnsan hatası sistem tasarımı sorunudur.

---

## 14. Dokümantasyon

### 14.1 ADR — Architecture Decision Records

`docs/adr/` dizininde. Her önemli mimari karar ADR ile kaydedilir:

```
docs/adr/
  0001-use-nestjs-backend.md
  0002-prisma-over-typeorm.md
  0003-jwt-hs256-over-rs256.md
  0004-refresh-token-family-tracking.md
  0005-audit-log-append-only-trigger.md
  0006-permission-metadata-in-code.md
  0007-expand-contract-migration-pattern.md
  0008-turborepo-monorepo.md
  0009-cloudfront-signed-url-8-layer.md
  0010-bcrypt-over-argon2.md
```

ADR format (MADR 3.0):

```markdown
# [ADR-0003] JWT için HS256 algoritması (RS256 yerine)

- **Status:** Accepted
- **Date:** 2026-03-10
- **Deciders:** Ahmet, Seyma
- **Technical Story:** #42

## Context

JWT imzalama algoritması seçimi gerekli. İki aday: HS256 (HMAC) ve RS256 (asymmetric).

## Considered Options

1. **HS256** — HMAC-SHA256, symmetric key
2. **RS256** — RSA-SHA256, public/private key

## Decision Outcome

**Chosen option: HS256**, because:
- Operational simplicity (tek backend, key sharing yok)
- Key rotation tek Redis update
- RS256 public/private key management + JWK endpoint complexity MVP için gereksiz

## Consequences

**Good:**
- Setup basit, troubleshooting kolay
- Signing/verify performans HS256'da daha hızlı

**Bad:**
- Gelecekte federated auth (Keycloak) eklenirse RS256'ya migration gerekir
- Key leak durumunda tek secret → tüm token'lar invalidate

## Mitigations

- Secret rotation 180 günde (dual-key window)
- AWS Secrets Manager IAM restrict
- Key size 256-bit random

## Links

- ADR-0004: Refresh token family tracking
```

ADR yazılan durumlar:
- Yeni framework/library seçimi (>10 KB bundle veya core dependency)
- Schema tasarım kararı (tablo yapısı, indexing strategy)
- Security-related karar (auth, encryption, access control)
- Performance kritik yaklaşım
- Third-party service seçimi
- Breaking change

ADR yazılmayan:
- Trivial library (lodash, date-fns) — package.json yeterli
- Bug fix — PR description yeterli
- Style/naming convention — bu doküman yeterli

### 14.2 Diğer Dokümantasyon

`docs/` dizini:
- **11 core doc** (`00_*` → `10_*`)
- **ADR'lar** (`adr/`)
- **Runbook'lar** (`runbooks/`)
- **Post-mortem'ler** (`postmortems/`)
- **Onboarding** (`onboarding.md`)
- **Glossary** (`glossary.md` — Turkish/English tech term mapping)

Her doküman markdown, Prettier format, tutarlı heading hierarchy.

### 14.3 Canlı Doküman

Bu dokümanlar **yaşayan** — her sprint retro sonrası güncelleme:
- Yeni feature geldiğinde ilgili doc update
- Yeni learning (incident, post-mortem) doc'a yansıtılır
- Eskimiş/yanlış info düzeltme PR'ları (docs: label)

Doc-freshness audit haftada 1 — Superadmin random doc seçer, "hâlâ doğru mu?" kontrol eder.

### 14.4 README.md

Root `README.md`:

```markdown
# Lean Management Platformu

Holding iç kurumsal lean yönetim platformu — Kaizen, 5S ve iyileştirme süreçleri için.

## Tech Stack
- Frontend: Next.js 15 + React 19 + TypeScript + shadcn/ui
- Backend: NestJS + Fastify + TypeScript
- Database: Aurora PostgreSQL 16
- Cache/Queue: Redis 7 + BullMQ
- Infra: AWS (ECS, CloudFront, S3, RDS, ElastiCache)

## Quick Start

See [docs/09_DEV_WORKFLOW.md](docs/09_DEV_WORKFLOW.md) for full setup.

```bash
nvm use
pnpm install
docker compose up -d
pnpm --filter api prisma migrate deploy
pnpm --filter api prisma db seed
pnpm dev
```

## Documentation

- [Project Overview](docs/00_PROJECT_OVERVIEW.md) — Platform kapsamı
- [Domain Model](docs/01_DOMAIN_MODEL.md) — Entity'ler, state machine'ler
- [API Contracts](docs/03_API_CONTRACTS.md) — REST endpoint'ler
- [Screen Catalog](docs/06_SCREEN_CATALOG.md) — Ekran spesifikasyonu
- [Security](docs/07_SECURITY_IMPLEMENTATION.md) — Güvenlik uygulaması
- [Testing](docs/08_TESTING_STRATEGY.md) — Test stratejisi
- [Dev Workflow](docs/09_DEV_WORKFLOW.md) — Geliştirme disiplini
- [Roadmap](docs/10_IMPLEMENTATION_ROADMAP.md) — MVP sprint planı

## Contributing

See [docs/09_DEV_WORKFLOW.md](docs/09_DEV_WORKFLOW.md).

## License

Internal — Holding proprietary.
```

---

## 15. Developer Onboarding

### 15.1 Day 1 — Setup

- [ ] Git repo erişimi (GitHub org invitation)
- [ ] AWS SSO credentials (dev hesap)
- [ ] Slack workspace invitation (`#lean-mgmt-dev`, `#lean-mgmt-alerts`)
- [ ] VS Code + extensions kurulumu
- [ ] Repo clone + lokal setup (bu doküman Bölüm 5)
- [ ] `pnpm dev` başarıyla çalışıyor
- [ ] http://localhost:3000'e erişim + login (dev seed credentials)

### 15.2 Day 2-3 — Orientasyon

- [ ] Tüm 11 core doc'u oku (00-10)
- [ ] ADR'leri göz gez — kararlar nasıl alındı anla
- [ ] İlk PR: küçük fix (typo, docs, minor UI) — full cycle deneyim
- [ ] Code review bir PR'a yap (başkasının PR'ını review et — takım üyesi varsa)
- [ ] Staging ortamına erişim (AWS SSO staging profile)
- [ ] Sentry + CloudWatch dashboard erişimi

### 15.3 Week 1 — First Feature

- [ ] Pair programming: senior developer ile feature delivery (backlog'tan küçük feature)
- [ ] Test coverage delta positive
- [ ] E2E çalıştırabiliyor (staging'e karşı)
- [ ] Runbook review: 3 runbook oku (`runbook-5xx-spike`, `runbook-ecs-deployment-stuck`, `runbook-db-migration-stuck`)

### 15.4 Week 2-4 — Ramp Up

- [ ] 3+ feature delivery (küçük-orta büyüklük)
- [ ] 5+ PR review
- [ ] Bir incident'a dahil olma (shadow on-call)
- [ ] ADR review: yeni ADR öneri yapabilecek seviyede

### 15.5 Onboarding Checklist

`docs/onboarding.md` — checkbox list. Buddy system: her yeni developer'a senior developer atanır, 2 haftalık mentorship.

### 15.6 Knowledge Transfer Sorumluluğu

Developer ayrılırken (sonsuz MVP değil — proje yaşar):
- 2 hafta notice period
- Open PR'lar kapat veya handoff
- Knowledge share session (2 saat — tüm takım)
- Runbook'ları güncelle (kişisel bilgi paylaşılır)
- Secret rotation (ayrılan kişinin credential'ları invalidate)

---

## 16. Gelişmiş Konular

### 16.1 Dependabot

`.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "Europe/Istanbul"
    open-pull-requests-limit: 5
    groups:
      prod-patches:
        applies-to: version-updates
        update-types: [patch]
      dev-deps:
        dependency-type: development
        update-types: [minor, patch]
    ignore:
      - dependency-name: "react"
        update-types: ["version-update:semver-major"]
      - dependency-name: "next"
        update-types: ["version-update:semver-major"]
    labels:
      - "dependencies"
      - "automated"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

Auto-merge policy:
- Patch version update + CI green → auto-merge
- Minor version update → PR açar, manual review
- Major version update → ignore (manual upgrade, ADR gerekir)

### 16.2 Code Quality Tools

- **ESLint** (`.eslintrc.cjs`) — TypeScript + React + security plugins
- **Prettier** (`.prettierrc`) — opinionated formatting; line 120 char
- **TypeScript strict mode** — `"strict": true`, `"noUnusedLocals": true`
- **lint-staged** — pre-commit incremental check
- **SonarQube Cloud** (opsiyonel) — code smell, duplication, complexity

### 16.3 Performance Profiling

MVP'de reactive (incident sonrası):
- Node.js `--inspect` flag + Chrome DevTools
- React DevTools Profiler
- PostgreSQL `EXPLAIN ANALYZE`
- Redis `SLOWLOG`

Production'da:
- CloudWatch Performance Insights (RDS)
- Sentry Performance Monitoring (transactions)
- APM (opsiyonel — Datadog, New Relic — MVP'de yok)

### 16.4 Log Aggregation

CloudWatch Logs ana tool. Log querying:
- CloudWatch Logs Insights (yüksek öğrenme eğrisi ama ücretsiz)
- Opsiyonel: Datadog Logs (cost'a değer mi karar)

Structured logging (Pino JSON):
```json
{"level":30,"time":1714000000,"userId":"u1","action":"PROCESS_STARTED","displayId":"KTI-000042","durationMs":145}
```

---

Bu doküman takımın disiplin ve kolektif hafızasıdır. Her yeni developer bu dokümanı Day 1'de okur. Her karar bu dokümanın ilgili bölümünün ihlali veya güncellemesi olmalı — adhoc kararlar tolere edilmez.

Yaşayan dokümantasyon prensibi: sapma tespit edilirse ya kural yanlış (düzelt), ya uygulama yanlış (düzelt), ama belirsizlik kabul edilmez.
