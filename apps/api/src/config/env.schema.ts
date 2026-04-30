/**
 * Boot-time env doğrulama — docs/04_BACKEND_SPEC.md (fail-fast config)
 * OIDC: docs/03_API_CONTRACTS.md §6, ADR 0008 — yalnız OIDC_ENABLED=true iken alanlar zorunlanır
 */
import { z, ZodIssueCode } from 'zod';

/** docs/03_API_CONTRACTS.md OIDC-2 — callback redirect pathname (open redirect yüzeyini daraltır) */
export const OIDC_GOOGLE_CALLBACK_PATHNAME = '/api/v1/auth/oauth/google/callback' as const;

function isGoogleOidcIssuer(issuer: string): boolean {
  try {
    return new URL(issuer).origin === 'https://accounts.google.com';
  } catch {
    return false;
  }
}

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
    /** Faz 2.1 — OIDC (Google dev / Keycloak prod); false iken diğer OIDC_* yok sayılır */
    OIDC_ENABLED: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
    OIDC_ISSUER: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.string().url().optional(),
    ),
    OIDC_CLIENT_ID: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.string().min(1).optional(),
    ),
    /** Confidential client (Google web client dev, Keycloak); prod+Google için zorunlu değil — ADR 0008 */
    OIDC_CLIENT_SECRET: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.string().min(1).optional(),
    ),
    OIDC_REDIRECT_URI: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.string().url().optional(),
    ),
    OIDC_SCOPES: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? 'openid email profile' : v),
      z.string().min(1),
    ),
    /**
     * Faz 2.1 İter 3 — OIDC callback sonrası tarayıcıyı Next köküne 302 ile döndürmek için (JSON sayfası önlemi).
     * Boş iken callback yanıtı JSON kalır (CI / entegrasyon testleri).
     */
    WEB_PUBLIC_ORIGIN: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.string().url().optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.DOCUMENTS_STORAGE_DRIVER === 's3' && !data.S3_DOCUMENTS_BUCKET) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'S3_DOCUMENTS_BUCKET, DOCUMENTS_STORAGE_DRIVER=s3 iken zorunludur',
        path: ['S3_DOCUMENTS_BUCKET'],
      });
    }

    if (!data.OIDC_ENABLED) {
      return;
    }

    if (!data.OIDC_ISSUER) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'OIDC_ENABLED=true iken OIDC_ISSUER zorunludur',
        path: ['OIDC_ISSUER'],
      });
    }
    if (!data.OIDC_CLIENT_ID) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'OIDC_ENABLED=true iken OIDC_CLIENT_ID zorunludur',
        path: ['OIDC_CLIENT_ID'],
      });
    }
    if (!data.OIDC_REDIRECT_URI) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'OIDC_ENABLED=true iken OIDC_REDIRECT_URI zorunludur',
        path: ['OIDC_REDIRECT_URI'],
      });
    } else {
      try {
        const pathname = new URL(data.OIDC_REDIRECT_URI).pathname;
        if (pathname !== OIDC_GOOGLE_CALLBACK_PATHNAME) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message: `OIDC_REDIRECT_URI pathname tam olarak "${OIDC_GOOGLE_CALLBACK_PATHNAME}" olmalıdır`,
            path: ['OIDC_REDIRECT_URI'],
          });
        }
      } catch {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: 'OIDC_REDIRECT_URI geçerli bir URL olmalıdır',
          path: ['OIDC_REDIRECT_URI'],
        });
      }
    }

    /**
     * Next tek-origin: tarayıcı `WEB_PUBLIC_ORIGIN` üzerinden `/api` proxy ile OIDC başlatır;
     * `oidc_state` çerezi yanıtın Host’una bağlanır. Google dönüşü `OIDC_REDIRECT_URI` host’una gider;
     * ikisi farklıysa (localhost vs 127.0.0.1 veya 3000 vs 3001) çerez gönderilmez → AUTH_OIDC_STATE_INVALID.
     */
    if (data.WEB_PUBLIC_ORIGIN && data.OIDC_REDIRECT_URI) {
      try {
        const redirectOrigin = new URL(data.OIDC_REDIRECT_URI).origin;
        const webOrigin = new URL(data.WEB_PUBLIC_ORIGIN).origin;
        if (redirectOrigin !== webOrigin) {
          ctx.addIssue({
            code: ZodIssueCode.custom,
            message:
              'WEB_PUBLIC_ORIGIN ile OIDC_REDIRECT_URI aynı origin olmalıdır (örn. ikisi de http://localhost:3000). Aksi halde kurumsal girişte oidc_state çerezi callback’e taşınmaz.',
            path: ['OIDC_REDIRECT_URI'],
          });
        }
      } catch {
        /* URL’ler üstte doğrulanır */
      }
    }

    const issuer = data.OIDC_ISSUER ?? '';
    const googleIssuer = issuer.length > 0 && isGoogleOidcIssuer(issuer);
    // Prod’da Google client secret zorunlu tutulmaz (ADR 0008); dev/staging/test’te Google web client tipik olarak secret ister
    const requiresGoogleNonProdSecret = googleIssuer && data.NODE_ENV !== 'production';

    if (requiresGoogleNonProdSecret && !data.OIDC_CLIENT_SECRET) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message:
          'Google issuer ile production dışı ortamda OIDC_CLIENT_SECRET zorunludur (Authorization Code web client)',
        path: ['OIDC_CLIENT_SECRET'],
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
