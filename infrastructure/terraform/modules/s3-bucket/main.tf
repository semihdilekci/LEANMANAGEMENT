locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Owner       = var.owner_tag
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "documents" {
  bucket = "leanmgmt-${var.environment}-documents-${random_id.bucket_suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-documents"
  })
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Tarayıcıdan presigned PUT — CORS yoksa fetch() "failed to fetch" (preflight) ile düşer.
resource "aws_s3_bucket_cors_configuration" "documents" {
  count  = length(var.documents_upload_cors_allowed_origins) > 0 ? 1 : 0
  bucket = aws_s3_bucket.documents.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "HEAD", "GET"]
    allowed_origins = var.documents_upload_cors_allowed_origins
    expose_headers  = ["ETag", "x-amz-request-id"]
    max_age_seconds = 3000
  }
}
