import { z } from 'zod';

/** docs/02_DATABASE_SCHEMA.md §6.7 + seed system settings */
export const SYSTEM_SETTING_KEYS = [
  'LOGIN_ATTEMPT_THRESHOLD',
  'LOGIN_ATTEMPT_WINDOW_MINUTES',
  'LOCKOUT_THRESHOLD',
  'LOCKOUT_DURATION_MINUTES',
  'PASSWORD_EXPIRY_DAYS',
  'IN_APP_NOTIFICATION_RETENTION_DAYS',
  'SUPERADMIN_IP_WHITELIST',
  'ACTIVE_CONSENT_VERSION_ID',
] as const;

export type SystemSettingKey = (typeof SYSTEM_SETTING_KEYS)[number];

export const SystemSettingKeyParamSchema = z.enum(SYSTEM_SETTING_KEYS);

const cidrLike = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\d./a-fA-F:]+$/, 'CIDR veya IP aralığı formatı beklenir');

export const SystemSettingPutBodySchema = z
  .object({
    value: z.unknown(),
  })
  .strict();

export type SystemSettingPutBody = z.infer<typeof SystemSettingPutBodySchema>;

export function parseSystemSettingValue(key: SystemSettingKey, value: unknown): unknown {
  switch (key) {
    case 'LOGIN_ATTEMPT_THRESHOLD':
    case 'LOGIN_ATTEMPT_WINDOW_MINUTES':
    case 'LOCKOUT_THRESHOLD':
    case 'LOCKOUT_DURATION_MINUTES':
    case 'PASSWORD_EXPIRY_DAYS':
      return z.number().int().min(1).max(3650).parse(value);
    case 'IN_APP_NOTIFICATION_RETENTION_DAYS':
      return z.number().int().min(7).max(730).parse(value);
    case 'SUPERADMIN_IP_WHITELIST':
      return z.array(cidrLike).max(256).parse(value);
    case 'ACTIVE_CONSENT_VERSION_ID':
      return z.union([z.string().cuid(), z.null()]).parse(value);
    default: {
      const _x: never = key;
      return _x;
    }
  }
}

const isoOrEmpty = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : v),
  z.string().datetime().optional(),
);

/** docs/03_API_CONTRACTS.md 9.9 */
export const AuditLogListQuerySchema = z
  .object({
    userId: z.string().cuid().optional(),
    action: z.string().min(1).max(64).optional(),
    entity: z.string().min(1).max(64).optional(),
    entityId: z.string().min(1).max(64).optional(),
    timestampFrom: isoOrEmpty,
    timestampTo: isoOrEmpty,
    ipHash: z.string().min(1).max(64).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export type AuditLogListQuery = z.infer<typeof AuditLogListQuerySchema>;

export const AuditLogExportQuerySchema = AuditLogListQuerySchema.omit({
  limit: true,
  cursor: true,
});

export type AuditLogExportQuery = z.infer<typeof AuditLogExportQuerySchema>;

/** docs/03_API_CONTRACTS.md §9.10 POST /admin/consent-versions */
export const AdminConsentVersionCreateBodySchema = z
  .object({
    content: z.string().min(100).max(50_000),
  })
  .strict();

export type AdminConsentVersionCreateBody = z.infer<typeof AdminConsentVersionCreateBodySchema>;

/** PATCH /admin/consent-versions/:id — yalnız DRAFT */
export const AdminConsentVersionPatchBodySchema = z
  .object({
    content: z.string().min(100).max(50_000),
  })
  .strict();

export type AdminConsentVersionPatchBody = z.infer<typeof AdminConsentVersionPatchBodySchema>;

const CONSENT_PUBLISH_MIN_LEAD_MS = 60_000;

/** POST .../publish — effectiveFrom geçmişte olamaz (min: now + 1 dk) */
export const AdminConsentVersionPublishBodySchema = z
  .object({
    effectiveFrom: z.string().datetime(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const t = new Date(val.effectiveFrom).getTime();
    const min = Date.now() + CONSENT_PUBLISH_MIN_LEAD_MS;
    if (Number.isNaN(t) || t < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Yürürlük tarihi en az bir dakika sonrası olmalıdır',
        path: ['effectiveFrom'],
      });
    }
  });

export type AdminConsentVersionPublishBody = z.infer<typeof AdminConsentVersionPublishBodySchema>;

/** POST /admin/audit-logs/chain-integrity/verify — gövde yok */
export const AuditChainIntegrityVerifyBodySchema = z.object({}).strict();

export type AuditChainIntegrityVerifyBody = z.infer<typeof AuditChainIntegrityVerifyBodySchema>;

/** GET /admin/summary — yönetim paneli özet metrikleri */
export const AdminOrganizationSummaryResponseSchema = z
  .object({
    activeUserCount: z.number().int().min(0),
    openProcessCount: z.number().int().min(0),
    overdueTaskCount: z.number().int().min(0),
  })
  .strict();

export type AdminOrganizationSummary = z.infer<typeof AdminOrganizationSummaryResponseSchema>;
