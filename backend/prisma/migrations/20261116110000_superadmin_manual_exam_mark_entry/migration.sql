-- AZM.AIO Session V: append-only manual exam-score entries for candidates
-- without any imported OMR score. This is NOT a scanner record.
-- Existing OMR marks, revisions, verified seals, results and DMCs are untouched.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '45s';

CREATE TABLE public."ManualExamMark" (
  "sessionReference" TEXT NOT NULL DEFAULT '2026-V',
  "studentId" TEXT NOT NULL,
  "rollNumberSnapshot" TEXT NOT NULL,
  "applicationNoSnapshot" TEXT NOT NULL,
  "obtainedMarks" INTEGER NOT NULL,
  "maximumMarks" INTEGER NOT NULL DEFAULT 100,
  "sourceEvidenceReference" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualExamMark_pkey" PRIMARY KEY ("sessionReference", "studentId"),
  CONSTRAINT "ManualExamMark_student_fkey" FOREIGN KEY ("studentId")
    REFERENCES public."Student"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualExamMark_actor_fkey" FOREIGN KEY ("actorId")
    REFERENCES public."User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualExamMark_session_check" CHECK ("sessionReference" = '2026-V'),
  CONSTRAINT "ManualExamMark_score_check" CHECK (
    "obtainedMarks" BETWEEN 0 AND 100 AND "maximumMarks" = 100
  ),
  CONSTRAINT "ManualExamMark_evidence_check" CHECK (
    char_length(btrim("sourceEvidenceReference")) BETWEEN 10 AND 500
  ),
  CONSTRAINT "ManualExamMark_reason_check" CHECK (
    char_length(btrim("reason")) BETWEEN 30 AND 1000
  )
);

CREATE INDEX "ManualExamMark_actor_time_idx"
  ON public."ManualExamMark" ("actorId", "recordedAt" DESC);
CREATE INDEX "ManualExamMark_published_idx"
  ON public."ManualExamMark" ("sessionReference", "publishedAt");

CREATE FUNCTION public.azm_reject_manual_exam_mark_edit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'MANUAL_EXAM_MARK_IMMUTABLE' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER "ManualExamMark_immutable"
  BEFORE UPDATE OR DELETE ON public."ManualExamMark"
  FOR EACH ROW EXECUTE FUNCTION public.azm_reject_manual_exam_mark_edit();

-- Block a later OMR import from adding a second source for the same student.
-- Both this trigger and the manual-entry RPC lock the Student row, so two
-- concurrent imports cannot bypass the cross-table uniqueness check.
CREATE FUNCTION public.azm_block_omr_when_manual_exists()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM 1 FROM public."Student" s WHERE s.id=NEW."studentId" FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public."ManualExamMark" manual
    WHERE manual."studentId"=NEW."studentId"
      AND manual."sessionReference"=NEW."sessionReference"
  ) THEN
    RAISE EXCEPTION 'MANUAL_MARK_ALREADY_RECORDED'
      USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "OmrProvisionalMark_manual_source_exclusion"
  BEFORE INSERT ON public."OmrProvisionalMark"
  FOR EACH ROW EXECUTE FUNCTION public.azm_block_omr_when_manual_exists();

-- The runtime role receives SELECT and EXECUTE ONLY. It cannot insert,
-- update or delete manual entries without passing through this RPC, which
-- validates the actual active Super Admin and source uniqueness in the DB.
CREATE FUNCTION public.azm_record_manual_exam_mark(
  p_student_id TEXT,
  p_obtained_marks INTEGER,
  p_evidence_reference TEXT,
  p_reason TEXT,
  p_identity_reviewed BOOLEAN,
  p_attendance_reviewed BOOLEAN,
  p_actor_id TEXT
)
RETURNS TABLE (recorded_marks INTEGER, recorded_at TIMESTAMP)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_name TEXT;
  v_student public."Student"%ROWTYPE;
BEGIN
  IF p_obtained_marks IS NULL OR p_obtained_marks NOT BETWEEN 0 AND 100
    OR p_evidence_reference IS NULL
    OR char_length(btrim(p_evidence_reference)) NOT BETWEEN 10 AND 500
    OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 30 AND 1000
    OR p_identity_reviewed IS DISTINCT FROM TRUE
    OR p_attendance_reviewed IS DISTINCT FROM TRUE
  THEN
    RAISE EXCEPTION 'INVALID_MANUAL_MARK_EVIDENCE' USING ERRCODE='22023';
  END IF;

  SELECT u.name INTO v_actor_name
  FROM public."User" u
  WHERE u.id=p_actor_id AND u.role::TEXT='SUPER_ADMIN' AND u.status='ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED' USING ERRCODE='42501';
  END IF;

  SELECT s.* INTO v_student FROM public."Student" s
  WHERE s.id=p_student_id FOR UPDATE;
  IF NOT FOUND OR v_student.status::TEXT<>'ACTIVE'
    OR v_student."rollNumber" IS NULL
    OR v_student."applicationNo" IS NULL
    OR v_student."rollNumber"=''
    OR v_student."applicationNo"=''
  THEN
    RAISE EXCEPTION 'STUDENT_NOT_ELIGIBLE_FOR_MANUAL_MARK' USING ERRCODE='22023';
  END IF;

  IF v_student."testScore" IS NOT NULL THEN
    RAISE EXCEPTION 'STUDENT_ALREADY_HAS_MARKS' USING ERRCODE='23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."OmrProvisionalMark" m
    WHERE m."sessionReference"='2026-V' AND m."studentId"=p_student_id
  ) THEN
    RAISE EXCEPTION 'OMR_MARK_ALREADY_RECORDED' USING ERRCODE='23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."ManualExamMark" manual
    WHERE manual."sessionReference"='2026-V' AND manual."studentId"=p_student_id
  ) THEN
    RAISE EXCEPTION 'MANUAL_MARK_ALREADY_RECORDED' USING ERRCODE='23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."ExaminationResult" result
    WHERE result."studentId"=p_student_id
  ) THEN
    RAISE EXCEPTION 'OFFICIAL_RESULT_ALREADY_RECORDED' USING ERRCODE='23505';
  END IF;

  INSERT INTO public."ManualExamMark" (
    "sessionReference","studentId","rollNumberSnapshot",
    "applicationNoSnapshot","obtainedMarks","maximumMarks",
    "sourceEvidenceReference","reason","actorId","actorName"
  ) VALUES (
    '2026-V',p_student_id,v_student."rollNumber",
    v_student."applicationNo",p_obtained_marks,100,
    btrim(p_evidence_reference),btrim(p_reason),p_actor_id,v_actor_name
  );

  RETURN QUERY SELECT m."obtainedMarks",m."recordedAt"
  FROM public."ManualExamMark" m
  WHERE m."sessionReference"='2026-V' AND m."studentId"=p_student_id;
END $$;

REVOKE ALL ON TABLE public."ManualExamMark" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.azm_record_manual_exam_mark(
  TEXT,INTEGER,TEXT,TEXT,BOOLEAN,BOOLEAN,TEXT
) FROM PUBLIC;
ALTER TABLE public."ManualExamMark" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ManualExamMark_read" ON public."ManualExamMark"
  FOR SELECT USING (TRUE);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT rolname FROM pg_roles
    WHERE rolname IN ('azm_app_dml','azm_runtime','student_app') LOOP
    EXECUTE format('GRANT SELECT ON public."ManualExamMark" TO %I',r.rolname);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.azm_record_manual_exam_mark(TEXT,INTEGER,TEXT,TEXT,BOOLEAN,BOOLEAN,TEXT) TO %I',
      r.rolname
    );
  END LOOP;
END $$;
COMMIT;
