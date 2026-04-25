import { type PrismaClient } from '@leanmgmt/prisma-client';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

import { runSlaOverdueScan } from './sla-overdue.js';

const QUEUE_NAME = process.env.SLA_OVERDUE_QUEUE_NAME ?? 'sla-overdue';

const FIVE_MIN_MS = 5 * 60_000;

/**
 * BullMQ worker: kuyruğa düşen "scan" job’larını işler.
 * Zamanlama: 5 dakikada bir aynı process yeni job ekler (Faz 6, docs/01 SLA izleme).
 */
export async function startSlaOverdueWorker(prisma: PrismaClient): Promise<() => Promise<void>> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('REDIS_URL yok — SLA taraması çalışmayacak');
    return async () => undefined;
  }
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const q = new Queue(QUEUE_NAME, { connection });
  const w = new Worker(QUEUE_NAME, () => runSlaOverdueScan(prisma), { connection });

  const add = (): void => {
    void q.add('scan', {});
  };
  add();
  const interval = setInterval(add, FIVE_MIN_MS);

  return async () => {
    clearInterval(interval);
    await w.close();
    await q.close();
    await connection.quit();
  };
}
