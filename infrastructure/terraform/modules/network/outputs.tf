output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC identifier."
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "Public subnet IDs (ALB, NAT)."
}

output "private_subnet_ids" {
  value       = aws_subnet.private[*].id
  description = "Private subnet IDs (ECS, RDS, Redis)."
}

output "ecs_tasks_security_group_id" {
  value       = aws_security_group.ecs_tasks.id
  description = "Security group for ECS tasks — RDS/Redis ingress source."
}
