BEGIN;
ALTER TABLE "Student" ADD COLUMN "resultSessionId" TEXT;
-- Existing non-null scores remain explicitly unowned. New writes require a real attempt.
CREATE FUNCTION public.azm_guard_result_ownership() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW."testScore",NEW."overallRank",NEW."resultSessionId") IS NOT DISTINCT FROM ROW(OLD."testScore",OLD."overallRank",OLD."resultSessionId") THEN RETURN NEW; END IF;
 IF NEW."testScore" IS NULL AND NEW."overallRank" IS NULL THEN NEW."resultSessionId":=NULL; RETURN NEW; END IF;
 -- Only signed evidence mapping may attach an unchanged legacy result to a
 -- retained historical roster. Ordinary result edits still need a current run.
 IF TG_OP='UPDATE' AND OLD."resultSessionId" IS NULL AND NEW."resultSessionId" IS NOT NULL
  AND ROW(NEW."testScore",NEW."overallRank") IS NOT DISTINCT FROM ROW(OLD."testScore",OLD."overallRank")
  AND public.azm_control_privileged() AND current_setting('azm.exam_result_mapping',true)=NEW."resultSessionId"
  AND EXISTS(SELECT 1 FROM public."AttendanceSessionCandidate" c WHERE c."sessionId"=NEW."resultSessionId" AND c."studentId"=NEW.id) THEN RETURN NEW; END IF;
 IF NEW."resultSessionId" IS NULL OR NOT EXISTS(SELECT 1 FROM public."AttendanceSessionCandidate" c JOIN public."AttendanceSession" s ON s.id=c."sessionId" WHERE c."sessionId"=NEW."resultSessionId" AND c."studentId"=NEW.id AND s."isCurrent") THEN
  RAISE EXCEPTION 'Result writes require explicit current examination attempt ownership; map legacy results with evidence first';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Student_result_ownership" BEFORE INSERT OR UPDATE ON "Student" FOR EACH ROW EXECUTE FUNCTION azm_guard_result_ownership();
ALTER TABLE "AttendanceSession" ALTER COLUMN "openedByUserId" DROP NOT NULL,
 ALTER COLUMN "openedAt" DROP NOT NULL, ALTER COLUMN "openedAt" DROP DEFAULT,
 ADD COLUMN "preparedByUserId" TEXT, ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
-- Default OPEN retained for compatibility inserts; all new portal preparation is explicit PRE_OPEN.
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_open_metadata" CHECK (
 (status='PRE_OPEN' AND "openedAt" IS NULL AND "openedByUserId" IS NULL AND "closedAt" IS NULL)
 OR (status<>'PRE_OPEN' AND "openedAt" IS NOT NULL AND "openedByUserId" IS NOT NULL));
-- Historical IDs remain immutable text facts after their operational target is deleted.
ALTER TABLE "AttendanceSessionCancellation" DROP CONSTRAINT "AttendanceSessionCancellation_session_fkey";
ALTER TABLE "AttendanceSessionReopening" DROP CONSTRAINT "AttendanceSessionReopening_sessionId_fkey";

CREATE TABLE "ExamPlacementControl" (
 "testCenterId" TEXT NOT NULL, "businessDate" DATE NOT NULL,
 frozen BOOLEAN NOT NULL DEFAULT false, revision INTEGER NOT NULL DEFAULT 0,
 "changedBy" TEXT, "changedAt" TIMESTAMP(3), reason TEXT,
 PRIMARY KEY ("testCenterId","businessDate"));
CREATE TABLE "ExamAttemptSequence" (
 "examHallId" TEXT NOT NULL, "businessDate" DATE NOT NULL, generation INTEGER NOT NULL,
 PRIMARY KEY ("examHallId","businessDate"));
INSERT INTO "ExamAttemptSequence" SELECT "examHallId","businessDate",max("attemptNumber") FROM "AttendanceSession" GROUP BY 1,2;
CREATE TABLE "ExamControlOperation" (
 id TEXT PRIMARY KEY, "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL,
 "idempotencyKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, nonce TEXT NOT NULL UNIQUE,
 action TEXT NOT NULL, reason TEXT NOT NULL, scope JSONB NOT NULL, result JSONB NOT NULL,
 "completedAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
 UNIQUE ("actorId","idempotencyKey"));
CREATE TRIGGER "ExamControlOperation_immutable" BEFORE UPDATE OR DELETE ON "ExamControlOperation"
 FOR EACH ROW EXECUTE FUNCTION protect_attendance_reset_audit();
CREATE TABLE "ExamLifecycleEvent" (
 id TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL, "examHallId" TEXT NOT NULL,
 "businessDate" DATE NOT NULL,"testCenterId" TEXT,action TEXT NOT NULL,
 "actorId" TEXT NOT NULL,"actorName" TEXT NOT NULL,reason TEXT NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
CREATE INDEX "ExamLifecycleEvent_testCenterId_businessDate_occurredAt_idx" ON "ExamLifecycleEvent"("testCenterId","businessDate","occurredAt");
CREATE TRIGGER "ExamLifecycleEvent_immutable" BEFORE UPDATE OR DELETE ON "ExamLifecycleEvent" FOR EACH ROW EXECUTE FUNCTION protect_attendance_reset_audit();
CREATE FUNCTION public.azm_record_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE action_name TEXT; user_id TEXT; user_name TEXT; event_reason TEXT;
BEGIN
 IF TG_OP='INSERT' THEN action_name:=CASE WHEN NEW.status='PRE_OPEN' THEN 'PREPARE' ELSE 'OPEN' END;user_id:=coalesce(NEW."preparedByUserId",NEW."openedByUserId");
 ELSIF NEW.status=OLD.status THEN RETURN NEW;
 ELSIF NEW.status='OPEN' AND OLD.status='CLOSED' THEN action_name:='REOPEN';SELECT "actorId",reason INTO user_id,event_reason FROM public."AttendanceSessionReopening" WHERE id=current_setting('azm.reopen_audit_id',true);
 ELSIF NEW.status='OPEN' THEN action_name:='OPEN';user_id:=NEW."openedByUserId";
 ELSIF NEW.status='CLOSED' THEN action_name:='CLOSE';user_id:=NEW."closedByUserId";
 ELSIF NEW.status='CANCELLED' THEN action_name:='CANCEL';user_id:=NEW."cancelledByUserId";
 ELSE RAISE EXCEPTION 'Unsupported lifecycle transition'; END IF;
 SELECT name INTO user_name FROM public."User" WHERE id=user_id AND status='ACTIVE' AND role IN ('ADMIN','SUPER_ADMIN');
 IF user_name IS NULL THEN RAISE EXCEPTION 'Active examination administrator required'; END IF;
 INSERT INTO public."ExamLifecycleEvent"(id,"sessionId","examHallId","businessDate","testCenterId",action,"actorId","actorName",reason)
 VALUES(md5(random()::TEXT || (clock_timestamp() AT TIME ZONE 'UTC')::TEXT),NEW.id,NEW."examHallId",NEW."businessDate",(SELECT "testCenterId" FROM public."ExamHall" WHERE id=NEW."examHallId"),action_name,user_id,user_name,coalesce(event_reason,action_name || ' examination attendance'));
 RETURN NEW;
END $$;
CREATE TRIGGER "AttendanceSession_lifecycle_history" AFTER INSERT OR UPDATE ON "AttendanceSession" FOR EACH ROW EXECUTE FUNCTION azm_record_lifecycle();
REVOKE ALL ON FUNCTION public.azm_record_lifecycle() FROM PUBLIC;
REVOKE ALL ON "ExamLifecycleEvent" FROM PUBLIC;
-- Never grant the application access to this key. Provision independently with the API signing key.
CREATE SCHEMA IF NOT EXISTS azm_control_private;
REVOKE ALL ON SCHEMA azm_control_private FROM PUBLIC;
CREATE TABLE azm_control_private.signing_key (id BOOLEAN PRIMARY KEY DEFAULT true CHECK(id), secret TEXT NOT NULL CHECK(length(secret)>=64));
REVOKE ALL ON azm_control_private.signing_key FROM PUBLIC;

-- Native SHA-256 HMAC avoids a pgcrypto extension dependency.
CREATE FUNCTION azm_control_private.hmac256(message TEXT, secret TEXT) RETURNS TEXT
 LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog AS $$
DECLARE k BYTEA:=convert_to(secret,'UTF8'); inner_pad BYTEA:=decode(repeat('36',64),'hex'); outer_pad BYTEA:=decode(repeat('5c',64),'hex'); i INTEGER;
BEGIN
 IF octet_length(k)>64 THEN k:=sha256(k); END IF;
 k:=k || decode(repeat('00',64-octet_length(k)),'hex');
 FOR i IN 0..63 LOOP
  inner_pad:=set_byte(inner_pad,i,get_byte(inner_pad,i)#get_byte(k,i));
  outer_pad:=set_byte(outer_pad,i,get_byte(outer_pad,i)#get_byte(k,i));
 END LOOP;
 RETURN encode(sha256(outer_pad || sha256(inner_pad || convert_to(message,'UTF8'))),'hex');
END $$;
REVOKE ALL ON FUNCTION azm_control_private.hmac256(TEXT,TEXT) FROM PUBLIC;

CREATE FUNCTION public.azm_exam_lock() RETURNS void LANGUAGE sql SET search_path=pg_catalog AS $$ SELECT pg_advisory_xact_lock(73921,19) $$;
CREATE FUNCTION public.azm_exam_statement_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN PERFORM public.azm_exam_lock(); RETURN NULL; END $$;
-- Acquire before row locks for every competing writer, including import/raw SQL paths.
DO $$ DECLARE tab TEXT; BEGIN
 FOREACH tab IN ARRAY ARRAY['Student','OfficeUseRecord','ExamHall','TestCenter','AttendanceSession','AttendanceSessionCandidate','Attendance','ExamPlacementControl'] LOOP
  EXECUTE format('CREATE TRIGGER "ExamControl_statement_lock" BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION public.azm_exam_statement_lock()',tab);
 END LOOP;
END $$;

CREATE FUNCTION public.azm_business_date(value TEXT) RETURNS DATE LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE normalized TEXT; parts TEXT[]; month_number INTEGER;
BEGIN
 IF value IS NULL OR btrim(value)='' THEN RETURN NULL; END IF;
 IF btrim(value) ~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN btrim(value)::DATE; END IF;
 normalized:=regexp_replace(btrim(value),'^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+','','i');
 parts:=regexp_match(normalized,'^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$');
 IF parts IS NULL THEN RETURN NULL; END IF;
 month_number:=array_position(ARRAY['january','february','march','april','may','june','july','august','september','october','november','december'],lower(parts[2]));
 IF month_number IS NULL THEN
  month_number:=array_position(ARRAY['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],lower(parts[2]));
 END IF;
 IF month_number IS NULL THEN RETURN NULL; END IF;
 -- Match hallDate's full and abbreviated English month forms; make_date rejects
 -- impossible days instead of normalizing them into a different examination.
 RETURN make_date(parts[3]::INTEGER,month_number,parts[1]::INTEGER);
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;
CREATE FUNCTION public.azm_assert_editable(center_id TEXT, exam_date DATE) RETURNS void
 LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public."ExamPlacementControl" WHERE "testCenterId"=center_id AND "businessDate"=exam_date AND frozen) THEN
  RAISE EXCEPTION 'Placements frozen. Super Admin must explicitly unfreeze this center/exam.' USING ERRCODE='23514';
 END IF;
END $$;
CREATE FUNCTION public.azm_guard_placements() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE h public."ExamHall"; sid TEXT; date_value DATE; center_id TEXT;
BEGIN
 IF TG_TABLE_NAME='Student' THEN
  IF TG_OP='UPDATE' AND ROW(NEW."assignedHallId",NEW."assignedHall",NEW."assignedRoom",NEW."seatNo") IS NOT DISTINCT FROM ROW(OLD."assignedHallId",OLD."assignedHall",OLD."assignedRoom",OLD."seatNo") THEN RETURN NEW; END IF;
  IF TG_OP<>'INSERT' THEN
   SELECT * INTO h FROM public."ExamHall" WHERE id=OLD."assignedHallId";
   PERFORM public.azm_assert_editable(h."testCenterId",public.azm_business_date(h."examDate"));
  END IF;
  IF TG_OP<>'DELETE' THEN
   SELECT * INTO h FROM public."ExamHall" WHERE id=NEW."assignedHallId";
   PERFORM public.azm_assert_editable(h."testCenterId",public.azm_business_date(h."examDate"));
   IF NEW."assignedHallId" IS NULL AND (NEW."assignedHall" IS NOT NULL OR NEW."assignedRoom" IS NOT NULL OR NEW."seatNo" IS NOT NULL) AND EXISTS(SELECT 1 FROM public."ExamPlacementControl" WHERE frozen) THEN RAISE EXCEPTION 'Resolve legacy text-only placement to a specific Hall/exam before editing while a placement freeze exists'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='OfficeUseRecord' THEN
  IF TG_OP='UPDATE' AND ROW(NEW."testCentre",NEW."testDate",NEW."testReportingTime") IS NOT DISTINCT FROM ROW(OLD."testCentre",OLD."testDate",OLD."testReportingTime") THEN RETURN NEW; END IF;
  sid:=CASE WHEN TG_OP='DELETE' THEN OLD."studentId" ELSE NEW."studentId" END;
  SELECT hall.* INTO h FROM public."Student" student JOIN public."ExamHall" hall ON hall.id=student."assignedHallId" WHERE student.id=sid;
  PERFORM public.azm_assert_editable(h."testCenterId",public.azm_business_date(h."examDate"));
  -- Legacy mirrors have no stable identity: protect every matching center, never guess one duplicate name.
  FOR center_id,date_value IN SELECT c.id, p."businessDate" FROM public."TestCenter" c JOIN public."ExamPlacementControl" p ON p."testCenterId"=c.id
   WHERE p.frozen AND (
    (c.name=CASE WHEN TG_OP='INSERT' THEN NEW."testCentre" ELSE OLD."testCentre" END AND (CASE WHEN TG_OP='INSERT' THEN NEW."testDate" ELSE OLD."testDate" END IS NULL OR p."businessDate"=CASE WHEN TG_OP='INSERT' THEN NEW."testDate" ELSE OLD."testDate" END::DATE)) OR
    (c.name=CASE WHEN TG_OP='DELETE' THEN OLD."testCentre" ELSE NEW."testCentre" END AND (CASE WHEN TG_OP='DELETE' THEN OLD."testDate" ELSE NEW."testDate" END IS NULL OR p."businessDate"=CASE WHEN TG_OP='DELETE' THEN OLD."testDate" ELSE NEW."testDate" END::DATE))) LOOP
   PERFORM public.azm_assert_editable(center_id,date_value);
  END LOOP;
 ELSIF TG_TABLE_NAME='ExamHall' THEN
  IF TG_OP<>'DELETE' AND nullif(btrim(NEW."examDate"),'') IS NOT NULL AND public.azm_business_date(NEW."examDate") IS NULL THEN RAISE EXCEPTION 'Configure a valid examination date or leave it blank'; END IF;
  IF TG_OP<>'INSERT' THEN PERFORM public.azm_assert_editable(OLD."testCenterId",public.azm_business_date(OLD."examDate")); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM public.azm_assert_editable(NEW."testCenterId",public.azm_business_date(NEW."examDate")); END IF;
  -- Sessions currently inherit center scope through their Hall. Do not move
  -- historical operational attempts into another center's deletion scope.
  IF TG_OP='UPDATE' AND OLD."testCenterId" IS DISTINCT FROM NEW."testCenterId" AND EXISTS(SELECT 1 FROM public."AttendanceSession" WHERE "examHallId"=OLD.id) THEN RAISE EXCEPTION 'Delete the reviewed operational Hall sessions before changing its test center'; END IF;
  IF TG_OP='UPDATE' AND public.azm_business_date(OLD."examDate") IS DISTINCT FROM public.azm_business_date(NEW."examDate") AND EXISTS(SELECT 1 FROM public."AttendanceSession" WHERE "examHallId"=OLD.id AND "isCurrent" AND status='OPEN') THEN RAISE EXCEPTION 'Reset the affected OPEN session before changing its examination date'; END IF;
 ELSE
  IF TG_OP<>'DELETE' AND nullif(btrim(NEW."testDate"),'') IS NOT NULL AND public.azm_business_date(NEW."testDate") IS NULL THEN RAISE EXCEPTION 'Configure a valid test center date or leave it blank'; END IF;
  IF TG_OP='UPDATE' AND ROW(NEW.name,NEW."reportingTime",NEW."testDate",NEW.address) IS NOT DISTINCT FROM ROW(OLD.name,OLD."reportingTime",OLD."testDate",OLD.address) THEN RETURN NEW; END IF;
  FOR date_value IN SELECT "businessDate" FROM public."ExamPlacementControl" WHERE "testCenterId"=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END AND frozen LOOP
   PERFORM public.azm_assert_editable(CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,date_value);
  END LOOP;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER "Student_placement_freeze" BEFORE INSERT OR UPDATE OR DELETE ON "Student" FOR EACH ROW EXECUTE FUNCTION azm_guard_placements();
CREATE TRIGGER "OfficeUseRecord_placement_freeze" BEFORE INSERT OR UPDATE OR DELETE ON "OfficeUseRecord" FOR EACH ROW EXECUTE FUNCTION azm_guard_placements();
CREATE TRIGGER "ExamHall_placement_freeze" BEFORE INSERT OR UPDATE OR DELETE ON "ExamHall" FOR EACH ROW EXECUTE FUNCTION azm_guard_placements();
CREATE TRIGGER "TestCenter_placement_freeze" BEFORE UPDATE OR DELETE ON "TestCenter" FOR EACH ROW EXECUTE FUNCTION azm_guard_placements();

-- The deletion exception depends on SECURITY DEFINER identity as well as transaction context.
-- Merely setting an application GUC does not confer that identity.
CREATE FUNCTION public.azm_control_privileged() RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT current_user=(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE proname='azm_execute_exam_control' AND pronamespace='public'::regnamespace)
 AND nullif(current_setting('azm.exam_control_operation',true),'') IS NOT NULL
$$;
-- Preserve old checks for normal operations by wrapping their existing implementations.
ALTER FUNCTION protect_archived_attendance_session() RENAME TO protect_archived_attendance_session_legacy;
CREATE FUNCTION protect_archived_attendance_session() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF public.azm_control_privileged() THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
 IF TG_OP='DELETE' OR NOT OLD."isCurrent" THEN RAISE EXCEPTION 'Session changed; refresh and select the current session.' USING ERRCODE='23514'; END IF;
 IF ROW(NEW.id,NEW."examHallId",NEW."businessDate",NEW."attemptNumber") IS DISTINCT FROM ROW(OLD.id,OLD."examHallId",OLD."businessDate",OLD."attemptNumber") THEN RAISE EXCEPTION 'Attempt identity is immutable'; END IF;
 IF OLD.status='PRE_OPEN' AND NEW.status='OPEN' AND NEW."openedAt" IS NOT NULL AND NEW."openedByUserId" IS NOT NULL AND NEW."isCurrent" AND NOT EXISTS(SELECT 1 FROM public."Attendance" WHERE "sessionId"=OLD.id) THEN RETURN NEW; END IF;
 IF OLD.status='CLOSED' AND NEW.status='OPEN' THEN
  IF NOT EXISTS(SELECT 1 FROM public."AttendanceSessionReopening" WHERE id=current_setting('azm.reopen_audit_id',true) AND "sessionId"=OLD.id AND "previousClosedAt"=OLD."closedAt" AND "previousClosedByUserId"=OLD."closedByUserId")
   OR (to_jsonb(NEW)-ARRAY['status','closedAt','closedByUserId','updatedAt','revision'])<>(to_jsonb(OLD)-ARRAY['status','closedAt','closedByUserId','updatedAt','revision']) THEN RAISE EXCEPTION 'Matching reopening audit required'; END IF;
  IF EXISTS(SELECT 1 FROM public."AttendanceSessionCandidate" own_roster JOIN public."AttendanceSessionCandidate" other_roster ON other_roster."studentId"=own_roster."studentId" JOIN public."AttendanceSession" other_session ON other_session.id=other_roster."sessionId" WHERE own_roster."sessionId"=OLD.id AND other_session.id<>OLD.id AND other_session."isCurrent" AND other_session.status='OPEN') THEN RAISE EXCEPTION 'Conflicting active examination membership. Reset affected sessions before reopening.'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.status='CLOSED' AND NEW."isCurrent" THEN RAISE EXCEPTION 'CLOSED session requires an audited reopen'; END IF;
 IF NOT NEW."isCurrent" AND NEW.status<>'CANCELLED' THEN RAISE EXCEPTION 'Use Exam Session Control to reset'; END IF;
 IF NEW.status='CANCELLED' THEN
  IF NOT EXISTS(SELECT 1 FROM public."AttendanceSessionCancellation" WHERE id=current_setting('azm.cancel_audit_id',true) AND "sessionId"=OLD.id AND "previousStatus"=OLD.status AND "cancelledAt"=NEW."cancelledAt" AND "actorId"=NEW."cancelledByUserId") OR (to_jsonb(NEW)-ARRAY['status','isCurrent','archivedAt','cancelledAt','cancelledByUserId'])<>(to_jsonb(OLD)-ARRAY['status','isCurrent','archivedAt','cancelledAt','cancelledByUserId']) THEN RAISE EXCEPTION 'Matching cancellation audit and unchanged evidence required'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.status='OPEN' AND NEW.status='CLOSED' AND NEW."closedAt" IS NOT NULL AND NEW."closedByUserId" IS NOT NULL AND (to_jsonb(NEW)-ARRAY['status','closedAt','closedByUserId','updatedAt'])=(to_jsonb(OLD)-ARRAY['status','closedAt','closedByUserId','updatedAt']) THEN RETURN NEW; END IF;
 IF NEW.status<>OLD.status OR (to_jsonb(NEW)-ARRAY['revision','updatedAt'])<>(to_jsonb(OLD)-ARRAY['revision','updatedAt']) THEN RAISE EXCEPTION 'Use an authorized lifecycle operation; evidence metadata is immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER "AttendanceSession_archive_protection" ON "AttendanceSession";
CREATE TRIGGER "AttendanceSession_archive_protection" BEFORE UPDATE OR DELETE ON "AttendanceSession" FOR EACH ROW EXECUTE FUNCTION protect_archived_attendance_session();
CREATE OR REPLACE FUNCTION deny_staged_attendance_delete() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN IF public.azm_control_privileged() THEN RETURN OLD; END IF; RAISE EXCEPTION 'Direct attendance deletion denied' USING ERRCODE='23514'; END $$;
CREATE OR REPLACE FUNCTION protect_attendance_attempt_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE s public."AttendanceSession";
BEGIN
 IF public.azm_control_privileged() THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Attendance evidence is immutable' USING ERRCODE='23514'; END IF;
 IF NEW."sessionId" IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO s FROM public."AttendanceSession" WHERE id=NEW."sessionId" FOR SHARE;
 IF s.id IS NULL OR NOT s."isCurrent" OR s.status<>'OPEN' THEN RAISE EXCEPTION 'Attendance writes require current OPEN attempt' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='AttendanceSessionCandidate' AND EXISTS(SELECT 1 FROM public."AttendanceSessionCandidate" other_roster JOIN public."AttendanceSession" other_session ON other_session.id=other_roster."sessionId" WHERE other_roster."studentId"=NEW."studentId" AND other_session.id<>s.id AND other_session."isCurrent" AND other_session.status='OPEN') THEN RAISE EXCEPTION 'One active examination membership per student; reset the affected session first'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION protect_attendance_generation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE g INTEGER;
BEGIN
 PERFORM public.azm_exam_lock();
 INSERT INTO public."ExamAttemptSequence" VALUES(NEW."examHallId",NEW."businessDate",0) ON CONFLICT DO NOTHING;
 UPDATE public."ExamAttemptSequence" SET generation=generation+1 WHERE "examHallId"=NEW."examHallId" AND "businessDate"=NEW."businessDate" RETURNING generation INTO g;
 IF NEW."attemptNumber"<>g OR NOT NEW."isCurrent" OR EXISTS(SELECT 1 FROM public."AttendanceSession" WHERE "examHallId"=NEW."examHallId" AND "businessDate"=NEW."businessDate" AND "isCurrent") THEN RAISE EXCEPTION 'Invalid or reused attempt generation'; END IF;
 RETURN NEW;
END $$;
-- Existing reset/audit validators retain their historical contracts. Legacy resets are retired in API.

CREATE FUNCTION public.azm_sync_live_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s public."AttendanceSession"; prior_context TEXT; d DATE; old_date DATE; source_center TEXT; affected_ids TEXT[]:=ARRAY[]::TEXT[];
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW."assignedHallId",NEW."seatNo") IS NOT DISTINCT FROM ROW(OLD."assignedHallId",OLD."seatNo") THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW."assignedHallId" IS NULL THEN RETURN NEW; END IF;
 IF NEW."assignedHallId" IS NOT NULL AND (TG_OP='INSERT' OR NEW."assignedHallId" IS DISTINCT FROM OLD."assignedHallId") AND NEW.status<>'ACTIVE' THEN RAISE EXCEPTION 'Only ACTIVE students may receive a new allocation'; END IF;
 IF NEW."assignedHallId" IS NOT NULL AND (nullif(btrim(NEW."seatNo"),'') IS NULL OR NOT EXISTS(SELECT 1 FROM public."ExamHall" WHERE id=NEW."assignedHallId") OR EXISTS(SELECT 1 FROM public."Student" WHERE id<>NEW.id AND "assignedHallId"=NEW."assignedHallId" AND "seatNo"=NEW."seatNo") OR (SELECT count(*) FROM public."Student" WHERE "assignedHallId"=NEW."assignedHallId")>(SELECT capacity FROM public."ExamHall" WHERE id=NEW."assignedHallId")) THEN RAISE EXCEPTION 'Invalid Hall, missing/duplicate seat, or capacity exceeded'; END IF;
 SELECT public.azm_business_date("examDate") INTO d FROM public."ExamHall" WHERE id=NEW."assignedHallId";
 IF TG_OP='UPDATE' THEN SELECT public.azm_business_date("examDate") INTO old_date FROM public."ExamHall" WHERE id=OLD."assignedHallId"; END IF;
 -- A global Student allocation represents exactly one active examination at a time.
 IF EXISTS(SELECT 1 FROM public."AttendanceSessionCandidate" c JOIN public."AttendanceSession" a ON a.id=c."sessionId" WHERE c."studentId"=NEW.id AND a."isCurrent" AND a.status='OPEN' AND a."businessDate" IS DISTINCT FROM d AND NEW."assignedHallId" IS NOT NULL) THEN RAISE EXCEPTION 'One active exam allocation per student; reset the affected session before changing exam'; END IF;
 -- Completed examinations on other dates are immutable history, not a permanent
 -- placement lock. Current OPEN progress and CLOSED progress for the requested
 -- examination still require an explicit reviewed reset before moving.
 IF EXISTS(SELECT 1 FROM public."AttendanceSessionCandidate" c JOIN public."AttendanceSession" a ON a.id=c."sessionId" WHERE c."studentId"=NEW.id AND a."isCurrent" AND (a.status='OPEN' OR (a.status='CLOSED' AND a."businessDate"=coalesce(d,old_date))) AND (EXISTS(SELECT 1 FROM public."Attendance" m WHERE m."sessionId"=a.id AND m."studentId"=c."studentId") OR ((NEW."testScore" IS NOT NULL OR NEW."overallRank" IS NOT NULL) AND (NEW."resultSessionId"=a.id OR NEW."resultSessionId" IS NULL)))) THEN RAISE EXCEPTION 'Recorded progress exists. Use Reset affected sessions and move.'; END IF;
 FOR s IN SELECT a.* FROM public."AttendanceSessionCandidate" c JOIN public."AttendanceSession" a ON a.id=c."sessionId" WHERE c."studentId"=NEW.id AND a."isCurrent" AND a.status='OPEN' LOOP
  SELECT "testCenterId" INTO source_center FROM public."ExamHall" WHERE id=s."examHallId";
  PERFORM public.azm_assert_editable(source_center,s."businessDate");
  affected_ids:=array_append(affected_ids,s.id);
 END LOOP;
 prior_context:=current_setting('azm.exam_control_operation',true);
 PERFORM set_config('azm.exam_control_operation','membership-sync',true);
 DELETE FROM public."AttendanceSessionCandidate" c USING public."AttendanceSession" a WHERE c."sessionId"=a.id AND c."studentId"=NEW.id AND a."isCurrent" AND a.status='OPEN';
 FOR s IN SELECT * FROM public."AttendanceSession" WHERE "examHallId"=NEW."assignedHallId" AND "businessDate"=d AND "isCurrent" AND status='OPEN' LOOP
  INSERT INTO public."AttendanceSessionCandidate"(id,"sessionId","studentId","fullNameSnapshot","rollNumberSnapshot","applicationNoSnapshot","currentClassSnapshot","seatNoSnapshot") VALUES(md5(random()::TEXT || (clock_timestamp() AT TIME ZONE 'UTC')::TEXT),s.id,NEW.id,NEW."fullName",NEW."rollNumber",NEW."applicationNo",NEW."currentClass",NEW."seatNo");
  affected_ids:=array_append(affected_ids,s.id);
 END LOOP;
 UPDATE public."AttendanceSession" SET revision=revision+1 WHERE id=ANY(affected_ids) AND "isCurrent" AND status='OPEN';
 PERFORM set_config('azm.exam_control_operation',coalesce(prior_context,''),true);
 RETURN NEW;
END $$;
CREATE TRIGGER "Student_sync_live_membership" AFTER INSERT OR UPDATE ON "Student" FOR EACH ROW EXECUTE FUNCTION azm_sync_live_membership();

-- Freeze state and operation receipts can only be written by the signed function.
CREATE FUNCTION public.azm_protect_control_write() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN IF NOT public.azm_control_privileged() THEN RAISE EXCEPTION 'Signed Exam Session Control capability required'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "ExamPlacementControl_signed_write" BEFORE INSERT OR UPDATE OR DELETE ON "ExamPlacementControl" FOR EACH ROW EXECUTE FUNCTION azm_protect_control_write();
CREATE TRIGGER "ExamControlOperation_signed_insert" BEFORE INSERT ON "ExamControlOperation" FOR EACH ROW EXECUTE FUNCTION azm_protect_control_write();

-- Signed payload is produced only after authenticated impact review under the common lock.
CREATE FUNCTION public.azm_execute_exam_control(payload TEXT, signature TEXT) RETURNS JSONB
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,azm_control_private,pg_temp AS $$
DECLARE p JSONB:=payload::JSONB; secret TEXT; actor public."User"; replay public."ExamControlOperation";
 ids TEXT[]; s public."AttendanceSession"; h public."ExamHall"; replacement TEXT; generation INTEGER;
 moving public."Student"; destination public."ExamHall"; new_seat TEXT; seat_index INTEGER:=1; results_deleted INTEGER:=0;
 receipt JSONB; replacements JSONB:='[]'; marks INTEGER; rosters INTEGER; cleared INTEGER:=0; op TEXT:=p->>'operationId';
BEGIN
 PERFORM public.azm_exam_lock();
 SELECT k.secret INTO secret FROM azm_control_private.signing_key k WHERE id;
 IF secret IS NULL OR signature IS DISTINCT FROM azm_control_private.hmac256(payload,secret) THEN RAISE EXCEPTION 'Invalid exam control capability' USING ERRCODE='42501'; END IF;
 SELECT * INTO actor FROM public."User" WHERE id=p->>'actorId' FOR SHARE;
 IF actor.id IS NULL OR actor.role<>'SUPER_ADMIN' OR actor.status<>'ACTIVE' OR actor."tokenVersion"<>(p->>'tokenVersion')::INTEGER THEN RAISE EXCEPTION 'Super Admin authorization expired' USING ERRCODE='42501'; END IF;
 SELECT * INTO replay FROM public."ExamControlOperation" WHERE "actorId"=actor.id AND "idempotencyKey"=p->>'idempotencyKey';
 IF replay.id IS NOT NULL THEN
  IF replay."requestHash"<>p->>'requestHash' THEN RAISE EXCEPTION 'Idempotency key reused with different request'; END IF;
  RETURN replay.result;
 END IF;
 IF (p->>'expiresAt')::TIMESTAMPTZ<clock_timestamp() OR length(btrim(p->>'reason')) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Expired capability or missing reason'; END IF;
 IF p->>'action' NOT IN ('RESET','DELETE','FREEZE','UNFREEZE','MAP_RESULTS') THEN RAISE EXCEPTION 'Unsupported action'; END IF;
 PERFORM set_config('azm.exam_control_operation',op,true);
 ids:=ARRAY(SELECT jsonb_array_elements_text(p->'sessionIds'));
 IF p->>'action'='MAP_RESULTS' THEN
  IF cardinality(ids)<>1 OR length(btrim(p->>'ownershipEvidence'))<10 THEN RAISE EXCEPTION 'Select one attempt and provide result ownership evidence'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public."AttendanceSession" a JOIN public."ExamHall" hall_scope ON hall_scope.id=a."examHallId" WHERE a.id=ids[1] AND hall_scope."testCenterId"=p->>'testCenterId' AND a."businessDate"=(p->>'businessDate')::DATE) THEN RAISE EXCEPTION 'Invalid result mapping attempt'; END IF;
  IF jsonb_array_length(p->'resultStudentIds') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Select result candidates'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'resultStudentIds') selected WHERE NOT EXISTS(SELECT 1 FROM public."Student" st JOIN public."AttendanceSessionCandidate" c ON c."studentId"=st.id WHERE st.id=selected AND c."sessionId"=ids[1] AND st."resultSessionId" IS NULL AND (st."testScore" IS NOT NULL OR st."overallRank" IS NOT NULL))) THEN RAISE EXCEPTION 'Only reviewed unowned roster results may be mapped'; END IF;
  PERFORM set_config('azm.exam_result_mapping',ids[1],true);
  UPDATE public."Student" SET "resultSessionId"=ids[1] WHERE id IN(SELECT jsonb_array_elements_text(p->'resultStudentIds'));
  PERFORM set_config('azm.exam_result_mapping','',true);
  marks:=0;rosters:=0;
 ELSIF p->>'action' IN ('FREEZE','UNFREEZE') THEN
  IF NOT EXISTS(SELECT 1 FROM public."TestCenter" WHERE id=p->>'testCenterId') THEN RAISE EXCEPTION 'Unknown center'; END IF;
  INSERT INTO public."ExamPlacementControl"("testCenterId","businessDate",frozen,revision,"changedBy","changedAt",reason)
   VALUES(p->>'testCenterId',(p->>'businessDate')::DATE,p->>'action'='FREEZE',1,actor.id,(clock_timestamp() AT TIME ZONE 'UTC'),p->>'reason')
   ON CONFLICT ("testCenterId","businessDate") DO UPDATE SET frozen=EXCLUDED.frozen,revision="ExamPlacementControl".revision+1,"changedBy"=actor.id,"changedAt"=(clock_timestamp() AT TIME ZONE 'UTC'),reason=p->>'reason';
  marks:=0; rosters:=0;
 ELSE
  IF cardinality(ids) NOT BETWEEN 1 AND 50 OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) THEN RAISE EXCEPTION 'Invalid deletion scope'; END IF;
  IF (SELECT count(*) FROM public."AttendanceSession" a JOIN public."ExamHall" hall ON hall.id=a."examHallId" WHERE a.id=ANY(ids) AND hall."testCenterId"=p->>'testCenterId' AND a."businessDate"=(p->>'businessDate')::DATE)<>cardinality(ids) THEN RAISE EXCEPTION 'Session scope changed'; END IF;
  IF p->>'action'='RESET' AND EXISTS(SELECT 1 FROM public."AttendanceSession" WHERE id=ANY(ids) AND (NOT "isCurrent" OR status='CANCELLED')) THEN RAISE EXCEPTION 'Reset requires current attempt'; END IF;
  IF coalesce((p->>'replace')::BOOLEAN,true) AND EXISTS(SELECT 1 FROM public."AttendanceSession" a JOIN public."ExamHall" hall ON hall.id=a."examHallId" WHERE a.id=ANY(ids) AND public.azm_business_date(hall."examDate") IS DISTINCT FROM (p->>'businessDate')::DATE) THEN RAISE EXCEPTION 'Hall is configured for a different examination date. Delete history without replacement, or explicitly configure and prepare the intended exam.'; END IF;
  -- Ambiguous global results are never silently destroyed or represented as fully reset.
  IF EXISTS(SELECT 1 FROM public."Student" st WHERE st."resultSessionId" IS NULL AND (st."testScore" IS NOT NULL OR st."overallRank" IS NOT NULL) AND (st."assignedHallId" IN (SELECT a."examHallId" FROM public."AttendanceSession" a JOIN public."ExamHall" hall ON hall.id=a."examHallId" WHERE a.id=ANY(ids) AND a."isCurrent" AND public.azm_business_date(hall."examDate")=(p->>'businessDate')::DATE) OR st.id IN(SELECT "studentId" FROM public."AttendanceSessionCandidate" WHERE "sessionId"=ANY(ids)))) THEN RAISE EXCEPTION 'Legacy result ownership unresolved. Map results before a full reset.'; END IF;
  IF (p->>'unfreeze')::BOOLEAN THEN
   UPDATE public."ExamPlacementControl" SET frozen=false,revision=revision+1,"changedBy"=actor.id,"changedAt"=(clock_timestamp() AT TIME ZONE 'UTC'),reason=p->>'reason' WHERE "testCenterId"=p->>'testCenterId' AND "businessDate"=(p->>'businessDate')::DATE;
  END IF;
  IF (p->>'clearAllocations')::BOOLEAN THEN
   PERFORM public.azm_assert_editable(p->>'testCenterId',(p->>'businessDate')::DATE);
   IF EXISTS(SELECT 1 FROM public."AttendanceSession" selected WHERE selected.id=ANY(ids) AND NOT selected."isCurrent" AND EXISTS(SELECT 1 FROM public."AttendanceSession" current_attempt WHERE current_attempt."examHallId"=selected."examHallId" AND current_attempt."businessDate"=selected."businessDate" AND current_attempt."isCurrent" AND NOT current_attempt.id=ANY(ids))) THEN RAISE EXCEPTION 'Historical deletion cannot clear retained current allocations'; END IF;
  END IF;
  SELECT count(*) INTO marks FROM public."Attendance" WHERE "sessionId"=ANY(ids);
  SELECT count(*) INTO rosters FROM public."AttendanceSessionCandidate" WHERE "sessionId"=ANY(ids);
  UPDATE public."Student" SET "testScore"=NULL,"overallRank"=NULL,"resultSessionId"=NULL WHERE "resultSessionId"=ANY(ids);
  GET DIAGNOSTICS results_deleted=ROW_COUNT;
  DELETE FROM public."Attendance" WHERE "sessionId"=ANY(ids);
  DELETE FROM public."AttendanceSessionCandidate" WHERE "sessionId"=ANY(ids);
  FOR h IN SELECT DISTINCT hall.* FROM public."ExamHall" hall JOIN public."AttendanceSession" a ON a."examHallId"=hall.id WHERE a.id=ANY(ids) ORDER BY hall.id LOOP
   SELECT * INTO s FROM public."AttendanceSession" WHERE "examHallId"=h.id AND "businessDate"=(p->>'businessDate')::DATE AND "isCurrent";
   IF s.id IS NOT NULL AND NOT s.id=ANY(ids) THEN CONTINUE; END IF;
   DELETE FROM public."AttendanceSession" WHERE id=ANY(ids) AND "examHallId"=h.id;
   IF (p->>'clearAllocations')::BOOLEAN AND public.azm_business_date(h."examDate")=(p->>'businessDate')::DATE THEN
    -- Treat the placement mirrors as one owned tuple. An independently edited
    -- date/center/time must not lose its coincidentally matching other fields.
    UPDATE public."OfficeUseRecord" o SET "testCentre"=NULL,"testDate"=NULL,"testReportingTime"=NULL
     FROM public."Student" st WHERE st.id=o."studentId" AND st."assignedHallId"=h.id
      AND o."testCentre" IS NOT DISTINCT FROM (SELECT name FROM public."TestCenter" WHERE id=h."testCenterId")
      AND o."testDate" IS NOT DISTINCT FROM (p->>'businessDate')::DATE::TIMESTAMP
      AND o."testReportingTime" IS NOT DISTINCT FROM nullif(h."reportingTime",'');
    UPDATE public."Student" SET "assignedHallId"=NULL,"assignedHall"=NULL,"assignedRoom"=NULL,"seatNo"=NULL WHERE "assignedHallId"=h.id;
    GET DIAGNOSTICS generation=ROW_COUNT; cleared:=cleared+generation;
   END IF;
   IF coalesce((p->>'replace')::BOOLEAN,true) THEN
    SELECT seq.generation+1 INTO generation FROM public."ExamAttemptSequence" seq WHERE seq."examHallId"=h.id AND seq."businessDate"=(p->>'businessDate')::DATE;
    replacement:=md5(op || h.id);
    INSERT INTO public."AttendanceSession"(id,"examHallId","businessDate","attemptNumber",status,"preparedByUserId","hallNameSnapshot","roomNumberSnapshot","testCenterNameSnapshot","examDateSnapshot","reportingTimeSnapshot","updatedAt")
     VALUES(replacement,h.id,(p->>'businessDate')::DATE,generation,'PRE_OPEN',actor.id,h.name,h."roomNumber",(SELECT name FROM public."TestCenter" WHERE id=h."testCenterId"),h."examDate",h."reportingTime",(clock_timestamp() AT TIME ZONE 'UTC'));
    replacements:=replacements || jsonb_build_object('examHallId',h.id,'newSessionId',replacement,'attemptNumber',generation,'status','PRE_OPEN');
   END IF;
  END LOOP;
  -- Historical attempts whose current attempt was retained are removed without replacement.
  DELETE FROM public."AttendanceSession" WHERE id=ANY(ids);
  IF p->>'moveStudentId' IS NOT NULL THEN
   IF p->>'action'<>'RESET' OR (p->>'clearAllocations')::BOOLEAN THEN RAISE EXCEPTION 'Invalid reset-and-move action'; END IF;
   SELECT * INTO moving FROM public."Student" WHERE id=p->>'moveStudentId' FOR UPDATE;
   SELECT * INTO destination FROM public."ExamHall" WHERE id=p->>'destinationHallId';
   IF moving.id IS NULL OR moving.status<>'ACTIVE' OR destination.id IS NULL OR destination."testCenterId" IS NULL OR public.azm_business_date(destination."examDate") IS DISTINCT FROM (p->>'businessDate')::DATE THEN RAISE EXCEPTION 'Move candidate/destination changed'; END IF;
   PERFORM public.azm_assert_editable(destination."testCenterId",(p->>'businessDate')::DATE);
   IF (SELECT count(*) FROM public."Student" WHERE "assignedHallId"=destination.id AND id<>moving.id)>=destination.capacity THEN RAISE EXCEPTION 'Destination is full'; END IF;
   IF EXISTS(SELECT 1 FROM public."AttendanceSession" WHERE "examHallId"=destination.id AND "businessDate"=(p->>'businessDate')::DATE AND "isCurrent" AND status<>'PRE_OPEN') THEN RAISE EXCEPTION 'Destination must be PRE_OPEN before a reset-and-move'; END IF;
   LOOP
    new_seat:='Seat #' || lpad(seat_index::TEXT,greatest(2,length(seat_index::TEXT)),'0');
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public."Student" WHERE "assignedHallId"=destination.id AND "seatNo"=new_seat);
    seat_index:=seat_index+1;
   END LOOP;
   UPDATE public."Student" SET "assignedHallId"=destination.id,"assignedHall"=destination.name,"assignedRoom"=destination."roomNumber","seatNo"=new_seat,"updatedAt"=(clock_timestamp() AT TIME ZONE 'UTC') WHERE id=moving.id;
   INSERT INTO public."OfficeUseRecord"(id,"studentId","testCentre","testDate","testReportingTime")
    VALUES(md5(op || moving.id),moving.id,(SELECT name FROM public."TestCenter" WHERE id=destination."testCenterId"),(p->>'businessDate')::DATE,destination."reportingTime")
    ON CONFLICT ("studentId") DO UPDATE SET "testCentre"=EXCLUDED."testCentre","testDate"=EXCLUDED."testDate","testReportingTime"=EXCLUDED."testReportingTime";
  END IF;
 END IF;
 receipt:=jsonb_build_object('operationId',op,'status','COMPLETED','deletedMarks',marks,'deletedRosterEntries',rosters,'deletedResults',results_deleted,'clearedAllocations',cleared,'replacements',replacements,'reprintRequired',cleared>0 OR moving.id IS NOT NULL,'movedStudentId',moving.id,'completedAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 INSERT INTO public."ExamControlOperation"(id,"actorId","actorName","idempotencyKey","requestHash",nonce,action,reason,scope,result)
 VALUES(op,actor.id,actor.name,p->>'idempotencyKey',p->>'requestHash',p->>'nonce',p->>'action',p->>'reason',p->'scope',receipt);
 PERFORM set_config('azm.exam_control_operation','',true);
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.azm_execute_exam_control(TEXT,TEXT) FROM PUBLIC;
CREATE FUNCTION public.azm_exam_capability_probe(payload TEXT,signature TEXT) RETURNS BOOLEAN
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,azm_control_private,pg_temp AS $$
 SELECT coalesce((SELECT signature=azm_control_private.hmac256(payload,secret) FROM azm_control_private.signing_key WHERE id),false)
$$;
REVOKE ALL ON FUNCTION public.azm_exam_capability_probe(TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.azm_sync_live_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_attendance_generation() FROM PUBLIC;
REVOKE ALL ON "ExamControlOperation","ExamPlacementControl","ExamAttemptSequence" FROM PUBLIC;
COMMIT;
