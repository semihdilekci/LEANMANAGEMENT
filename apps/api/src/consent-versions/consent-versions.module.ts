import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AuthModule } from '../auth/auth.module.js';
import { CommonModule } from '../common/common.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { AdminConsentVersionsController } from './admin-consent-versions.controller.js';
import { ConsentVersionsController } from './consent-versions.controller.js';
import { ConsentVersionsService } from './consent-versions.service.js';

@Module({
  imports: [EventEmitterModule, PrismaModule, CommonModule, AuthModule],
  controllers: [ConsentVersionsController, AdminConsentVersionsController],
  providers: [ConsentVersionsService],
})
export class ConsentVersionsModule {}
