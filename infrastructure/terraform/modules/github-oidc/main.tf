locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Owner       = var.owner_tag
  }

  region = "eu-central-1"

  # Account-scoped ARN prefixes for Terraform-managed leanmgmt resources (no Resource:"*").
  deploy_resource_arns = [
    "arn:aws:ec2:${local.region}:${var.aws_account_id}:*",
    "arn:aws:elasticloadbalancing:${local.region}:${var.aws_account_id}:loadbalancer/app/*",
    "arn:aws:elasticloadbalancing:${local.region}:${var.aws_account_id}:targetgroup/*",
    "arn:aws:elasticloadbalancing:${local.region}:${var.aws_account_id}:listener/app/*",
    "arn:aws:elasticloadbalancing:${local.region}:${var.aws_account_id}:listener-rule/app/*",
    "arn:aws:rds:${local.region}:${var.aws_account_id}:cluster:*",
    "arn:aws:rds:${local.region}:${var.aws_account_id}:db:*",
    "arn:aws:rds:${local.region}:${var.aws_account_id}:subgrp:*",
    "arn:aws:elasticache:${local.region}:${var.aws_account_id}:replicationgroup:*",
    "arn:aws:elasticache:${local.region}:${var.aws_account_id}:subnetgroup:*",
    "arn:aws:ecs:${local.region}:${var.aws_account_id}:cluster/*",
    "arn:aws:ecs:${local.region}:${var.aws_account_id}:service/*",
    "arn:aws:ecs:${local.region}:${var.aws_account_id}:task-definition/*",
    "arn:aws:ecr:${local.region}:${var.aws_account_id}:repository/*",
    "arn:aws:logs:${local.region}:${var.aws_account_id}:log-group:*",
    "arn:aws:s3:::leanmgmt-*",
    "arn:aws:s3:::leanmgmt-*/*",
    "arn:aws:secretsmanager:${local.region}:${var.aws_account_id}:secret:leanmgmt-*",
    "arn:aws:iam::${var.aws_account_id}:role/leanmgmt-*",
    "arn:aws:iam::${var.aws_account_id}:policy/leanmgmt-*",
    "arn:aws:cloudfront::${var.aws_account_id}:distribution/*",
    "arn:aws:wafv2:us-east-1:${var.aws_account_id}:global/webacl/*",
    "arn:aws:wafv2:us-east-1:${var.aws_account_id}:global/rulegroup/*",
    "arn:aws:wafv2:us-east-1:${var.aws_account_id}:global/ipset/*",
    "arn:aws:cloudwatch:${local.region}:${var.aws_account_id}:alarm:*",
  ]
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = var.github_oidc_thumbprints

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-github-oidc"
  })
}

data "aws_iam_policy_document" "assume" {
  statement {
    effect = "Allow"
    actions = [
      "sts:AssumeRoleWithWebIdentity",
    ]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [for p in var.github_ref_subjects : "repo:${var.github_repository}:${p}"]
    }
  }
}

resource "aws_iam_role" "github_terraform" {
  name               = "leanmgmt-${var.environment}-github-terraform"
  assume_role_policy = data.aws_iam_policy_document.assume.json

  tags = merge(local.common_tags, {
    Name = "leanmgmt-${var.environment}-github-terraform-role"
  })
}

data "aws_iam_policy_document" "terraform_deploy" {
  statement {
    sid    = "TerraformRemoteState"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:GetBucketVersioning",
      "s3:GetBucketLocation",
      "s3:GetBucketEncryption",
    ]
    resources = [var.terraform_state_bucket_arn]
  }

  statement {
    sid    = "TerraformRemoteStateObjects"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${var.terraform_state_bucket_arn}/*"]
  }

  statement {
    sid    = "TerraformStateLock"
    effect = "Allow"
    actions = [
      "dynamodb:DescribeTable",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
    ]
    resources = [var.terraform_locks_table_arn]
  }

  statement {
    sid    = "TerraformKms"
    effect = "Allow"
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:GenerateDataKey",
      "kms:CreateGrant",
      "kms:ReEncrypt*",
    ]
    resources = var.kms_key_arns
  }

  statement {
    sid    = "LeanMgmtTerraformResources"
    effect = "Allow"
    actions = [
      "ec2:*",
      "elasticloadbalancing:*",
      "rds:*",
      "elasticache:*",
      "ecs:*",
      "ecr:*",
      "logs:*",
      "s3:*",
      "secretsmanager:*",
      "iam:GetRole",
      "iam:PassRole",
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:CreatePolicy",
      "iam:DeletePolicy",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:ListPolicyVersions",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:TagPolicy",
      "iam:UntagPolicy",
      "cloudfront:*",
      "wafv2:*",
      "cloudwatch:*",
      "application-autoscaling:*",
      "servicediscovery:*",
    ]
    resources = local.deploy_resource_arns
  }

  statement {
    sid    = "IamListForTerraform"
    effect = "Allow"
    actions = [
      "iam:ListRoles",
      "iam:ListPolicies",
      "iam:GetRolePolicy",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
    ]
    resources = ["arn:aws:iam::${var.aws_account_id}:role/*"]
  }
}

resource "aws_iam_role_policy" "github_terraform_inline" {
  name   = "leanmgmt-${var.environment}-terraform-inline"
  role   = aws_iam_role.github_terraform.id
  policy = data.aws_iam_policy_document.terraform_deploy.json
}
