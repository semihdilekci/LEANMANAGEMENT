/**
 * Boot-time env doğrulama — docs/04_BACKEND_SPEC.md (fail-fast config)
 */
import { z, ZodIssueCode } from 'zod';

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    APP_PII_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, '64 hex (32 byte)'),
    APP_PII_PEPPER: z.string().regex(/^[0-9a-fA-F]{64}$/, '64 hex (32 byte)'),
    /** İter 3 JWT için; şimdilik sadece şema doğrulaması */
    JWT_ACCESS_SECRET_CURRENT: z.string().min(32),
    /** Yalnızca test/CI — response’ta reset token döner (üretimde kapalı) */
    AUTH_EXPOSE_RESET_TOKEN: z.preprocess(
      (val) => val === 'true' || val === true,
      z.boolean().default(false),
    ),
    SENTRY_DSN: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.string().url().optional(),
    ),
    /** s3: gerçek S3; noop: CI/yerel test — staging doğrulama atlanır (yalnız güvenilir ortamda) */
    DOCUMENTS_STORAGE_DRIVER: z.enum(['s3', 'noop']).default('s3'),
    S3_DOCUMENTS_BUCKET: z.string().min(1).optional(),
    AWS_REGION: z.string().min(1).default('eu-central-1'),
    AWS_ACCESS_KEY_ID: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.string().optional(),
    ),
    AWS_SECRET_ACCESS_KEY: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.string().optional(),
    ),
    S3_ENDPOINT_URL: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.string().url().optional(),
    ),
    DOCUMENT_SCAN_QUEUE_NAME: z.string().min(1).default('document-virus-scan'),
    /** BullMQ — transactional bildirim e-postası (Faz 7 iter 2) */
    NOTIFICATION_EMAIL_QUEUE_NAME: z.string().min(1).default('notification-email-outbound'),
  })
  .superRefine((data, ctx) => {
    if (data.DOCUMENTS_STORAGE_DRIVER === 's3' && !data.S3_DOCUMENTS_BUCKET) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'S3_DOCUMENTS_BUCKET, DOCUMENTS_STORAGE_DRIVER=s3 iken zorunludur',
        path: ['S3_DOCUMENTS_BUCKET'],
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Geçersiz ortam değişkenleri: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}
