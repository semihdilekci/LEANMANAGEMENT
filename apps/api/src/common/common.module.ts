import { Global, Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { AuditLogModule } from './audit/audit-log.module.js';
import { EncryptionService } from './encryption/encryption.service.js';
import { PermissionGuard } from './guards/permission.guard.js';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, AuditLogModule, forwardRef(() => RolesModule)],
  providers: [EncryptionService, PermissionGuard],
  exports: [EncryptionService, PermissionGuard],
})
export class CommonModule {}
