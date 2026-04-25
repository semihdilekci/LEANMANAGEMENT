import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { type Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import type { Readable } from 'node:stream';
import { PrismaClient } from '@leanmgmt/prisma-client';

import { scanBufferWithClamd } from './clamav-instream.js';

export const EICAR_SUBSTRING = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';

export function bufferLooksInfected(buffer: Buffer): boolean {
  return buffer.toString('utf8').includes(EICAR_SUBSTRING);
}

export type DocumentScanJobData = {
  documentId: string;
};

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

function createS3Client(): S3Client | null {
  if (process.env.DOCUMENTS_STORAGE_DRIVER === 'noop') {
    return null;
  }
  const region = process.env.AWS_REGION ?? 'eu-central-1';
  const bucket = process.env.S3_DOCUMENTS_BUCKET;
  if (!bucket) {
    return null;
  }
  const hasKeys = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  return new S3Client({
    region,
    credentials: hasKeys
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
        }
      : undefined,
    endpoint: process.env.S3_ENDPOINT_URL || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT_URL),
  });
}

export async function runDocumentScanJob(
  prisma: PrismaClient,
  job: Job<DocumentScanJobData>,
): Promise<void> {
  const { documentId } = job.data;
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    return;
  }
  if (doc.scanStatus !== 'PENDING_SCAN' && doc.scanStatus !== 'SCANNING') {
    return;
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { scanStatus: 'SCANNING' },
  });

  let buffer: Buffer;
  const s3 = createS3Client();
  const bucket = process.env.S3_DOCUMENTS_BUCKET;
  if (!s3 || !bucket || process.env.DOCUMENTS_STORAGE_DRIVER === 'noop') {
    buffer = Buffer.alloc(0);
  } else {
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: doc.s3Key }));
    const body = out.Body;
    if (!body || typeof (body as Readable).pipe !== 'function') {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          scanStatus: 'SCAN_FAILED',
          scanResultDetail: 'S3 nesnesi okunamadı',
        },
      });
      return;
    }
    buffer = await streamToBuffer(body as Readable);
  }

  if (bufferLooksInfected(buffer)) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        scanStatus: 'INFECTED',
        scanResultDetail: 'EICAR-TEST-FILE',
      },
    });
    return;
  }

  const clamHost = process.env.CLAMAV_HOST;
  const clamPort = Number(process.env.CLAMAV_PORT ?? '3310');
  const mockClean =
    process.env.WORKER_SCAN_MOCK_CLEAN === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.DOCUMENTS_STORAGE_DRIVER === 'noop';

  if (clamHost) {
    try {
      const res = await scanBufferWithClamd(clamHost, clamPort, buffer, 120_000);
      if (res.clean) {
        await prisma.document.update({
          where: { id: documentId },
          data: { scanStatus: 'CLEAN', scanResultDetail: null },
        });
      } else {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            scanStatus: 'INFECTED',
            scanResultDetail: res.signature,
          },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          scanStatus: 'SCAN_FAILED',
          scanResultDetail: msg.slice(0, 500),
        },
      });
    }
    return;
  }

  if (mockClean) {
    await prisma.document.update({
      where: { id: documentId },
      data: { scanStatus: 'CLEAN', scanResultDetail: null },
    });
    return;
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      scanStatus: 'SCAN_FAILED',
      scanResultDetail: 'ClamAV host tanımlı değil (CLAMAV_HOST)',
    },
  });
}

export async function startDocumentScanWorker(prisma: PrismaClient): Promise<() => Promise<void>> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL zorunlu');
  }
  const queueName = process.env.DOCUMENT_SCAN_QUEUE_NAME ?? 'document-virus-scan';
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const worker = new Worker<DocumentScanJobData>(
    queueName,
    async (job) => {
      await runDocumentScanJob(prisma, job);
    },
    { connection },
  );
  return async () => {
    await worker.close();
    await connection.quit();
  };
}
