-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('EMPLOYEE', 'MANAGER', 'SUPERVISOR', 'ADMINISTRATOR');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "employeeRole" "EmployeeRole" NOT NULL DEFAULT 'EMPLOYEE';
