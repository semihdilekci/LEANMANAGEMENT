# ADR 0007: CI/CD AWS Erişimi — GitHub OIDC (uzun ömürlü anahtar yok)

- Status: Accepted
- Date: 2026-04-24
- Deciders: Platform

## Context and Problem Statement

Terraform plan/apply ve ileride uygulama dağıtımı için GitHub Actions’un AWS API’lerine erişmesi gerekir. Uzun ömürlü `AWS_ACCESS_KEY_ID` saklamak supply-chain ve sızıntı riskini artırır.

## Decision Drivers

- Güvenlik baseline ve `09_DEV_WORKFLOW` OIDC örneği
- `03-security-baseline` IAM ilkeleri
- Rotasyon maliyeti

## Considered Options

1. **GitHub Actions OIDC → `sts:AssumeRoleWithWebIdentity`** — kısa ömürlü creds
2. **Saklı IAM user access key** — basit; rotasyon ve sızıntı riski yüksek
3. **Federation + harici IdP** — MVP için ağır

## Decision Outcome

**Seçilen: OIDC** ile `leanmgmt-<env>-github-terraform` rolü. `token.actions.githubusercontent.com:sub` için `repo:<org>/<repo>:<suffix>` kısıtı `terraform.tfvars` / GitHub Environment secret’ları ile yönetilir. Terraform state erişimi ve KMS anahtarları role policy’de hesap kapsamıyla listelenir; geniş `iam:*`/`ec2:*` eylemleri **yalnızca** `leanmgmt-*` kaynak ARN önekleriyle sınırlandırılmaya çalışılır (ilk bootstrap sonrası sıkılaştırma human gate).

## Consequences

- Olumlu: Anahtar rotasyonu yok, denetim izi GitHub + CloudTrail ile birleşir
- Olumsun: Thumbprint/dokümantasyon güncellemeleri ve rol policy sıkılaştırması için sürekli bakım
