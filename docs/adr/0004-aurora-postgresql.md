# ADR 0004: Veritabanı — Amazon Aurora PostgreSQL 16

- Status: Accepted
- Date: 2026-04-24
- Deciders: Platform

## Context and Problem Statement

İç kurumsal lean platformu için ilişkisel veri + JSON ihtiyaçları, yüksek erişilebilirlik ve yönetilen yedekleme gereksinimi vardır.

## Decision Drivers

- Prisma + PostgreSQL uyumu
- Otomatik yedekleme, okuma replikası (prod), şifreleme (KMS)
- Operasyon yükü (RDS “tek instance” yerine Aurora cluster modeli)

## Considered Options

1. **Aurora PostgreSQL 16** — cluster + instance, `manage_master_user_password` ile Secrets Manager entegrasyonu
2. **RDS PostgreSQL single-AZ** — daha ucuz; HA ve failover story zayıf
3. **Aurora Serverless v2** — maliyet/ölçek dinamik; MVP’de öngörülebilir instance sınıfı tercih edildi

## Decision Outcome

**Seçilen: Aurora PostgreSQL 16** (`engine_version` pin’i Terraform’da), depolama ve yedekleme AWS yönetimli. **Dev** tek writer instance; **prod** writer + bir reader (`environment` ile koşullu).

## Consequences

- Olumlu: Multi-AZ failover path, tutarlı PostgreSQL sürümü, encryption-at-rest varsayılan
- Olumsuz: Maliyet RDS single instance’a göre daha yüksek; instance sınıfı gözlemlenmeli
