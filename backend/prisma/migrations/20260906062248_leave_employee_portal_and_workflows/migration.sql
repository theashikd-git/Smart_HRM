/*
  Warnings:

  - A unique constraint covering the columns `[employeeId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LeaveTierType" AS ENUM ('REPORTING_SUPERIOR', 'SPECIFIC_USER');

-- CreateEnum
CREATE TYPE "LeaveDecisionType" AS ENUM ('APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'EMPLOYEE';

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "currentTierOrder" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "employeeId" TEXT;

-- CreateTable
CREATE TABLE "leave_approval_workflows" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_approval_tiers" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "type" "LeaveTierType" NOT NULL,
    "approverUserId" TEXT,

    CONSTRAINT "leave_approval_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_approval_decisions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tierOrder" INTEGER NOT NULL,
    "tierLabel" TEXT NOT NULL,
    "approverId" TEXT,
    "decision" "LeaveDecisionType" NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_approval_workflows_departmentId_key" ON "leave_approval_workflows"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_approval_tiers_workflowId_order_key" ON "leave_approval_tiers"("workflowId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_workflows" ADD CONSTRAINT "leave_approval_workflows_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_tiers" ADD CONSTRAINT "leave_approval_tiers_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "leave_approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_tiers" ADD CONSTRAINT "leave_approval_tiers_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_decisions" ADD CONSTRAINT "leave_approval_decisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_decisions" ADD CONSTRAINT "leave_approval_decisions_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
