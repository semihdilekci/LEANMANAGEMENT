data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Owner       = var.owner_tag
  }

  https_enabled = trimspace(var.certificate_arn) != ""
}

resource "aws_security_group" "alb" {
  name        = "leanmgmt-${var.environment}-alb"
  description = local.https_enabled ? "Public ALB — HTTPS + HTTP from internet" : "Public ALB — HTTP only (no ACM yet)"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = local.https_enabled ? [1] : []
    content {
      description = "HTTPS from internet"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  ingress {
    description = local.https_enabled ? "HTTP redirect to HTTPS" : "HTTP to targets"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-alb-sg"
  })
}

resource "aws_lb" "main" {
  name               = "leanmgmt-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-alb"
  })
}

resource "aws_lb_target_group" "ecs" {
  name        = "leanmgmt-${var.environment}-ecs-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-ecs-tg"
  })
}

resource "aws_lb_listener" "https" {
  count = local.https_enabled ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs.arn
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = local.https_enabled ? "redirect" : "forward"

    dynamic "redirect" {
      for_each = local.https_enabled ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }

    dynamic "forward" {
      for_each = local.https_enabled ? [] : [1]
      content {
        target_group {
          arn    = aws_lb_target_group.ecs.arn
          weight = 1
        }
      }
    }
  }
}
