# ADR 0005: İş Yükü Çalışma Zamanı — Amazon ECS on Fargate

- Status: Accepted
- Date: 2026-04-24
- Deciders: Platform

## Context and Problem Statement

API, worker ve web (SSR) bileşenlerinin AWS üzerinde çalıştırılması için konteyner orkestrasyonu seçilmelidir. MVP’de operasyonel karmaşıklık düşük tutulmalıdır.

## Decision Drivers

- NestJS API + BullMQ worker + Next.js dağıtım modeli
- `.cursor` stack kararı (Nest + Next ayrı servisler)
- Ekip boyutu ve operasyon yükü (K8s sertifikası/bakım maliyeti)

## Considered Options

1. **ECS Fargate** — sunucusuz konteyner, ALB entegrasyonu, IAM görev rolleri
2. **Amazon EKS** — güçlü ekosistem; kontrol düzlemi ve yükseltme maliyeti yüksek
3. **EC2 + Docker Compose** — anti-pattern; ölçek ve sağlık kontrolü zayıf

## Decision Outcome

**Seçilen: ECS Fargate** — `leanmgmt-<env>-cluster` ve servis başına modüler task tanımı. MVP’de **skeleton** servis (nginx) ile ALB health ve uçtan uca ağ doğrulanır; gerçek uygulama imajları sonraki fazlarda ECR + task güncellemesi ile gelir.

## Consequences

- Olumlu: Düşük operasyon yükü, IAM ile ince taneli yetki, Terraform modülü ile tekrar kullanılabilirlik
- Olumsuz: Stateful workload ve özel cihaz ihtiyaçları sınırlı (MVP için sorun değil)
