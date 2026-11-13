BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public."Student" s LEFT JOIN public."AttendanceSession" a ON a.id=s."resultSessionId"
   WHERE s."resultSessionId" IS NOT NULL AND a.id IS NULL AND (s."testScore" IS NOT NULL OR s."overallRank" IS NOT NULL)) THEN
  RAISE EXCEPTION 'Historical result ownership references a missing attempt; review before migration';
 END IF;
END $$;
CREATE TABLE public."ExamLegacyResultHistory" (
 "sessionId" TEXT NOT NULL REFERENCES public."AttendanceSession"(id) ON DELETE RESTRICT,
 "studentId" TEXT NOT NULL REFERENCES public."Student"(id) ON DELETE RESTRICT,
 "testScore" INTEGER, "overallRank" INTEGER, "resetOperationId" TEXT,
 "source" TEXT NOT NULL DEFAULT 'CONTROL',
 "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("sessionId","studentId"),
 CHECK ("testScore" IS NOT NULL OR "overallRank" IS NOT NULL),
 CHECK (("source"='CONTROL' AND "resetOperationId" IS NOT NULL) OR ("source"='MIGRATION' AND "resetOperationId" IS NULL)),
 FOREIGN KEY ("resetOperationId") REFERENCES public."ExamControlOperation"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public."ExamLegacyResultHistory" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ExamLegacyResultHistory" FROM PUBLIC;
CREATE POLICY "ExamLegacyResultHistory_read" ON public."ExamLegacyResultHistory" FOR SELECT USING (true);
CREATE POLICY "ExamLegacyResultHistory_signed_insert" ON public."ExamLegacyResultHistory" FOR INSERT WITH CHECK (public.azm_control_privileged());
-- The capability can check only candidate IDs while executing a signed operation.
CREATE POLICY "ExamControl_official_result_presence" ON public."ExaminationResult" FOR SELECT USING (public.azm_control_privileged());
CREATE FUNCTION public.azm_protect_exam_result_history() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'Exam result history is immutable'; END $$;
CREATE TRIGGER "ExamLegacyResultHistory_immutable" BEFORE UPDATE OR DELETE OR TRUNCATE ON public."ExamLegacyResultHistory" FOR EACH STATEMENT EXECUTE FUNCTION public.azm_protect_exam_result_history();
-- Move already-owned historical legacy scores out of current Student fields.
-- Unowned legacy scores remain untouched and require explicit evidence review.
INSERT INTO public."ExamLegacyResultHistory" ("sessionId","studentId","testScore","overallRank","source")
 SELECT s."resultSessionId",s.id,s."testScore",s."overallRank",'MIGRATION'
 FROM public."Student" s JOIN public."AttendanceSession" a ON a.id=s."resultSessionId"
 WHERE NOT a."isCurrent" AND (s."testScore" IS NOT NULL OR s."overallRank" IS NOT NULL);
UPDATE public."Student" s SET "testScore"=NULL,"overallRank"=NULL,"resultSessionId"=NULL
 FROM public."AttendanceSession" a WHERE a.id=s."resultSessionId" AND NOT a."isCurrent"
 AND (s."testScore" IS NOT NULL OR s."overallRank" IS NOT NULL);
DO $$ DECLARE r TEXT; BEGIN
 SELECT pg_get_userbyid(proowner) INTO r FROM pg_proc WHERE oid='public.azm_execute_exam_control(text,text)'::regprocedure;
 EXECUTE format('GRANT SELECT,INSERT ON public."ExamLegacyResultHistory" TO %I',r);
 EXECUTE format('GRANT SELECT ("studentId") ON public."ExaminationResult" TO %I',r);
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='azm_app_dml') THEN GRANT SELECT ON public."ExamLegacyResultHistory" TO azm_app_dml; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.azm_execute_exam_control(payload TEXT, signature TEXT) RETURNS JSONB
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
 IF p->>'action'='DELETE' THEN RAISE EXCEPTION 'Deleting examination history is disabled; use a history-preserving reset'; END IF;
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
  IF EXISTS (SELECT 1 FROM public."AttendanceSession" WHERE id=ids[1] AND NOT "isCurrent") THEN
   INSERT INTO public."ExamLegacyResultHistory" ("sessionId","studentId","testScore","overallRank","resetOperationId")
    SELECT "resultSessionId",id,"testScore","overallRank",op FROM public."Student"
     WHERE id IN(SELECT jsonb_array_elements_text(p->'resultStudentIds')) AND "resultSessionId"=ids[1];
   GET DIAGNOSTICS results_deleted=ROW_COUNT;
   UPDATE public."Student" SET "testScore"=NULL,"overallRank"=NULL,"resultSessionId"=NULL
    WHERE id IN(SELECT jsonb_array_elements_text(p->'resultStudentIds')) AND "resultSessionId"=ids[1];
  END IF;
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
  IF p->>'action'='RESET' AND EXISTS (
   SELECT 1 FROM public."ExaminationResult" r WHERE r."studentId" IN (
    SELECT c."studentId" FROM public."AttendanceSessionCandidate" c WHERE c."sessionId"=ANY(ids)
    UNION SELECT st.id FROM public."Student" st JOIN public."AttendanceSession" a ON a."examHallId"=st."assignedHallId" WHERE a.id=ANY(ids) AND a."isCurrent"
   )
  ) THEN RAISE EXCEPTION 'A candidate has an official result whose attempt ownership requires review; reset is blocked'; END IF;
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
  INSERT INTO public."ExamLegacyResultHistory" ("sessionId","studentId","testScore","overallRank","resetOperationId")
   SELECT "resultSessionId",id,"testScore","overallRank",op FROM public."Student" WHERE "resultSessionId"=ANY(ids);
  GET DIAGNOSTICS results_deleted=ROW_COUNT;
  UPDATE public."Student" SET "testScore"=NULL,"overallRank"=NULL,"resultSessionId"=NULL WHERE "resultSessionId"=ANY(ids);
  UPDATE public."AttendanceSession" SET "isCurrent"=false,"archivedAt"=(clock_timestamp() AT TIME ZONE 'UTC') WHERE id=ANY(ids);
  FOR h IN SELECT DISTINCT hall.* FROM public."ExamHall" hall JOIN public."AttendanceSession" a ON a."examHallId"=hall.id WHERE a.id=ANY(ids) ORDER BY hall.id LOOP
   SELECT * INTO s FROM public."AttendanceSession" WHERE "examHallId"=h.id AND "businessDate"=(p->>'businessDate')::DATE AND "isCurrent";
   IF s.id IS NOT NULL AND NOT s.id=ANY(ids) THEN CONTINUE; END IF;
   -- Prior attempts, rosters and marks remain protected history.
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
  -- Archived attempts remain associated with their original examination.
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
 receipt:=jsonb_build_object('operationId',op,'status','COMPLETED','deletedMarks',0,'deletedRosterEntries',0,'deletedResults',0,'archivedMarks',marks,'archivedRosterEntries',rosters,'archivedResults',results_deleted,'clearedAllocations',cleared,'replacements',replacements,'reprintRequired',cleared>0 OR moving.id IS NOT NULL,'movedStudentId',moving.id,'completedAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 INSERT INTO public."ExamControlOperation"(id,"actorId","actorName","idempotencyKey","requestHash",nonce,action,reason,scope,result)
 VALUES(op,actor.id,actor.name,p->>'idempotencyKey',p->>'requestHash',p->>'nonce',p->>'action',p->>'reason',p->'scope',receipt);
 PERFORM set_config('azm.exam_control_operation','',true);
 RETURN receipt;
END $$;
-- The legacy deferred validator required an immediately OPEN replacement and
-- a legacy reset receipt. Accept the new signed control receipt only when it
-- points to a fresh, empty PRE_OPEN attempt for the exact archived session.
CREATE OR REPLACE FUNCTION public.require_closed_attendance_reset() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD."isCurrent" AND NOT NEW."isCurrent" THEN
  IF NEW.status='CANCELLED' THEN
   IF NOT EXISTS (SELECT 1 FROM public."AttendanceSessionCancellation" c WHERE c."sessionId"=OLD.id AND c."previousStatus"=OLD.status AND c."cancelledAt"=NEW."cancelledAt" AND c."actorId"=NEW."cancelledByUserId") THEN
    RAISE EXCEPTION 'Cancelled archival requires an exact cancellation audit' USING ERRCODE='23514';
   END IF;
   RETURN NULL;
  END IF;
  IF EXISTS (
   SELECT 1 FROM public."ExamControlOperation" o
   CROSS JOIN LATERAL jsonb_array_elements(o.result->'replacements') r
   JOIN public."AttendanceSession" replacement ON replacement.id=r->>'newSessionId'
   JOIN public."User" actor ON actor.id=o."actorId" AND actor.role='SUPER_ADMIN' AND actor.status='ACTIVE'
   WHERE o.action='RESET' AND o.result->>'status'='COMPLETED' AND o.scope->'sessionIds' ? OLD.id
    AND r->>'examHallId'=OLD."examHallId" AND replacement."examHallId"=OLD."examHallId"
    AND replacement."businessDate"=OLD."businessDate" AND replacement."attemptNumber">OLD."attemptNumber"
    AND replacement."isCurrent" AND replacement.status='PRE_OPEN' AND replacement."openedAt" IS NULL
    AND NEW."archivedAt" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public."Attendance" a WHERE a."sessionId"=replacement.id)
    AND NOT EXISTS (SELECT 1 FROM public."AttendanceSessionCandidate" c WHERE c."sessionId"=replacement.id)
  ) THEN RETURN NULL; END IF;
  -- Retain the earlier protected reset contract for legacy callers.
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
END $$;
COMMIT;
