import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationEventType } from '@leanmgmt/prisma-client';

import { PrismaService } from '../prisma/prisma.service.js';

import { EmailTemplatesService } from './email-templates.service.js';

describe('EmailTemplatesService', () => {
  let service: EmailTemplatesService;
  let prisma: {
    emailTemplate: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      emailTemplate: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [EmailTemplatesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(EmailTemplatesService);
  });

  it('update: zorunlu değişken eksikse hata', async () => {
    prisma.emailTemplate.findUnique.mockResolvedValue({
      id: 't1',
      eventType: 'TASK_ASSIGNED' as NotificationEventType,
    });
    await expect(
      service.update(
        'TASK_ASSIGNED' as NotificationEventType,
        {
          subjectTemplate: 'S {{a}}',
          htmlBodyTemplate: '<p>{{a}}</p>',
          textBodyTemplate: 'no a here',
          requiredVariables: ['a'],
        },
        'actor',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(prisma.emailTemplate.update).not.toHaveBeenCalled();
  });

  it('preview: çözülmemiş değişkenleri listeler', () => {
    const r = service.preview({
      subjectTemplate: '{{x}}',
      htmlBodyTemplate: '<p>{{y}}</p>',
      textBodyTemplate: 't',
      variables: { x: '1' },
    });
    expect(r.unresolvedVariables).toEqual(['y']);
    expect(r.subjectRendered).toBe('1');
  });

  it('sendTest: noop modunda SES çağırmaz', async () => {
    const prevMode = process.env.EMAIL_SENDING_MODE;
    const prevFrom = process.env.SES_FROM_ADDRESS;
    process.env.EMAIL_SENDING_MODE = 'noop';
    process.env.SES_FROM_ADDRESS = 'noreply@example.com';
    prisma.emailTemplate.findUnique.mockResolvedValue({
      id: 't1',
      eventType: 'TASK_ASSIGNED' as NotificationEventType,
      subjectTemplate: 'Merhaba {{firstName}}',
      htmlBodyTemplate: '<p>{{firstName}}</p>',
      textBodyTemplate: '{{firstName}}',
      requiredVariables: ['firstName'],
      updatedAt: new Date(),
      updatedByUserId: null,
    });
    const r = await service.sendTest('TASK_ASSIGNED' as NotificationEventType, {
      toEmail: 'test@example.com',
    });
    expect(r.sent).toBe(false);
    expect(r.mode).toBe('noop');
    process.env.EMAIL_SENDING_MODE = prevMode;
    process.env.SES_FROM_ADDRESS = prevFrom;
  });
});
