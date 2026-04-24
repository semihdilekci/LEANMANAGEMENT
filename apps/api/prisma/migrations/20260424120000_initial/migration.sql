-- docs/02_DATABASE_SCHEMA.md §2 — şema extension'ları
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "employee_type" AS ENUM ('WHITE_COLLAR', 'BLUE_COLLAR', 'INTERN');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ROTATED');

-- CreateEnum
CREATE TYPE "session_revocation_reason" AS ENUM ('PASSWORD_CHANGED', 'USER_INITIATED', 'CONCURRENT_LIMIT', 'SUSPICIOUS_IP', 'TOKEN_REPLAY', 'ADMIN_REVOKED');

-- CreateEnum
CREATE TYPE "login_attempt_outcome" AS ENUM ('SUCCESS', 'FAILURE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "login_failure_reason" AS ENUM ('INVALID_PASSWORD', 'USER_NOT_FOUND', 'USER_PASSIVE', 'USER_ANONYMIZED');

-- CreateEnum
CREATE TYPE "login_blocked_by" AS ENUM ('ACCOUNT_LOCKED', 'IP_RATE_LIMIT', 'USER_RATE_LIMIT', 'GEO_BLOCKED', 'WAF_BOT_CONTROL', 'SUPERADMIN_IP_WHITELIST_VIOLATION');

-- CreateEnum
CREATE TYPE "consent_version_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "company_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_areas" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "work_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_sub_areas" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "parent_work_area_code" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "work_sub_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "sicil_encrypted" BYTEA NOT NULL,
    "sicil_blind_index" VARCHAR(64) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email_encrypted" BYTEA NOT NULL,
    "email_blind_index" VARCHAR(64) NOT NULL,
    "phone_encrypted" BYTEA,
    "phone_dek" BYTEA,
    "password_hash" VARCHAR(60),
    "employee_type" "employee_type" NOT NULL,
    "company_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "team_id" TEXT,
    "work_area_id" TEXT NOT NULL,
    "work_sub_area_id" TEXT,
    "manager_user_id" TEXT,
    "manager_email_encrypted" BYTEA,
    "manager_email_blind_index" VARCHAR(64),
    "hire_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "anonymized_at" TIMESTAMPTZ(6),
    "anonymization_reason" TEXT,
    "password_changed_at" TIMESTAMPTZ(6),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "ip_hash" VARCHAR(64) NOT NULL,
    "user_agent" VARCHAR(512) NOT NULL,
    "status" "session_status" NOT NULL DEFAULT 'ACTIVE',
    "revocation_reason" "session_revocation_reason",
    "rotated_to_session_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password_hash" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "request_ip_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "attempted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email_blind_index" VARCHAR(64) NOT NULL,
    "user_id" TEXT,
    "ip_hash" VARCHAR(64) NOT NULL,
    "user_agent" VARCHAR(512) NOT NULL,
    "outcome" "login_attempt_outcome" NOT NULL,
    "failure_reason" "login_failure_reason",
    "blocked_by" "login_blocked_by",
    "lockout_triggered" BOOLEAN NOT NULL DEFAULT false,
    "session_id" TEXT,
    "country_code" VARCHAR(2),
    "latency_ms" INTEGER,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_by_user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_key" VARCHAR(64) NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by_user_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "consent_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content_encrypted" BYTEA NOT NULL,
    "content_dek" BYTEA NOT NULL,
    "status" "consent_version_status" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "consent_version_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" VARCHAR(64) NOT NULL,
    "user_agent" VARCHAR(512) NOT NULL,
    "signature" VARCHAR(64) NOT NULL,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "action" VARCHAR(64) NOT NULL,
    "entity" VARCHAR(64) NOT NULL,
    "entity_id" VARCHAR(64),
    "old_value_encrypted" BYTEA,
    "old_value_dek" BYTEA,
    "new_value_encrypted" BYTEA,
    "new_value_dek" BYTEA,
    "metadata" JSONB,
    "ip_hash" VARCHAR(64) NOT NULL,
    "user_agent" VARCHAR(512),
    "session_id" TEXT,
    "chain_hash" VARCHAR(64) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE INDEX "companies_is_active_idx" ON "companies"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");

-- CreateIndex
CREATE INDEX "locations_is_active_idx" ON "locations"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_is_active_idx" ON "departments"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "levels_code_key" ON "levels"("code");

-- CreateIndex
CREATE INDEX "levels_is_active_idx" ON "levels"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "positions_code_key" ON "positions"("code");

-- CreateIndex
CREATE INDEX "positions_is_active_idx" ON "positions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "teams_code_key" ON "teams"("code");

-- CreateIndex
CREATE INDEX "teams_is_active_idx" ON "teams"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "work_areas_code_key" ON "work_areas"("code");

-- CreateIndex
CREATE INDEX "work_areas_is_active_idx" ON "work_areas"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "work_sub_areas_code_key" ON "work_sub_areas"("code");

-- CreateIndex
CREATE INDEX "work_sub_areas_parent_idx" ON "work_sub_areas"("parent_work_area_code", "is_active");

-- CreateIndex
CREATE INDEX "work_sub_areas_is_active_idx" ON "work_sub_areas"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "users_sicil_blind_index_key" ON "users"("sicil_blind_index");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_blind_index_key" ON "users"("email_blind_index");

-- CreateIndex
CREATE INDEX "users_company_active_idx" ON "users"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "users_location_active_idx" ON "users"("location_id", "is_active");

-- CreateIndex
CREATE INDEX "users_department_active_idx" ON "users"("department_id", "is_active");

-- CreateIndex
CREATE INDEX "users_position_active_idx" ON "users"("position_id", "is_active");

-- CreateIndex
CREATE INDEX "users_manager_user_id_idx" ON "users"("manager_user_id");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_rotated_to_session_id_key" ON "sessions"("rotated_to_session_id");

-- CreateIndex
CREATE INDEX "sessions_user_status_idx" ON "sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at") WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "password_history_user_created_idx" ON "password_history"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "login_attempts_email_attempted_idx" ON "login_attempts"("email_blind_index", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX "login_attempts_ip_attempted_idx" ON "login_attempts"("ip_hash", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX "login_attempts_outcome_attempted_idx" ON "login_attempts"("outcome", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX "login_attempts_user_attempted_idx" ON "login_attempts"("user_id", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX "login_attempts_lockout_idx" ON "login_attempts"("attempted_at" DESC) WHERE "lockout_triggered" = true;

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_is_active_idx" ON "roles"("is_active");

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_role_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions"("permission_key");

-- CreateIndex
CREATE UNIQUE INDEX "consent_versions_version_key" ON "consent_versions"("version");

-- CreateIndex
CREATE INDEX "consent_versions_status_idx" ON "consent_versions"("status");

-- CreateIndex
CREATE INDEX "user_consents_user_accepted_idx" ON "user_consents"("user_id", "accepted_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_consents_user_version_key" ON "user_consents"("user_id", "consent_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_chain_hash_key" ON "audit_logs"("chain_hash");

-- CreateIndex
CREATE INDEX "audit_logs_user_timestamp_idx" ON "audit_logs"("user_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_timestamp_idx" ON "audit_logs"("entity", "entity_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_timestamp_idx" ON "audit_logs"("action", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp" DESC);

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_areas" ADD CONSTRAINT "work_areas_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_sub_areas" ADD CONSTRAINT "work_sub_areas_parent_work_area_code_fkey" FOREIGN KEY ("parent_work_area_code") REFERENCES "work_areas"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_sub_areas" ADD CONSTRAINT "work_sub_areas_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_work_area_id_fkey" FOREIGN KEY ("work_area_id") REFERENCES "work_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_work_sub_area_id_fkey" FOREIGN KEY ("work_sub_area_id") REFERENCES "work_sub_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_user_id_fkey" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_rotated_to_session_id_fkey" FOREIGN KEY ("rotated_to_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_versions" ADD CONSTRAINT "consent_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_consent_version_id_fkey" FOREIGN KEY ("consent_version_id") REFERENCES "consent_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- docs/02_DATABASE_SCHEMA.md §3 — partial index users (aktif kullanıcı listeleri)
DROP INDEX IF EXISTS "users_is_active_idx";
CREATE INDEX "users_is_active_idx" ON "users" ("is_active") WHERE "is_active" = true;

-- docs/02 §3 — updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON "companies" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON "locations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON "departments" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_levels_updated_at BEFORE UPDATE ON "levels" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_positions_updated_at BEFORE UPDATE ON "positions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON "teams" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_work_areas_updated_at BEFORE UPDATE ON "work_areas" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_work_sub_areas_updated_at BEFORE UPDATE ON "work_sub_areas" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON "sessions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON "roles" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_consent_versions_updated_at BEFORE UPDATE ON "consent_versions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON "system_settings" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- docs/02 users business rules
ALTER TABLE "users" ADD CONSTRAINT "users_anonymized_requires_inactive" CHECK ("anonymized_at" IS NULL OR "is_active" = false);
ALTER TABLE "users" ADD CONSTRAINT "users_failed_login_non_negative" CHECK ("failed_login_count" >= 0);

-- docs/02 sessions — REVOKED/ROTATED için revoked_at zorunlu
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_revoked_at_when_terminal" CHECK (
  ("status" IN ('REVOKED', 'ROTATED') AND "revoked_at" IS NOT NULL) OR
  ("status" NOT IN ('REVOKED', 'ROTATED'))
);

-- docs/02 login_attempts
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_failure_reason" CHECK (
  ("outcome" <> 'FAILURE') OR ("failure_reason" IS NOT NULL)
);
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_blocked_by" CHECK (
  ("outcome" <> 'BLOCKED') OR ("blocked_by" IS NOT NULL)
);

-- docs/02 §6.7 audit_logs append-only
CREATE OR REPLACE FUNCTION block_audit_modification() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_no_update BEFORE UPDATE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION block_audit_modification();
CREATE TRIGGER trg_audit_logs_no_delete BEFORE DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION block_audit_modification();
