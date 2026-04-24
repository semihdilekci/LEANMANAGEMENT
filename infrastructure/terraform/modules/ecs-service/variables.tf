variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "service_name" {
  type        = string
  description = "Short ECS service name suffix."
  default     = "skeleton"
}

variable "cluster_arn" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "ecs_security_group_ids" {
  type        = list(string)
  description = "Security groups attached to the task ENI."
}

variable "target_group_arn" {
  type = string
}

variable "container_image" {
  type    = string
  default = "public.ecr.aws/docker/library/nginx:alpine"
}

variable "container_port" {
  type    = number
  default = 80
}

variable "cpu" {
  type    = number
  default = 256
}

variable "memory" {
  type    = number
  default = 512
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "log_group_name" {
  type = string
}

variable "secret_arns_for_task_role" {
  type        = list(string)
  description = "Secrets Manager ARNs the application task may read."
  default     = []
}

variable "s3_bucket_arn" {
  type        = string
  description = "Documents bucket ARN for object-level IAM."
  default     = ""
}

variable "kms_key_arns_for_task" {
  type        = list(string)
  description = "KMS CMK ARNs for Decrypt/GenerateDataKey (secrets + S3)."
  default     = []
}

variable "project_name" {
  type    = string
  default = "lean-management"
}

variable "owner_tag" {
  type    = string
  default = "platform-team"
}
