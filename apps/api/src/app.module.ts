import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module.js';
import { ConsentGuard } from './auth/guards/consent.guard.js';
import { CsrfGuard } from './auth/guards/csrf.guard.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { CommonModule } from './common/common.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { PermissionGuard } from './common/guards/permission.guard.js';
import { AuditInterceptor } from './common/interceptors/audit.interceptor.js';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js';
import { validateEnv } from './config/env.schema.js';
import { ConsentVersionsModule } from './consent-versions/consent-versions.module.js';
import { AdminSummaryModule } from './admin-summary/admin-summary.module.js';
import { AuditLogsModule } from './audit-logs/audit-logs.module.js';
import { EmailTemplatesModule } from './email-templates/email-templates.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { MasterDataModule } from './master-data/master-data.module.js';
import { SystemSettingsModule } from './system-settings/system-settings.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ProcessesModule } from './processes/processes.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: false }),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (cfg: Record<string, unknown>) => validateEnv(cfg),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 600 }],
    }),
    PrismaModule,
    RedisModule,
    CommonModule,
    HealthModule,
    AuthModule,
    ConsentVersionsModule,
    UsersModule,
    MasterDataModule,
    ProcessesModule,
    TasksModule,
    NotificationsModule,
    EmailTemplatesModule,
    SystemSettingsModule,
    AdminSummaryModule,
    AuditLogsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: ConsentGuard },
  ],
})
export class AppModule {}
