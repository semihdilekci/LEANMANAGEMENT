import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import type { DocumentCreateInput, DocumentUploadInitiateInput } from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { PermissionResolverService } from '../roles/permission-resolver.service.js';

import { DocumentScanQueueService } from './document-scan-queue.service.js';
import {
  DocumentContentTypeInvalidException,
  DocumentInfectedException,
  DocumentInitiateExpiredException,
  DocumentNotFoundException,
  DocumentScanPendingException,
  DocumentUploadForbiddenException,
  ProcessAccessDeniedException,
} from './documents.exceptions.js';
import type { DocumentsObjectStorage } from './documents-object-storage.js';
import {
  NoopDocumentsObjectStorage,
  S3DocumentsObjectStorage,
} from './documents-object-storage.js';

const INIT_TTL_SEC = 900;
const PRESIGN_PUT_TTL_SEC = 300;
const PRESIGN_GET_TTL_SEC = 300;

function redisInitKey(documentId: string): string {
  return `doc:upload:init:${documentId}`;
}

type InitPayload = {
  uploadedByUserId: string;
  filename: string;
  contentType: string;
  fileSizeBytes: number;
  contextType: string;
  contextData: unknown;
};

export function buildStagingObjectKey(documentId: string, filename: string): string {
  const safe = filename.replace(/[/\\]/g, '_').replace(/\.\./g, '_').replace(/\0/g, '');
  return `staging/${documentId}-${safe}`;
}

function isImageContentType(contentType: string): boolean {
  return (
    contentType === 'image/jpeg' || contentType === 'image/png' || contentType === 'image/webp'
  );
}

@Injectable()
export class DocumentsService {
  private readonly storage: DocumentsObjectStorage;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(DocumentScanQueueService) private readonly scanQueue: DocumentScanQueueService,
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
  ) {
    const driver = this.config.get('DOCUMENTS_STORAGE_DRIVER', { infer: true });
    this.storage =
      driver === 'noop'
        ? new NoopDocumentsObjectStorage()
        : new S3DocumentsObjectStorage({
            AWS_REGION: this.config.get('AWS_REGION', { infer: true }),
            AWS_ACCESS_KEY_ID: this.config.get('AWS_ACCESS_KEY_ID', { infer: true }),
            AWS_SECRET_ACCESS_KEY: this.config.get('AWS_SECRET_ACCESS_KEY', { infer: true }),
            S3_ENDPOINT_URL: this.config.get('S3_ENDPOINT_URL', { infer: true }),
            S3_DOCUMENTS_BUCKET: this.config.get('S3_DOCUMENTS_BUCKET', { infer: true }) as string,
          });
  }

  private async assertTaskAttachmentAllowed(actorId: string, taskId: string): Promise<void> {
    const row = await this.prisma.taskAssignment.findFirst({
      where: {
        taskId,
        userId: actorId,
        status: { in: ['PENDING', 'COMPLETED'] },
      },
    });
    if (!row) {
      throw new DocumentUploadForbiddenException();
    }
  }

  private async assertInitiateContext(
    actor: AuthenticatedUser,
    body: DocumentUploadInitiateInput,
  ): Promise<void> {
    if (body.contextType === 'TASK_ATTACHMENT') {
      const taskId = (body.contextData as { taskId: string }).taskId;
      await this.assertTaskAttachmentAllowed(actor.id, taskId);
    }
  }

  async initiateUpload(
    body: DocumentUploadInitiateInput,
    actor: AuthenticatedUser,
  ): Promise<{
    documentId: string;
    uploadUrl: string;
    uploadMethod: 'PUT';
    uploadHeaders: Record<string, string>;
    expiresAt: string;
  }> {
    await this.assertInitiateContext(actor, body);
    const documentId = randomUUID();
    const s3Key = buildStagingObjectKey(documentId, body.filename);
    const payload: InitPayload = {
      uploadedByUserId: actor.id,
      filename: body.filename,
      contentType: body.contentType,
      fileSizeBytes: body.fileSizeBytes,
      contextType: body.contextType,
      contextData: body.contextData,
    };
    await this.redis.raw.setex(redisInitKey(documentId), INIT_TTL_SEC, JSON.stringify(payload));
    const { url, headers } = await this.storage.getPresignedPutUrl(
      s3Key,
      body.contentType,
      PRESIGN_PUT_TTL_SEC,
    );
    const expiresAt = new Date(Date.now() + PRESIGN_PUT_TTL_SEC * 1000).toISOString();
    return {
      documentId,
      uploadUrl: url,
      uploadMethod: 'PUT',
      uploadHeaders: headers,
      expiresAt,
    };
  }

  async completeUpload(
    body: DocumentCreateInput,
    actor: AuthenticatedUser,
  ): Promise<{
    id: string;
    filename: string;
    contentType: string;
    fileSizeBytes: number;
    scanStatus: string;
    uploadedAt: string;
  }> {
    const raw = await this.redis.raw.get(redisInitKey(body.documentId));
    if (!raw) {
      throw new DocumentInitiateExpiredException();
    }
    const init = JSON.parse(raw) as InitPayload;
    if (init.uploadedByUserId !== actor.id) {
      throw new DocumentUploadForbiddenException();
    }
    if (
      init.filename !== body.filename ||
      init.contentType !== body.contentType ||
      init.fileSizeBytes !== body.fileSizeBytes ||
      init.contextType !== body.contextType ||
      JSON.stringify(init.contextData) !== JSON.stringify(body.contextData)
    ) {
      throw new DocumentInitiateExpiredException();
    }

    if (body.contextType === 'TASK_ATTACHMENT') {
      await this.assertTaskAttachmentAllowed(
        actor.id,
        (body.contextData as { taskId: string }).taskId,
      );
    }

    const s3Key = buildStagingObjectKey(body.documentId, body.filename);
    await this.storage.assertStagingObjectExists(s3Key, body.contentType, body.fileSizeBytes);

    let processId: string | null = null;
    let taskId: string | null = null;
    if (body.contextType === 'TASK_ATTACHMENT') {
      const t = await this.prisma.task.findUnique({
        where: { id: (body.contextData as { taskId: string }).taskId },
        select: { id: true, processId: true },
      });
      if (!t) {
        throw new DocumentUploadForbiddenException();
      }
      processId = t.processId;
      taskId = t.id;
    }

    const doc = await this.prisma.document.create({
      data: {
        id: body.documentId,
        uploadedByUserId: actor.id,
        s3Key,
        originalFilename: body.filename,
        fileSizeBytes: BigInt(body.fileSizeBytes),
        contentType: body.contentType,
        scanStatus: 'PENDING_SCAN',
        processId,
        taskId,
      },
    });
    await this.redis.raw.del(redisInitKey(body.documentId));
    await this.scanQueue.enqueueScan(doc.id);
    return {
      id: doc.id,
      filename: doc.originalFilename,
      contentType: doc.contentType,
      fileSizeBytes: Number(doc.fileSizeBytes),
      scanStatus: doc.scanStatus,
      uploadedAt: doc.uploadedAt.toISOString(),
    };
  }

  private async assertDocumentReadable(actor: AuthenticatedUser, docId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
    });
    if (!doc) {
      throw new DocumentNotFoundException();
    }
    const perms = await this.permissionResolver.getUserPermissions(actor.id);
    if (perms.has(Permission.PROCESS_VIEW_ALL)) {
      return doc;
    }
    if (doc.uploadedByUserId === actor.id) {
      return doc;
    }
    if (doc.processId) {
      const proc = await this.prisma.process.findUnique({
        where: { id: doc.processId },
        select: { startedByUserId: true },
      });
      if (proc?.startedByUserId === actor.id) {
        return doc;
      }
      const assignee = await this.prisma.taskAssignment.findFirst({
        where: {
          userId: actor.id,
          status: { in: ['PENDING', 'COMPLETED'] },
          task: { processId: doc.processId },
        },
      });
      if (assignee) {
        return doc;
      }
    }
    throw new ProcessAccessDeniedException();
  }

  async getMeta(
    actor: AuthenticatedUser,
    docId: string,
  ): Promise<{
    id: string;
    processId: string | null;
    taskId: string | null;
    filename: string;
    contentType: string;
    fileSizeBytes: number;
    scanStatus: string;
    scanResultDetail: string | null;
    uploadedAt: string;
  }> {
    const doc = await this.assertDocumentReadable(actor, docId);
    return {
      id: doc.id,
      processId: doc.processId,
      taskId: doc.taskId,
      filename: doc.originalFilename,
      contentType: doc.contentType,
      fileSizeBytes: Number(doc.fileSizeBytes),
      scanStatus: doc.scanStatus,
      scanResultDetail: doc.scanResultDetail,
      uploadedAt: doc.uploadedAt.toISOString(),
    };
  }

  async getScanStatus(
    actor: AuthenticatedUser,
    docId: string,
  ): Promise<{ id: string; scanStatus: string; scanResultDetail: string | null }> {
    const doc = await this.assertDocumentReadable(actor, docId);
    return {
      id: doc.id,
      scanStatus: doc.scanStatus,
      scanResultDetail: doc.scanResultDetail,
    };
  }

  async getDownloadUrl(
    actor: AuthenticatedUser,
    docId: string,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    const doc = await this.assertDocumentReadable(actor, docId);
    if (doc.scanStatus === 'PENDING_SCAN' || doc.scanStatus === 'SCANNING') {
      throw new DocumentScanPendingException();
    }
    if (doc.scanStatus === 'INFECTED') {
      throw new DocumentInfectedException();
    }
    if (doc.scanStatus !== 'CLEAN') {
      throw new DocumentScanPendingException();
    }
    const expiresAt = new Date(Date.now() + PRESIGN_GET_TTL_SEC * 1000).toISOString();
    const downloadUrl = await this.storage.getPresignedGetUrl(
      doc.s3Key,
      doc.originalFilename,
      PRESIGN_GET_TTL_SEC,
    );
    return { downloadUrl, expiresAt };
  }

  /** KTİ başlatma öncesi: tümü CLEAN, görsel MIME, yükleyen = actor */
  async assertKtiPhotoDocumentsCleanAndOwned(
    actor: AuthenticatedUser,
    allIds: string[],
  ): Promise<void> {
    const unique = [...new Set(allIds)];
    const docs = await this.prisma.document.findMany({
      where: { id: { in: unique } },
    });
    if (docs.length !== unique.length) {
      throw new DocumentNotFoundException();
    }
    for (const d of docs) {
      if (d.uploadedByUserId !== actor.id) {
        throw new DocumentUploadForbiddenException();
      }
      if (!isImageContentType(d.contentType)) {
        throw new DocumentContentTypeInvalidException();
      }
      if (d.scanStatus === 'PENDING_SCAN' || d.scanStatus === 'SCANNING') {
        throw new DocumentScanPendingException();
      }
      if (d.scanStatus === 'INFECTED') {
        throw new DocumentInfectedException();
      }
      if (d.scanStatus !== 'CLEAN') {
        throw new DocumentScanPendingException();
      }
    }
  }
}
