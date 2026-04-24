# Lean Management

Holding içi **lean yönetim platformu** — Kaizen, 5S ve sürekli iyileştirme süreçleri (MVP). Monorepo: Turborepo + pnpm.

## Gereksinimler

- Node.js 20+ ([`.nvmrc`](./.nvmrc))
- pnpm 9+ (`corepack enable` / `npm i -g pnpm`)

## Kurulum

```bash
pnpm install
```

## Komutlar

| Komut                   | Açıklama                                               |
| ----------------------- | ------------------------------------------------------ |
| `pnpm dev`              | Uygulamaları geliştirme modunda çalıştırır (Turborepo) |
| `pnpm -w run build`     | Tüm paket ve uygulamaları üretim için derler           |
| `pnpm -w run lint`      | ESLint                                                 |
| `pnpm -w run typecheck` | TypeScript `--noEmit`                                  |
| `pnpm -w run test`      | Vitest                                                 |

Tek uygulama örneği: `pnpm --filter @leanmgmt/web dev`

## Lokal servisler (Faz 2 öncesi altyapı)

PostgreSQL, Redis ve Mailpit:

```bash
docker compose up -d
```

## Yapı

- `apps/api` — NestJS 10 + Fastify API
- `apps/web` — Next.js 15 (App Router) + React 19
- `apps/worker` — NestJS + BullMQ iskeleti (iş mantığı sonraki fazlar)
- `packages/shared-types`, `shared-schemas`, `shared-utils` — paylaşılan kod
- `packages/config` — tsconfig, ESLint, Vitest, Prettier paylaşımı

Detaylı iş akışı: [`docs/09_DEV_WORKFLOW.md`](./docs/09_DEV_WORKFLOW.md). Mimari kararlar: [`docs/adr/`](./docs/adr/).

## Commit mesajları

[Conventional Commits](https://www.conventionalcommits.org/) + commitlint (Husky `commit-msg` hook). Örnek: `feat(web): giriş sayfası iskeleti eklendi`.
