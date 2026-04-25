-- docs/02_DATABASE_SCHEMA.md §6.5 — Documents (process_id/task_id nullable: PROCESS_START staging, docs/03_API_CONTRACTS 9.7)

CREATE TYPE "document_scan_status" AS ENUM ('PENDING_SCAN', 'SCANNING', 'CLEAN', 'INFECTED', 'SCAN_FAILED');

CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "s3_key" VARCHAR(512) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "scan_status" "document_scan_status" NOT NULL DEFAULT 'PENDING_SCAN',
    "scan_result_detail" TEXT,
    "process_id" TEXT,
    "task_id" TEXT,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "documents_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "documents_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "documents_file_size_chk" CHECK ("file_size_bytes" <= 10485760)
);

CREATE INDEX "documents_scan_status_idx" ON "documents" ("scan_status");
CREATE INDEX "documents_uploaded_by_idx" ON "documents" ("uploaded_by_user_id");
CREATE INDEX "documents_process_idx" ON "documents" ("process_id");
