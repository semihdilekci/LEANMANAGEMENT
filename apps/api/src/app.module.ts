import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';

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
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { MasterDataModule } from './master-data/master-data.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: false }),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (cfg: Record<string, unknown>) => validateEnv(cfg),
    }),
    PrismaModule,
    RedisModule,
    CommonModule,
    HealthModule,
    AuthModule,
    ConsentVersionsModule,
    UsersModule,
    MasterDataModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: ConsentGuard },
  ],
})
export class AppModule {}
