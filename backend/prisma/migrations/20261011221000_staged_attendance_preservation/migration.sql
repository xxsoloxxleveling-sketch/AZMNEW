-- AZM.AIO Stage 1: cancellation must preserve attendance evidence.
-- This is intentionally additive to the reviewed PR #14/#15 migrations.
-- It does NOT depend on any application feature flag or environment variable.
-- PostgreSQL table owners remain privileged; PR #16 role separation is required.
BEGIN;

-- Existing completed purge audits, if any, block staged activation.
-- Production inspection showed this table does not exist until the prior migrations.
ALTER TABLE "AttendanceSessionCancellation"
  ADD CONSTRAINT "AttendanceSessionCancellation_staged_no_purge"
  CHECK ("purgeAttendance" = false AND "deletedCount" = 0
    AND "retainedCount" = "markedCount");

-- Even when a caller fabricates an application-scoped GUC and a matching
-- audit, every actual attendance DELETE is rejected at the database boundary.
CREATE FUNCTION "deny_staged_attendance_delete"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Immutable attendance evidence: hard deletion is disabled during staged release'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "Attendance_staged_no_delete"
  BEFORE DELETE ON "Attendance"
  FOR EACH ROW EXECUTE FUNCTION "deny_staged_attendance_delete"();

COMMIT;
