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
  type        = string
  description = "Ingress to PostgreSQL only from this SG."
}

variable "kms_key_arn" {
  type = string
}

variable "instance_class" {
  type    = string
  default = "db.t4g.medium"
}

variable "backup_retention_days" {
  type    = number
  default = 7
}

variable "project_name" {
  type    = string
  default = "lean-management"
}

variable "owner_tag" {
  type    = string
  default = "platform-team"
}
