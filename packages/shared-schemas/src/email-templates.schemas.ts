import { z } from 'zod';

import { NOTIFICATION_EVENT_TYPES } from './notifications.schemas.js';

/** Path/query: event_type — docs/03_API_CONTRACTS.md admin/email-templates */
export const EmailTemplateEventTypeParamSchema = z.enum(NOTIFICATION_EVENT_TYPES);

/** PUT /admin/email-templates/:eventType body */
export const UpdateEmailTemplateSchema = z
  .object({
    subjectTemplate: z.string().min(1).max(300),
    htmlBodyTemplate: z.string().min(1).max(500_000),
    textBodyTemplate: z.string().min(1).max(500_000),
    requiredVariables: z.array(z.string().min(1).max(64)).max(50),
  })
  .strict();

export type UpdateEmailTemplateInput = z.infer<typeof UpdateEmailTemplateSchema>;

/** POST .../preview body — taslak şablon + örnek değişkenler */
export const EmailTemplatePreviewSchema = z
  .object({
    subjectTemplate: z.string().min(1).max(300),
    htmlBodyTemplate: z.string().min(1).max(500_000),
    textBodyTemplate: z.string().min(1).max(500_000),
    variables: z.record(z.string(), z.string()).default({}),
  })
  .strict();

export type EmailTemplatePreviewInput = z.infer<typeof EmailTemplatePreviewSchema>;

/** POST /admin/email-templates/:eventType/send-test — test e-postası */
export const EmailTemplateSendTestSchema = z
  .object({
    toEmail: z.string().email().max(320),
    variables: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export type EmailTemplateSendTestInput = z.infer<typeof EmailTemplateSendTestSchema>;
