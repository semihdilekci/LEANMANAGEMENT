import { z } from 'zod';

/** docs/02_DATABASE_SCHEMA.md §6.6 — notification_event_type */
export const NOTIFICATION_EVENT_TYPES = [
  'TASK_ASSIGNED',
  'TASK_CLAIMED_BY_PEER',
  'SLA_WARNING',
  'SLA_BREACH',
  'PROCESS_COMPLETED',
  'PROCESS_REJECTED',
  'PROCESS_CANCELLED',
  'ROLLBACK_PERFORMED',
  'DOCUMENT_INFECTED',
  'ACCOUNT_LOCKED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_CHANGED',
  'PASSWORD_EXPIRY_WARNING',
  'SUSPICIOUS_LOGIN',
  'SUPERADMIN_LOGIN',
  'SECURITY_ANOMALY',
  'AUDIT_CHAIN_BROKEN',
  'USER_LOGIN_WELCOME',
  'DAILY_DIGEST',
] as const;

export type NotificationEventTypeValue = (typeof NOTIFICATION_EVENT_TYPES)[number];

const NOTIFICATION_CHANNEL_FILTER = ['IN_APP', 'EMAIL', 'all'] as const;
const NOTIFICATION_IS_READ_QUERY = ['true', 'false', 'all'] as const;

/** docs/03_API_CONTRACTS.md §9.8 — GET /api/v1/notifications */
export const NotificationListQuerySchema = z
  .object({
    channel: z.enum(NOTIFICATION_CHANNEL_FILTER).default('IN_APP'),
    isRead: z.enum(NOTIFICATION_IS_READ_QUERY).default('all'),
    eventType: z.enum(NOTIFICATION_EVENT_TYPES).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;

const NotificationPreferenceEntrySchema = z
  .object({
    eventType: z.enum(NOTIFICATION_EVENT_TYPES),
    inAppEnabled: z.boolean(),
    emailEnabled: z.boolean(),
    digestEnabled: z.boolean(),
  })
  .strict();

/** Faz 7 — kullanıcı bildirim tercihleri (bulk upsert) */
export const NotificationPreferencesPutSchema = z
  .object({
    preferences: z.array(NotificationPreferenceEntrySchema).min(1).max(40),
  })
  .strict();

export type NotificationPreferencesPutInput = z.infer<typeof NotificationPreferencesPutSchema>;
