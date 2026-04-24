output "vpc_id" {
  value = module.network.vpc_id
}

output "aurora_cluster_endpoint" {
  value = module.database.cluster_endpoint
}

output "aurora_reader_endpoint" {
  value = module.database.reader_endpoint
}

output "redis_primary_endpoint" {
  value = module.cache.primary_endpoint_address
}

output "documents_bucket_id" {
  value = module.documents_bucket.bucket_id
}

output "alb_dns_name" {
  value = module.alb.alb_dns_name
}

output "cloudfront_domain_name" {
  value = module.cloudfront.distribution_domain_name
}

output "github_terraform_role_arn" {
  value = module.github_oidc.terraform_role_arn
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}
