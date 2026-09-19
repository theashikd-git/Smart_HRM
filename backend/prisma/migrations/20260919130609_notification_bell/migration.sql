/*
  Warnings:

  - You are about to drop the column `employeeId` on the `notifications` table. All the data in the column will be lost.
  - Added the required column `userId` to the `notifications` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_employeeId_fkey";

-- DropIndex
DROP INDEX "notifications_employeeId_createdAt_idx";

-- DropIndex
DROP INDEX "notifications_employeeId_isRead_idx";

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "employeeId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
