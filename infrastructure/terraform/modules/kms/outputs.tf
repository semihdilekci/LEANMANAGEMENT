output "database_key_arn" {
  value = aws_kms_key.database.arn
}

output "database_key_id" {
  value = aws_kms_key.database.id
}

output "s3_key_arn" {
  value = aws_kms_key.s3.arn
}

output "secrets_key_arn" {
  value = aws_kms_key.secrets.arn
}
