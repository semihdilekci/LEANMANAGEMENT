import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ConsentPolicyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getActiveConsentVersionId(): Promise<string | null> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'ACTIVE_CONSENT_VERSION_ID' },
    });
    const configured = row?.value as string | null | undefined;
    if (typeof configured === 'string' && configured.length > 0) {
      const cv = await this.prisma.consentVersion.findFirst({
        where: { id: configured, status: 'PUBLISHED' },
        select: { id: true },
      });
      return cv?.id ?? null;
    }
    const latest = await this.prisma.consentVersion.findFirst({
      where: { status: 'PUBLISHED' },
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
