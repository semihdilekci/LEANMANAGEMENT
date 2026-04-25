-- Faz 7 iter 2 — email_templates + notification_event_type genişletmesi
-- Kaynak: docs/02_DATABASE_SCHEMA.md §6.6

ALTER TYPE "notification_event_type" ADD VALUE 'USER_LOGIN_WELCOME';
ALTER TYPE "notification_event_type" ADD VALUE 'DAILY_DIGEST';

CREATE TABLE "email_templates" (
  "id" TEXT NOT NULL,
  "event_type" "notification_event_type" NOT NULL,
  "subject_template" VARCHAR(300) NOT NULL,
  "html_body_template" TEXT NOT NULL,
  "text_body_template" TEXT NOT NULL,
  "required_variables" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "updated_by_user_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_templates_event_type_key" ON "email_templates" ("event_type");

ALTER TABLE "email_templates"
  ADD CONSTRAINT "email_templates_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
