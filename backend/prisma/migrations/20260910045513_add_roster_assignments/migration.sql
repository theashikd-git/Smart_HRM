-- CreateEnum
CREATE TYPE "RosterDayType" AS ENUM ('SHIFT', 'OFF');

-- CreateTable
CREATE TABLE "roster_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "RosterDayType" NOT NULL DEFAULT 'SHIFT',
    "shiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roster_assignments_date_idx" ON "roster_assignments"("date");

-- CreateIndex
CREATE UNIQUE INDEX "roster_assignments_employeeId_date_key" ON "roster_assignments"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "roster_assignments" ADD CONSTRAINT "roster_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_assignments" ADD CONSTRAINT "roster_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
