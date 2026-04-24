import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CommonModule } from '../common/common.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { ConsentVersionsController } from './consent-versions.controller.js';
import { ConsentVersionsService } from './consent-versions.service.js';

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  controllers: [ConsentVersionsController],
  providers: [ConsentVersionsService],
})
export class ConsentVersionsModule {}
