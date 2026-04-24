output "jwt_access_current_arn" {
  value = aws_secretsmanager_secret.jwt_access_current.arn
}

output "jwt_access_previous_arn" {
  value = aws_secretsmanager_secret.jwt_access_previous.arn
}

output "jwt_refresh_current_arn" {
  value = aws_secretsmanager_secret.jwt_refresh_current.arn
}

output "jwt_refresh_previous_arn" {
  value = aws_secretsmanager_secret.jwt_refresh_previous.arn
}

output "app_encryption_arn" {
  value = aws_secretsmanager_secret.app_encryption.arn
}
