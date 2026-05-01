variable "environment" {
  type    = string
  default = "prod"

  validation {
    condition     = var.environment == "prod"
    error_message = "This stack is pinned to environment=prod."
  }
}

variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.2.0.0/16"
}

variable "single_nat_gateway" {
  type    = bool
  default = false
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM certificate ARN for ALB HTTPS. Prod should be non-empty before go-live; empty forces HTTP-only (not recommended for production traffic)."
  default     = ""
}

variable "github_repository" {
  type        = string
  description = "GitHub repository (org/repo) allowed for OIDC assume role."
}

variable "github_ref_subjects" {
  type        = list(string)
  description = "token.actions.githubusercontent.com:sub suffixes after repo:org/repo:"
  default     = ["ref:refs/heads/main"]
}

variable "terraform_remote_state_bucket_arn" {
  type        = string
  description = "S3 bucket ARN for Terraform state (bootstrap outside this root)."
}

variable "terraform_remote_state_lock_table_arn" {
  type        = string
  description = "DynamoDB table ARN for state locking."
}

variable "terraform_state_kms_key_arn" {
  type        = string
  description = "Optional KMS key ARN encrypting the state bucket; pass empty string if SSE-S3 only."
  default     = ""
}

variable "project_name" {
  type    = string
  default = "lean-management"
}

variable "owner_tag" {
  type    = string
  default = "platform-team"
}

variable "alarm_sns_topic_arn" {
  type        = string
  description = "Optional SNS topic for CloudWatch alarm notifications."
  default     = ""
}

variable "documents_upload_cors_allowed_origins" {
  type        = list(string)
  description = "Tarayıcıdan S3 presigned PUT için CORS. Örn. [\"https://lean.example.com\"]. Boş bırakılırsa yükleme CORS ile başarısız olur."
  default     = []
}
