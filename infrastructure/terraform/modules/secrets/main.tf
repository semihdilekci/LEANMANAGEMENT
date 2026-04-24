locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Owner       = var.owner_tag
  }
}

resource "aws_secretsmanager_secret" "jwt_access_current" {
  name        = "leanmgmt-${var.environment}/jwt-access-secret-current"
  description = "JWT access signing secret (current)"
  kms_key_id  = var.kms_key_arn

  tags = merge(local.common_tags, { Name = "leanmgmt-${var.environment}-jwt-access-current" })
}

resource "aws_secretsmanager_secret" "jwt_access_previous" {
  name        = "leanmgmt-${var.environment}/jwt-access-secret-previous"
  description = "JWT access signing secret (previous rotation)"
  kms_key_id  = var.kms_key_arn

  tags = merge(local.common_tags, { Name = "leanmgmt-${var.environment}-jwt-access-previous" })
}

resource "aws_secretsmanager_secret" "jwt_refresh_current" {
  name        = "leanmgmt-${var.environment}/jwt-refresh-secret-current"
  description = "JWT refresh signing secret (current)"
  kms_key_id  = var.kms_key_arn

  tags = merge(local.common_tags, { Name = "leanmgmt-${var.environment}-jwt-refresh-current" })
}

resource "aws_secretsmanager_secret" "jwt_refresh_previous" {
  name        = "leanmgmt-${var.environment}/jwt-refresh-secret-previous"
  description = "JWT refresh signing secret (previous rotation)"
  kms_key_id  = var.kms_key_arn

  tags = merge(local.common_tags, { Name = "leanmgmt-${var.environment}-jwt-refresh-previous" })
}

resource "aws_secretsmanager_secret" "app_encryption" {
  name        = "leanmgmt-${var.environment}/app-encryption-key"
  description = "Application-level encryption key material (PII field encryption bootstrap)"
  kms_key_id  = var.kms_key_arn

  tags = merge(local.common_tags, { Name = "leanmgmt-${var.environment}-app-encryption" })
}
