locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Owner       = var.owner_tag
  }
}

resource "random_password" "redis_auth" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "redis_auth" {
  name        = "leanmgmt-${var.environment}/redis-auth-token"
  description = "ElastiCache Redis AUTH token"
  kms_key_id  = var.kms_key_arn

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-redis-auth-secret"
  })
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id     = aws_secretsmanager_secret.redis_auth.id
  secret_string = random_password.redis_auth.result
}

resource "aws_security_group" "redis" {
  name        = "leanmgmt-${var.environment}-redis"
  description = "Redis — only from ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis TLS from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.ecs_tasks_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-redis-sg"
  })
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "leanmgmt-${var.environment}-redis-subnets"
  subnet_ids = var.private_subnet_ids

  tags = local.common_tags
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "leanmgmt-${var.environment}-redis"
  description          = "Redis for leanmgmt ${var.environment}"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.node_type
  port                 = 6379
  parameter_group_name = "default.redis7"

  num_cache_clusters         = var.environment == "prod" ? 2 : 1
  automatic_failover_enabled = var.environment == "prod"
  multi_az_enabled           = var.environment == "prod"

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth.result

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-redis"
  })
}
