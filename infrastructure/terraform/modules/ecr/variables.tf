variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  type    = string
  default = "lean-management"
}

variable "owner_tag" {
  type    = string
  default = "platform-team"
}
