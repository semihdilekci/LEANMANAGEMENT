import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@leanmgmt/prisma-client';
import { type SystemSettingKey, parseSystemSettingValue } from '@leanmgmt/shared-schemas';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { AuditLogService } from '../common/audit/audit-log.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

const SYSTEM_SETTINGS_CACHE_KEY = 'system_settings:all';
const SYSTEM_SETTINGS_TTL_SEC = 300;

export type SystemSettingRow = {
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
  updatedByUserId: string | null;
};

@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(AuditLogService) private readonly audit: AuditLogService,
  ) {}

  async list(): Promise<SystemSettingRow[]> {
    const cached = await this.redis.raw.get(SYSTEM_SETTINGS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as SystemSettingRow[];
    }
    const rows = await this.prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
    const mapped = rows.map((r) => this.mapRow(r));
    await this.redis.raw.set(
      SYSTEM_SETTINGS_CACHE_KEY,
      JSON.stringify(mapped),
      'EX',
      SYSTEM_SETTINGS_TTL_SEC,
    );
    return mapped;
  }

  async updateByKey(
    key: SystemSettingKey,
    value: unknown,
    actor: AuthenticatedUser,
  ): Promise<SystemSettingRow> {
    let parsed: unknown;
    try {
      parsed = parseSystemSettingValue(key, value);
    } catch (err) {
      this.logger.warn({ event: 'system_setting_parse_failed', key, err });
      throw new AppException('SYSTEM_SETTING_INVALID', 'Ayar değeri geçersiz.', 400, {
        key,
        cause: err instanceof Error ? err.message : String(err),
      });
    }

    const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!existing) {
      throw new AppException('VALIDATION_FAILED', 'Bilinmeyen ayar anahtarı.', 400, { key });
    }

    const oldSnapshot = { value: existing.value as object };

    const row = await this.prisma.systemSetting.update({
      where: { key },
      data: {
        value: parsed as Prisma.InputJsonValue,
        updatedByUserId: actor.id,
      },
    });

    await this.redis.raw.del(SYSTEM_SETTINGS_CACHE_KEY);

    const metadata: Prisma.InputJsonValue = {
      key,
      oldValue: oldSnapshot,
      newValue: { value: parsed as object },
    };
    await this.audit.append({
      userId: actor.id,
      action: 'UPDATE_SYSTEM_SETTING',
      entity: 'system_setting',
      entityId: key,
      ipHash: 'api',
      metadata,
    });

    return this.mapRow(row);
  }

  private mapRow(r: {
    key: string;
    value: Prisma.JsonValue;
    description: string | null;
    updatedAt: Date;
    updatedByUserId: string | null;
  }): SystemSettingRow {
    return {
      key: r.key,
      value: r.value,
      description: r.description,
      updatedAt: r.updatedAt.toISOString(),
      updatedByUserId: r.updatedByUserId,
    };
  }
}
