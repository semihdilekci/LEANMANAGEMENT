import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

import type { Env } from '../config/env.schema.js';

export type DocumentScanJobPayload = {
  documentId: string;
};

@Injectable()
export class DocumentScanQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(DocumentScanQueueService.name);
  private readonly connection: Redis;
  private readonly queue: Queue<DocumentScanJobPayload>;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {
    const redisUrl = this.config.get('REDIS_URL', { infer: true });
    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    const name = this.config.get('DOCUMENT_SCAN_QUEUE_NAME', { infer: true });
    this.queue = new Queue<DocumentScanJobPayload>(name, {
      connection: this.connection,
    });
  }

  async enqueueScan(documentId: string): Promise<void> {
    await this.queue.add(
      'scan',
      { documentId },
      {
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    this.logger.log({ event: 'document_scan_enqueued', documentId });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
