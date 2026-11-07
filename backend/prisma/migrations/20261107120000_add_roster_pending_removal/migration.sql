-- AlterTable
-- Lets a MANAGER/SUPERVISOR request clearing a past-date roster entry
-- without deleting it outright -- the row (and its current content) stays
-- exactly as it was until HR/Admin approves the request, at which point
-- RosterService.approve() actually deletes it. Defaults to false so every
-- existing row is unaffected.
ALTER TABLE "roster_assignments" ADD COLUMN     "pendingRemoval" BOOLEAN NOT NULL DEFAULT false;
