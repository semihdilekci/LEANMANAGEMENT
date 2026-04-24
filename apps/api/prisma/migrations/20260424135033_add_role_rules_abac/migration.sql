-- CreateEnum
CREATE TYPE "role_rule_attribute_key" AS ENUM ('COMPANY_ID', 'LOCATION_ID', 'DEPARTMENT_ID', 'POSITION_ID', 'LEVEL_ID', 'TEAM_ID', 'WORK_AREA_ID', 'WORK_SUB_AREA_ID', 'EMPLOYEE_TYPE');

-- CreateEnum
CREATE TYPE "role_rule_condition_operator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IN', 'NOT_IN', 'STARTS_WITH', 'ENDS_WITH');

-- CreateTable
CREATE TABLE "role_rules" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT NOT NULL,

    CONSTRAINT "role_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_rule_condition_sets" (
    "id" TEXT NOT NULL,
    "role_rule_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_rule_condition_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_rule_conditions" (
    "id" TEXT NOT NULL,
    "condition_set_id" TEXT NOT NULL,
    "attribute_key" "role_rule_attribute_key" NOT NULL,
    "operator" "role_rule_condition_operator" NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_rule_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_rules_role_order_idx" ON "role_rules"("role_id", "order");

-- CreateIndex
CREATE INDEX "role_rule_condition_sets_rule_order_idx" ON "role_rule_condition_sets"("role_rule_id", "order");

-- CreateIndex
CREATE INDEX "role_rule_conditions_set_idx" ON "role_rule_conditions"("condition_set_id");

-- AddForeignKey
ALTER TABLE "role_rules" ADD CONSTRAINT "role_rules_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_rules" ADD CONSTRAINT "role_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_rule_condition_sets" ADD CONSTRAINT "role_rule_condition_sets_role_rule_id_fkey" FOREIGN KEY ("role_rule_id") REFERENCES "role_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_rule_conditions" ADD CONSTRAINT "role_rule_conditions_condition_set_id_fkey" FOREIGN KEY ("condition_set_id") REFERENCES "role_rule_condition_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
