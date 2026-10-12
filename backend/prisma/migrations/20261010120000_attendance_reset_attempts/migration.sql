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
ALTER TABLE "AttendanceResetOperation" ADD CONSTRAINT "AttendanceResetOperation_metadata_shape" CHECK (
  id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND "idempotencyKey" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND "challengeNonce" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND "requestHash" ~ '^[0-9a-f]{64}$' AND length(btrim("actorName"))>0
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
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Attendance attempts are immutable historical identities' USING ERRCODE='23514'; END IF;
  IF NEW.id<>OLD.id OR NEW."examHallId"<>OLD."examHallId" OR NEW."businessDate"<>OLD."businessDate" OR NEW."attemptNumber"<>OLD."attemptNumber" THEN
    RAISE EXCEPTION 'Attendance attempt identities and generations are immutable' USING ERRCODE='23514';
  END IF;
  IF NOT NEW."isCurrent" THEN
    IF NEW."archivedAt" IS NULL OR (to_jsonb(NEW) - ARRAY['isCurrent','archivedAt']) <> (to_jsonb(OLD) - ARRAY['isCurrent','archivedAt']) THEN
      RAISE EXCEPTION 'Attendance evidence is immutable; archival may only change archive metadata' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='CLOSED' THEN
    -- Finalization evidence is never edited. A reset may only archive the intact row;
    -- the deferred constraint below requires its replacement and immutable audit.
    IF TG_OP='UPDATE' THEN
      IF OLD."isCurrent" AND NOT NEW."isCurrent" AND OLD."archivedAt" IS NULL AND NEW."archivedAt" IS NOT NULL
         AND (to_jsonb(NEW) - ARRAY['isCurrent','archivedAt']) = (to_jsonb(OLD) - ARRAY['isCurrent','archivedAt']) THEN
        RETURN NEW;
      END IF;
    END IF;
    RAISE EXCEPTION 'Finalized attendance attempts are immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "AttendanceSession_archive_protection" BEFORE UPDATE OR DELETE ON "AttendanceSession" FOR EACH ROW EXECUTE FUNCTION "protect_archived_attendance_session"();
CREATE FUNCTION "require_closed_attendance_reset"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."isCurrent" AND NOT NEW."isCurrent" THEN
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
    ) THEN RAISE EXCEPTION 'Closed attendance archival requires a reset audit and exact replacement roster' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "AttendanceSession_closed_reset_coherence" AFTER UPDATE ON "AttendanceSession" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "require_closed_attendance_reset"();
CREATE FUNCTION "protect_attendance_generation"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous "AttendanceSession";
BEGIN
  PERFORM id FROM "ExamHall" WHERE id=NEW."examHallId" FOR UPDATE;
  SELECT * INTO previous FROM "AttendanceSession" WHERE "examHallId"=NEW."examHallId" AND "businessDate"=NEW."businessDate" ORDER BY "attemptNumber" DESC LIMIT 1;
  IF NOT NEW."isCurrent" OR NEW."archivedAt" IS NOT NULL
     OR (previous.id IS NULL AND NEW."attemptNumber"<>1)
     OR (previous.id IS NOT NULL AND (previous."isCurrent" OR NEW."attemptNumber"<>previous."attemptNumber"+1 OR NEW.status<>'OPEN')) THEN
    RAISE EXCEPTION 'Attendance generations require attempt one or the next audited current replacement' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "AttendanceSession_generation_protection" BEFORE INSERT ON "AttendanceSession" FOR EACH ROW EXECUTE FUNCTION "protect_attendance_generation"();
CREATE FUNCTION "validate_attendance_reset_audit"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt JSONB; prior "AttendanceSession"; replacement "AttendanceSession"; candidate_count INTEGER; total_count INTEGER:=0; old_ids TEXT[]:=ARRAY[]::TEXT[]; new_ids TEXT[]:=ARRAY[]::TEXT[];
BEGIN
  IF NEW.mode NOT IN ('HALL','SELECTED','EXAM_DATE','CURRENT') OR length(btrim(NEW.reason)) NOT BETWEEN 5 AND 1000
     OR NEW."affectedCandidates"<0 OR NEW.scope->>'mode' IS DISTINCT FROM NEW.mode
     OR NEW.scope->>'businessDate' IS DISTINCT FROM to_char(NEW."businessDate",'YYYY-MM-DD')
     OR jsonb_typeof(NEW.scope->'sessionIds') IS DISTINCT FROM 'array'
     OR jsonb_typeof(NEW.result->'attempts') IS DISTINCT FROM 'array'
     OR NEW.result->>'status' IS DISTINCT FROM 'COMPLETED' OR NEW.result->>'resetReference' IS DISTINCT FROM NEW.id
     OR NEW.result->>'completedAt' IS NULL
     OR jsonb_typeof(NEW.result->'affectedCandidates') IS DISTINCT FROM 'number'
     OR NOT EXISTS (SELECT 1 FROM "User" actor WHERE actor.id=NEW."actorId" AND actor.name=NEW."actorName" AND actor.role='SUPER_ADMIN' AND actor.status='ACTIVE') THEN
    RAISE EXCEPTION 'Invalid attendance reset audit' USING ERRCODE='23514';
  END IF;
  IF (NEW.result->>'completedAt')::timestamptz IS DISTINCT FROM NEW."completedAt" AT TIME ZONE 'UTC'
     OR jsonb_array_length(NEW.result->'attempts') NOT BETWEEN 1 AND 100
     OR jsonb_array_length(NEW.scope->'sessionIds')<>jsonb_array_length(NEW.result->'attempts')
     OR (NEW.mode='HALL' AND jsonb_array_length(NEW.result->'attempts')<>1) THEN
    RAISE EXCEPTION 'Invalid attendance reset audit scope' USING ERRCODE='23514';
  END IF;
  FOR attempt IN SELECT value FROM jsonb_array_elements(NEW.result->'attempts') ORDER BY value->>'previousSessionId' LOOP
    SELECT * INTO prior FROM "AttendanceSession" WHERE id=attempt->>'previousSessionId' FOR UPDATE;
    SELECT * INTO replacement FROM "AttendanceSession" WHERE id=attempt->>'newSessionId';
    IF prior.id IS NULL OR replacement.id IS NULL OR prior."isCurrent" OR prior."archivedAt" IS NULL
       OR NOT replacement."isCurrent" OR replacement.status<>'OPEN' OR replacement."closedAt" IS NOT NULL OR replacement."closedByUserId" IS NOT NULL
       OR prior."businessDate"<>NEW."businessDate" OR replacement."businessDate"<>prior."businessDate" OR replacement."examHallId"<>prior."examHallId"
       OR replacement."attemptNumber"<>prior."attemptNumber"+1 OR replacement."openedByUserId"<>NEW."actorId"
       OR NOT (NEW.scope->'sessionIds' ? prior.id) OR prior.id=ANY(old_ids) OR replacement.id=ANY(new_ids)
       OR attempt->>'examHallId' IS DISTINCT FROM prior."examHallId" OR attempt->>'hallName' IS DISTINCT FROM prior."hallNameSnapshot"
       OR attempt->>'attemptNumber' IS DISTINCT FROM replacement."attemptNumber"::TEXT
       OR jsonb_typeof(attempt->'attemptNumber') IS DISTINCT FROM 'number' OR jsonb_typeof(attempt->'expectedCount') IS DISTINCT FROM 'number'
       OR (NEW.scope ? 'testCenterId' AND NOT EXISTS (SELECT 1 FROM "ExamHall" hall WHERE hall.id=prior."examHallId" AND hall."testCenterId"=NEW.scope->>'testCenterId'))
       OR EXISTS (SELECT 1 FROM "AttendanceResetOperation" other WHERE other.id<>NEW.id AND other.scope->'sessionIds' ? prior.id)
       OR EXISTS (SELECT 1 FROM "Attendance" mark WHERE mark."sessionId"=replacement.id)
       OR (to_jsonb(replacement)-ARRAY['id','attemptNumber','isCurrent','archivedAt','status','openedByUserId','openedAt','closedByUserId','closedAt','createdAt','updatedAt'])
          <> (to_jsonb(prior)-ARRAY['id','attemptNumber','isCurrent','archivedAt','status','openedByUserId','openedAt','closedByUserId','closedAt','createdAt','updatedAt'])
       OR EXISTS (
         (SELECT to_jsonb(row)-ARRAY['id','sessionId','createdAt'] FROM "AttendanceSessionCandidate" row WHERE row."sessionId"=prior.id EXCEPT SELECT to_jsonb(row)-ARRAY['id','sessionId','createdAt'] FROM "AttendanceSessionCandidate" row WHERE row."sessionId"=replacement.id)
         UNION ALL
         (SELECT to_jsonb(row)-ARRAY['id','sessionId','createdAt'] FROM "AttendanceSessionCandidate" row WHERE row."sessionId"=replacement.id EXCEPT SELECT to_jsonb(row)-ARRAY['id','sessionId','createdAt'] FROM "AttendanceSessionCandidate" row WHERE row."sessionId"=prior.id)
       ) THEN
      RAISE EXCEPTION 'Invalid attendance reset audit replacement' USING ERRCODE='23514';
    END IF;
    SELECT count(*) INTO candidate_count FROM "AttendanceSessionCandidate" WHERE "sessionId"=prior.id;
    IF attempt->>'expectedCount' IS DISTINCT FROM candidate_count::TEXT THEN RAISE EXCEPTION 'Invalid attendance reset audit count' USING ERRCODE='23514'; END IF;
    total_count:=total_count+candidate_count; old_ids:=array_append(old_ids,prior.id); new_ids:=array_append(new_ids,replacement.id);
  END LOOP;
  IF NEW."affectedCandidates"<>total_count OR NEW.result->>'affectedCandidates' IS DISTINCT FROM total_count::TEXT
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.scope->'sessionIds') id WHERE jsonb_typeof(id)<>'string' OR NOT (id#>>'{}'=ANY(old_ids)))
     OR (NEW.mode IN ('CURRENT','EXAM_DATE') AND EXISTS (SELECT 1 FROM "AttendanceSession" session JOIN "ExamHall" hall ON hall.id=session."examHallId" WHERE session."isCurrent" AND session."businessDate"=NEW."businessDate" AND (NOT (NEW.scope ? 'testCenterId') OR hall."testCenterId"=NEW.scope->>'testCenterId') AND NOT (session.id=ANY(new_ids)))) THEN
    RAISE EXCEPTION 'Invalid attendance reset audit complete scope or totals' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "AttendanceResetOperation_insert_validation" AFTER INSERT ON "AttendanceResetOperation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "validate_attendance_reset_audit"();
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
