import { Inject, Injectable } from '@nestjs/common';
import type { NotificationEventType } from '@leanmgmt/prisma-client';
import type { EmailTemplatePreviewInput, UpdateEmailTemplateInput } from '@leanmgmt/shared-schemas';
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
}
