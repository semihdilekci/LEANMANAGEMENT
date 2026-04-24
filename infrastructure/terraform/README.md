# Lean Management — AWS Terraform (Faz 1)

Terraform **1.6+**, AWS provider **5.x**, bölge **eu-central-1**. Modüller `modules/`, ortam kompozisyonları `environments/{dev,staging,prod}/`.

## Ön koşullar

1. **Uzak state (S3 + DynamoDB)** her AWS hesabında bir kez oluşturulur (bucket versioning + encryption; prod için MFA delete önerilir).
2. `terraform init` için `backend.hcl` kullanın:

```bash
cd environments/dev
cp backend.hcl.example backend.hcl
# backend.hcl içindeki bucket/table değerlerini hesabınıza göre düzenleyin
terraform init -backend-config=backend.hcl
```

3. `terraform.tfvars` (gitignore’da): `terraform.tfvars.example` dosyasını kopyalayıp GitHub `org/repo`, remote state bucket/table ARN değerlerini doldurun. **ACM / DNS yokken** `acm_certificate_arn = ""` bırakılabilir: ALB yalnızca HTTP (80), CloudFront kökeni ALB’ye **http-only** bağlanır (yalnızca geliştirme / bootstrap; trafik CloudFront→ALB şifresizdir).

**State bucket bölgesi:** `backend.hcl` içindeki `region`, S3 bucket’ın olduğu bölge ile aynı olmalı (ör. bucket `us-east-1` ise `region = "us-east-1"`). Uygulama kaynakları (VPC, Aurora, …) varsayılan olarak **eu-central-1** provider’ında kalır; state farklı bölgede olabilir.

## Komutlar

```bash
terraform fmt -recursive
terraform validate
terraform plan
```

**ACM** varsa HTTPS + HTTP→HTTPS redirect açılır; yoksa yalnız HTTP. JWT vb. secret **değerleri** Terraform’da tutulmaz; konsoldan veya pipeline’dan Secrets Manager’a yazılır.

## GitHub OIDC

`module.github_oidc` rolü: `terraform_remote_state_*` ARN’leri ve KMS anahtar listesi `terraform.tfvars` ile verilir. CI’da `configure-aws-credentials` ile `module.github_oidc.terraform_role_arn` assume edilir.

### Gerekli GitHub Actions secret’ları (örnek isimler)

| Secret                                             | Açıklama                                             |
| -------------------------------------------------- | ---------------------------------------------------- |
| `AWS_TERRAFORM_ROLE_ARN_DEV`                       | Dev hesapta `leanmgmt-dev-github-terraform` rol ARN  |
| `TF_BACKEND_BUCKET_DEV`                            | State S3 bucket adı                                  |
| `TF_BACKEND_LOCK_TABLE_DEV`                        | DynamoDB lock tablosu adı                            |
| `TF_VAR_ACM_CERTIFICATE_ARN_DEV`                   | ALB için ACM ARN (boş bırakılabilir = HTTP-only dev) |
| `TF_VAR_GITHUB_REPOSITORY`                         | `org/repo` (OIDC `sub` ile aynı)                     |
| `TF_VAR_TERRAFORM_REMOTE_STATE_BUCKET_ARN_DEV`     | State bucket ARN (OIDC rol policy)                   |
| `TF_VAR_TERRAFORM_REMOTE_STATE_LOCK_TABLE_ARN_DEV` | Lock tablosu ARN                                     |
| `TF_VAR_TERRAFORM_STATE_KMS_KEY_ARN_DEV`           | Opsiyonel; boş bırakılabilir                         |

Staging/prod apply workflow’ları için aynı desenle `*_STAGING` / `*_PROD` secret’ları tanımlanır.

## WAF + CloudFront

WAFv2 **CLOUDFRONT** kapsamı kaynakları **us-east-1** provider alias’ı ile oluşturulur; dağıtım kök provider bölgesinde kalır.
