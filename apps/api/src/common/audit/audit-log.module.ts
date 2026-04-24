import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuditLogService } from './audit-log.service.js';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
