import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import type {
  AdminConsentVersionCreateBody,
  AdminConsentVersionPatchBody,
  AdminConsentVersionPublishBody,
} from '@leanmgmt/shared-schemas';

import { ConsentVersionNotFoundException } from '../auth/auth.exceptions.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { NOTIFICATION_DOMAIN_EVENT } from '../notifications/notification-domain.events.js';
import { ConsentPolicyService } from '../auth/consent-policy.service.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import {
  ConsentVersionAlreadyPublishedException,
  ConsentVersionNotFoundAdminException,
} from './consent-versions.exceptions.js';

type ConsentContentJson = { locale?: string; title?: string; body?: string };

@Injectable()
export class ConsentVersionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
    @Inject(ConsentPolicyService) private readonly consentPolicy: ConsentPolicyService,
    @Inject(EventEmitter2) private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Yayımlanmış rıza sürümü için tüm aktif kullanıcılara bildirim tetikler (async listener).
   * Admin publish akışı eklendiğinde bu metot çağrılmalıdır.
   */
  requestBroadcastConsentPublished(versionId: string): void {
    void this.eventEmitter.emit(NOTIFICATION_DOMAIN_EVENT.CONSENT_VERSION_PUBLISHED, { versionId });
  }

  /**
   * Yalnızca geçerli (aktif) yayındaki sürüm okunur — başka id ile sızıntıyı engeller.
   */
  async getActivePublishedById(versionId: string): Promise<{
    id: string;
    version: number;
    title: string;
    body: string;
    locale: string;
  }> {
    const activeId = await this.consentPolicy.getActiveConsentVersionId();
    if (!activeId || activeId !== versionId) {
      throw new ConsentVersionNotFoundException();
    }

    const row = await this.prisma.consentVersion.findFirst({
      where: { id: versionId, status: 'PUBLISHED' },
    });
    if (!row) {
      throw new ConsentVersionNotFoundException();
    }

    const raw = this.encryption.decryptPhone(row.contentEncrypted, row.contentDek);
    let parsed: ConsentContentJson;
    try {
      parsed = JSON.parse(raw) as ConsentContentJson;
    } catch {
      parsed = { title: 'Rıza metni', body: raw, locale: 'tr' };
    }

    return {
      id: row.id,
      version: row.version,
      title:
        typeof parsed.title === 'string' && parsed.title.length > 0
          ? parsed.title
          : 'Aydınlatma ve açık rıza',
      body: typeof parsed.body === 'string' ? parsed.body : '',
      locale: typeof parsed.locale === 'string' ? parsed.locale : 'tr',
    };
  }

  private encryptConsentPayload(content: string): {
    contentEncrypted: Uint8Array;
    contentDek: Uint8Array;
  } {
    const payload = JSON.stringify({
      locale: 'tr',
      title: 'Aydınlatma ve açık rıza',
      body: content,
    } satisfies ConsentContentJson);
    const { ciphertext: contentEncrypted, dek: contentDek } = this.encryption.encryptPhone(payload);
    return { contentEncrypted, contentDek };
  }

  private decryptConsentRow(row: { contentEncrypted: Uint8Array; contentDek: Uint8Array }): {
    title: string;
    body: string;
    locale: string;
  } {
    const raw = this.encryption.decryptPhone(row.contentEncrypted, row.contentDek);
    let parsed: ConsentContentJson;
    try {
      parsed = JSON.parse(raw) as ConsentContentJson;
    } catch {
      return {
        title: 'Aydınlatma ve açık rıza',
        body: raw,
        locale: 'tr',
      };
    }
    return {
      title:
        typeof parsed.title === 'string' && parsed.title.length > 0
          ? parsed.title
          : 'Aydınlatma ve açık rıza',
      body: typeof parsed.body === 'string' ? parsed.body : '',
      locale: typeof parsed.locale === 'string' ? parsed.locale : 'tr',
    };
  }

  private async configuredActiveConsentVersionId(): Promise<string | null> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'ACTIVE_CONSENT_VERSION_ID' },
    });
    const v = row?.value;
    return typeof v === 'string' && v.length > 0 ? v : null;
  }

  async adminList(): Promise<
    {
      id: string;
      version: number;
      status: string;
      effectiveFrom: string | null;
      publishedAt: string | null;
      createdByUserId: string;
      isActive: boolean;
      acceptedUserCount: number;
    }[]
  > {
    const activeSettingId = await this.configuredActiveConsentVersionId();
    const rows = await this.prisma.consentVersion.findMany({
      orderBy: { version: 'desc' },
      include: { _count: { select: { userConsents: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      version: r.version,
      status: r.status,
      effectiveFrom: r.effectiveFrom?.toISOString() ?? null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      createdByUserId: r.createdByUserId,
      isActive: activeSettingId !== null && r.id === activeSettingId,
      acceptedUserCount: r._count.userConsents,
    }));
  }

  async adminGetById(id: string): Promise<{
    id: string;
    version: number;
    status: string;
    effectiveFrom: string | null;
    publishedAt: string | null;
    createdByUserId: string;
    title: string;
    body: string;
    locale: string;
    content: string;
    isActive: boolean;
  }> {
    const row = await this.prisma.consentVersion.findUnique({ where: { id } });
    if (!row) {
      throw new ConsentVersionNotFoundAdminException();
    }
    const text = this.decryptConsentRow(row);
    const activeSettingId = await this.configuredActiveConsentVersionId();
    return {
      id: row.id,
      version: row.version,
      status: row.status,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdByUserId: row.createdByUserId,
      title: text.title,
      body: text.body,
      locale: text.locale,
      content: text.body,
      isActive: activeSettingId !== null && row.id === activeSettingId,
    };
  }

  async adminCreate(
    body: AdminConsentVersionCreateBody,
    actor: AuthenticatedUser,
  ): Promise<{
    id: string;
    version: number;
    status: string;
    effectiveFrom: null;
    publishedAt: null;
    createdByUserId: string;
  }> {
    const max = await this.prisma.consentVersion.aggregate({ _max: { version: true } });
    const nextVersion = (max._max.version ?? 0) + 1;
    const enc = this.encryptConsentPayload(body.content);
    const created = await this.prisma.consentVersion.create({
      data: {
        version: nextVersion,
        contentEncrypted: Buffer.from(enc.contentEncrypted),
        contentDek: Buffer.from(enc.contentDek),
        status: 'DRAFT',
        createdByUserId: actor.id,
      },
    });
    return {
      id: created.id,
      version: created.version,
      status: created.status,
      effectiveFrom: null,
      publishedAt: null,
      createdByUserId: created.createdByUserId,
    };
  }

  async adminPatch(
    id: string,
    body: AdminConsentVersionPatchBody,
    actor: AuthenticatedUser,
  ): Promise<{
    id: string;
    version: number;
    status: string;
    effectiveFrom: string | null;
    publishedAt: string | null;
    createdByUserId: string;
  }> {
    const existing = await this.prisma.consentVersion.findUnique({ where: { id } });
    if (!existing) {
      throw new ConsentVersionNotFoundAdminException();
    }
    void actor;
    if (existing.status !== 'DRAFT') {
      throw new ConsentVersionAlreadyPublishedException();
    }
    const enc = this.encryptConsentPayload(body.content);
    const updated = await this.prisma.consentVersion.update({
      where: { id },
      data: {
        contentEncrypted: Buffer.from(enc.contentEncrypted),
        contentDek: Buffer.from(enc.contentDek),
      },
    });
    return {
      id: updated.id,
      version: updated.version,
      status: updated.status,
      effectiveFrom: updated.effectiveFrom?.toISOString() ?? null,
      publishedAt: updated.publishedAt?.toISOString() ?? null,
      createdByUserId: updated.createdByUserId,
    };
  }

  async adminPublish(
    id: string,
    body: AdminConsentVersionPublishBody,
    actor: AuthenticatedUser,
  ): Promise<{
    id: string;
    version: number;
    status: string;
    publishedAt: string;
    effectiveFrom: string;
    affectedActiveUserCount: number;
  }> {
    const effectiveFrom = new Date(body.effectiveFrom);
    void actor;
    const result = await this.prisma.$transaction(async (tx) => {
      const draft = await tx.consentVersion.findUnique({ where: { id } });
      if (!draft) {
        throw new ConsentVersionNotFoundAdminException();
      }
      if (draft.status !== 'DRAFT') {
        throw new ConsentVersionAlreadyPublishedException();
      }
      const publishedAt = new Date();
      const updated = await tx.consentVersion.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt,
          effectiveFrom,
        },
      });
      await tx.systemSetting.upsert({
        where: { key: 'ACTIVE_CONSENT_VERSION_ID' },
        create: {
          key: 'ACTIVE_CONSENT_VERSION_ID',
          value: id,
          description: 'Şu an yayındaki rıza metni sürümü (admin)',
        },
        update: { value: id },
      });
      const affectedActiveUserCount = await tx.user.count({ where: { isActive: true } });
      return { updated, affectedActiveUserCount };
    });

    this.requestBroadcastConsentPublished(id);

    return {
      id: result.updated.id,
      version: result.updated.version,
      status: result.updated.status,
      publishedAt: result.updated.publishedAt!.toISOString(),
      effectiveFrom: result.updated.effectiveFrom!.toISOString(),
      affectedActiveUserCount: result.affectedActiveUserCount,
    };
  }
}
