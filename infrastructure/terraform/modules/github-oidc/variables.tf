variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "github_repository" {
  type        = string
  description = "GitHub repo in org/name form (e.g. holding/lean-management)."
}

variable "github_oidc_thumbprints" {
  type        = list(string)
  description = "GitHub Actions OIDC intermediate certificate thumbprints."
  default     = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

variable "github_ref_subjects" {
  type        = list(string)
  description = "Subject suffix after repo:org/repo: (e.g. ref:refs/heads/main, environment:production)."
  default     = ["ref:refs/heads/main"]
}

variable "aws_account_id" {
  type = string
}

variable "terraform_state_bucket_arn" {
  type = string
}

variable "terraform_locks_table_arn" {
  type = string
}

variable "kms_key_arns" {
  type        = list(string)
  description = "KMS keys Terraform may use (state + workload CMKs)."
}

variable "project_name" {
  type    = string
  default = "lean-management"
}

variable "owner_tag" {
  type    = string
  default = "platform-team"
}
