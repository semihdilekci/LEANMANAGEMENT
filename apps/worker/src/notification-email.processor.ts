import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { type Job, Worker } from 'bullmq';
import Handlebars from 'handlebars';
import Redis from 'ioredis';
import type { PrismaClient } from '@leanmgmt/prisma-client';
import { bytesToNodeBuffer, decryptAes256GcmDeterministic } from '@leanmgmt/shared-utils';

export type NotificationEmailJobData = {
  notificationId: string;
};

function requireHexKey(name: string): Buffer {
  const v = process.env[name];
  if (!v || v.length !== 64 || !/^[0-9a-fA-F]+$/i.test(v)) {
    throw new Error(`${name} zorunlu: 64 hex (worker e-posta için PII decrypt)`);
  }
  return Buffer.from(v, 'hex');
}

function decryptUserEmail(emailEncrypted: Uint8Array): string {
  const key = requireHexKey('APP_PII_ENCRYPTION_KEY');
  return decryptAes256GcmDeterministic(bytesToNodeBuffer(emailEncrypted), key, 'user:email:v1');
}

function metaString(meta: unknown, key: string): string {
  if (!meta || typeof meta !== 'object') return '';
  const v = (meta as Record<string, unknown>)[key];
  if (typeof v === 'string') return v;
  if (v == null) return '';
  return String(v);
}

export async function runNotificationEmailJob(
  prisma: PrismaClient,
  job: Job<NotificationEmailJobData>,
): Promise<void> {
  const { notificationId } = job.data;
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.channel !== 'EMAIL') {
    return;
  }
  if (notification.deliveryStatus !== 'PENDING') {
    return;
  }

  const template = await prisma.emailTemplate.findUnique({
    where: { eventType: notification.eventType },
  });
  if (!template) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: 'FAILED',
        deliveryFailureReason: 'email_template_missing',
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: notification.userId } });
  if (!user?.isActive) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: 'FAILED',
        deliveryFailureReason: 'user_inactive_or_missing',
      },
    });
    return;
  }

  let to: string;
  try {
    to = decryptUserEmail(user.emailEncrypted as unknown as Uint8Array);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: 'FAILED',
        deliveryFailureReason: `email_decrypt_failed:${msg.slice(0, 200)}`,
      },
    });
    return;
  }

  const meta = notification.metadata;
  const baseUrl = process.env.WEB_APP_BASE_URL ?? 'http://localhost:3000';
  const vars: Record<string, string> = {
    firstName: user.firstName,
    displayId: metaString(meta, 'displayId'),
    taskTitle: metaString(meta, 'taskTitle'),
    processId: metaString(meta, 'processId'),
    taskId: metaString(meta, 'taskId'),
    resetLink: metaString(meta, 'resetLink'),
    loginUrl: metaString(meta, 'loginUrl') || `${baseUrl}/login`,
    digestDate: metaString(meta, 'digestDate'),
    digestBodyHtml: metaString(meta, 'digestBodyHtml'),
    digestBodyText: metaString(meta, 'digestBodyText'),
    daysRemaining: metaString(meta, 'daysRemaining'),
    version: metaString(meta, 'version'),
    roleName: metaString(meta, 'roleName'),
    roleCode: metaString(meta, 'roleCode'),
  };

  const subject = Handlebars.compile(template.subjectTemplate, { noEscape: true })(vars);
  const html = Handlebars.compile(template.htmlBodyTemplate, { noEscape: true })(vars);
  const text = Handlebars.compile(template.textBodyTemplate, { noEscape: true })(vars);

  const mode = (process.env.EMAIL_SENDING_MODE ?? 'noop').toLowerCase();
  const from = process.env.SES_FROM_ADDRESS ?? '';

  if (mode === 'noop' || !from) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: 'SENT',
        sentAt: new Date(),
        deliveryFailureReason: null,
      },
    });
    return;
  }

  const maxAttempts = typeof job.opts.attempts === 'number' ? job.opts.attempts : 3;

  try {
    const region = process.env.AWS_REGION ?? 'eu-central-1';
    const hasKeys = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const client = new SESv2Client({
      region,
      credentials: hasKeys
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
          }
        : undefined,
    });

    await client.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: html, Charset: 'UTF-8' },
              Text: { Data: text, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: 'SENT',
        sentAt: new Date(),
        deliveryFailureReason: null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (job.attemptsMade >= maxAttempts) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          deliveryStatus: 'FAILED',
          deliveryFailureReason: msg.slice(0, 500),
        },
      });
      return;
    }
    throw e;
  }
}

export async function startNotificationEmailWorker(
  prisma: PrismaClient,
): Promise<() => Promise<void>> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('REDIS_URL yok — bildirim e-posta worker başlatılmadı');
    return async () => undefined;
  }
  const queueName = process.env.NOTIFICATION_EMAIL_QUEUE_NAME ?? 'notification-email-outbound';
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const worker = new Worker<NotificationEmailJobData>(
    queueName,
    async (job) => {
      await runNotificationEmailJob(prisma, job);
    },
    { connection },
  );
  return async () => {
    await worker.close();
    await connection.quit();
  };
}
