# ADR 0002: Uygulama yığını — Next.js + NestJS + Prisma

- Status: Accepted
- Date: 2026-04-24
- Deciders: Platform (vibe coding)

## Context and Problem Statement

MVP için B2E web uygulaması, REST API ve arka plan işleri gerekiyor. Stack seçimi hiring, ekosistem olgunluğu, güvenlik pattern'leri ve dokümantasyon (`00_PROJECT_OVERVIEW`, `04_BACKEND_SPEC`, `05_FRONTEND_SPEC`) ile uyumlu olmalı.

## Decision Drivers

- TypeScript strict tek dil (frontend + backend)
- Kurumsal ölçek (20K+ kullanıcı) için kanıtlanmış framework'ler
- Prisma ile şema tek kaynak ve migration disiplini (Faz 2)
- Next.js App Router ve NestJS + Fastify (`04_BACKEND_SPEC`) zorunluluğu

## Considered Options

1. **Next.js 15 + NestJS 10 (Fastify) + Prisma** — dokümanda pin'li stack
2. **Remix + FastAPI + SQLAlchemy** — Python ikinci dil; takım ve kurallar TS odaklı
3. **Next.js full-stack (Route Handlers)** — ağır iş ve BullMQ için API ayrılığı tercih edildi

## Decision Outcome

**Seçilen: Next.js 15 (App Router) + React 19 + NestJS 10 + Fastify + Prisma (Aurora PostgreSQL 16)**

Faz 0 iskeletinde yalnızca Next ve Nest uygulamaları oluşturulur; **Prisma şema ve DB bağlantısı Faz 2**'de tanımlanır. Bu ADR stack taahhüdünü kilitlemek için Faz 0 sonunda yazılır.

## Consequences

- Olumlu: Tek dil, paylaşımlı Zod paketi, Nest modül sınırları ile yetki/audit pattern'leri
- Olumsuz: İki runtime (Node API + Node worker + SSR/SSG web); deploy topolojisi Faz 1/9'da netleştirilir
