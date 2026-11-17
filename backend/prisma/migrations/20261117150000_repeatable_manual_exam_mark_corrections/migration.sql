-- Session V: immutable revisions of manual marks; original scores never overwritten.
-- Intentionally no FK to legacy postgres-owned ManualExamMark, avoiding a second temporary grant.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '45s';
CREATE TABLE public."ManualExamMarkCorrectionAudit" (
  id BIGSERIAL PRIMARY KEY,
  "sessionReference" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "originalRecordedMarks" INTEGER NOT NULL,
  "previousEffectiveMarks" INTEGER NOT NULL,
  "newEffectiveMarks" INTEGER NOT NULL,
  "recordedAtSnapshot" TIMESTAMP(3) NOT NULL,
  "rollNumberSnapshot" TEXT NOT NULL,
  "applicationNoSnapshot" TEXT NOT NULL,
  "evidenceReference" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "identityReviewed" BOOLEAN NOT NULL,
  "attendanceReviewed" BOOLEAN NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualExamMarkCorrectionAudit_session_check" CHECK ("sessionReference"='2026-V'),
  CONSTRAINT "ManualExamMarkCorrectionAudit_scores_check" CHECK (
    "originalRecordedMarks" BETWEEN 0 AND 100 AND
    "previousEffectiveMarks" BETWEEN 0 AND 100 AND
    "newEffectiveMarks" BETWEEN 0 AND 100 AND
    "previousEffectiveMarks"<>"newEffectiveMarks"),
  CONSTRAINT "ManualExamMarkCorrectionAudit_evidence_check"
    CHECK (char_length(btrim("evidenceReference")) BETWEEN 10 AND 500),
  CONSTRAINT "ManualExamMarkCorrectionAudit_reason_check"
    CHECK (char_length(btrim("reason")) BETWEEN 30 AND 1000),
  CONSTRAINT "ManualExamMarkCorrectionAudit_review_check" CHECK ("identityReviewed" AND "attendanceReviewed")
);
CREATE INDEX "ManualExamMarkCorrectionAudit_latest_idx"
 ON public."ManualExamMarkCorrectionAudit" ("sessionReference","studentId",id DESC);
CREATE INDEX "ManualExamMarkCorrectionAudit_actor_idx"
 ON public."ManualExamMarkCorrectionAudit" ("actorId",id DESC);
CREATE TRIGGER "ManualExamMarkCorrectionAudit_immutable"
 BEFORE UPDATE OR DELETE ON public."ManualExamMarkCorrectionAudit"
 FOR EACH ROW EXECUTE FUNCTION public.azm_reject_manual_exam_mark_edit();
REVOKE ALL ON public."ManualExamMarkCorrectionAudit" FROM PUBLIC;
ALTER TABLE public."ManualExamMarkCorrectionAudit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ManualExamMarkCorrectionAudit_read"
 ON public."ManualExamMarkCorrectionAudit" FOR SELECT USING (TRUE);
-- Existing signed audits implicitly refer to the unchanged original revision (NULL).
ALTER TABLE public."ManualExamMarkVerificationAudit" ADD COLUMN "latestCorrectionId" BIGINT;

CREATE FUNCTION public.azm_correct_manual_exam_mark(
 p_student_id TEXT, p_expected_marks INTEGER, p_new_marks INTEGER,
 p_evidence_reference TEXT, p_reason TEXT,
 p_identity_reviewed BOOLEAN, p_attendance_reviewed BOOLEAN, p_actor_id TEXT
)
RETURNS TABLE (correction_id TEXT, previous_effective_marks INTEGER,
 new_effective_marks INTEGER, corrected_at TIMESTAMP)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
 v_actor_name TEXT;
 v_student public."Student"%ROWTYPE;
 v_mark public."ManualExamMark"%ROWTYPE;
 v_latest public."ManualExamMarkCorrectionAudit"%ROWTYPE;
 v_effective INTEGER;
BEGIN
 IF p_expected_marks IS NULL OR p_expected_marks NOT BETWEEN 0 AND 100
  OR p_new_marks IS NULL OR p_new_marks NOT BETWEEN 0 AND 100
  OR p_evidence_reference IS NULL OR char_length(btrim(p_evidence_reference)) NOT BETWEEN 10 AND 500
  OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 30 AND 1000
  OR p_identity_reviewed IS DISTINCT FROM TRUE
  OR p_attendance_reviewed IS DISTINCT FROM TRUE
 THEN
  RAISE EXCEPTION 'INVALID_MANUAL_CORRECTION_EVIDENCE' USING ERRCODE='22023';
 END IF;
 SELECT u.name INTO v_actor_name FROM public."User" u
 WHERE u.id=p_actor_id AND u.role::TEXT='SUPER_ADMIN' AND u.status='ACTIVE';
 IF NOT FOUND THEN
  RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED' USING ERRCODE='42501';
 END IF;
 -- Student row lock serializes corrections, re-verifications and OMR imports.
 -- Never FOR UPDATE the legacy immutable postgres-owned manual mark.
 SELECT s.* INTO v_student FROM public."Student" s WHERE s.id=p_student_id FOR UPDATE;
 IF NOT FOUND OR v_student.status::TEXT<>'ACTIVE' THEN
  RAISE EXCEPTION 'STUDENT_NOT_ACTIVE' USING ERRCODE='22023';
 END IF;
 SELECT m.* INTO v_mark FROM public."ManualExamMark" m
 WHERE m."studentId"=p_student_id AND m."sessionReference"='2026-V'
 AND m."publishedAt" IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'MANUAL_MARK_NOT_FOUND' USING ERRCODE='P0002'; END IF;
 IF v_student."rollNumber" IS DISTINCT FROM v_mark."rollNumberSnapshot"
  OR v_student."applicationNo" IS DISTINCT FROM v_mark."applicationNoSnapshot"
 THEN RAISE EXCEPTION 'MANUAL_IDENTITY_MISMATCH' USING ERRCODE='22023'; END IF;
 IF v_student."testScore" IS NOT NULL
  OR EXISTS (SELECT 1 FROM public."OmrProvisionalMark" omr
   WHERE omr."studentId"=p_student_id AND omr."sessionReference"='2026-V')
  OR EXISTS (SELECT 1 FROM public."ExaminationResult" r WHERE r."studentId"=p_student_id)
 THEN RAISE EXCEPTION 'CONFLICTING_EXAM_MARK_SOURCE' USING ERRCODE='23505'; END IF;
 SELECT a.* INTO v_latest FROM public."ManualExamMarkCorrectionAudit" a
 WHERE a."sessionReference"='2026-V' AND a."studentId"=p_student_id ORDER BY a.id DESC LIMIT 1;
 v_effective:=COALESCE(v_latest."newEffectiveMarks",v_mark."obtainedMarks");
 IF p_expected_marks<>v_effective THEN RAISE EXCEPTION 'STALE_MANUAL_MARK' USING ERRCODE='40001'; END IF;
 IF p_new_marks=v_effective THEN RAISE EXCEPTION 'NO_MANUAL_MARK_CHANGE' USING ERRCODE='22023'; END IF;
 RETURN QUERY INSERT INTO public."ManualExamMarkCorrectionAudit" (
   "sessionReference","studentId","originalRecordedMarks","previousEffectiveMarks",
   "newEffectiveMarks","recordedAtSnapshot","rollNumberSnapshot","applicationNoSnapshot",
   "evidenceReference","reason","identityReviewed","attendanceReviewed","actorId","actorName"
 ) VALUES (
   '2026-V',p_student_id,v_mark."obtainedMarks",v_effective,p_new_marks,
   v_mark."recordedAt",v_student."rollNumber",v_student."applicationNo",
   btrim(p_evidence_reference),btrim(p_reason),TRUE,TRUE,p_actor_id,v_actor_name
 ) RETURNING id::TEXT,"previousEffectiveMarks","newEffectiveMarks","occurredAt";
END $$;

-- Replaces the existing function in place; existing signed audit rows remain immutable.
-- A seal binds exact current revision ID, not merely the numerical score.
CREATE OR REPLACE FUNCTION public.azm_verify_manual_exam_mark(
 p_student_id TEXT, p_expected_mark INTEGER, p_evidence_reference TEXT,
 p_reason TEXT, p_identity_reviewed BOOLEAN, p_attendance_reviewed BOOLEAN,
 p_marks_evidence_reviewed BOOLEAN, p_actor_id TEXT
)
RETURNS TABLE (verification_id TEXT, verified_marks INTEGER, verified_at TIMESTAMP)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
 v_actor_name TEXT;
 v_student public."Student"%ROWTYPE;
 v_mark public."ManualExamMark"%ROWTYPE;
 v_latest public."ManualExamMarkCorrectionAudit"%ROWTYPE;
 v_last public."ManualExamMarkVerificationAudit"%ROWTYPE;
 v_effective INTEGER;
 v_revision_id BIGINT;
BEGIN
 IF p_expected_mark IS NULL OR p_expected_mark NOT BETWEEN 0 AND 100
  OR p_evidence_reference IS NULL OR char_length(btrim(p_evidence_reference)) NOT BETWEEN 10 AND 500
  OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 30 AND 1000
  OR p_identity_reviewed IS DISTINCT FROM TRUE OR p_attendance_reviewed IS DISTINCT FROM TRUE
  OR p_marks_evidence_reviewed IS DISTINCT FROM TRUE
 THEN RAISE EXCEPTION 'INVALID_MANUAL_VERIFICATION_EVIDENCE' USING ERRCODE='22023'; END IF;
 SELECT u.name INTO v_actor_name FROM public."User" u
 WHERE u.id=p_actor_id AND u.role::TEXT='SUPER_ADMIN' AND u.status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT s.* INTO v_student FROM public."Student" s WHERE s.id=p_student_id FOR UPDATE;
 IF NOT FOUND OR v_student.status::TEXT<>'ACTIVE' THEN
  RAISE EXCEPTION 'STUDENT_NOT_ACTIVE' USING ERRCODE='22023';
 END IF;
 SELECT m.* INTO v_mark FROM public."ManualExamMark" m
 WHERE m."studentId"=p_student_id AND m."sessionReference"='2026-V'
 AND m."publishedAt" IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'MANUAL_MARK_NOT_FOUND' USING ERRCODE='P0002'; END IF;
 SELECT a.* INTO v_latest FROM public."ManualExamMarkCorrectionAudit" a
 WHERE a."sessionReference"='2026-V' AND a."studentId"=p_student_id ORDER BY a.id DESC LIMIT 1;
 v_effective:=COALESCE(v_latest."newEffectiveMarks",v_mark."obtainedMarks");
 v_revision_id:=v_latest.id;
 IF p_expected_mark<>v_effective THEN RAISE EXCEPTION 'STALE_MANUAL_MARK' USING ERRCODE='40001'; END IF;
 IF v_student."rollNumber" IS DISTINCT FROM v_mark."rollNumberSnapshot"
  OR v_student."applicationNo" IS DISTINCT FROM v_mark."applicationNoSnapshot"
 THEN RAISE EXCEPTION 'MANUAL_IDENTITY_MISMATCH' USING ERRCODE='22023'; END IF;
 IF v_student."testScore" IS NOT NULL
  OR EXISTS (SELECT 1 FROM public."OmrProvisionalMark" omr
   WHERE omr."studentId"=p_student_id AND omr."sessionReference"='2026-V')
  OR EXISTS (SELECT 1 FROM public."ExaminationResult" r WHERE r."studentId"=p_student_id)
 THEN RAISE EXCEPTION 'CONFLICTING_EXAM_MARK_SOURCE' USING ERRCODE='23505'; END IF;
 SELECT a.* INTO v_last FROM public."ManualExamMarkVerificationAudit" a
 WHERE a."studentId"=p_student_id AND a."sessionReference"='2026-V' ORDER BY a.id DESC LIMIT 1;
 IF FOUND AND v_last."verifiedMarks"=v_effective
  AND v_last."latestCorrectionId" IS NOT DISTINCT FROM v_revision_id
  AND v_last."maximumMarks"=v_mark."maximumMarks"
  AND v_last."recordedAtSnapshot"=v_mark."recordedAt"
  AND v_last."rollNumberSnapshot"=v_student."rollNumber"
  AND v_last."applicationNoSnapshot"=v_student."applicationNo"
  AND v_last."fullNameSnapshot"=v_student."fullName"
  AND v_last."fatherNameSnapshot"=v_student."fatherName"
  AND v_last."currentClassSnapshot"=v_student."currentClass"
 THEN RAISE EXCEPTION 'MANUAL_MARK_ALREADY_VERIFIED' USING ERRCODE='22023'; END IF;
 RETURN QUERY INSERT INTO public."ManualExamMarkVerificationAudit" (
   "sessionReference","studentId","verifiedMarks","maximumMarks",
   "latestCorrectionId","recordedAtSnapshot","rollNumberSnapshot","applicationNoSnapshot",
   "fullNameSnapshot","fatherNameSnapshot","currentClassSnapshot",
   "reviewEvidenceReference","verificationReason","identityReviewed",
   "attendanceReviewed","marksEvidenceReviewed","actorId","actorName"
 ) VALUES (
   '2026-V',p_student_id,v_effective,v_mark."maximumMarks",v_revision_id,
   v_mark."recordedAt",v_student."rollNumber",v_student."applicationNo",
   v_student."fullName",v_student."fatherName",v_student."currentClass",
   btrim(p_evidence_reference),btrim(p_reason),TRUE,TRUE,TRUE,p_actor_id,v_actor_name
 ) RETURNING id::TEXT,"verifiedMarks","verifiedAt";
END $$;

REVOKE ALL ON FUNCTION public.azm_correct_manual_exam_mark(
 TEXT,INTEGER,INTEGER,TEXT,TEXT,BOOLEAN,BOOLEAN,TEXT
) FROM PUBLIC;
DO $$
DECLARE r RECORD;
BEGIN
 FOR r IN SELECT rolname FROM pg_roles
 WHERE rolname IN ('azm_app_dml','azm_runtime','student_app') LOOP
  EXECUTE format('GRANT SELECT ON public."ManualExamMarkCorrectionAudit" TO %I',r.rolname);
  EXECUTE format(
   'GRANT EXECUTE ON FUNCTION public.azm_correct_manual_exam_mark(TEXT,INTEGER,INTEGER,TEXT,TEXT,BOOLEAN,BOOLEAN,TEXT) TO %I',
   r.rolname);
 END LOOP;
END $$;
COMMIT;
