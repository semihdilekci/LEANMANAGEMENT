data "aws_caller_identity" "current" {}

module "network" {
  source = "../../modules/network"

  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  single_nat_gateway = var.single_nat_gateway
  project_name       = var.project_name
  owner_tag          = var.owner_tag
}

module "kms" {
  source = "../../modules/kms"

  environment  = var.environment
  project_name = var.project_name
  owner_tag    = var.owner_tag
}

module "secrets" {
  source = "../../modules/secrets"

  environment  = var.environment
  kms_key_arn  = module.kms.secrets_key_arn
  project_name = var.project_name
  owner_tag    = var.owner_tag
}

module "documents_bucket" {
  source = "../../modules/s3-bucket"

  environment                             = var.environment
  kms_key_arn                             = module.kms.s3_key_arn
  project_name                            = var.project_name
  owner_tag                               = var.owner_tag
  documents_upload_cors_allowed_origins   = var.documents_upload_cors_allowed_origins
}

module "database" {
  source = "../../modules/database"

  environment                 = var.environment
  vpc_id                      = module.network.vpc_id
  private_subnet_ids          = module.network.private_subnet_ids
  ecs_tasks_security_group_id = module.network.ecs_tasks_security_group_id
  kms_key_arn                 = module.kms.database_key_arn
  project_name                = var.project_name
  owner_tag                   = var.owner_tag
}

module "cache" {
  source = "../../modules/cache"

  environment                 = var.environment
  vpc_id                      = module.network.vpc_id
  private_subnet_ids          = module.network.private_subnet_ids
  ecs_tasks_security_group_id = module.network.ecs_tasks_security_group_id
  kms_key_arn                 = module.kms.secrets_key_arn
  project_name                = var.project_name
  owner_tag                   = var.owner_tag
}

module "ecr" {
  source = "../../modules/ecr"

  environment  = var.environment
  project_name = var.project_name
  owner_tag    = var.owner_tag
}

module "ecs_cluster" {
  source = "../../modules/ecs-cluster"

  environment  = var.environment
  project_name = var.project_name
  owner_tag    = var.owner_tag
}

module "alb" {
  source = "../../modules/alb"

  environment       = var.environment
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  certificate_arn   = var.acm_certificate_arn
  project_name      = var.project_name
  owner_tag         = var.owner_tag
}

resource "aws_security_group_rule" "ecs_tasks_from_alb" {
  type                     = "ingress"
  security_group_id        = module.network.ecs_tasks_security_group_id
  from_port                = 80
  to_port                  = 80
  protocol                 = "tcp"
  source_security_group_id = module.alb.security_group_id
  description              = "Allow ALB to reach the skeleton task on port 80"
}

module "ecs_skeleton" {
  source = "../../modules/ecs-service"

  environment            = var.environment
  service_name           = "skeleton"
  cluster_arn            = module.ecs_cluster.cluster_arn
  vpc_id                 = module.network.vpc_id
  private_subnet_ids     = module.network.private_subnet_ids
  ecs_security_group_ids = [module.network.ecs_tasks_security_group_id]
  target_group_arn       = module.alb.target_group_arn
  log_group_name         = module.ecs_cluster.skeleton_log_group_name
  container_port         = 80
  desired_count          = 1

  secret_arns_for_task_role = concat(
    [
      module.secrets.jwt_access_current_arn,
      module.secrets.jwt_access_previous_arn,
      module.secrets.jwt_refresh_current_arn,
      module.secrets.jwt_refresh_previous_arn,
      module.secrets.app_encryption_arn,
      module.cache.redis_auth_secret_arn,
    ],
    module.database.master_user_secret_arn != null ? [module.database.master_user_secret_arn] : [],
  )

  s3_bucket_arn = module.documents_bucket.bucket_arn

  kms_key_arns_for_task = compact([
    module.kms.database_key_arn,
    module.kms.secrets_key_arn,
    module.kms.s3_key_arn,
  ])

  project_name = var.project_name
  owner_tag    = var.owner_tag

  depends_on = [
    aws_security_group_rule.ecs_tasks_from_alb,
    module.alb,
  ]
}

module "waf_cloudfront" {
  source = "../../modules/waf-cloudfront"
  providers = {
    aws = aws.us_east_1
  }

  environment  = var.environment
  project_name = var.project_name
  owner_tag    = var.owner_tag
}

module "cloudfront" {
  source = "../../modules/cloudfront"

  environment      = var.environment
  alb_dns_name     = module.alb.alb_dns_name
  alb_origin_https = trimspace(var.acm_certificate_arn) != ""
  web_acl_arn      = module.waf_cloudfront.web_acl_arn
  project_name     = var.project_name
  owner_tag        = var.owner_tag
}

module "cloudwatch_alarms" {
  source = "../../modules/cloudwatch-alarms"

  environment         = var.environment
  alb_dimension_value = module.alb.cloudwatch_dimension_load_balancer
  rds_cluster_id      = module.database.cluster_identifier
  sns_topic_arn       = var.alarm_sns_topic_arn
  project_name        = var.project_name
  owner_tag           = var.owner_tag
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  environment                = var.environment
  github_repository          = var.github_repository
  github_ref_subjects        = var.github_ref_subjects
  aws_account_id             = data.aws_caller_identity.current.account_id
  terraform_state_bucket_arn = var.terraform_remote_state_bucket_arn
  terraform_locks_table_arn  = var.terraform_remote_state_lock_table_arn
  kms_key_arns = compact(concat(
    [
      module.kms.database_key_arn,
      module.kms.s3_key_arn,
      module.kms.secrets_key_arn,
    ],
    var.terraform_state_kms_key_arn != "" ? [var.terraform_state_kms_key_arn] : [],
  ))
  project_name = var.project_name
  owner_tag    = var.owner_tag
}
