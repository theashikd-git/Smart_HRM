/*
  Warnings:

  - You are about to drop the column `subDepartmentId` on the `department_superiors` table. All the data in the column will be lost.
  - You are about to drop the column `branchId` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `locationId` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `gradeId` on the `designations` table. All the data in the column will be lost.
  - You are about to drop the column `branchId` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `locationId` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `sectionId` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `subDepartmentId` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the `branches` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `grades` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `locations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sub_departments` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[departmentId,employeeId,title]` on the table `department_superiors` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "branches" DROP CONSTRAINT "branches_companyId_fkey";

-- DropForeignKey
ALTER TABLE "branches" DROP CONSTRAINT "branches_managerId_fkey";

-- DropForeignKey
ALTER TABLE "department_superiors" DROP CONSTRAINT "department_superiors_subDepartmentId_fkey";

-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_branchId_fkey";

-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_locationId_fkey";

-- DropForeignKey
ALTER TABLE "designations" DROP CONSTRAINT "designations_gradeId_fkey";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_branchId_fkey";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_locationId_fkey";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_subDepartmentId_fkey";

-- DropForeignKey
ALTER TABLE "locations" DROP CONSTRAINT "locations_branchId_fkey";

-- DropForeignKey
ALTER TABLE "sections" DROP CONSTRAINT "sections_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "sections" DROP CONSTRAINT "sections_subDepartmentId_fkey";

-- DropForeignKey
ALTER TABLE "sub_departments" DROP CONSTRAINT "sub_departments_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "sub_departments" DROP CONSTRAINT "sub_departments_headEmployeeId_fkey";

-- DropIndex
DROP INDEX "department_superiors_departmentId_subDepartmentId_employeeI_key";

-- AlterTable
ALTER TABLE "department_superiors" DROP COLUMN "subDepartmentId";

-- AlterTable
ALTER TABLE "departments" DROP COLUMN "branchId",
DROP COLUMN "locationId";

-- AlterTable
ALTER TABLE "designations" DROP COLUMN "gradeId";

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "branchId",
DROP COLUMN "locationId",
DROP COLUMN "sectionId",
DROP COLUMN "subDepartmentId";

-- DropTable
DROP TABLE "branches";

-- DropTable
DROP TABLE "grades";

-- DropTable
DROP TABLE "locations";

-- DropTable
DROP TABLE "sections";

-- DropTable
DROP TABLE "sub_departments";

-- DropEnum
DROP TYPE "LocationType";

-- CreateIndex
CREATE UNIQUE INDEX "department_superiors_departmentId_employeeId_title_key" ON "department_superiors"("departmentId", "employeeId", "title");
