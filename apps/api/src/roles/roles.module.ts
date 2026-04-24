import { Global, Module } from '@nestjs/common';

import { AuditLogModule } from '../common/audit/audit-log.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';

import { AttributeRuleEvaluatorService } from './attribute-rule-evaluator.service.js';
import { PermissionsMetadataController } from './permissions-metadata.controller.js';
import { RoleCacheInvalidationListener } from './role-cache-invalidation.listener.js';
import { RolePermissionManagementService } from './role-permission-management.service.js';
import { PermissionResolverService } from './permission-resolver.service.js';
import { RoleRulesService } from './role-rules.service.js';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';

@Global()
@Module({
  imports: [PrismaModule, RedisModule, AuditLogModule],
  controllers: [RolesController, PermissionsMetadataController],
  providers: [
    AttributeRuleEvaluatorService,
    PermissionResolverService,
    RoleCacheInvalidationListener,
    RolePermissionManagementService,
    RoleRulesService,
    RolesService,
  ],
  exports: [
    AttributeRuleEvaluatorService,
    PermissionResolverService,
    RolePermissionManagementService,
    RoleRulesService,
    RolesService,
  ],
})
export class RolesModule {}
