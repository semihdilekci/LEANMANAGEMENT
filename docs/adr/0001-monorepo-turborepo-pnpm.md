# ADR 0001: Monorepo — Turborepo + pnpm

- Status: Accepted
- Date: 2026-04-24
- Deciders: Platform (vibe coding)

## Context and Problem Statement

Backend (NestJS), frontend (Next.js) ve worker (Nest + BullMQ) aynı release döngüsünde; paylaşılan Zod şemaları ve TypeScript tipleri tek kaynakta tutulmalı. Monorepo araç seçimi disk kullanımı, CI süresi ve developer deneyimini etkiler.

## Decision Drivers

- Ortak `shared-schemas` / `shared-types` ile tip drift riskinin sıfıra yakın olması
- Tek CI pipeline ve atomic PR (API + web aynı PR)
- Disk-efficient install ve hızlı CI cache
- Dokümantasyonla uyum (`09_DEV_WORKFLOW`)

## Considered Options

1. **Turborepo + pnpm** — görev cache ve workspace protokolü
2. **Nx** — güçlü graph ve codegen; MVP için öğrenme eğrisi ve config yükü daha yüksek
3. **npm/yarn workspaces + manuel script** — cache ve task orchestration zayıf

## Decision Outcome

**Seçilen: Turborepo + pnpm workspaces**

pnpm ile `workspace:*` iç bağımlılıklar ve paylaşımlı store; Turborepo ile `build` / `lint` / `typecheck` / `test` / `dev` pipeline ve remote cache hazırlığı. Kök `packageManager` alanı ile pnpm sürümü pinlenir.

## Consequences

- Olumlu: Tek `pnpm install`, tutarlı dependency ağacı, PR başına tek lint/typecheck/test/build komutu
- Olumsuz: Çok büyük monorepolarda Turbo graph bakımı gerekir (MVP ölçeğinde düşük risk)
