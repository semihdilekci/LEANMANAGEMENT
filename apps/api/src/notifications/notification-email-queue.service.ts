import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

import type { Env } from '../config/env.schema.js';

export type NotificationEmailJobPayload = {
  notificationId: string;
};

@Injectable()
export class NotificationEmailQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationEmailQueueService.name);
  private readonly connection: Redis;
  private readonly queue: Queue<NotificationEmailJobPayload>;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {
    const redisUrl = this.config.get('REDIS_URL', { infer: true });
    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    const name = this.config.get('NOTIFICATION_EMAIL_QUEUE_NAME', { infer: true });
    this.queue = new Queue<NotificationEmailJobPayload>(name, {
      connection: this.connection,
    });
  }

  async enqueueEmail(notificationId: string): Promise<void> {
    await this.queue.add(
      'send-notification-email',
      { notificationId },
      {
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    this.logger.log({ event: 'notification_email_enqueued', notificationId });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
