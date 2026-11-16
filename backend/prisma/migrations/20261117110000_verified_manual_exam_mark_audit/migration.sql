-- Session V: individually audited, revision-bound Super Admin verification of
-- manual examination marks. No OMR/Student marks are updated by this migration.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '45s';

CREATE TABLE public."ManualExamMarkVerificationAudit" (
  id BIGSERIAL PRIMARY KEY,
  "sessionReference" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "verifiedMarks" INTEGER NOT NULL,
  "maximumMarks" INTEGER NOT NULL,
  "recordedAtSnapshot" TIMESTAMP(3) NOT NULL,
  "rollNumberSnapshot" TEXT NOT NULL,
  "applicationNoSnapshot" TEXT NOT NULL,
  "fullNameSnapshot" TEXT NOT NULL,
  "fatherNameSnapshot" TEXT NOT NULL,
  "currentClassSnapshot" TEXT NOT NULL,
  "reviewEvidenceReference" TEXT NOT NULL,
  "verificationReason" TEXT NOT NULL,
  "identityReviewed" BOOLEAN NOT NULL,
  "attendanceReviewed" BOOLEAN NOT NULL,
  "marksEvidenceReviewed" BOOLEAN NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualExamMarkVerificationAudit_mark_fkey"
    FOREIGN KEY ("sessionReference", "studentId")
    REFERENCES public."ManualExamMark" ("sessionReference", "studentId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualExamMarkVerificationAudit_actor_fkey"
    FOREIGN KEY ("actorId") REFERENCES public."User" (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualExamMarkVerificationAudit_session_check"
    CHECK ("sessionReference" = '2026-V'),
  CONSTRAINT "ManualExamMarkVerificationAudit_score_check"
    CHECK ("verifiedMarks" BETWEEN 0 AND 100 AND "maximumMarks" = 100),
  CONSTRAINT "ManualExamMarkVerificationAudit_evidence_check"
    CHECK (char_length(btrim("reviewEvidenceReference")) BETWEEN 10 AND 500),
  CONSTRAINT "ManualExamMarkVerificationAudit_reason_check"
    CHECK (char_length(btrim("verificationReason")) BETWEEN 30 AND 1000),
  CONSTRAINT "ManualExamMarkVerificationAudit_checks"
    CHECK ("identityReviewed" AND "attendanceReviewed" AND "marksEvidenceReviewed")
);
CREATE INDEX "ManualExamMarkVerificationAudit_latest_idx"
  ON public."ManualExamMarkVerificationAudit"
  ("sessionReference", "studentId", id DESC);
CREATE INDEX "ManualExamMarkVerificationAudit_actor_idx"
  ON public."ManualExamMarkVerificationAudit" ("actorId", id DESC);

CREATE TRIGGER "ManualExamMarkVerificationAudit_immutable"
  BEFORE UPDATE OR DELETE ON public."ManualExamMarkVerificationAudit"
  FOR EACH ROW EXECUTE FUNCTION public.azm_reject_manual_exam_mark_edit();

-- Database-enforced review action. Do not accept a client-supplied verifier.
-- Lock Student first like azm_record_manual_exam_mark so identity edits and
-- concurrent OMR inserts cannot race the signed evidence check.
CREATE FUNCTION public.azm_verify_manual_exam_mark(
  p_student_id TEXT,
  p_expected_mark INTEGER,
  p_evidence_reference TEXT,
  p_reason TEXT,
  p_identity_reviewed BOOLEAN,
  p_attendance_reviewed BOOLEAN,
  p_marks_evidence_reviewed BOOLEAN,
  p_actor_id TEXT
)
RETURNS TABLE (verification_id TEXT, verified_marks INTEGER, verified_at TIMESTAMP)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_name TEXT;
  v_student public."Student"%ROWTYPE;
  v_mark public."ManualExamMark"%ROWTYPE;
  v_last public."ManualExamMarkVerificationAudit"%ROWTYPE;
BEGIN
  IF p_expected_mark IS NULL OR p_expected_mark NOT BETWEEN 0 AND 100
    OR p_evidence_reference IS NULL
    OR char_length(btrim(p_evidence_reference)) NOT BETWEEN 10 AND 500
    OR p_reason IS NULL
    OR char_length(btrim(p_reason)) NOT BETWEEN 30 AND 1000
    OR p_identity_reviewed IS DISTINCT FROM TRUE
    OR p_attendance_reviewed IS DISTINCT FROM TRUE
    OR p_marks_evidence_reviewed IS DISTINCT FROM TRUE
  THEN
    RAISE EXCEPTION 'INVALID_MANUAL_VERIFICATION_EVIDENCE' USING ERRCODE='22023';
  END IF;

  SELECT u.name INTO v_actor_name
  FROM public."User" u
  WHERE u.id=p_actor_id AND u.role::TEXT='SUPER_ADMIN' AND u.status='ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED' USING ERRCODE='42501';
  END IF;

  SELECT s.* INTO v_student
  FROM public."Student" s WHERE s.id=p_student_id FOR UPDATE;
  IF NOT FOUND OR v_student.status::TEXT<>'ACTIVE' THEN
    RAISE EXCEPTION 'STUDENT_NOT_ACTIVE' USING ERRCODE='22023';
  END IF;

  -- The manual source is immutable (BEFORE UPDATE/DELETE rejects edits),
  -- and the Student row lock above serializes imports and verification.
  -- Do not request FOR UPDATE on a postgres-owned legacy source: the
  -- student_app SECURITY DEFINER needs SELECT, not mutation privileges.
  SELECT m.* INTO v_mark FROM public."ManualExamMark" m
  WHERE m."studentId"=p_student_id
    AND m."sessionReference"='2026-V'
    AND m."publishedAt" IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MANUAL_MARK_NOT_FOUND' USING ERRCODE='P0002';
  END IF;

  IF p_expected_mark <> v_mark."obtainedMarks" THEN
    RAISE EXCEPTION 'STALE_MANUAL_MARK' USING ERRCODE='40001';
  END IF;
  IF v_student."rollNumber" IS DISTINCT FROM v_mark."rollNumberSnapshot"
    OR v_student."applicationNo" IS DISTINCT FROM v_mark."applicationNoSnapshot"
  THEN
    RAISE EXCEPTION 'MANUAL_IDENTITY_MISMATCH' USING ERRCODE='22023';
  END IF;
  IF v_student."testScore" IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public."OmrProvisionalMark" omr
      WHERE omr."studentId"=p_student_id AND omr."sessionReference"='2026-V'
    )
    OR EXISTS (
      SELECT 1 FROM public."ExaminationResult" result
      WHERE result."studentId"=p_student_id
    )
  THEN
    RAISE EXCEPTION 'CONFLICTING_EXAM_MARK_SOURCE' USING ERRCODE='23505';
  END IF;

  SELECT a.* INTO v_last FROM public."ManualExamMarkVerificationAudit" a
  WHERE a."sessionReference"=v_mark."sessionReference"
    AND a."studentId"=p_student_id
  ORDER BY a.id DESC LIMIT 1;
  IF FOUND
    AND v_last."verifiedMarks"=v_mark."obtainedMarks"
    AND v_last."maximumMarks"=v_mark."maximumMarks"
    AND v_last."recordedAtSnapshot"=v_mark."recordedAt"
    AND v_last."rollNumberSnapshot"=v_student."rollNumber"
    AND v_last."applicationNoSnapshot"=v_student."applicationNo"
    AND v_last."fullNameSnapshot"=v_student."fullName"
    AND v_last."fatherNameSnapshot"=v_student."fatherName"
    AND v_last."currentClassSnapshot"=v_student."currentClass"
  THEN
    RAISE EXCEPTION 'MANUAL_MARK_ALREADY_VERIFIED' USING ERRCODE='22023';
  END IF;

  RETURN QUERY
  INSERT INTO public."ManualExamMarkVerificationAudit" (
    "sessionReference", "studentId", "verifiedMarks", "maximumMarks",
    "recordedAtSnapshot", "rollNumberSnapshot", "applicationNoSnapshot",
    "fullNameSnapshot", "fatherNameSnapshot", "currentClassSnapshot",
    "reviewEvidenceReference", "verificationReason", "identityReviewed",
    "attendanceReviewed", "marksEvidenceReviewed", "actorId", "actorName"
  ) VALUES (
    '2026-V', p_student_id, v_mark."obtainedMarks", v_mark."maximumMarks",
    v_mark."recordedAt", v_student."rollNumber", v_student."applicationNo",
    v_student."fullName", v_student."fatherName", v_student."currentClass",
    btrim(p_evidence_reference), btrim(p_reason), TRUE, TRUE, TRUE,
    p_actor_id, v_actor_name
  )
  RETURNING id::TEXT, "verifiedMarks", "verifiedAt";
END $$;

REVOKE ALL ON public."ManualExamMarkVerificationAudit" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.azm_verify_manual_exam_mark(
  TEXT,INTEGER,TEXT,TEXT,BOOLEAN,BOOLEAN,BOOLEAN,TEXT
) FROM PUBLIC;
ALTER TABLE public."ManualExamMarkVerificationAudit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ManualExamMarkVerification_read" ON public."ManualExamMarkVerificationAudit"
  FOR SELECT USING (TRUE);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT rolname FROM pg_roles
    WHERE rolname IN ('azm_app_dml','azm_runtime','student_app') LOOP
    EXECUTE format('GRANT SELECT ON public."ManualExamMarkVerificationAudit" TO %I', r.rolname);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.azm_verify_manual_exam_mark(TEXT,INTEGER,TEXT,TEXT,BOOLEAN,BOOLEAN,BOOLEAN,TEXT) TO %I', r.rolname);
  END LOOP;
END $$;
COMMIT;
