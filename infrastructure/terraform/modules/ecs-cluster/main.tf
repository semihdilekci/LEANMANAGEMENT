locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Owner       = var.owner_tag
  }
}

resource "aws_ecs_cluster" "main" {
  name = "leanmgmt-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = var.environment == "dev" ? "disabled" : "enabled"
  }

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-ecs-cluster"
  })
}

resource "aws_cloudwatch_log_group" "skeleton" {
  name              = "/ecs/leanmgmt-${var.environment}/skeleton"
  retention_in_days = var.environment == "prod" ? 90 : 14

  tags = local.common_tags
}
