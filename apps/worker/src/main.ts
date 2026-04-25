import 'reflect-metadata';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@leanmgmt/prisma-client';

import { startDocumentScanWorker } from './document-scan.processor.js';
import { startNotificationDigestAndCleanup } from './notification-digest-cleanup.js';
import { startNotificationEmailWorker } from './notification-email.processor.js';
import { startSlaOverdueWorker } from './sla-overdue.worker.js';

async function bootstrap(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL zorunlu');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const stopDocumentScan = await startDocumentScanWorker(prisma);
  const stopSla = await startSlaOverdueWorker(prisma);
  const stopNotificationEmail = await startNotificationEmailWorker(prisma);
  const stopDigestCleanup = startNotificationDigestAndCleanup(prisma);

  const shutdown = async (): Promise<void> => {
    await stopDocumentScan();
    await stopSla();
    await stopNotificationEmail();
    await stopDigestCleanup();
    await prisma.$disconnect();
  };

  process.on('SIGTERM', () => {
    void shutdown().then(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    void shutdown().then(() => process.exit(0));
  });

  console.log(
    'Document scan worker dinleniyor:',
    process.env.DOCUMENT_SCAN_QUEUE_NAME ?? 'document-virus-scan',
  );

  console.log('SLA worker dinleniyor:', process.env.SLA_OVERDUE_QUEUE_NAME ?? 'sla-overdue');

  console.log(
    'Bildirim e-posta worker:',
    process.env.NOTIFICATION_EMAIL_QUEUE_NAME ?? 'notification-email-outbound',
  );
}

void bootstrap();
