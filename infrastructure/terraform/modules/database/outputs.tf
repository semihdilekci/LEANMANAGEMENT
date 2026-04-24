output "cluster_endpoint" {
  value       = aws_rds_cluster.main.endpoint
  description = "Writer endpoint."
}

output "reader_endpoint" {
  value       = aws_rds_cluster.main.reader_endpoint
  description = "Reader endpoint."
}

output "cluster_identifier" {
  value = aws_rds_cluster.main.id
}

output "database_security_group_id" {
  value = aws_security_group.database.id
}

output "master_user_secret_arn" {
  value       = length(aws_rds_cluster.main.master_user_secret) > 0 ? aws_rds_cluster.main.master_user_secret[0].secret_arn : null
  description = "Secrets Manager ARN for master password when manage_master_user_password is true."
}
