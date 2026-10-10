BEGIN;
-- Existing sessions become attempt one; no roster or attendance evidence is rewritten.
ALTER TABLE "AttendanceSession" ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_attempt_positive" CHECK ("attemptNumber" > 0),
  ADD CONSTRAINT "AttendanceSession_archive_state" CHECK (("isCurrent" AND "archivedAt" IS NULL) OR (NOT "isCurrent" AND "archivedAt" IS NOT NULL));
DROP INDEX "AttendanceSession_examHallId_businessDate_key";
CREATE UNIQUE INDEX "AttendanceSession_examHallId_businessDate_attemptNumber_key" ON "AttendanceSession"("examHallId","businessDate","attemptNumber");
CREATE UNIQUE INDEX "AttendanceSession_current_hall_date_key" ON "AttendanceSession"("examHallId","businessDate") WHERE "isCurrent";
CREATE TABLE "AttendanceResetOperation" (
  "id" TEXT PRIMARY KEY, "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "challengeNonce" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL, "reason" TEXT NOT NULL, "mode" TEXT NOT NULL,
  "businessDate" DATE NOT NULL, "affectedCandidates" INTEGER NOT NULL,
  "scope" JSONB NOT NULL, "result" JSONB NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AttendanceResetOperation_actorId_idempotencyKey_key" ON "AttendanceResetOperation"("actorId","idempotencyKey");
CREATE UNIQUE INDEX "AttendanceResetOperation_challengeNonce_key" ON "AttendanceResetOperation"("challengeNonce");
CREATE INDEX "AttendanceResetOperation_completedAt_idx" ON "AttendanceResetOperation"("completedAt");
CREATE FUNCTION "protect_attendance_reset_audit"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Attendance reset audit is immutable' USING ERRCODE='23514'; END;
$$;
CREATE TRIGGER "AttendanceResetOperation_immutable" BEFORE UPDATE OR DELETE ON "AttendanceResetOperation" FOR EACH ROW EXECUTE FUNCTION "protect_attendance_reset_audit"();
CREATE FUNCTION "protect_archived_attendance_session"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT OLD."isCurrent" THEN RAISE EXCEPTION 'Archived attendance attempts are immutable' USING ERRCODE='23514'; END IF;
  IF OLD.status='CLOSED' THEN RAISE EXCEPTION 'Finalized attendance attempts are immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "AttendanceSession_archive_protection" BEFORE UPDATE OR DELETE ON "AttendanceSession" FOR EACH ROW EXECUTE FUNCTION "protect_archived_attendance_session"();
CREATE FUNCTION "protect_attendance_attempt_evidence"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_attempt BOOLEAN; attempt_status "AttendanceSessionStatus";
BEGIN
  IF TG_OP <> 'INSERT' AND OLD."sessionId" IS NOT NULL THEN
    SELECT "isCurrent",status INTO current_attempt,attempt_status FROM "AttendanceSession" WHERE id=OLD."sessionId" FOR SHARE;
    IF NOT current_attempt OR attempt_status = 'CLOSED' THEN RAISE EXCEPTION 'Archived or finalized attendance evidence is immutable' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW."sessionId" IS NOT NULL THEN
    SELECT "isCurrent",status INTO current_attempt,attempt_status FROM "AttendanceSession" WHERE id=NEW."sessionId" FOR SHARE;
    IF NOT current_attempt OR attempt_status <> 'OPEN' THEN RAISE EXCEPTION 'Attendance writes require a current OPEN attempt' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Attendance_archived_evidence" BEFORE INSERT OR UPDATE OR DELETE ON "Attendance" FOR EACH ROW EXECUTE FUNCTION "protect_attendance_attempt_evidence"();
CREATE TRIGGER "AttendanceSessionCandidate_archived_evidence" BEFORE INSERT OR UPDATE OR DELETE ON "AttendanceSessionCandidate" FOR EACH ROW EXECUTE FUNCTION "protect_attendance_attempt_evidence"();

COMMIT;
