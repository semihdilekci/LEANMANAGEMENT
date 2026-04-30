import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ConsentPolicyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Şu an kullanıcıya uygulanan yayındaki sürüm: ACTIVE_CONSENT_VERSION_ID kaydı
   * gelecekteki effectiveFrom için henüz bağlayıcı değil — o durumda en son geçerli yayındaki sürüme düşer.
   */
  async getActiveConsentVersionId(): Promise<string | null> {
    const now = new Date();
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'ACTIVE_CONSENT_VERSION_ID' },
    });
    const configured = row?.value as string | null | undefined;

    const isEffectivePublished = async (id: string): Promise<boolean> => {
      const cv = await this.prisma.consentVersion.findFirst({
        where: { id, status: 'PUBLISHED' },
        select: { effectiveFrom: true },
      });
      if (!cv) return false;
      if (!cv.effectiveFrom) return true;
      return cv.effectiveFrom.getTime() <= now.getTime();
    };

    if (typeof configured === 'string' && configured.length > 0) {
      if (await isEffectivePublished(configured)) {
        return configured;
      }
    }

    const latest = await this.prisma.consentVersion.findFirst({
      where: {
        status: 'PUBLISHED',
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
      },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    return latest?.id ?? null;
  }

  async hasAcceptedActiveVersion(userId: string): Promise<boolean> {
    const activeId = await this.getActiveConsentVersionId();
    if (!activeId) return true;
    const uc = await this.prisma.userConsent.findUnique({
      where: {
        userId_consentVersionId: {
          userId,
          consentVersionId: activeId,
        },
      },
      select: { id: true },
    });
    return uc !== null;
  }
}
