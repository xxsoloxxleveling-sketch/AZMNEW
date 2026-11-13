BEGIN;
-- Existing records stay unbound until an authorized person verifies roster evidence.
ALTER TABLE public."ExaminationResult" ADD COLUMN "attendanceSessionId" TEXT;
ALTER TABLE public."ExaminationResult" ADD CONSTRAINT "ExaminationResult_attendanceSessionId_fkey"
 FOREIGN KEY ("attendanceSessionId") REFERENCES public."AttendanceSession"(id) ON DELETE RESTRICT;
DROP INDEX public."ExaminationResult_studentId_examinationId_key";
CREATE UNIQUE INDEX "ExaminationResult_studentId_examinationId_attendanceSessionId_key"
 ON public."ExaminationResult"("studentId","examinationId","attendanceSessionId");
CREATE UNIQUE INDEX "ExaminationResult_unbound_student_exam_key"
 ON public."ExaminationResult"("studentId","examinationId") WHERE "attendanceSessionId" IS NULL;

CREATE TABLE public."OfficialResultAttemptBinding" (
 "resultId" TEXT PRIMARY KEY REFERENCES public."ExaminationResult"(id) ON DELETE RESTRICT,
 "sessionId" TEXT NOT NULL REFERENCES public."AttendanceSession"(id) ON DELETE RESTRICT,
 "studentId" TEXT NOT NULL REFERENCES public."Student"(id) ON DELETE RESTRICT,
 "actorId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
 "actorName" TEXT NOT NULL,
 evidence TEXT NOT NULL CHECK(length(btrim(evidence)) BETWEEN 12 AND 1000),
 "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OfficialResultAttemptBinding_sessionId_studentId_idx" ON public."OfficialResultAttemptBinding"("sessionId","studentId");
ALTER TABLE public."OfficialResultAttemptBinding" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."OfficialResultAttemptBinding" FROM PUBLIC;
CREATE POLICY "OfficialResultAttemptBinding_read" ON public."OfficialResultAttemptBinding" FOR SELECT USING (true);
CREATE POLICY "OfficialResultAttemptBinding_signed_insert" ON public."OfficialResultAttemptBinding" FOR INSERT WITH CHECK (public.azm_control_privileged());
CREATE FUNCTION public.azm_protect_official_attempt_binding() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Official result attempt bindings are immutable'; END $$;
CREATE TRIGGER "OfficialResultAttemptBinding_immutable" BEFORE UPDATE OR DELETE OR TRUNCATE ON public."OfficialResultAttemptBinding" FOR EACH STATEMENT EXECUTE FUNCTION public.azm_protect_official_attempt_binding();
CREATE POLICY "ExamControl_result_attempt_update" ON public."ExaminationResult" FOR UPDATE USING (public.azm_control_privileged()) WITH CHECK (public.azm_control_privileged());

CREATE FUNCTION public.azm_guard_official_result_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW."attendanceSessionId" IS NOT NULL THEN RAISE EXCEPTION 'Use verified attempt binding'; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW."studentId",NEW."examinationId") IS DISTINCT FROM ROW(OLD."studentId",OLD."examinationId") THEN
  RAISE EXCEPTION 'Official result student and examination identity are immutable';
 END IF;
 IF TG_OP='UPDATE' AND NEW."attendanceSessionId" IS DISTINCT FROM OLD."attendanceSessionId" THEN
  IF OLD."attendanceSessionId" IS NOT NULL OR NEW."attendanceSessionId" IS NULL OR NOT public.azm_control_privileged()
    OR current_setting('azm.result_attempt_binding',true) IS DISTINCT FROM NEW.id THEN
   RAISE EXCEPTION 'Official result attempt association is immutable';
  END IF;
 END IF;
 IF NEW."attendanceSessionId" IS NULL AND (NEW."scoringStatus"='VERIFIED' OR NEW."verificationStatus"='VERIFIED' OR NEW."publicationStatus"='PUBLISHED') THEN
  RAISE EXCEPTION 'Verify the examination attempt before verification or publication';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ExaminationResult_attempt_guard" BEFORE INSERT OR UPDATE ON public."ExaminationResult" FOR EACH ROW EXECUTE FUNCTION public.azm_guard_official_result_attempt();

CREATE FUNCTION public.azm_bind_official_result_attempt(payload TEXT, signature TEXT) RETURNS JSONB
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,azm_control_private,pg_temp AS $$
DECLARE p JSONB:=payload::JSONB; secret TEXT; actor public."User"; result_row RECORD; previous public."OfficialResultAttemptBinding";
BEGIN
 PERFORM public.azm_exam_lock();
 SELECT k.secret INTO secret FROM azm_control_private.signing_key k WHERE id;
 IF secret IS NULL OR signature IS DISTINCT FROM azm_control_private.hmac256(payload,secret) THEN RAISE EXCEPTION 'Invalid binding capability' USING ERRCODE='42501'; END IF;
 SELECT * INTO actor FROM public."User" WHERE id=p->>'actorId' FOR SHARE;
 IF actor.id IS NULL OR actor.role<>'SUPER_ADMIN' OR actor.status<>'ACTIVE' OR actor."tokenVersion"<>(p->>'tokenVersion')::INTEGER THEN RAISE EXCEPTION 'Super Admin authorization expired' USING ERRCODE='42501'; END IF;
 IF (p->>'expiresAt')::TIMESTAMPTZ<clock_timestamp() OR length(btrim(p->>'evidence')) NOT BETWEEN 12 AND 1000 OR nullif(p->>'operationId','') IS NULL THEN RAISE EXCEPTION 'Expired binding or missing evidence'; END IF;
 PERFORM set_config('azm.exam_control_operation',p->>'operationId',true);
 SELECT id,"studentId","attendanceSessionId" INTO result_row FROM public."ExaminationResult" WHERE id=p->>'resultId' FOR UPDATE;
 IF result_row.id IS NULL THEN RAISE EXCEPTION 'Official result not found'; END IF;
 SELECT * INTO previous FROM public."OfficialResultAttemptBinding" WHERE "resultId"=result_row.id;
 IF previous."resultId" IS NOT NULL THEN
  IF previous."sessionId"=p->>'sessionId' AND previous."actorId"=actor.id AND previous.evidence=btrim(p->>'evidence') THEN RETURN jsonb_build_object('resultId',previous."resultId",'sessionId',previous."sessionId",'boundAt',previous."boundAt"); END IF;
  RAISE EXCEPTION 'Official result already has an immutable attempt association';
 END IF;
 IF result_row."attendanceSessionId" IS NOT NULL THEN RAISE EXCEPTION 'Inconsistent existing attempt association'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."AttendanceSessionCandidate" c JOIN public."AttendanceSession" s ON s.id=c."sessionId"
   WHERE c."sessionId"=p->>'sessionId' AND c."studentId"=result_row."studentId" AND s.status IN ('OPEN','CLOSED','CANCELLED')) THEN
  RAISE EXCEPTION 'The candidate is not on the verified attempt roster';
 END IF;
 INSERT INTO public."OfficialResultAttemptBinding"("resultId","sessionId","studentId","actorId","actorName",evidence)
  VALUES(result_row.id,p->>'sessionId',result_row."studentId",actor.id,actor.name,btrim(p->>'evidence'));
 PERFORM set_config('azm.result_attempt_binding',result_row.id,true);
 UPDATE public."ExaminationResult" SET "attendanceSessionId"=p->>'sessionId' WHERE id=result_row.id;
 PERFORM set_config('azm.result_attempt_binding','',true);
 PERFORM set_config('azm.exam_control_operation','',true);
 RETURN jsonb_build_object('resultId',result_row.id,'sessionId',p->>'sessionId');
END $$;
REVOKE ALL ON FUNCTION public.azm_bind_official_result_attempt(TEXT,TEXT) FROM PUBLIC;

DO $$ DECLARE r TEXT; BEGIN
 SELECT pg_get_userbyid(proowner) INTO r FROM pg_proc WHERE oid='public.azm_execute_exam_control(text,text)'::regprocedure;
 EXECUTE format('GRANT SELECT,INSERT ON public."OfficialResultAttemptBinding" TO %I',r);
 EXECUTE format('GRANT SELECT (id,"studentId","attendanceSessionId"), UPDATE ("attendanceSessionId") ON public."ExaminationResult" TO %I',r);
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='azm_app_dml') THEN
  GRANT SELECT ON public."OfficialResultAttemptBinding" TO azm_app_dml;
  GRANT EXECUTE ON FUNCTION public.azm_bind_official_result_attempt(TEXT,TEXT) TO azm_app_dml;
 END IF;
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
   SELECT 1 FROM public."ExaminationResult" r WHERE r."attendanceSessionId" IS NULL AND r."studentId" IN (
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
COMMIT;
