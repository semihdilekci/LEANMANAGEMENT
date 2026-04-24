# ADR 0006: AWS Üç Hesap İzolasyonu (dev / staging / prod)

- Status: Accepted
- Date: 2026-04-24
- Deciders: Platform

## Context and Problem Statement

Kurumsal iç platformda veri sızıntısı ve yanlışlıkla prod değişikliği riskini azaltmak için ortamlar AWS hesap sınırı ile ayrılmalıdır.

## Decision Drivers

- `07_SECURITY_IMPLEMENTATION` §14 (cross-hesap veri akışı yok)
- Farklı IAM ve SCP politikaları (dev geniş, prod kısıtlı)
- Maliyet ve blast radius ayrımı

## Considered Options

1. **Üç ayrı AWS hesabı** — dev, staging, prod; her biri bağımsız VPC ve state bucket
2. **Tek hesap çoklu VPC** — daha düşük maliyet; SCP ve fat-finger riski yüksek
3. **Organizasyon birimi + paylaşılan networking** — MVP için fazla karmaşık

## Decision Outcome

**Seçilen: üç hesap** modeli. Terraform’da `environments/dev`, `staging`, `prod` ayrı kökleri aynı `modules/` setini paylaşır; **state bucket ve lock tablosu hesap başına** ayrıdır. Apply politikası: dev otomasyonla, staging/prod manuel/onaylı.

## Consequences

- Olumlu: Güvenlik sınırı net, blast radius küçülür
- Olumsun: Hesap başına bootstrap (OIDC, state bucket, SSO) tekrarı; maliyet konsolidasyonu Organizations ile yönetilmeli
