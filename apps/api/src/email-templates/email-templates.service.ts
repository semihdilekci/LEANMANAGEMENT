import { Inject, Injectable } from '@nestjs/common';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { NotificationEventType } from '@leanmgmt/prisma-client';
import type {
  EmailTemplatePreviewInput,
  EmailTemplateSendTestInput,
  UpdateEmailTemplateInput,
} from '@leanmgmt/shared-schemas';
import Handlebars from 'handlebars';
import DOMPurify from 'isomorphic-dompurify';

import { PrismaService } from '../prisma/prisma.service.js';

import {
  EmailTemplateNotFoundException,
  EmailTemplateVariablesInvalidException,
} from './email-templates.exceptions.js';

function collectVarRefs(template: string): Set<string> {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  while ((m = re.exec(template)) !== null) {
    set.add(m[1]!);
  }
  return set;
}

function hasVarRef(template: string, varName: string): boolean {
  return new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`).test(template);
}

function assertRequiredVariablesInTemplates(
  required: string[],
  subject: string,
  html: string,
  text: string,
): void {
  const missing: string[] = [];
  for (const v of required) {
    const inSub = hasVarRef(subject, v);
    const inHtml = hasVarRef(html, v);
    const inText = hasVarRef(text, v);
    if (!inSub || !inHtml || !inText) {
      missing.push(v);
    }
  }
  if (missing.length > 0) {
    throw new EmailTemplateVariablesInvalidException({
      missingInTemplates: missing,
      message: `Zorunlu değişkenler her şablonda geçmeli: ${missing.join(', ')}`,
    });
  }
}

function sanitizeHtmlTemplate(html: string): string {
  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'ul',
      'ol',
      'li',
      'a',
      'h1',
      'h2',
      'h3',
      'div',
      'span',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    ALLOWED_ATTR: ['href', 'class', 'style'],
  });
  if (cleaned.trim().length === 0 && html.trim().length > 0) {
    throw new EmailTemplateVariablesInvalidException({
      message: 'HTML şablonu güvenlik filtresinden geçmedi',
    });
  }
  return cleaned;
}

function unresolvedVariables(
  subject: string,
  html: string,
  text: string,
  variables: Record<string, string>,
): string[] {
  const refs = new Set<string>();
  for (const s of [subject, html, text]) {
    for (const v of collectVarRefs(s)) {
      refs.add(v);
    }
  }
  const out: string[] = [];
  for (const r of refs) {
    if (!(r in variables)) out.push(r);
  }
  return out.sort();
}

/** send-test önizlemesi için varsayılan Handlebars değişkenleri */
const DEFAULT_TEST_TEMPLATE_VARS: Record<string, string> = {
  firstName: 'Test',
  displayId: 'KTI-000001',
  taskTitle: 'Örnek görev adımı',
  processId: '00000000-0000-4000-8000-000000000001',
  taskId: '00000000-0000-4000-8000-000000000002',
  resetLink: 'https://example.com/sifre-sifirla?token=demo',
  loginUrl: 'https://example.com/login',
  digestDate: '2026-04-25',
  digestBodyHtml: '<p>Örnek günlük özet içeriği</p>',
  digestBodyText: 'Örnek günlük özet içeriği',
  userName: 'Test Kullanıcı',
};

@Injectable()
export class EmailTemplatesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listSummaries(): Promise<
    {
      id: string;
      eventType: NotificationEventType;
      subjectTemplate: string;
      updatedAt: string;
      updatedByUserId: string | null;
    }[]
  > {
    const rows = await this.prisma.emailTemplate.findMany({
      orderBy: { eventType: 'asc' },
      select: {
        id: true,
        eventType: true,
        subjectTemplate: true,
        updatedAt: true,
        updatedByUserId: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      subjectTemplate: r.subjectTemplate,
      updatedAt: r.updatedAt.toISOString(),
      updatedByUserId: r.updatedByUserId,
    }));
  }

  async findByEventType(eventType: NotificationEventType): Promise<{
    id: string;
    eventType: NotificationEventType;
    subjectTemplate: string;
    htmlBodyTemplate: string;
    textBodyTemplate: string;
    requiredVariables: string[];
    updatedAt: string;
    updatedByUserId: string | null;
  }> {
    const row = await this.prisma.emailTemplate.findUnique({
      where: { eventType },
    });
    if (!row) {
      throw new EmailTemplateNotFoundException(eventType);
    }
    const req = Array.isArray(row.requiredVariables)
      ? (row.requiredVariables as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    return {
      id: row.id,
      eventType: row.eventType,
      subjectTemplate: row.subjectTemplate,
      htmlBodyTemplate: row.htmlBodyTemplate,
      textBodyTemplate: row.textBodyTemplate,
      requiredVariables: req,
      updatedAt: row.updatedAt.toISOString(),
      updatedByUserId: row.updatedByUserId,
    };
  }

  async update(
    eventType: NotificationEventType,
    dto: UpdateEmailTemplateInput,
    actorId: string,
  ): Promise<Awaited<ReturnType<EmailTemplatesService['findByEventType']>>> {
    const existing = await this.prisma.emailTemplate.findUnique({ where: { eventType } });
    if (!existing) {
      throw new EmailTemplateNotFoundException(eventType);
    }

    assertRequiredVariablesInTemplates(
      dto.requiredVariables,
      dto.subjectTemplate,
      dto.htmlBodyTemplate,
      dto.textBodyTemplate,
    );
    const htmlSan = sanitizeHtmlTemplate(dto.htmlBodyTemplate);

    await this.prisma.emailTemplate.update({
      where: { eventType },
      data: {
        subjectTemplate: dto.subjectTemplate,
        htmlBodyTemplate: htmlSan,
        textBodyTemplate: dto.textBodyTemplate,
        requiredVariables: dto.requiredVariables,
        updatedByUserId: actorId,
      },
    });
    return this.findByEventType(eventType);
  }

  preview(dto: EmailTemplatePreviewInput): {
    subjectRendered: string;
    htmlBodyRendered: string;
    textBodyRendered: string;
    unresolvedVariables: string[];
  } {
    const subjectTpl = Handlebars.compile(dto.subjectTemplate, { noEscape: true });
    const htmlTpl = Handlebars.compile(dto.htmlBodyTemplate, { noEscape: true });
    const textTpl = Handlebars.compile(dto.textBodyTemplate, { noEscape: true });
    const vars = dto.variables ?? {};
    const unresolved = unresolvedVariables(
      dto.subjectTemplate,
      dto.htmlBodyTemplate,
      dto.textBodyTemplate,
      vars,
    );
    return {
      subjectRendered: subjectTpl(vars),
      htmlBodyRendered: htmlTpl(vars),
      textBodyRendered: textTpl(vars),
      unresolvedVariables: unresolved,
    };
  }

  /**
   * Kayıtlı şablonu örnek değişkenlerle render edip test adresine gönderir.
   * EMAIL_SENDING_MODE=noop veya SES_FROM_ADDRESS yoksa gönderim yapılmaz (CI/yerel).
   */
  async sendTest(
    eventType: NotificationEventType,
    dto: EmailTemplateSendTestInput,
  ): Promise<{ sent: boolean; mode: string }> {
    const tpl = await this.findByEventType(eventType);
    const variables: Record<string, string> = { ...DEFAULT_TEST_TEMPLATE_VARS, ...dto.variables };
    for (const key of tpl.requiredVariables) {
      if (!(key in variables)) {
        variables[key] = '';
      }
    }
    const rendered = this.preview({
      subjectTemplate: tpl.subjectTemplate,
      htmlBodyTemplate: tpl.htmlBodyTemplate,
      textBodyTemplate: tpl.textBodyTemplate,
      variables,
    });
    const htmlSafe = DOMPurify.sanitize(rendered.htmlBodyRendered, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'ul',
        'ol',
        'li',
        'a',
        'h1',
        'h2',
        'h3',
        'div',
        'span',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
      ],
      ALLOWED_ATTR: ['href', 'class', 'style'],
    });
    const mode = (process.env.EMAIL_SENDING_MODE ?? 'noop').toLowerCase();
    const from = process.env.SES_FROM_ADDRESS ?? '';
    if (mode === 'noop' || !from) {
      return { sent: false, mode: mode === 'noop' ? 'noop' : 'missing_from' };
    }

    const region = process.env.AWS_REGION ?? 'eu-central-1';
    const hasKeys = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const client = new SESv2Client({
      region,
      credentials: hasKeys
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
          }
        : undefined,
    });

    await client.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [dto.toEmail] },
        Content: {
          Simple: {
            Subject: { Data: rendered.subjectRendered, Charset: 'UTF-8' },
            Body: {
              Html: { Data: htmlSafe, Charset: 'UTF-8' },
              Text: { Data: rendered.textBodyRendered, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
    return { sent: true, mode: 'ses' };
  }
}
