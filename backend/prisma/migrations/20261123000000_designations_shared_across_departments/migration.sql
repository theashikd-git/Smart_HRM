-- Designations become one shared, company-wide list. A department now picks
-- the designations it uses through the new join table (many-to-many).
--
-- What this does, in order:
--   1. creates department_designations
--   2. groups designations by lower(trim(title)); the oldest of each group is kept
--   3. links every old (department, designation) pair to the kept record
--   4. repoints employees and attendance-policy scopes to the kept record
--   5. also links each employee's own (department, designation) pair, so nobody
--      ends up with a designation their department doesn't list
--   6. deletes the duplicates, trims titles, drops designations.departmentId
--   7. adds a case-insensitive unique index on the title
-- No employee loses a designation. A designation that had no department is NOT
-- linked anywhere unless an employee already holds it (then only to that
-- employee's department); link the rest from Organization > Department.

-- 1. Join table ---------------------------------------------------------------
CREATE TABLE "department_designations" (
    "departmentId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_designations_pkey" PRIMARY KEY ("departmentId","designationId")
);

CREATE INDEX "department_designations_designationId_idx" ON "department_designations"("designationId");

ALTER TABLE "department_designations" ADD CONSTRAINT "department_designations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "department_designations" ADD CONSTRAINT "department_designations_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Which record survives for each title -----------------------------------
CREATE TEMP TABLE "_designation_merge" AS
SELECT
    d."id" AS "oldId",
    FIRST_VALUE(d."id") OVER (
        PARTITION BY lower(btrim(d."title"))
        ORDER BY d."createdAt", d."id"
    ) AS "keepId"
FROM "designations" d;

-- A merged designation is ACTIVE if any of its duplicates was ACTIVE.
UPDATE "designations" k
SET "status" = 'ACTIVE'
WHERE k."id" IN (
    SELECT m."keepId"
    FROM "_designation_merge" m
    JOIN "designations" d ON d."id" = m."oldId"
    WHERE d."status" = 'ACTIVE'
);

-- 3. Old (department, designation) pairs -> links to the kept record ---------
INSERT INTO "department_designations" ("departmentId", "designationId")
SELECT DISTINCT d."departmentId", m."keepId"
FROM "designations" d
JOIN "_designation_merge" m ON m."oldId" = d."id"
WHERE d."departmentId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Repoint everything that referenced a duplicate -------------------------
UPDATE "employees" e
SET "designationId" = m."keepId"
FROM "_designation_merge" m
WHERE e."designationId" = m."oldId" AND m."oldId" <> m."keepId";

-- Attendance policy scopes keep a designation id as plain text (no foreign key).
UPDATE "attendance_policy_scopes" s
SET "targetId" = m."keepId"
FROM "_designation_merge" m
WHERE s."targetType" = 'DESIGNATION' AND s."targetId" = m."oldId" AND m."oldId" <> m."keepId";

-- Two duplicates in the same policy would now be the same scope twice.
DELETE FROM "attendance_policy_scopes" a
USING "attendance_policy_scopes" b
WHERE a."targetType" = 'DESIGNATION'
  AND a."id" > b."id"
  AND a."policyId" = b."policyId"
  AND a."kind" = b."kind"
  AND a."targetType" = b."targetType"
  AND a."targetId" = b."targetId";

-- 5. Each employee's own pair, so existing staff stay consistent ------------
INSERT INTO "department_designations" ("departmentId", "designationId")
SELECT DISTINCT e."departmentId", e."designationId"
FROM "employees" e
WHERE e."departmentId" IS NOT NULL AND e."designationId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- 6. Remove duplicates, tidy titles, drop the old column ---------------------
DELETE FROM "designations"
WHERE "id" IN (SELECT "oldId" FROM "_designation_merge" WHERE "oldId" <> "keepId");

UPDATE "designations" SET "title" = btrim("title") WHERE "title" <> btrim("title");

DROP TABLE "_designation_merge";

ALTER TABLE "designations" DROP COLUMN "departmentId";

-- 7. One title per company, ignoring case and surrounding spaces -------------
-- (Prisma cannot express an expression index, so it lives only in this SQL.)
CREATE UNIQUE INDEX "designations_title_lower_key" ON "designations" (lower(btrim("title")));
