variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "ecs_tasks_security_group_id" {
  type = string
}

variable "kms_key_arn" {
  type        = string
  description = "KMS key for encrypting the Redis auth token in Secrets Manager."
}

variable "node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "project_name" {
  type    = string
  default = "lean-management"
}

variable "owner_tag" {
  type    = string
  default = "platform-team"
}
