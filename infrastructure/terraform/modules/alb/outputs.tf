output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "alb_zone_id" {
  value = aws_lb.main.zone_id
}

output "target_group_arn" {
  value = aws_lb_target_group.ecs.arn
}

output "security_group_id" {
  value = aws_security_group.alb.id
}

output "alb_arn" {
  value = aws_lb.main.arn
}

output "cloudwatch_dimension_load_balancer" {
  value       = replace(aws_lb.main.arn, "arn:aws:elasticloadbalancing:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:loadbalancer/", "")
  description = "Value for CloudWatch AWS/ApplicationELB dimension LoadBalancer."
}
