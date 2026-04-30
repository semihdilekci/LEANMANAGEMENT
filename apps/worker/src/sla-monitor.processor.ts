import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import type { PrismaClient } from '@leanmgmt/prisma-client';

import { runSlaMonitorPipeline, type SlaMonitorPipelineDeps } from './sla-monitor.pipeline.js';

export type SlaMonitorJobData = Record<string, never>;

function buildEmailEnqueue(connection: Redis, emailQueueName: string) {
  const emailQueue = new Queue<{ notificationId: string }>(emailQueueName, { connection });
  return {
    enqueue: async (notificationId: string): Promise<void> => {
      await emailQueue.add(
        'send-notification-email',
        { notificationId },
        {
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    },
    closeEmailQueue: async () => {
      await emailQueue.close();
    },
  };
}

/**
 * `sla-monitor` kuyruğu — 5 dk’da bir `check-task-sla` (docs/04_BACKEND_SPEC §11.2).
 */
export async function startSlaMonitorWorker(prisma: PrismaClient): Promise<() => Promise<void>> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('REDIS_URL yok — sla-monitor worker başlatılmadı');
    return async () => undefined;
  }

  const slaQueueName = process.env.SLA_MONITOR_QUEUE_NAME ?? 'sla-monitor';
  const emailQueueName = process.env.NOTIFICATION_EMAIL_QUEUE_NAME ?? 'notification-email-outbound';

  const workerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const producerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const emailProducerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  const { enqueue, closeEmailQueue } = buildEmailEnqueue(emailProducerConnection, emailQueueName);
  const deps: SlaMonitorPipelineDeps = {
    enqueueNotificationEmail: enqueue,
  };

  const slaQueue = new Queue<SlaMonitorJobData>(slaQueueName, { connection: producerConnection });
  await slaQueue.add('check-task-sla', {}, { repeat: { every: 300_000 } });

  const worker = new Worker<SlaMonitorJobData>(
    slaQueueName,
    async () => {
      await runSlaMonitorPipeline(prisma, deps);
    },
    { connection: workerConnection },
  );

  return async () => {
    await worker.close();
    await slaQueue.close();
    await closeEmailQueue();
    await workerConnection.quit();
    await producerConnection.quit();
    await emailProducerConnection.quit();
  };
}
