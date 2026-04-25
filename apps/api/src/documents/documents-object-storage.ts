import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';

import type { Env } from '../config/env.schema.js';

import {
  DocumentMetaMismatchException,
  DocumentStagingMissingException,
} from './documents.exceptions.js';

export interface DocumentsObjectStorage {
  getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresSeconds: number,
  ): Promise<{ url: string; headers: Record<string, string> }>;
  getPresignedGetUrl(
    key: string,
    downloadFilename: string,
    expiresSeconds: number,
  ): Promise<string>;
  assertStagingObjectExists(
    key: string,
    expectedContentType: string,
    expectedSize: number,
  ): Promise<void>;
  getObjectBody(key: string): Promise<Readable>;
}

function buildS3Client(env: Env): S3Client {
  const hasKeys = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
  return new S3Client({
    region: env.AWS_REGION,
    credentials: hasKeys
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID as string,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
        }
      : undefined,
    endpoint: env.S3_ENDPOINT_URL,
    forcePathStyle: Boolean(env.S3_ENDPOINT_URL),
  });
}

export class S3DocumentsObjectStorage implements DocumentsObjectStorage {
  private readonly client: S3Client;
  constructor(
    private readonly env: Pick<
      Env,
      | 'AWS_REGION'
      | 'AWS_ACCESS_KEY_ID'
      | 'AWS_SECRET_ACCESS_KEY'
      | 'S3_ENDPOINT_URL'
      | 'S3_DOCUMENTS_BUCKET'
    >,
  ) {
    this.client = buildS3Client(env as Env);
  }

  private get bucket(): string {
    return this.env.S3_DOCUMENTS_BUCKET as string;
  }

  async getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresSeconds: number,
  ): Promise<{ url: string; headers: Record<string, string> }> {
    const putCmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, putCmd, { expiresIn: expiresSeconds });
    return { url, headers: { 'Content-Type': contentType } };
  }

  async getPresignedGetUrl(
    key: string,
    downloadFilename: string,
    expiresSeconds: number,
  ): Promise<string> {
    const safeName = downloadFilename.replace(/"/g, '');
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `inline; filename="${safeName}"`,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresSeconds });
  }

  async assertStagingObjectExists(
    key: string,
    expectedContentType: string,
    expectedSize: number,
  ): Promise<void> {
    try {
      const out = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      const len = out.ContentLength ?? 0;
      const ct = (out.ContentType ?? '').split(';')[0]?.trim() ?? '';
      if (len !== expectedSize) {
        throw new DocumentMetaMismatchException();
      }
      if (ct && ct !== expectedContentType) {
        throw new DocumentMetaMismatchException();
      }
    } catch (e) {
      if (e instanceof DocumentMetaMismatchException) throw e;
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) {
        throw new DocumentStagingMissingException();
      }
      throw new DocumentStagingMissingException();
    }
  }

  async getObjectBody(key: string): Promise<Readable> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const body = out.Body;
    if (!body || typeof (body as Readable).pipe !== 'function') {
      throw new DocumentStagingMissingException();
    }
    return body as Readable;
  }
}

/** Test / güvenilir noop ortamları — gerçek depo çağrısı yok */
export class NoopDocumentsObjectStorage implements DocumentsObjectStorage {
  async getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresSeconds: number,
  ): Promise<{ url: string; headers: Record<string, string> }> {
    void expiresSeconds;
    return {
      url: `https://noop.invalid/staging-put?key=${encodeURIComponent(key)}`,
      headers: { 'Content-Type': contentType },
    };
  }

  async getPresignedGetUrl(
    key: string,
    downloadFilename: string,
    expiresSeconds: number,
  ): Promise<string> {
    void downloadFilename;
    void expiresSeconds;
    return `https://noop.invalid/get?key=${encodeURIComponent(key)}`;
  }

  async assertStagingObjectExists(
    key: string,
    expectedContentType: string,
    expectedSize: number,
  ): Promise<void> {
    void key;
    void expectedContentType;
    void expectedSize;
  }

  async getObjectBody(key: string): Promise<Readable> {
    void key;
    const { Readable } = await import('node:stream');
    return Readable.from(Buffer.alloc(0));
  }
}
