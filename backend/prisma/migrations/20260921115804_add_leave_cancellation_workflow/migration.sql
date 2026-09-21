-- CreateEnum
CREATE TYPE "LeaveCancellationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "cancellationCurrentTierOrder" INTEGER,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "cancellationRequestedById" TEXT,
ADD COLUMN     "cancellationStatus" "LeaveCancellationStatus";

-- CreateTable
CREATE TABLE "leave_cancellation_decisions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tierOrder" INTEGER NOT NULL,
    "tierLabel" TEXT NOT NULL,
    "approverId" TEXT,
    "decision" "LeaveDecisionType" NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_cancellation_decisions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_cancellationRequestedById_fkey" FOREIGN KEY ("cancellationRequestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_cancellation_decisions" ADD CONSTRAINT "leave_cancellation_decisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_cancellation_decisions" ADD CONSTRAINT "leave_cancellation_decisions_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
