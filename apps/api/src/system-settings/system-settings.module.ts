import { Module } from '@nestjs/common';

import { AuditLogModule } from '../common/audit/audit-log.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';

import { SystemSettingsController } from './system-settings.controller.js';
import { SystemSettingsService } from './system-settings.service.js';

@Module({
  imports: [PrismaModule, RedisModule, AuditLogModule],
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
