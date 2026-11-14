-- Speed-up indexes (no data change). IF NOT EXISTS so it is safe to re-run.
CREATE INDEX IF NOT EXISTS "employees_status_idx" ON "employees"("status");
CREATE INDEX IF NOT EXISTS "employees_departmentId_status_idx" ON "employees"("departmentId", "status");
CREATE INDEX IF NOT EXISTS "employees_createdAt_idx" ON "employees"("createdAt");
CREATE INDEX IF NOT EXISTS "attendance_logs_timestamp_idx" ON "attendance_logs"("timestamp");
CREATE INDEX IF NOT EXISTS "attendance_records_date_status_idx" ON "attendance_records"("date", "status");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
