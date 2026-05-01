variable "environment" {
  type = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "kms_key_arn" {
  type = string
}

variable "project_name" {
  type    = string
  default = "lean-management"
}

variable "owner_tag" {
  type    = string
  default = "platform-team"
}

variable "documents_upload_cors_allowed_origins" {
  type        = list(string)
  description = "Web uygulaması origin'leri (presigned PUT ile doğrudan tarayıcı yükleme). Boş liste = CORS kuralı eklenmez (yükleme CORS hatası verir)."
  default     = []
}
