import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';

import { DocumentScanQueueService } from './document-scan-queue.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentScanQueueService],
  exports: [DocumentsService, DocumentScanQueueService],
})
export class DocumentsModule {}
