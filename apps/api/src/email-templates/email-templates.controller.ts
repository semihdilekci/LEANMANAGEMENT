import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { NotificationEventType } from '@leanmgmt/prisma-client';
import {
  EmailTemplateEventTypeParamSchema,
  EmailTemplatePreviewSchema,
  EmailTemplateSendTestSchema,
  UpdateEmailTemplateSchema,
  type EmailTemplatePreviewInput,
  type EmailTemplateSendTestInput,
  type UpdateEmailTemplateInput,
} from '@leanmgmt/shared-schemas';
import { Permission } from '@leanmgmt/shared-types';

import { Audit } from '../common/decorators/audit.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { createZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { EmailTemplatesService } from './email-templates.service.js';

@Controller('admin/email-templates')
export class EmailTemplatesController {
  constructor(
    @Inject(EmailTemplatesService) private readonly emailTemplates: EmailTemplatesService,
  ) {}

  @Get()
  @RequirePermission(Permission.EMAIL_TEMPLATE_VIEW)
  @HttpCode(200)
  async list(): Promise<Awaited<ReturnType<EmailTemplatesService['listSummaries']>>> {
    return this.emailTemplates.listSummaries();
  }

  @Get(':eventType')
  @RequirePermission(Permission.EMAIL_TEMPLATE_VIEW)
  @HttpCode(200)
  async getByEventType(
    @Param('eventType', createZodValidationPipe(EmailTemplateEventTypeParamSchema))
    eventType: NotificationEventType,
  ): Promise<Awaited<ReturnType<EmailTemplatesService['findByEventType']>>> {
    return this.emailTemplates.findByEventType(eventType);
  }

  @Put(':eventType')
  @RequirePermission(Permission.EMAIL_TEMPLATE_EDIT)
  @Audit('UPDATE_EMAIL_TEMPLATE', 'email_template')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(200)
  async update(
    @Param('eventType', createZodValidationPipe(EmailTemplateEventTypeParamSchema))
    eventType: NotificationEventType,
    @Body(createZodValidationPipe(UpdateEmailTemplateSchema)) dto: UpdateEmailTemplateInput,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<EmailTemplatesService['findByEventType']>>> {
    return this.emailTemplates.update(eventType, dto, actor.id);
  }

  @Post(':eventType/preview')
  @RequirePermission(Permission.EMAIL_TEMPLATE_EDIT)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @HttpCode(200)
  async preview(
    @Param('eventType', createZodValidationPipe(EmailTemplateEventTypeParamSchema))
    _eventType: NotificationEventType,
    @Body(createZodValidationPipe(EmailTemplatePreviewSchema)) dto: EmailTemplatePreviewInput,
  ): Promise<ReturnType<EmailTemplatesService['preview']>> {
    return this.emailTemplates.preview(dto);
  }

  @Post(':eventType/send-test')
  @RequirePermission(Permission.EMAIL_TEMPLATE_EDIT)
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  @HttpCode(200)
  async sendTest(
    @Param('eventType', createZodValidationPipe(EmailTemplateEventTypeParamSchema))
    eventType: NotificationEventType,
    @Body(createZodValidationPipe(EmailTemplateSendTestSchema)) dto: EmailTemplateSendTestInput,
  ): Promise<Awaited<ReturnType<EmailTemplatesService['sendTest']>>> {
    return this.emailTemplates.sendTest(eventType, dto);
  }
}
