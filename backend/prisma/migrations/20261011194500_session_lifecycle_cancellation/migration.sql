-- Forward-only, additive lifecycle extension to reviewed PR #14.
-- Enum CANCELLED was committed by the immediately preceding migration.
BEGIN;

ALTER TABLE "AttendanceSession"
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledByUserId" TEXT;

ALTER TABLE "AttendanceSession"
  ADD CONSTRAINT "AttendanceSession_cancellation_state"
  CHECK (
    (status = 'CANCELLED' AND NOT "isCurrent" AND "archivedAt" IS NOT NULL
      AND "cancelledAt" IS NOT NULL AND "cancelledByUserId" IS NOT NULL)
    OR
    (status <> 'CANCELLED' AND "cancelledAt" IS NULL AND "cancelledByUserId" IS NULL)
  );

CREATE TABLE "AttendanceSessionCancellation" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL UNIQUE,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "challengeNonce" TEXT NOT NULL UNIQUE,
  "requestHash" TEXT NOT NULL,
  "snapshotFingerprint" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "approvalReference" TEXT,
  "retentionApproved" BOOLEAN NOT NULL DEFAULT false,
  "externalDispositionAttested" BOOLEAN NOT NULL DEFAULT false,
  "closedEvidenceApproved" BOOLEAN NOT NULL DEFAULT false,
  "previousStatus" "AttendanceSessionStatus" NOT NULL,
  "businessDate" DATE NOT NULL,
  "purgeAttendance" BOOLEAN NOT NULL,
  "markedCount" INTEGER NOT NULL,
  "deletedCount" INTEGER NOT NULL,
  "retainedCount" INTEGER NOT NULL,
  "expectedCount" INTEGER NOT NULL,
  "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceSessionCancellation_session_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendanceSessionCancellation_metadata" CHECK (
    "id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND "idempotencyKey" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND "challengeNonce" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND "requestHash" ~ '^[0-9a-f]{64}$'
    AND "snapshotFingerprint" ~ '^[0-9a-f]{64}$'
    AND length(btrim("actorName")) > 0
    AND length(btrim("reason")) BETWEEN 10 AND 1000
    AND "previousStatus" IN ('OPEN','CLOSED')
    AND "markedCount" >= 0 AND "expectedCount" >= 0
    AND "markedCount" <= "expectedCount"
    AND "deletedCount" >= 0 AND "retainedCount" >= 0
    AND (
      ("purgeAttendance" AND "retentionApproved" AND "externalDispositionAttested"
        AND "approvalReference" IS NOT NULL AND length(btrim("approvalReference")) BETWEEN 8 AND 160
        AND ("previousStatus" <> 'CLOSED' OR "closedEvidenceApproved")
        AND "deletedCount" = "markedCount" AND "retainedCount" = 0)
      OR
      (NOT "purgeAttendance" AND "deletedCount" = 0 AND "retainedCount" = "markedCount")
    )
  )
);
CREATE UNIQUE INDEX "AttendanceSessionCancellation_actorId_idempotencyKey_key"
  ON "AttendanceSessionCancellation"("actorId", "idempotencyKey");
CREATE INDEX "AttendanceSessionCancellation_cancelledAt_idx"
  ON "AttendanceSessionCancellation"("cancelledAt");

-- All cancellation audits are insert-once historical facts.
CREATE FUNCTION "protect_attendance_cancellation_audit"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Session cancellation audit records are immutable' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER "AttendanceSessionCancellation_immutable"
  BEFORE UPDATE OR DELETE ON "AttendanceSessionCancellation"
  FOR EACH ROW EXECUTE FUNCTION "protect_attendance_cancellation_audit"();

-- Permit a single, exact, audited cancellation transition. Every other
-- archival transition continues to use PR #14's strict reset constraints.
CREATE OR REPLACE FUNCTION "protect_archived_attendance_session"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cancellation "AttendanceSessionCancellation";
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Attendance attempt identities are immutable and cannot be deleted' USING ERRCODE='23514';
  END IF;
  IF NOT OLD."isCurrent" THEN
    RAISE EXCEPTION 'Archived attendance attempts are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.id <> OLD.id OR NEW."examHallId" <> OLD."examHallId"
    OR NEW."businessDate" <> OLD."businessDate" OR NEW."attemptNumber" <> OLD."attemptNumber" THEN
    RAISE EXCEPTION 'Attendance attempt identities and generations are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status = 'CANCELLED' THEN
    SELECT * INTO cancellation FROM "AttendanceSessionCancellation"
      WHERE id = nullif(current_setting('azm.cancel_audit_id', true), '')
        AND "sessionId" = OLD.id;
    IF OLD.status NOT IN ('OPEN', 'CLOSED') OR cancellation.id IS NULL
      OR cancellation."previousStatus" <> OLD.status
      OR cancellation."actorId" IS DISTINCT FROM NEW."cancelledByUserId"
      OR cancellation."cancelledAt" IS DISTINCT FROM NEW."cancelledAt"
      OR NOT OLD."isCurrent" OR NEW."isCurrent" OR OLD."archivedAt" IS NOT NULL
      OR NEW."archivedAt" IS NULL
      OR (to_jsonb(NEW) - ARRAY['status','isCurrent','archivedAt','cancelledAt','cancelledByUserId'])
       <> (to_jsonb(OLD) - ARRAY['status','isCurrent','archivedAt','cancelledAt','cancelledByUserId']) THEN
      RAISE EXCEPTION 'Cancellation requires a matching immutable audit and unchanged attempt evidence' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT NEW."isCurrent" THEN
    IF NEW."archivedAt" IS NULL
      OR (to_jsonb(NEW) - ARRAY['isCurrent','archivedAt']) <>
         (to_jsonb(OLD) - ARRAY['isCurrent','archivedAt']) THEN
      RAISE EXCEPTION 'Attendance evidence is immutable; reset may only archive metadata' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'CLOSED' THEN
    RAISE EXCEPTION 'Finalized attendance attempts are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

-- An archived CANCELLED attempt is allowed without a replacement, but only
-- when the same transaction created a matching cancellation audit.
CREATE OR REPLACE FUNCTION "require_closed_attendance_reset"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."isCurrent" AND NOT NEW."isCurrent" THEN
    IF NEW.status = 'CANCELLED' THEN
      IF NOT EXISTS (
        SELECT 1 FROM "AttendanceSessionCancellation" operation
        WHERE operation."sessionId" = OLD.id
          AND operation."previousStatus" = OLD.status
          AND operation."cancelledAt" = NEW."cancelledAt"
          AND operation."actorId" = NEW."cancelledByUserId"
      ) THEN
        RAISE EXCEPTION 'Cancelled archival requires an exact cancellation audit' USING ERRCODE='23514';
      END IF;
      RETURN NULL;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "AttendanceResetOperation" operation
      CROSS JOIN LATERAL jsonb_array_elements(operation.result->'attempts') attempt
      JOIN "AttendanceSession" replacement ON replacement.id=attempt->>'newSessionId'
      WHERE attempt->>'previousSessionId'=OLD.id
        AND operation.result->>'status'='COMPLETED' AND operation.scope->'sessionIds' ? OLD.id
        AND EXISTS (SELECT 1 FROM "User" actor WHERE actor.id=operation."actorId" AND actor.role='SUPER_ADMIN' AND actor.status='ACTIVE')
        AND replacement."examHallId"=OLD."examHallId" AND replacement."businessDate"=OLD."businessDate"
        AND replacement."attemptNumber"=OLD."attemptNumber"+1 AND replacement."isCurrent" AND replacement.status='OPEN'
        AND replacement."openedByUserId"=operation."actorId"
        AND replacement."closedAt" IS NULL AND replacement."closedByUserId" IS NULL
        AND replacement."hallNameSnapshot"=OLD."hallNameSnapshot" AND replacement."roomNumberSnapshot"=OLD."roomNumberSnapshot"
        AND replacement."testCenterNameSnapshot" IS NOT DISTINCT FROM OLD."testCenterNameSnapshot"
        AND replacement."examDateSnapshot"=OLD."examDateSnapshot" AND replacement."reportingTimeSnapshot"=OLD."reportingTimeSnapshot"
        AND NOT EXISTS (SELECT 1 FROM "Attendance" evidence WHERE evidence."sessionId"=replacement.id)
        AND NOT EXISTS (
          (SELECT to_jsonb(candidate)-ARRAY['id','sessionId','createdAt'] FROM "AttendanceSessionCandidate" candidate WHERE candidate."sessionId"=OLD.id
           EXCEPT
           SELECT to_jsonb(candidate)-ARRAY['id','sessionId','createdAt'] FROM "AttendanceSessionCandidate" candidate WHERE candidate."sessionId"=replacement.id)
          UNION ALL
          (SELECT to_jsonb(candidate)-ARRAY['id','sessionId','createdAt'] FROM "AttendanceSessionCandidate" candidate WHERE candidate."sessionId"=replacement.id
           EXCEPT
           SELECT to_jsonb(candidate)-ARRAY['id','sessionId','createdAt'] FROM "AttendanceSessionCandidate" candidate WHERE candidate."sessionId"=OLD.id)
        )
    ) THEN
      RAISE EXCEPTION 'Attendance archival requires reset audit and exact replacement roster' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- Exception for deleting ONLY marks associated with the exact current session
-- named by an immutable cancellation audit inside the transaction.
CREATE OR REPLACE FUNCTION "protect_attendance_attempt_evidence"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_attempt BOOLEAN; attempt_status "AttendanceSessionStatus";
BEGIN
  -- A frozen roster must never be rewritten, even while its session is OPEN.
  IF TG_TABLE_NAME = 'AttendanceSessionCandidate' AND TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'Frozen attendance roster is immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME = 'Attendance' THEN
    IF OLD."sessionId" IS NULL OR NOT EXISTS (
      SELECT 1 FROM "AttendanceSessionCancellation" op
      JOIN "AttendanceSession" session ON session.id=op."sessionId"
      JOIN "User" actor ON actor.id=op."actorId"
      WHERE op.id=nullif(current_setting('azm.cancel_audit_id', true), '')
        AND op."sessionId"=OLD."sessionId" AND op."purgeAttendance"
        AND op."retentionApproved" AND op."externalDispositionAttested"
        AND actor.role='SUPER_ADMIN' AND actor.status='ACTIVE'
        AND session."isCurrent" AND session.status IN ('OPEN','CLOSED')
    ) THEN
      RAISE EXCEPTION 'Historical attendance is immutable: deletion requires an authorized, scoped cancellation audit' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD."sessionId" IS NOT NULL THEN
    SELECT "isCurrent", status INTO current_attempt, attempt_status
      FROM "AttendanceSession" WHERE id=OLD."sessionId" FOR SHARE;
    IF NOT current_attempt OR attempt_status = 'CLOSED' OR attempt_status = 'CANCELLED' THEN
      RAISE EXCEPTION 'Archived or finalized attendance evidence is immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW."sessionId" IS NOT NULL THEN
    SELECT "isCurrent", status INTO current_attempt, attempt_status
      FROM "AttendanceSession" WHERE id=NEW."sessionId" FOR SHARE;
    IF NOT current_attempt OR attempt_status <> 'OPEN' THEN
      RAISE EXCEPTION 'Attendance writes require a current OPEN attempt' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Deferred checks also catch fabricated audit rows and incomplete purges.
CREATE FUNCTION "validate_attendance_cancellation_audit"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session "AttendanceSession"; current_marks INTEGER; current_roster INTEGER;
BEGIN
  SELECT * INTO session FROM "AttendanceSession" WHERE id=NEW."sessionId" FOR UPDATE;
  IF session.id IS NULL OR session.status <> 'CANCELLED' OR session."isCurrent"
    OR session."archivedAt" IS NULL
    OR session."cancelledAt" IS DISTINCT FROM NEW."cancelledAt"
    OR session."cancelledByUserId" IS DISTINCT FROM NEW."actorId"
    OR session."businessDate" IS DISTINCT FROM NEW."businessDate"
    OR NOT EXISTS (
      SELECT 1 FROM "User" actor WHERE actor.id=NEW."actorId"
        AND actor.name=NEW."actorName" AND actor.role='SUPER_ADMIN' AND actor.status='ACTIVE'
    ) THEN
    RAISE EXCEPTION 'Invalid or incomplete attendance cancellation audit' USING ERRCODE='23514';
  END IF;
  SELECT count(*) INTO current_marks FROM "Attendance" WHERE "sessionId"=NEW."sessionId";
  SELECT count(*) INTO current_roster FROM "AttendanceSessionCandidate" WHERE "sessionId"=NEW."sessionId";
  IF NEW."expectedCount" <> current_roster
     OR (NEW."purgeAttendance" AND current_marks <> 0)
     OR (NOT NEW."purgeAttendance" AND current_marks <> NEW."markedCount")
     OR (NEW."purgeAttendance" AND EXISTS (
       SELECT 1 FROM "AttendanceSessionCandidate" member
       JOIN "Student" student ON student.id=member."studentId"
       WHERE member."sessionId"=NEW."sessionId"
         AND (student."testScore" IS NOT NULL OR student."overallRank" IS NOT NULL)
     )) THEN
    RAISE EXCEPTION 'Cancellation violates preserved-roster, results, or attendance coherence' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "AttendanceSessionCancellation_coherence"
  AFTER INSERT ON "AttendanceSessionCancellation"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION "validate_attendance_cancellation_audit"();

COMMIT;
