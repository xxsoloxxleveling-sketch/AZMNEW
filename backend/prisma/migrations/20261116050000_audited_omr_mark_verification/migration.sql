-- Session V: verified overall scores, separately attested by Super Admin.
-- Do not modify original OMR evidence or automatically clear review flags.
-- Candidate E-DMC never substitutes for regional official/original DMC.
BEGIN;

CREATE TABLE public."OmrMarkVerificationAudit" (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "sessionReference" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "verifiedMarks" INTEGER NOT NULL CHECK ("verifiedMarks" BETWEEN 0 AND 100),
  "maximumMarks" INTEGER NOT NULL CHECK ("maximumMarks" = 100),
  "originalScannedMarks" INTEGER NOT NULL CHECK ("originalScannedMarks" BETWEEN 0 AND 100),
  "scanSha256" TEXT NOT NULL CHECK ("scanSha256" ~ '^[0-9a-f]{64}$'),
  "latestCorrectionId" TEXT,
  "rollNumberSnapshot" TEXT NOT NULL,
  "applicationNoSnapshot" TEXT NOT NULL,
  "fullNameSnapshot" TEXT NOT NULL,
  "fatherNameSnapshot" TEXT NOT NULL,
  "currentClassSnapshot" TEXT NOT NULL,
  "reviewCategorySnapshot" TEXT NOT NULL,
  "identityStatusSnapshot" TEXT NOT NULL,
  "paperVersionStatusSnapshot" TEXT NOT NULL,
  "printedClassDisagreesSnapshot" BOOLEAN NOT NULL,
  "reviewEvidenceReference" TEXT NOT NULL CHECK (char_length(btrim("reviewEvidenceReference")) BETWEEN 10 AND 500),
  "verificationReason" TEXT NOT NULL CHECK (char_length(btrim("verificationReason")) BETWEEN 30 AND 1000),
  "identityReviewed" BOOLEAN NOT NULL CHECK ("identityReviewed"),
  "paperVersionReviewed" BOOLEAN NOT NULL CHECK ("paperVersionReviewed"),
  "printedClassReviewed" BOOLEAN NOT NULL CHECK ("printedClassReviewed"),
  "actorId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
  "actorName" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OmrMarkVerification_mark_fkey"
    FOREIGN KEY ("sessionReference", "studentId")
    REFERENCES public."OmrProvisionalMark"("sessionReference", "studentId") ON DELETE RESTRICT
);
CREATE INDEX "OmrMarkVerification_latest_idx"
  ON public."OmrMarkVerificationAudit" ("sessionReference", "studentId", id DESC);
CREATE INDEX "OmrMarkVerification_actor_idx"
  ON public."OmrMarkVerificationAudit" ("actorId", id DESC);

CREATE FUNCTION public.azm_reject_omr_mark_verification_edit()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Verified marks attestations are append-only';
END $$;
CREATE TRIGGER "OmrMarkVerification_immutable"
  BEFORE UPDATE OR DELETE ON public."OmrMarkVerificationAudit"
  FOR EACH ROW EXECUTE FUNCTION public.azm_reject_omr_mark_verification_edit();

-- Seals the effective score and the precise correction revision, not a requested
-- client-side score. Every later mark correction invalidates this seal until a
-- NEW Super Admin review records a NEW append-only attestation.
CREATE FUNCTION public.azm_verify_omr_mark(
  p_student_id TEXT,
  p_expected_mark INTEGER,
  p_evidence_reference TEXT,
  p_reason TEXT,
  p_identity_reviewed BOOLEAN,
  p_paper_version_reviewed BOOLEAN,
  p_printed_class_reviewed BOOLEAN,
  p_actor_id TEXT
)
RETURNS TABLE (verification_id TEXT, verified_marks INTEGER, verified_at TIMESTAMP)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_name TEXT;
  v_mark public."OmrProvisionalMark"%ROWTYPE;
  v_current_mark INTEGER;
  v_last_correction TEXT;
  v_last public."OmrMarkVerificationAudit"%ROWTYPE;
  v_roll TEXT;
  v_app TEXT;
  v_full_name TEXT;
  v_father_name TEXT;
  v_current_class TEXT;
BEGIN
  IF p_expected_mark IS NULL OR p_expected_mark NOT BETWEEN 0 AND 100
     OR p_evidence_reference IS NULL
     OR char_length(btrim(p_evidence_reference)) NOT BETWEEN 10 AND 500
     OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 30 AND 1000
     OR p_identity_reviewed IS DISTINCT FROM TRUE
     OR p_paper_version_reviewed IS DISTINCT FROM TRUE
     OR p_printed_class_reviewed IS DISTINCT FROM TRUE
  THEN
    RAISE EXCEPTION 'INVALID_VERIFICATION_EVIDENCE' USING ERRCODE='22023';
  END IF;

  SELECT u.name INTO v_actor_name
  FROM public."User" u
  WHERE u.id=p_actor_id AND u.role::TEXT='SUPER_ADMIN' AND u.status='ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED' USING ERRCODE='42501';
  END IF;

  SELECT m.* INTO v_mark FROM public."OmrProvisionalMark" m
  WHERE m."studentId"=p_student_id AND m."sessionReference"='2026-V'
    AND m."publishedAt" IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MARK_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  SELECT s."rollNumber", s."applicationNo", s."fullName", s."fatherName", s."currentClass"
  INTO v_roll, v_app, v_full_name, v_father_name, v_current_class
  FROM public."Student" s
  WHERE s.id=p_student_id AND s.status::TEXT='ACTIVE';
  IF NOT FOUND OR v_roll IS DISTINCT FROM v_mark."rollNumberSnapshot"
    OR v_app IS DISTINCT FROM v_mark."applicationNoSnapshot"
  THEN
    RAISE EXCEPTION 'IDENTITY_SNAPSHOT_MISMATCH' USING ERRCODE='22023';
  END IF;

  v_current_mark := COALESCE(v_mark."correctedMarks", v_mark."obtainedMarks");
  IF v_current_mark <> p_expected_mark THEN
    RAISE EXCEPTION 'STALE_MARK' USING ERRCODE='40001';
  END IF;
  SELECT c.id INTO v_last_correction
  FROM public."OmrProvisionalMarkCorrectionAudit" c
  WHERE c."studentId"=p_student_id AND c."sessionReference"='2026-V'
  ORDER BY c."occurredAt" DESC, c.id DESC LIMIT 1;
  SELECT a.* INTO v_last
  FROM public."OmrMarkVerificationAudit" a
  WHERE a."studentId"=p_student_id AND a."sessionReference"='2026-V'
  ORDER BY a.id DESC LIMIT 1;
  IF FOUND
    AND v_last."verifiedMarks"=v_current_mark
    AND v_last."scanSha256"=v_mark."scanSha256"
    AND v_last."latestCorrectionId" IS NOT DISTINCT FROM v_last_correction
    AND v_last."rollNumberSnapshot"=v_roll
    AND v_last."applicationNoSnapshot"=v_app
    AND v_last."fullNameSnapshot"=v_full_name
    AND v_last."fatherNameSnapshot"=v_father_name
    AND v_last."currentClassSnapshot"=v_current_class
  THEN
    RAISE EXCEPTION 'ALREADY_VERIFIED' USING ERRCODE='22023';
  END IF;

  RETURN QUERY
  INSERT INTO public."OmrMarkVerificationAudit" (
    "sessionReference","studentId","verifiedMarks","maximumMarks",
    "originalScannedMarks","scanSha256","latestCorrectionId",
    "rollNumberSnapshot","applicationNoSnapshot",
    "fullNameSnapshot","fatherNameSnapshot","currentClassSnapshot",
    "reviewCategorySnapshot","identityStatusSnapshot","paperVersionStatusSnapshot",
    "printedClassDisagreesSnapshot","reviewEvidenceReference","verificationReason",
    "identityReviewed","paperVersionReviewed","printedClassReviewed",
    "actorId","actorName"
  ) VALUES (
    v_mark."sessionReference",v_mark."studentId",v_current_mark,v_mark."maximumMarks",
    v_mark."obtainedMarks",v_mark."scanSha256",v_last_correction,
    v_roll,v_app,v_full_name,v_father_name,v_current_class,v_mark."reviewCategory",v_mark."identityStatus",v_mark."paperVersionStatus",
    v_mark."printedClassDisagrees",btrim(p_evidence_reference),btrim(p_reason),
    TRUE,TRUE,TRUE,p_actor_id,v_actor_name
  )
  RETURNING id::TEXT, "verifiedMarks", "verifiedAt";
END $$;

REVOKE ALL ON public."OmrMarkVerificationAudit" FROM PUBLIC;
ALTER TABLE public."OmrMarkVerificationAudit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "OmrMarkVerification_read" ON public."OmrMarkVerificationAudit"
  FOR SELECT USING (TRUE);
REVOKE ALL ON FUNCTION public.azm_verify_omr_mark(
  TEXT,INTEGER,TEXT,TEXT,BOOLEAN,BOOLEAN,BOOLEAN,TEXT
) FROM PUBLIC;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('azm_app_dml','azm_runtime','student_app') LOOP
    EXECUTE format('GRANT SELECT ON public."OmrMarkVerificationAudit" TO %I', r.rolname);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.azm_verify_omr_mark(TEXT,INTEGER,TEXT,TEXT,BOOLEAN,BOOLEAN,BOOLEAN,TEXT) TO %I', r.rolname);
  END LOOP;
END $$;
COMMIT;
