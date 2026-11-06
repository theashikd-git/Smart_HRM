-- CreateEnum
CREATE TYPE "RosterAssignmentStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterTable
-- Existing rows predate this workflow and were only ever created by
-- ADMIN/HR (the controller didn't allow MANAGER until now), so they are
-- treated as already approved. New rows created by a MANAGER start out
-- PENDING instead (see RosterService.upsert).
ALTER TABLE "roster_assignments" ADD COLUMN     "status" "RosterAssignmentStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "roster_assignments" ADD COLUMN     "assignedById" TEXT;
ALTER TABLE "roster_assignments" ADD COLUMN     "approvedById" TEXT;
ALTER TABLE "roster_assignments" ADD COLUMN     "approvedAt" TIMESTAMP(3);
ALTER TABLE "roster_assignments" ADD COLUMN     "hrNote" TEXT;

-- AddForeignKey
ALTER TABLE "roster_assignments" ADD CONSTRAINT "roster_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_assignments" ADD CONSTRAINT "roster_assignments_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
