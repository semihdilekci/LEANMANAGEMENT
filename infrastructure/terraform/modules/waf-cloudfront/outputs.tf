output "web_acl_arn" {
  value       = aws_wafv2_web_acl.cloudfront.arn
  description = "Associate with CloudFront distribution (WAFv2 CLOUDFRONT scope, us-east-1)."
}
