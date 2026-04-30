import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { AdminSummaryController } from './admin-summary.controller.js';
import { AdminSummaryService } from './admin-summary.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AdminSummaryController],
  providers: [AdminSummaryService],
})
export class AdminSummaryModule {}
