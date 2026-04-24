output "primary_endpoint_address" {
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  description = "Primary Redis endpoint (use TLS)."
}

output "reader_endpoint_address" {
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
  description = "Reader endpoint when replicas exist."
}

output "redis_auth_secret_arn" {
  value       = aws_secretsmanager_secret.redis_auth.arn
  description = "Secrets Manager ARN for AUTH token."
}
