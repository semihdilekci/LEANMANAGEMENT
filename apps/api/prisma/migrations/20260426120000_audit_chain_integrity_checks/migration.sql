-- CreateTable
CREATE TABLE "audit_chain_integrity_checks" (
    "id" TEXT NOT NULL,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chain_intact" BOOLEAN NOT NULL,
    "first_broken_at" TIMESTAMPTZ(6),
    "first_broken_record_id" TEXT,
    "total_records_checked" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    CONSTRAINT "audit_chain_integrity_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_chain_checks_checked_at_idx" ON "audit_chain_integrity_checks"("checked_at" DESC);
