-- Attendance policies (grace/late conversion), holiday duty, flexible shifts
-- and per-employee policy exemption. Non-destructive: only adds enum values,
-- columns with defaults and new tables. Existing shifts become FIXED.

-- New attendance statuses
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'GRACE';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'HOLIDAY_DUTY';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'SHORT_HOURS';

-- New enums
CREATE TYPE "ShiftType" AS ENUM ('FIXED', 'FLEXIBLE');
CREATE TYPE "PolicyType" AS ENUM ('GRACE', 'LATE');
CREATE TYPE "PolicyScopeKind" AS ENUM ('INCLUDE', 'EXCLUDE');
CREATE TYPE "PolicyTargetType" AS ENUM ('DEPARTMENT', 'DESIGNATION', 'EMPLOYEE');

-- Shifts: fixed (default) or flexible with required daily hours
ALTER TABLE "shifts" ADD COLUMN "shiftType" "ShiftType" NOT NULL DEFAULT 'FIXED';
ALTER TABLE "shifts" ADD COLUMN "requiredHours" DECIMAL(4,2);

-- Employees: attendance policy exemption
ALTER TABLE "employees" ADD COLUMN "policyExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "employees" ADD COLUMN "policyExemptUntil" DATE;
ALTER TABLE "employees" ADD COLUMN "policyExemptReason" TEXT;

-- Policies
CREATE TABLE "attendance_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PolicyType" NOT NULL,
    "params" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "attendance_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attendance_policies_type_isActive_idx" ON "attendance_policies"("type", "isActive");

CREATE TABLE "attendance_policy_scopes" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "kind" "PolicyScopeKind" NOT NULL,
    "targetType" "PolicyTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    CONSTRAINT "attendance_policy_scopes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attendance_policy_scopes_policyId_idx" ON "attendance_policy_scopes"("policyId");
ALTER TABLE "attendance_policy_scopes" ADD CONSTRAINT "attendance_policy_scopes_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "attendance_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "policy_occurrences" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "type" "PolicyType" NOT NULL,
    "date" DATE NOT NULL,
    "windowKey" TEXT NOT NULL,
    "windowStart" DATE NOT NULL,
    "windowEnd" DATE NOT NULL,
    "counted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_occurrences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "policy_occurrences_employeeId_policyId_date_key" ON "policy_occurrences"("employeeId", "policyId", "date");
CREATE INDEX "policy_occurrences_employeeId_date_idx" ON "policy_occurrences"("employeeId", "date");
ALTER TABLE "policy_occurrences" ADD CONSTRAINT "policy_occurrences_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_occurrences" ADD CONSTRAINT "policy_occurrences_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "attendance_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "policy_absences" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "type" "PolicyType" NOT NULL,
    "date" DATE NOT NULL,
    "windowKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_absences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "policy_absences_employeeId_policyId_date_key" ON "policy_absences"("employeeId", "policyId", "date");
CREATE INDEX "policy_absences_employeeId_date_idx" ON "policy_absences"("employeeId", "date");
CREATE INDEX "policy_absences_date_idx" ON "policy_absences"("date");
ALTER TABLE "policy_absences" ADD CONSTRAINT "policy_absences_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_absences" ADD CONSTRAINT "policy_absences_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "attendance_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Absent day <-> occurrences (implicit many-to-many, Prisma naming)
CREATE TABLE "_AbsenceOccurrences" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_AbsenceOccurrences_AB_unique" ON "_AbsenceOccurrences"("A", "B");
CREATE INDEX "_AbsenceOccurrences_B_index" ON "_AbsenceOccurrences"("B");
ALTER TABLE "_AbsenceOccurrences" ADD CONSTRAINT "_AbsenceOccurrences_A_fkey"
    FOREIGN KEY ("A") REFERENCES "policy_absences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_AbsenceOccurrences" ADD CONSTRAINT "_AbsenceOccurrences_B_fkey"
    FOREIGN KEY ("B") REFERENCES "policy_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
