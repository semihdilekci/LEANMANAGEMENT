output "terraform_role_arn" {
  value       = aws_iam_role.github_terraform.arn
  description = "Assume from GitHub Actions (configure-aws-credentials role-to-assume)."
}

output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.github.arn
}
