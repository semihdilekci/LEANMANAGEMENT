-- Faz 7 iter 1 — notifications + notification_preferences
-- Kaynak: docs/02_DATABASE_SCHEMA.md §6.6

CREATE TYPE "notification_event_type" AS ENUM (
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
  'AUDIT_CHAIN_BROKEN'
);

CREATE TYPE "notification_channel" AS ENUM ('IN_APP', 'EMAIL');

CREATE TYPE "notification_delivery_status" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BOUNCED');

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "event_type" "notification_event_type" NOT NULL,
  "channel" "notification_channel" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "body" TEXT NOT NULL,
  "link_url" VARCHAR(500),
  "metadata" JSONB,
  "read_at" TIMESTAMPTZ(6),
  "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "delivery_status" "notification_delivery_status" NOT NULL DEFAULT 'PENDING',
  "delivery_failure_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_preferences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "event_type" "notification_event_type" NOT NULL,
  "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
  "email_enabled" BOOLEAN NOT NULL DEFAULT true,
  "digest_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_preferences_user_event_key"
  ON "notification_preferences" ("user_id", "event_type");

CREATE INDEX "notification_preferences_user_idx" ON "notification_preferences" ("user_id");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "notifications_user_read_created_idx"
  ON "notifications" ("user_id", "read_at", "created_at" DESC);

CREATE INDEX "notifications_user_channel_idx" ON "notifications" ("user_id", "channel");

CREATE INDEX "notifications_created_at_idx" ON "notifications" ("created_at" DESC);

CREATE INDEX "notifications_delivery_status_idx"
  ON "notifications" ("delivery_status")
  WHERE "delivery_status" IN ('PENDING', 'FAILED');
