-- docs/02_DATABASE_SCHEMA.md §6.4 — Workflow (Faz 5)
-- Sequence: display_id için process_number (BEFORE_AFTER_KAIZEN)
CREATE SEQUENCE "process_seq_before_after_kaizen" START 1;

-- CreateEnum
CREATE TYPE "process_type" AS ENUM ('BEFORE_AFTER_KAIZEN');

-- CreateEnum
CREATE TYPE "process_status" AS ENUM ('INITIATED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('PENDING', 'CLAIMED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED_BY_PEER', 'SKIPPED_BY_ROLLBACK');

-- CreateEnum
CREATE TYPE "assignment_mode" AS ENUM ('SINGLE', 'CLAIM', 'ALL_REQUIRED');

-- CreateEnum
CREATE TYPE "task_assignment_status" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "processes" (
    "id" TEXT NOT NULL,
    "process_number" BIGINT NOT NULL,
    "process_type" "process_type" NOT NULL,
    "display_id" VARCHAR(32) NOT NULL,
    "started_by_user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "status" "process_status" NOT NULL DEFAULT 'INITIATED',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "cancelled_by_user_id" TEXT,
    "rollback_history" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "processes_cancelled_state_chk" CHECK (
        ("status"::text <> 'CANCELLED')
        OR ("cancel_reason" IS NOT NULL AND "cancelled_at" IS NOT NULL AND "cancelled_by_user_id" IS NOT NULL)
    ),
    CONSTRAINT "processes_completed_state_chk" CHECK (
        (NOT ("status"::text = ANY (ARRAY['COMPLETED'::text, 'REJECTED'])))
        OR "completed_at" IS NOT NULL
    ),
    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "step_key" VARCHAR(64) NOT NULL,
    "step_order" INTEGER NOT NULL,
    "assignment_mode" "assignment_mode" NOT NULL,
    "status" "task_status" NOT NULL DEFAULT 'PENDING',
    "completion_action" VARCHAR(64),
    "completion_reason" TEXT,
    "form_data" JSONB,
    "sla_due_at" TIMESTAMPTZ(6),
    "sla_warning_sent_at" TIMESTAMPTZ(6),
    "sla_breach_sent_at" TIMESTAMPTZ(6),
    "completed_by_user_id" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_completed_state_chk" CHECK (
        (NOT ("status"::text = 'COMPLETED'))
        OR (
            "completed_by_user_id" IS NOT NULL
            AND "completed_at" IS NOT NULL
        )
    ),
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT,
    "role_id" TEXT,
    "status" "task_assignment_status" NOT NULL DEFAULT 'PENDING',
    "resolved_by_rule" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_assignments_target_chk" CHECK ("user_id" IS NOT NULL OR "role_id" IS NOT NULL),
    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processes_display_id_key" ON "processes"("display_id");

-- CreateIndex
CREATE INDEX "processes_started_by_status_idx" ON "processes"("started_by_user_id", "status");

-- CreateIndex
CREATE INDEX "processes_company_status_started_idx" ON "processes"("company_id", "status", "started_at" DESC);

-- CreateIndex
CREATE INDEX "processes_status_started_idx" ON "processes"("status", "started_at" DESC);

-- CreateIndex
CREATE INDEX "processes_started_at_idx" ON "processes"("started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "processes_type_number_key" ON "processes"("process_type", "process_number");

-- CreateIndex
CREATE INDEX "tasks_process_order_idx" ON "tasks"("process_id", "step_order");

-- CreateIndex
CREATE INDEX "tasks_status_sla_idx" ON "tasks"("status", "sla_due_at");

-- CreateIndex
CREATE INDEX "tasks_completed_by_idx" ON "tasks"("completed_by_user_id", "completed_at" DESC);

-- CreateIndex
CREATE INDEX "task_assignments_task_status_idx" ON "task_assignments"("task_id", "status");

-- CreateIndex
CREATE INDEX "task_assignments_user_status_idx" ON "task_assignments"("user_id", "status");

-- CreateIndex
CREATE INDEX "task_assignments_role_idx" ON "task_assignments"("role_id");

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_started_by_user_id_fkey" FOREIGN KEY ("started_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- updated_at (docs/02 §3)
CREATE TRIGGER trg_processes_updated_at BEFORE UPDATE ON "processes" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON "tasks" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
