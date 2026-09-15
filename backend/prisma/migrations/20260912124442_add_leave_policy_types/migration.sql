-- CreateEnum
CREATE TYPE "LeaveEmployeeCategory" AS ENUM ('PERMANENT', 'PROVISION', 'CONTRACTUAL', 'TRIAL');

-- CreateEnum
CREATE TYPE "LeaveSpecialRule" AS ENUM ('NONE', 'COMPENSATORY', 'MATERNITY');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "categorySince" TIMESTAMP(3),
ADD COLUMN     "leaveCategory" "LeaveEmployeeCategory",
ADD COLUMN     "trialMonths" INTEGER;

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "attachmentId" TEXT,
ADD COLUMN     "compensatoryForDate" DATE;

-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN     "specialRule" "LeaveSpecialRule" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "leave_category_policies" (
    "id" TEXT NOT NULL,
    "leaveCategory" "LeaveEmployeeCategory" NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "daysPerCycle" DECIMAL(5,1) NOT NULL,
    "carryForward" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryForwardDays" DECIMAL(5,1),
    "carryForwardOnce" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_category_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_category_policies_leaveCategory_leaveTypeId_key" ON "leave_category_policies"("leaveCategory", "leaveTypeId");

-- AddForeignKey
ALTER TABLE "leave_category_policies" ADD CONSTRAINT "leave_category_policies_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
