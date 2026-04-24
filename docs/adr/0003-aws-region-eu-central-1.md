# ADR 0003: AWS Primary Region — eu-central-1

- Status: Accepted
- Date: 2026-04-24
- Deciders: Platform

## Context and Problem Statement

Veri ikameti, gecikme ve hizmet olgunluğu için birincil AWS bölgesi seçilmelidir. MVP tek bölge ile başlar; gelecekte DR için cross-region opsiyonu dokümante edilir.

## Decision Drivers

- `00_PROJECT_OVERVIEW` ve güvenlik dokümanı ile uyum (AB yakınlığı, KVKK ile uyumlu süreç)
- Aurora, ElastiCache, ECS Fargate, CloudFront edge availability
- Operasyonel basitlik (tek bölge yönetimi)

## Considered Options

1. **eu-central-1 (Frankfurt)** — holding standardı ve mevcut dokümantasyon
2. **eu-west-1** — daha geniş bazı servisler; latency Türkiye için biraz daha yüksek olabilir

## Decision Outcome

**Seçilen: eu-central-1** tüm runtime kaynakları (VPC, Aurora, Redis, ECS, ALB, regional WAF) için birincil bölge. CloudFront + WAFv2 CLOUDFRONT kapsamı için `us-east-1` yalnızca WAF Web ACL oluşturma zorunluluğu nedeniyle provider alias ile kullanılır (AWS kısıtı).

## Consequences

- Olumlu: Dokümanlar, Terraform ve operasyon runbook’ları tek bölge üzerinden hizalanır
- Olumsuz: Bölgesel outage’te RTO/RPO için ayrı DR kararı gerekir (MVP dışı backlog)
