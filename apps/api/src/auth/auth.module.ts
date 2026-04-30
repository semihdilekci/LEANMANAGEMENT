import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { CommonModule } from '../common/common.module.js';
import type { Env } from '../config/env.schema.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { RolesModule } from '../roles/roles.module.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OidcGoogleAuthService } from './oidc-google-auth.service.js';
import { ConsentPolicyService } from './consent-policy.service.js';
import { ConsentGuard } from './guards/consent.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    CommonModule,
    RolesModule,
    NotificationsModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET_CURRENT', { infer: true }),
        signOptions: { algorithm: 'HS256' as const, expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OidcGoogleAuthService,
    ConsentPolicyService,
    JwtAuthGuard,
    CsrfGuard,
    ConsentGuard,
  ],
  exports: [AuthService, ConsentPolicyService, JwtModule, JwtAuthGuard, CsrfGuard, ConsentGuard],
})
export class AuthModule {}
