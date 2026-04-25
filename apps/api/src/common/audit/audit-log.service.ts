import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@leanmgmt/prisma-client';

import { PrismaService } from '../../prisma/prisma.service.js';

export type AppendAuditInput = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipHash: string;
  userAgent?: string | null;
  sessionId?: string | null;
};

/**
 * audit_logs.chain_hash uygulama tarafında üretilir (migration’da INSERT trigger yok).
 * Seed ile aynı zincirleme: sha256(prevChain + canonicalPayload)
 */
@Injectable()
export class AuditLogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async append(input: AppendAuditInput): Promise<void> {
    const last = await this.prisma.auditLog.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { chainHash: true },
    });
    const prev = last?.chainHash ?? 'GENESIS';
    const canonical = JSON.stringify({
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      metadata: input.metadata ?? null,
      ipHash: input.ipHash,
    });
    const chainHash = createHash('sha256')
      .update(prev + canonical)
      .digest('hex');

    await this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? undefined,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? undefined,
        metadata: input.metadata ?? undefined,
        ipHash: input.ipHash,
        userAgent: input.userAgent ?? undefined,
        sessionId: input.sessionId ?? undefined,
        chainHash,
      },
    });
  }
}
