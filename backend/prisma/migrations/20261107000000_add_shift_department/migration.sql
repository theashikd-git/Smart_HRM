-- AlterTable
-- null = a "General" shift, usable by every department -- every existing
-- row keeps this default so nothing already assigned a shift breaks.
-- MANAGER/SUPERVISOR can only set this to their own department (enforced
-- in ShiftsService), ADMIN/HR can set any department or leave it General.
ALTER TABLE "shifts" ADD COLUMN     "departmentId" TEXT;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
