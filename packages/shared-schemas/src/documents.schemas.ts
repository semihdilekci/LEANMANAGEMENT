import { z } from 'zod';

/** docs/03_API_CONTRACTS.md 9.7 — MIME whitelist */
export const DOCUMENT_ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

const ContentTypeSchema = z.enum(DOCUMENT_ALLOWED_CONTENT_TYPES);

const filenameSchema = z
  .string()
  .min(1, 'Dosya adı zorunludur')
  .max(255, 'Dosya adı en fazla 255 karakter olabilir')
  .refine(
    (name) =>
      !name.includes('/') && !name.includes('\\') && !name.includes('..') && !name.includes('\0'),
    'Dosya adında geçersiz karakterler var',
  );

const fileSizeSchema = z
  .number()
  .int()
  .positive()
  .max(10_485_760, 'Dosya boyutu en fazla 10 MB olabilir');

const ProcessStartContextDataSchema = z
  .object({
    processType: z.literal('BEFORE_AFTER_KAIZEN'),
  })
  .strict();

const TaskAttachmentContextDataSchema = z
  .object({
    taskId: z.string().min(1, 'taskId zorunludur'),
  })
  .strict();

export const DocumentUploadInitiateBodySchema = z
  .object({
    filename: filenameSchema,
    contentType: ContentTypeSchema,
    fileSizeBytes: fileSizeSchema,
    contextType: z.enum(['PROCESS_START', 'TASK_ATTACHMENT']),
    contextData: z.unknown(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.contextType === 'PROCESS_START') {
      const r = ProcessStartContextDataSchema.safeParse(val.contextData);
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({ ...issue, path: ['contextData', ...issue.path] });
        }
      }
    } else {
      const r = TaskAttachmentContextDataSchema.safeParse(val.contextData);
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({ ...issue, path: ['contextData', ...issue.path] });
        }
      }
    }
  });

export type DocumentUploadInitiateInput = z.infer<typeof DocumentUploadInitiateBodySchema>;

export const DocumentCreateBodySchema = z
  .object({
    documentId: z.string().min(1, 'documentId zorunludur'),
    filename: filenameSchema,
    contentType: ContentTypeSchema,
    fileSizeBytes: fileSizeSchema,
    contextType: z.enum(['PROCESS_START', 'TASK_ATTACHMENT']),
    contextData: z.unknown(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.contextType === 'PROCESS_START') {
      const r = ProcessStartContextDataSchema.safeParse(val.contextData);
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({ ...issue, path: ['contextData', ...issue.path] });
        }
      }
    } else {
      const r = TaskAttachmentContextDataSchema.safeParse(val.contextData);
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({ ...issue, path: ['contextData', ...issue.path] });
        }
      }
    }
  });

export type DocumentCreateInput = z.infer<typeof DocumentCreateBodySchema>;

export const DocumentIdParamSchema = z.object({ id: z.string().min(1) }).strict();

export type DocumentIdParam = z.infer<typeof DocumentIdParamSchema>;
