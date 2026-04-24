variable "environment" {
  type        = string
  description = "dev | staging | prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "VPC IPv4 CIDR block (unique per AWS account for isolation)."
}

variable "az_count" {
  type        = number
  description = "Number of availability zones to use (max 3)."
  default     = 3

  validation {
    condition     = var.az_count >= 1 && var.az_count <= 3
    error_message = "az_count must be between 1 and 3."
  }
}

variable "single_nat_gateway" {
  type        = bool
  description = "If true, one NAT gateway in the first public subnet (lower cost for dev)."
  default     = true
}

variable "project_name" {
  type        = string
  description = "Short project tag value."
  default     = "lean-management"
}

variable "owner_tag" {
  type        = string
  description = "Owner tag for governance."
  default     = "platform-team"
}
