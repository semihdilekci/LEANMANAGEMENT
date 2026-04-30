import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, type Prisma as PrismaNs } from '@leanmgmt/prisma-client';
import type { AuditLogListQuery, AuditLogExportQuery } from '@leanmgmt/shared-schemas';
import {
  bytesToNodeBuffer,
  decryptAes256GcmProbabilistic,
  verifyAuditLogChain,
} from '@leanmgmt/shared-utils';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { AuditLogService } from '../common/audit/audit-log.service.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

const EXPORT_HOURLY_LIMIT = 10;
const EXPORT_HOUR_TTL_SEC = 3600;
const EXPORT_MAX_ROWS = 100_000;

const AUDIT_EXPORT_RL_PREFIX = 'audit:export:hour:';

type CursorPayload = { t: string; i: string };

function exportRedisKey(userId: string, hourSlot: string): string {
  return `${AUDIT_EXPORT_RL_PREFIX}${userId}:${hourSlot}`;
}

function currentHourSlot(): string {
  return new Date().toISOString().slice(0, 13);
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(AuditLogService) private readonly audit: AuditLogService,
  ) {}

  async list(query: AuditLogListQuery): Promise<{
    data: Record<string, unknown>[];
    pagination: { nextCursor: string | null; hasMore: boolean };
  }> {
    const { limit, cursor } = query;
    const where = this.buildWhereFromListQuery(query);
    const cursorClause = this.decodeListCursor(cursor);

    const andFilters: Prisma.AuditLogWhereInput[] = [where];
    if (cursorClause) {
      andFilters.push(cursorClause);
    }

    const combinedWhere: Prisma.AuditLogWhereInput =
      andFilters.length > 1 ? { AND: andFilters } : where;

    const take = limit + 1;
    const rows = await this.prisma.auditLog.findMany({
      where: combinedWhere,
      take,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            sicilEncrypted: true,
            anonymizedAt: true,
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? this.encodeListCursor({ t: last.timestamp.toISOString(), i: last.id })
        : null;

    const data = await Promise.all(page.map((r) => this.mapAuditLogRow(r)));
    return { data, pagination: { nextCursor, hasMore } };
  }

  async assertExportNotRateLimited(actor: AuthenticatedUser): Promise<void> {
    const slot = currentHourSlot();
    const key = exportRedisKey(actor.id, slot);
    const n = await this.redis.raw.incr(key);
    if (n === 1) {
      await this.redis.raw.expire(key, EXPORT_HOUR_TTL_SEC);
    }
    if (n > EXPORT_HOURLY_LIMIT) {
      throw new AppException(
        'EXPORT_RATE_LIMIT',
        'Audit dışa aktarma sınırı aşıldı. Lütfen 1 saat sonra tekrar deneyin.',
        429,
        { limit: EXPORT_HOURLY_LIMIT, window: '1h' },
      );
    }
  }

  async exportCsvString(
    query: AuditLogExportQuery,
    actor: AuthenticatedUser,
  ): Promise<{ csv: string; filename: string; rowCount: number }> {
    const where = this.buildWhereFromExportQuery(query);
    const total = await this.prisma.auditLog.count({ where });
    if (total > EXPORT_MAX_ROWS) {
      throw new AppException(
        'VALIDATION_FAILED',
        `Çok fazla kayıt (>${EXPORT_MAX_ROWS}). Daha dar filtre kullanın.`,
        400,
        { total },
      );
    }

    await this.assertExportNotRateLimited(actor);

    const rows = await this.prisma.auditLog.findMany({
      where,
      take: EXPORT_MAX_ROWS,
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            sicilEncrypted: true,
            anonymizedAt: true,
          },
        },
      },
    });

    const mapped = await Promise.all(rows.map((r) => this.mapAuditLogRow(r, { forExport: true })));

    const from = query.timestampFrom?.slice(0, 10) ?? 'all';
    const to = query.timestampTo?.slice(0, 10) ?? 'all';
    const filename = `audit-logs-${from}-to-${to}.csv`;

    const header = [
      'timestamp',
      'userId',
      'userSicil',
      'action',
      'entity',
      'entityId',
      'oldValue',
      'newValue',
      'ipHash',
      'userAgent',
      'sessionId',
      'chainHash',
    ];

    const lines = [header.join(',')];
    for (let i = 0; i < mapped.length; i++) {
      const row = mapped[i]!;
      const values = [
        this.csvEscape(String(row['timestamp'])),
        this.csvEscape(String(row['userId'] ?? '')),
        this.csvEscape(String((row as { userSicil?: string })['userSicil'] ?? '')),
        this.csvEscape(String(row['action'])),
        this.csvEscape(String(row['entity'])),
        this.csvEscape(String(row['entityId'] ?? '')),
        this.csvEscape(JSON.stringify(row['oldValue'] ?? null)),
        this.csvEscape(JSON.stringify(row['newValue'] ?? null)),
        this.csvEscape(String(row['ipHash'])),
        this.csvEscape(String(row['userAgent'] ?? '')),
        this.csvEscape(String(row['sessionId'] ?? '')),
        this.csvEscape(String(row['chainHash'])),
      ];
      lines.push(values.join(','));
    }

    const filterSummary = this.summarizeFiltersForAudit(query);
    await this.audit.append({
      userId: actor.id,
      action: 'EXPORT_AUDIT_LOG',
      entity: 'audit_log',
      entityId: null,
      ipHash: createHash('sha256').update('export-csv').digest('hex'),
      metadata: { filters: filterSummary, rowCount: rows.length } satisfies Prisma.JsonObject,
    });

    return {
      csv: '\uFEFF' + lines.join('\n'),
      filename,
      rowCount: rows.length,
    };
  }

  private summarizeFiltersForAudit(
    q: Pick<
      AuditLogListQuery,
      'userId' | 'action' | 'entity' | 'entityId' | 'timestampFrom' | 'timestampTo' | 'ipHash'
    >,
  ): Record<string, boolean | string> {
    return {
      hasUserId: Boolean(q.userId),
      hasAction: Boolean(q.action),
      hasEntity: Boolean(q.entity),
      hasEntityId: Boolean(q.entityId),
      hasTimeRange: Boolean(q.timestampFrom && q.timestampTo),
      hasIpHash: Boolean(q.ipHash),
    };
  }

  private csvEscape(s: string): string {
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  async getChainIntegrityView(): Promise<{
    lastCheckAt: string | null;
    totalRecordsChecked: number;
    chainIntact: boolean;
    firstBrokenAt: string | null;
    firstBrokenRecordId: string | null;
    nextScheduledCheckAt: string;
  }> {
    const latest = await this.prisma.auditChainIntegrityCheck.findFirst({
      orderBy: { checkedAt: 'desc' },
    });

    if (latest) {
      const nextScheduledCheckAt = new Date(latest.checkedAt.getTime() + 24 * 60 * 60 * 1000);
      return {
        lastCheckAt: latest.checkedAt.toISOString(),
        totalRecordsChecked: latest.totalRecordsChecked,
        chainIntact: latest.chainIntact,
        firstBrokenAt: latest.firstBrokenAt?.toISOString() ?? null,
        firstBrokenRecordId: latest.firstBrokenRecordId,
        nextScheduledCheckAt: nextScheduledCheckAt.toISOString(),
      };
    }

    return await this.runVerificationAndStore();
  }

  /** Admin tetiklemesi — her çağrıda tam zincir taraması (throttle controller’da). */
  async verifyChainIntegrityNow(): Promise<{
    lastCheckAt: string | null;
    totalRecordsChecked: number;
    chainIntact: boolean;
    firstBrokenAt: string | null;
    firstBrokenRecordId: string | null;
    nextScheduledCheckAt: string;
  }> {
    return this.runVerificationAndStore();
  }

  private async runVerificationAndStore(): Promise<{
    lastCheckAt: string | null;
    totalRecordsChecked: number;
    chainIntact: boolean;
    firstBrokenAt: string | null;
    firstBrokenRecordId: string | null;
    nextScheduledCheckAt: string;
  }> {
    const started = Date.now();
    const all = await this.prisma.auditLog.findMany();
    const chain = verifyAuditLogChain(all);
    const duration = Date.now() - started;
    if (chain.chainIntact) {
      const row = await this.prisma.auditChainIntegrityCheck.create({
        data: {
          chainIntact: true,
          firstBrokenAt: null,
          firstBrokenRecordId: null,
          totalRecordsChecked: all.length,
          durationMs: duration,
        },
      });
      const nextScheduledCheckAt = new Date(row.checkedAt.getTime() + 24 * 60 * 60 * 1000);
      return {
        lastCheckAt: row.checkedAt.toISOString(),
        totalRecordsChecked: all.length,
        chainIntact: true,
        firstBrokenAt: null,
        firstBrokenRecordId: null,
        nextScheduledCheckAt: nextScheduledCheckAt.toISOString(),
      };
    }

    const firstBrokenRow = all.find((r) => r.id === chain.firstBrokenRecordId);
    const now2 = new Date();
    const row2 = await this.prisma.auditChainIntegrityCheck.create({
      data: {
        chainIntact: false,
        firstBrokenAt: firstBrokenRow?.timestamp ?? new Date(chain.firstBrokenAt),
        firstBrokenRecordId: chain.firstBrokenRecordId,
        totalRecordsChecked: all.length,
        durationMs: duration,
      },
    });
    const nextScheduledCheckAt2 = new Date(
      (firstBrokenRow?.timestamp ?? now2).getTime() + 24 * 60 * 60 * 1000,
    );
    this.logger.error({
      event: 'audit_chain_broken',
      at: chain.firstBrokenAt,
      recordId: chain.firstBrokenRecordId,
    });
    return {
      lastCheckAt: row2.checkedAt.toISOString(),
      totalRecordsChecked: all.length,
      chainIntact: false,
      firstBrokenAt: chain.firstBrokenAt,
      firstBrokenRecordId: chain.firstBrokenRecordId,
      nextScheduledCheckAt: nextScheduledCheckAt2.toISOString(),
    };
  }

  private buildWhereFromExportQuery(q: AuditLogExportQuery): Prisma.AuditLogWhereInput {
    return this.buildWhereFromListQuery(q);
  }

  private buildWhereFromListQuery(
    q: Pick<
      AuditLogListQuery,
      'userId' | 'action' | 'entity' | 'entityId' | 'timestampFrom' | 'timestampTo' | 'ipHash'
    >,
  ): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (q.userId) where.userId = q.userId;
    if (q.action) where.action = q.action;
    if (q.entity) where.entity = q.entity;
    if (q.entityId) where.entityId = q.entityId;
    if (q.ipHash) where.ipHash = q.ipHash;
    if (q.timestampFrom || q.timestampTo) {
      const ts: PrismaNs.DateTimeFilter = {};
      if (q.timestampFrom) ts.gte = new Date(q.timestampFrom);
      if (q.timestampTo) ts.lte = new Date(q.timestampTo);
      where.timestamp = ts;
    }
    return where;
  }

  private decodeListCursor(cursor: string | undefined): Prisma.AuditLogWhereInput | undefined {
    if (!cursor) return undefined;
    let parsed: CursorPayload;
    try {
      const json = Buffer.from(cursor, 'base64url').toString('utf8');
      parsed = JSON.parse(json) as CursorPayload;
    } catch {
      throw new AppException('VALIDATION_FAILED', 'Geçersiz imleç.', 400, { field: 'cursor' });
    }
    const t = new Date(parsed.t);
    if (Number.isNaN(t.getTime()) || !parsed.i) {
      throw new AppException('VALIDATION_FAILED', 'Geçersiz imleç.', 400, { field: 'cursor' });
    }
    return {
      OR: [{ timestamp: { lt: t } }, { AND: [{ timestamp: t }, { id: { lt: parsed.i } }] }],
    };
  }

  private encodeListCursor(p: CursorPayload): string {
    return Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
  }

  private async mapAuditLogRow(
    r: {
      id: string;
      timestamp: Date;
      userId: string | null;
      action: string;
      entity: string;
      entityId: string | null;
      oldValueEncrypted: Buffer | Uint8Array | null;
      oldValueDek: Buffer | Uint8Array | null;
      newValueEncrypted: Buffer | Uint8Array | null;
      newValueDek: Buffer | Uint8Array | null;
      metadata: Prisma.JsonValue | null;
      ipHash: string;
      userAgent: string | null;
      sessionId: string | null;
      chainHash: string;
      user: {
        firstName: string;
        lastName: string;
        sicilEncrypted: unknown;
        anonymizedAt: Date | null;
      } | null;
    },
    opts: { forExport?: boolean } = {},
  ): Promise<Record<string, unknown>> {
    const oldV = this.decryptOptionalJson(r.oldValueEncrypted, r.oldValueDek);
    const newV = this.decryptOptionalJson(r.newValueEncrypted, r.newValueDek);

    let userOut: { sicil: string | null; firstName: string; lastName: string } | null = null;
    if (r.user) {
      let sicil: string | null = null;
      if (r.user.anonymizedAt) {
        sicil = null;
      } else {
        try {
          sicil = this.encryption.decryptSicil(r.user.sicilEncrypted as unknown as Buffer);
        } catch {
          sicil = null;
        }
      }
      userOut = {
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        sicil,
      };
    }

    if (oldV) this.deepMaskPiiInPlace(oldV);
    if (newV) this.deepMaskPiiInPlace(newV);

    const base: Record<string, unknown> = {
      id: r.id,
      timestamp: r.timestamp.toISOString(),
      userId: r.userId,
      user: userOut
        ? {
            sicil: (userOut as { sicil: string | null }).sicil,
            firstName: userOut.firstName,
            lastName: userOut.lastName,
          }
        : null,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      oldValue: oldV,
      newValue: newV,
      metadata: r.metadata,
      ipHash: r.ipHash,
      userAgent: r.userAgent,
      sessionId: r.sessionId,
      chainHash: r.chainHash,
    };
    if (opts.forExport) {
      (base as { userSicil?: string })['userSicil'] = userOut
        ? String((userOut as { sicil: string | null }).sicil ?? '')
        : '';
      delete base['user'];
    }
    return base;
  }

  private deepMaskPiiInPlace(v: unknown): void {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const k of Object.keys(v as object)) {
        if (
          [
            'email',
            'phone',
            'sicil',
            'managerEmail',
            'emailBlindIndex',
            'phoneBlindIndex',
          ].includes(k)
        ) {
          (v as Record<string, unknown>)[k] = '***';
        } else {
          this.deepMaskPiiInPlace((v as Record<string, unknown>)[k]);
        }
      }
    } else if (Array.isArray(v)) {
      for (const it of v) {
        this.deepMaskPiiInPlace(it);
      }
    }
  }

  private decryptOptionalJson(
    enc: Buffer | Uint8Array | null | undefined,
    dek: Buffer | Uint8Array | null | undefined,
  ): unknown {
    if (!enc || !dek) return null;
    try {
      const raw = decryptAes256GcmProbabilistic(
        bytesToNodeBuffer(enc as Buffer | Uint8Array),
        bytesToNodeBuffer(dek as Buffer | Uint8Array),
      );
      return JSON.parse(raw) as unknown;
    } catch (err) {
      this.logger.warn({ event: 'audit_json_decrypt_failed', err });
      return null;
    }
  }
}
