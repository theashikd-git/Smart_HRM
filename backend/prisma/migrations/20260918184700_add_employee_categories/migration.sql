-- CreateTable: employee_categories -- replaces the fixed LeaveEmployeeCategory
-- enum with real, HR-editable rows (name + a couple of behavior flags that
-- LeaveSchedulerService reads instead of hardcoding category names).
CREATE TABLE "employee_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "accruesRollover" BOOLEAN NOT NULL DEFAULT true,
    "hasFixedPeriod" BOOLEAN NOT NULL DEFAULT false,
    "defaultPeriodMonths" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_categories_name_key" ON "employee_categories"("name");
CREATE UNIQUE INDEX "employee_categories_code_key" ON "employee_categories"("code");

-- Seed the 4 categories that already exist as enum values, preserving their
-- current behavior exactly:
--  - Permanent / Contractual: accrue an anniversary-based leave balance
--    (unchanged from the old hardcoded scheduler logic).
--  - Provision: a fixed 6-month probation (was hardcoded as addMonths(_, 6)
--    in the scheduler -- now the category's own defaultPeriodMonths).
--  - Trial: a fixed period, but HR sets the actual length per employee via
--    Employee.trialMonths (no prior default existed, so defaultPeriodMonths
--    is left NULL here -- HR always chose it per hire).
INSERT INTO "employee_categories"
  ("id", "name", "code", "accruesRollover", "hasFixedPeriod", "defaultPeriodMonths", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Permanent', 'PERMANENT', true, false, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Provision (Probation)', 'PROVISION', false, true, 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Contractual', 'CONTRACTUAL', true, false, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Trial', 'TRIAL', false, true, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: employees -- swap the enum column for a nullable FK, backfilling
-- every existing employee's category from the old enum value first.
ALTER TABLE "employees" ADD COLUMN "leaveCategoryId" TEXT;

UPDATE "employees" e
SET "leaveCategoryId" = c."id"
FROM "employee_categories" c
WHERE c."code" = e."leaveCategory"::TEXT;

ALTER TABLE "employees" DROP COLUMN "leaveCategory";

ALTER TABLE "employees" ADD CONSTRAINT "employees_leaveCategoryId_fkey" FOREIGN KEY ("leaveCategoryId") REFERENCES "employee_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: leave_category_policies -- same swap, but the column stays
-- required (every existing row already had a non-null enum value, and all
-- 4 possible values were just seeded above, so the backfill is complete
-- before we enforce NOT NULL).
ALTER TABLE "leave_category_policies" ADD COLUMN "leaveCategoryId" TEXT;

UPDATE "leave_category_policies" p
SET "leaveCategoryId" = c."id"
FROM "employee_categories" c
WHERE c."code" = p."leaveCategory"::TEXT;

DROP INDEX "leave_category_policies_leaveCategory_leaveTypeId_key";

ALTER TABLE "leave_category_policies" DROP COLUMN "leaveCategory";
ALTER TABLE "leave_category_policies" ALTER COLUMN "leaveCategoryId" SET NOT NULL;

CREATE UNIQUE INDEX "leave_category_policies_leaveCategoryId_leaveTypeId_key" ON "leave_category_policies"("leaveCategoryId", "leaveTypeId");

ALTER TABLE "leave_category_policies" ADD CONSTRAINT "leave_category_policies_leaveCategoryId_fkey" FOREIGN KEY ("leaveCategoryId") REFERENCES "employee_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The enum is no longer referenced by any column -- safe to drop.
DROP TYPE "LeaveEmployeeCategory";
