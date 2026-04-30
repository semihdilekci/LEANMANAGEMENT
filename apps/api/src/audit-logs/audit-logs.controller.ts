import { Body, Controller, Get, HttpCode, Inject, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Throttle } from '@nestjs/throttler';
import {
  AuditChainIntegrityVerifyBodySchema,
  AuditLogExportQuerySchema,
  AuditLogListQuerySchema,
  type AuditChainIntegrityVerifyBody,
  type AuditLogExportQuery,
  type AuditLogListQuery,
} from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import { SkipEnvelope } from '../common/decorators/skip-envelope.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { AuditLogsService } from './audit-logs.service.js';

@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(@Inject(AuditLogsService) private readonly auditLogs: AuditLogsService) {}

  @Get()
  @HttpCode(200)
  @RequirePermission(Permission.AUDIT_LOG_VIEW)
  async list(@Query(createZodValidationPipe(AuditLogListQuerySchema)) query: AuditLogListQuery) {
    return this.auditLogs.list(query);
  }

  @Get('export')
  @SkipEnvelope()
  @HttpCode(200)
  @RequirePermission(Permission.AUDIT_LOG_VIEW)
  async exportCsv(
    @Query(createZodValidationPipe(AuditLogExportQuerySchema)) query: AuditLogExportQuery,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    const { csv, filename } = await this.auditLogs.exportCsvString(query, actor);
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header(
        'Content-Disposition',
        `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      );
    return csv;
  }

  @Get('chain-integrity')
  @HttpCode(200)
  @RequirePermission(Permission.AUDIT_LOG_VIEW)
  async chainIntegrity() {
    return this.auditLogs.getChainIntegrityView();
  }

  @Post('chain-integrity/verify')
  @HttpCode(200)
  @RequirePermission(Permission.AUDIT_LOG_VIEW)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyChainIntegrity(
    @Body(createZodValidationPipe(AuditChainIntegrityVerifyBodySchema))
    body: AuditChainIntegrityVerifyBody,
  ) {
    void body;
    return this.auditLogs.verifyChainIntegrityNow();
  }
}
