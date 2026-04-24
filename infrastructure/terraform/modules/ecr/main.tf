locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Owner       = var.owner_tag
  }

  repos = ["api", "worker", "web"]
}

resource "aws_ecr_repository" "app" {
  for_each = toset(local.repos)

  name                 = "leanmgmt-${var.environment}-${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-ecr-${each.key}"
  })
}
