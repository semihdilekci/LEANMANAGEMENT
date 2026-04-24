locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Owner       = var.owner_tag
  }

  container_name = "app"
}

data "aws_region" "current" {}

resource "aws_iam_role" "execution" {
  name = "leanmgmt-${var.environment}-${var.service_name}-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-${var.service_name}-exec-role"
  })
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name = "leanmgmt-${var.environment}-${var.service_name}-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-${var.service_name}-task-role"
  })
}

data "aws_iam_policy_document" "task" {
  dynamic "statement" {
    for_each = length(var.secret_arns_for_task_role) > 0 ? [1] : []
    content {
      sid    = "SecretsRead"
      effect = "Allow"
      actions = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
      ]
      resources = var.secret_arns_for_task_role
    }
  }

  dynamic "statement" {
    for_each = var.s3_bucket_arn != "" ? [1] : []
    content {
      sid    = "DocumentsS3"
      effect = "Allow"
      actions = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
      ]
      resources = ["${var.s3_bucket_arn}/*"]
    }
  }

  dynamic "statement" {
    for_each = length(var.kms_key_arns_for_task) > 0 ? [1] : []
    content {
      sid    = "KmsForAppData"
      effect = "Allow"
      actions = [
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:GenerateDataKey",
      ]
      resources = var.kms_key_arns_for_task
    }
  }
}

resource "aws_iam_role_policy" "task_inline" {
  count = (
    length(var.secret_arns_for_task_role) > 0 ||
    var.s3_bucket_arn != "" ||
    length(var.kms_key_arns_for_task) > 0
  ) ? 1 : 0

  name   = "leanmgmt-${var.environment}-${var.service_name}-task-inline"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

resource "aws_ecs_task_definition" "main" {
  family                   = "leanmgmt-${var.environment}-${var.service_name}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = local.container_name
    image     = var.container_image
    essential = true
    portMappings = [{
      containerPort = var.container_port
      protocol      = "tcp"
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = var.log_group_name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = var.service_name
      }
    }
  }])

  tags = local.common_tags
}

resource "aws_ecs_service" "main" {
  name            = "leanmgmt-${var.environment}-${var.service_name}"
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = var.ecs_security_group_ids
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = local.container_name
    container_port   = var.container_port
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-ecs-${var.service_name}"
  })
}
