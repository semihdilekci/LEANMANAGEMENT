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

variable "public_subnet_ids" {
  type = list(string)
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN (ALB region). Empty = HTTP-only ALB (bootstrap without DNS)."
  default     = ""
}

variable "health_check_path" {
  type    = string
  default = "/"
}

variable "container_port" {
  type    = number
  default = 80
}

variable "project_name" {
  type    = string
  default = "lean-management"
}

variable "owner_tag" {
  type    = string
  default = "platform-team"
}
