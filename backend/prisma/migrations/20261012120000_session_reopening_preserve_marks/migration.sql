-- Audited Super Admin re-opening of a current CLOSED attendance attempt.
-- Preserves existing mark rows, frozen rosters and prior closure timestamps in append-only evidence.
BEGIN;
CREATE TABLE "AttendanceSessionReopening" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL REFERENCES "AttendanceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "previousClosedAt" TIMESTAMP(3) NOT NULL,
  "previousClosedByUserId" TEXT NOT NULL,
  "expectedCount" INTEGER NOT NULL,
  "markedCount" INTEGER NOT NULL,
  "reopenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceSessionReopening_valid_fields" CHECK (
    length(btrim("actorId"))>0 AND length(btrim("actorName"))>0
    AND length(btrim("previousClosedByUserId"))>0 AND length(btrim("reason")) BETWEEN 10 AND 1000
    AND "expectedCount">=0 AND "markedCount">=0 AND "markedCount"<="expectedCount"
  )
);
CREATE INDEX "AttendanceSessionReopening_sessionId_reopenedAt_idx"
  ON "AttendanceSessionReopening"("sessionId","reopenedAt");

CREATE FUNCTION "protect_attendance_reopening_audit"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Attendance reopening audit is immutable' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER "AttendanceSessionReopening_immutable"
  BEFORE UPDATE OR DELETE ON "AttendanceSessionReopening" FOR EACH ROW
  EXECUTE FUNCTION "protect_attendance_reopening_audit"();

CREATE FUNCTION "validate_attendance_reopening_insert"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session_record "AttendanceSession"; candidate_count INTEGER; marked_count INTEGER;
BEGIN
  IF NEW.id IS DISTINCT FROM nullif(current_setting('azm.reopen_audit_id', true),'') THEN
    RAISE EXCEPTION 'Reopening requires a transaction-scoped audit reference' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "User" actor
       WHERE actor.id=NEW."actorId" AND actor.name=NEW."actorName"
         AND actor.role='SUPER_ADMIN' AND actor.status='ACTIVE') THEN
    RAISE EXCEPTION 'Reopening requires an active Super Admin' USING ERRCODE='23514';
  END IF;
  SELECT * INTO session_record FROM "AttendanceSession" WHERE id=NEW."sessionId";
  IF NOT FOUND OR NOT session_record."isCurrent" OR session_record.status<>'CLOSED'
     OR session_record."archivedAt" IS NOT NULL
     OR session_record."closedAt" IS DISTINCT FROM NEW."previousClosedAt"
     OR session_record."closedByUserId" IS DISTINCT FROM NEW."previousClosedByUserId" THEN
    RAISE EXCEPTION 'Reopening requires exact current CLOSED session evidence' USING ERRCODE='23514';
  END IF;
  SELECT count(*) INTO candidate_count FROM "AttendanceSessionCandidate" WHERE "sessionId"=NEW."sessionId";
  SELECT count(*) INTO marked_count FROM "Attendance" WHERE "sessionId"=NEW."sessionId";
  IF candidate_count<>NEW."expectedCount" OR marked_count<>NEW."markedCount" THEN
    RAISE EXCEPTION 'Reopening attendance snapshot mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "AttendanceSessionReopening_insert_validation"
  BEFORE INSERT ON "AttendanceSessionReopening" FOR EACH ROW
  EXECUTE FUNCTION "validate_attendance_reopening_insert"();

CREATE FUNCTION "require_attendance_reopening_coherence"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state "AttendanceSession";
BEGIN
  SELECT * INTO state FROM "AttendanceSession" WHERE id=NEW."sessionId";
  IF NOT FOUND OR NOT state."isCurrent" OR state.status<>'OPEN'
     OR state."closedAt" IS NOT NULL OR state."closedByUserId" IS NOT NULL
     OR state."archivedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Reopening audit requires corresponding OPEN transition' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "AttendanceSessionReopening_coherence"
  AFTER INSERT ON "AttendanceSessionReopening" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "require_attendance_reopening_coherence"();

-- Retain cancellation/reset protections exactly, permitting only audit-correlated CLOSED->OPEN.
CREATE OR REPLACE FUNCTION "protect_archived_attendance_session"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cancellation "AttendanceSessionCancellation";
  reopening "AttendanceSessionReopening";
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Attendance attempt identities are immutable and cannot be deleted' USING ERRCODE='23514';
  END IF;
  IF NOT OLD."isCurrent" THEN
    RAISE EXCEPTION 'Archived attendance attempts are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.id<>OLD.id OR NEW."examHallId"<>OLD."examHallId"
     OR NEW."businessDate"<>OLD."businessDate" OR NEW."attemptNumber"<>OLD."attemptNumber" THEN
    RAISE EXCEPTION 'Attendance attempt identities and generations are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status='CANCELLED' THEN
    SELECT * INTO cancellation FROM "AttendanceSessionCancellation"
      WHERE id=nullif(current_setting('azm.cancel_audit_id',true),'')
      AND "sessionId"=OLD.id;
    IF OLD.status NOT IN ('OPEN','CLOSED') OR cancellation.id IS NULL
       OR cancellation."previousStatus"<>OLD.status
       OR cancellation."actorId" IS DISTINCT FROM NEW."cancelledByUserId"
       OR cancellation."cancelledAt" IS DISTINCT FROM NEW."cancelledAt"
       OR NOT OLD."isCurrent" OR NEW."isCurrent" OR OLD."archivedAt" IS NOT NULL
       OR NEW."archivedAt" IS NULL
       OR (to_jsonb(NEW)-ARRAY['status','isCurrent','archivedAt','cancelledAt','cancelledByUserId'])
         <>(to_jsonb(OLD)-ARRAY['status','isCurrent','archivedAt','cancelledAt','cancelledByUserId']) THEN
      RAISE EXCEPTION 'Cancellation requires matching immutable audit and unchanged evidence' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT NEW."isCurrent" THEN
    IF NEW."archivedAt" IS NULL
       OR (to_jsonb(NEW)-ARRAY['isCurrent','archivedAt'])
         <>(to_jsonb(OLD)-ARRAY['isCurrent','archivedAt']) THEN
      RAISE EXCEPTION 'Attendance evidence is immutable; reset may only archive metadata' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='CLOSED' THEN
    SELECT * INTO reopening FROM "AttendanceSessionReopening"
      WHERE id=nullif(current_setting('azm.reopen_audit_id',true),'')
      AND "sessionId"=OLD.id;
    IF NEW.status<>'OPEN' OR reopening.id IS NULL
       OR reopening."previousClosedAt" IS DISTINCT FROM OLD."closedAt"
       OR reopening."previousClosedByUserId" IS DISTINCT FROM OLD."closedByUserId"
       OR NEW."closedAt" IS NOT NULL OR NEW."closedByUserId" IS NOT NULL
       OR NOT NEW."isCurrent" OR NEW."archivedAt" IS NOT NULL
       OR (to_jsonb(NEW)-ARRAY['status','closedAt','closedByUserId','updatedAt'])
         <>(to_jsonb(OLD)-ARRAY['status','closedAt','closedByUserId','updatedAt']) THEN
      RAISE EXCEPTION 'CLOSED attempts reopen only with matching immutable Super Admin audit' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
