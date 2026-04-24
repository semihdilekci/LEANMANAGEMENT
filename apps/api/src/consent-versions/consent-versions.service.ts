import { Inject, Injectable } from '@nestjs/common';

import { ConsentVersionNotFoundException } from '../auth/auth.exceptions.js';
import { ConsentPolicyService } from '../auth/consent-policy.service.js';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type ConsentContentJson = { locale?: string; title?: string; body?: string };

@Injectable()
export class ConsentVersionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
    @Inject(ConsentPolicyService) private readonly consentPolicy: ConsentPolicyService,
  ) {}

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
}
