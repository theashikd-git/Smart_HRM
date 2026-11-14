-- Remembers what a date held before a pending (awaiting HR approval) change,
-- so rejecting the change can restore it.
ALTER TABLE "roster_assignments" ADD COLUMN "previousType" "RosterDayType";
ALTER TABLE "roster_assignments" ADD COLUMN "previousShiftId" TEXT;
