variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "alb_dimension_value" {
  type        = string
  description = "CloudWatch dimension LoadBalancer value (from ALB module output)."
}

variable "rds_cluster_id" {
  type = string
}

variable "sns_topic_arn" {
  type        = string
  description = "Optional SNS topic for alarm actions; leave empty for no actions."
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
