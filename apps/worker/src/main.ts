import 'dotenv/config';
import 'reflect-metadata';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@leanmgmt/prisma-client';

import { startAuditChainVerify } from './audit-chain-verify.cron.js';
import { startInAppNotificationRetention } from './data-retention-cleanup.cron.js';
import { startDocumentScanWorker } from './document-scan.processor.js';
import { startNotificationDigestAndCleanup } from './notification-digest-cleanup.js';
import { startNotificationEmailWorker } from './notification-email.processor.js';
import { startSlaMonitorWorker } from './sla-monitor.processor.js';

async function bootstrap(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL zorunlu');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const stopDocumentScan = await startDocumentScanWorker(prisma);
  const stopNotificationEmail = await startNotificationEmailWorker(prisma);
  const stopDigestCleanup = startNotificationDigestAndCleanup(prisma);
  const stopInAppRetention = startInAppNotificationRetention(prisma);
  const stopSlaMonitor = await startSlaMonitorWorker(prisma);
  const stopAuditChainVerify = startAuditChainVerify(prisma);

  const shutdown = async (): Promise<void> => {
    await stopDocumentScan();
    await stopNotificationEmail();
    await stopDigestCleanup();
    await stopInAppRetention();
    await stopSlaMonitor();
    await stopAuditChainVerify();
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

  console.log(
    'Bildirim e-posta worker:',
    process.env.NOTIFICATION_EMAIL_QUEUE_NAME ?? 'notification-email-outbound',
  );

  console.log('SLA monitor:', process.env.SLA_MONITOR_QUEUE_NAME ?? 'sla-monitor');

  console.log(
    'Audit chain verify interval ms:',
    process.env.AUDIT_CHAIN_CRON_INTERVAL_MS ?? String(24 * 60 * 60 * 1000),
  );
}

void bootstrap();
