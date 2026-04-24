/**
 * Boot-time env doğrulama — docs/04_BACKEND_SPEC.md (fail-fast config)
 */
import { z } from 'zod';

export const EnvSchema = z.object({
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
