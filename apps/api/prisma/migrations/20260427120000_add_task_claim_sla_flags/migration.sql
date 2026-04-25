-- Faz 6: claim kilidi (CLAIM mod) + SLA aşımı bayrağı (worker taraması)
-- Kaynak: docs/02_DATABASE_SCHEMA.md tasks, .cursor/rules/56-phase-06-task-management

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "claimed_by_user_id" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "is_sla_overdue" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_claimed_by_user_id_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_claimed_by_user_id_fkey"
      FOREIGN KEY ("claimed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tasks_claimed_by_user_id_idx" ON "tasks" ("claimed_by_user_id");
