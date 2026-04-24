locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Owner       = var.owner_tag
  }

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []
}

resource "aws_cloudwatch_metric_alarm" "alb_http_5xx" {
  alarm_name          = "leanmgmt-${var.environment}-alb-5xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"
  alarm_description   = "ALB target 5xx spike"
  alarm_actions       = local.alarm_actions

  dimensions = {
    LoadBalancer = var.alb_dimension_value
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "leanmgmt-${var.environment}-aurora-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  alarm_description   = "Aurora cluster CPU high"
  alarm_actions       = local.alarm_actions

  dimensions = {
    DBClusterIdentifier = var.rds_cluster_id
  }

  tags = local.common_tags
}
