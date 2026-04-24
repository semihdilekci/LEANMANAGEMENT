variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "alb_dns_name" {
  type = string
}

variable "alb_origin_https" {
  type        = bool
  description = "If true, CloudFront uses HTTPS to the ALB origin (requires ACM on ALB). If false, HTTP-only (bootstrap without DNS)."
  default     = true
}

variable "web_acl_arn" {
  type        = string
  description = "WAFv2 web ACL ARN (CLOUDFRONT scope, us-east-1)."
}

variable "project_name" {
  type    = string
  default = "lean-management"
}

variable "owner_tag" {
  type    = string
  default = "platform-team"
}
