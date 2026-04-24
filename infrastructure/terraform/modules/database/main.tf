locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Owner       = var.owner_tag
  }
}

resource "aws_security_group" "database" {
  name        = "leanmgmt-${var.environment}-aurora"
  description = "Aurora PostgreSQL — only from ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.ecs_tasks_security_group_id]
  }

  egress {
    description = "No outbound required for RDS"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-aurora-sg"
  })
}

resource "aws_db_subnet_group" "main" {
  name       = "leanmgmt-${var.environment}-aurora"
  subnet_ids = var.private_subnet_ids

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-aurora-subnets"
  })
}

resource "aws_rds_cluster" "main" {
  cluster_identifier = "leanmgmt-${var.environment}-aurora"

  engine         = "aurora-postgresql"
  engine_version = "16.4"

  database_name               = "leanmgmt"
  master_username             = "leanmgmt_admin"
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]

  storage_encrypted = true
  kms_key_id        = var.kms_key_arn

  backup_retention_period      = var.backup_retention_days
  preferred_backup_window      = "02:00-03:00"
  preferred_maintenance_window = "sun:03:00-sun:05:00"

  deletion_protection       = var.environment == "prod"
  skip_final_snapshot       = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "leanmgmt-prod-aurora-final" : null

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-aurora-cluster"
  })
}

resource "aws_rds_cluster_instance" "writer" {
  identifier         = "leanmgmt-${var.environment}-aurora-1"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = var.instance_class
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version

  performance_insights_enabled = var.environment != "dev"

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-aurora-instance-1"
  })
}

resource "aws_rds_cluster_instance" "reader" {
  count = var.environment == "prod" ? 1 : 0

  identifier         = "leanmgmt-${var.environment}-aurora-2"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = var.instance_class
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version

  performance_insights_enabled = true

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-aurora-instance-2"
  })
}
