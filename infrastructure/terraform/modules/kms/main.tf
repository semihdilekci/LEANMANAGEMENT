locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Owner       = var.owner_tag
  }
}

resource "aws_kms_key" "database" {
  description             = "leanmgmt-${var.environment} Aurora encryption"
  deletion_window_in_days = var.environment == "prod" ? 30 : 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-kms-db"
  })
}

resource "aws_kms_alias" "database" {
  name          = "alias/leanmgmt-${var.environment}-database"
  target_key_id = aws_kms_key.database.key_id
}

resource "aws_kms_key" "s3" {
  description             = "leanmgmt-${var.environment} S3 documents encryption"
  deletion_window_in_days = var.environment == "prod" ? 30 : 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-kms-s3"
  })
}

resource "aws_kms_alias" "s3" {
  name          = "alias/leanmgmt-${var.environment}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

resource "aws_kms_key" "secrets" {
  description             = "leanmgmt-${var.environment} Secrets Manager encryption"
  deletion_window_in_days = var.environment == "prod" ? 30 : 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-kms-secrets"
  })
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/leanmgmt-${var.environment}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}
