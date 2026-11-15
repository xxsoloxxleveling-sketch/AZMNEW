-- Provisional OMR marks corrections (Super Admin only).
-- Preserve scanned obtainedMarks and original sheet evidence.
BEGIN;

ALTER TABLE public."OmrProvisionalMark"
  ADD COLUMN "correctedMarks" INTEGER
  CONSTRAINT "OmrProvisionalMark_correctedMarks_range"
  CHECK ("correctedMarks" IS NULL OR "correctedMarks" BETWEEN 0 AND 100);

CREATE TABLE public."OmrProvisionalMarkCorrectionAudit" (
  "id" TEXT PRIMARY KEY,
  "sessionReference" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "originalScannedMarks" INTEGER NOT NULL CHECK ("originalScannedMarks" BETWEEN 0 AND 100),
  "previousEffectiveMarks" INTEGER NOT NULL CHECK ("previousEffectiveMarks" BETWEEN 0 AND 100),
  "newEffectiveMarks" INTEGER NOT NULL CHECK ("newEffectiveMarks" BETWEEN 0 AND 100),
  "scanSha256" TEXT NOT NULL CHECK ("scanSha256" ~ '^[0-9a-f]{64}$'),
  "reason" TEXT NOT NULL CHECK (char_length(btrim("reason")) BETWEEN 10 AND 500),
  "actorId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
  "actorName" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OmrMarkCorrection_changes_value"
    CHECK ("previousEffectiveMarks" <> "newEffectiveMarks"),
  CONSTRAINT "OmrMarkCorrection_provisionalMark_fkey"
    FOREIGN KEY ("sessionReference", "studentId")
    REFERENCES public."OmrProvisionalMark"("sessionReference", "studentId") ON DELETE RESTRICT
);
CREATE INDEX "OmrMarkCorrection_student_time_idx"
  ON public."OmrProvisionalMarkCorrectionAudit" ("studentId", "occurredAt");
CREATE INDEX "OmrMarkCorrection_actor_time_idx"
  ON public."OmrProvisionalMarkCorrectionAudit" ("actorId", "occurredAt");

CREATE FUNCTION public.azm_reject_provisional_mark_correction_audit_edit()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Provisional marks correction audits are append-only';
END $$;
CREATE TRIGGER "OmrMarkCorrection_immutable"
  BEFORE UPDATE OR DELETE ON public."OmrProvisionalMarkCorrectionAudit"
  FOR EACH ROW EXECUTE FUNCTION public.azm_reject_provisional_mark_correction_audit_edit();

CREATE FUNCTION public.azm_preserve_scanned_omr_mark()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF (NEW."studentId", NEW."sessionReference", NEW."obtainedMarks",
      NEW."scanSha256", NEW."sourceBatchSha256", NEW."sourceFile",
      NEW."paperVersion", NEW."paperVersionStatus", NEW."identityStatus",
      NEW."rollNumberSnapshot", NEW."applicationNoSnapshot",
      NEW."reviewCategory")
      IS DISTINCT FROM
     (OLD."studentId", OLD."sessionReference", OLD."obtainedMarks",
      OLD."scanSha256", OLD."sourceBatchSha256", OLD."sourceFile",
      OLD."paperVersion", OLD."paperVersionStatus", OLD."identityStatus",
      OLD."rollNumberSnapshot", OLD."applicationNoSnapshot",
      OLD."reviewCategory")
  THEN RAISE EXCEPTION 'Original scanned OMR evidence cannot be edited'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "OmrProvisionalMark_preserve_scan"
  BEFORE UPDATE ON public."OmrProvisionalMark"
  FOR EACH ROW EXECUTE FUNCTION public.azm_preserve_scanned_omr_mark();

-- The runtime DB role gets no direct write access to either table.
-- This function checks the actor in the DB, locks the selected candidate,
-- rejects stale values, updates only the correction field and writes a receipt.
CREATE FUNCTION public.azm_correct_provisional_omr_mark(
  p_student_id TEXT,
  p_expected_mark INTEGER,
  p_new_mark INTEGER,
  p_reason TEXT,
  p_actor_id TEXT
)
RETURNS TABLE (
  original_marks INTEGER,
  previous_marks INTEGER,
  updated_marks INTEGER,
  correction_id TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_name TEXT;
  v_original INTEGER;
  v_previous INTEGER;
  v_scan_sha TEXT;
  v_id TEXT;
BEGIN
  IF p_new_mark IS NULL OR p_new_mark NOT BETWEEN 0 AND 100 OR
     p_expected_mark IS NULL OR p_expected_mark NOT BETWEEN 0 AND 100 OR
     p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 10 AND 500
  THEN RAISE EXCEPTION 'INVALID_MARK_CORRECTION' USING ERRCODE='22023'; END IF;

  SELECT u.name INTO v_actor_name
  FROM public."User" u
  WHERE u.id=p_actor_id AND u.role::TEXT='SUPER_ADMIN' AND u.status='ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED' USING ERRCODE='42501';
  END IF;

  SELECT m."obtainedMarks",
         COALESCE(m."correctedMarks", m."obtainedMarks"),
         m."scanSha256"
  INTO v_original, v_previous, v_scan_sha
  FROM public."OmrProvisionalMark" m
  WHERE m."studentId"=p_student_id AND m."sessionReference"='2026-V'
    AND m."publishedAt" IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROVISIONAL_MARK_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  IF v_previous <> p_expected_mark THEN
    RAISE EXCEPTION 'STALE_PROVISIONAL_MARK' USING ERRCODE='40001';
  END IF;
  IF v_previous = p_new_mark THEN
    RAISE EXCEPTION 'NO_MARK_CHANGE' USING ERRCODE='22023';
  END IF;

  -- Setting the mark back to the scan reading removes the override, not the audit.
  UPDATE public."OmrProvisionalMark" m
  SET "correctedMarks"=CASE WHEN p_new_mark=v_original THEN NULL ELSE p_new_mark END
  WHERE m."studentId"=p_student_id AND m."sessionReference"='2026-V';

  v_id=gen_random_uuid()::TEXT;
  INSERT INTO public."OmrProvisionalMarkCorrectionAudit" (
    id, "sessionReference", "studentId", "originalScannedMarks",
    "previousEffectiveMarks", "newEffectiveMarks", "scanSha256",
    reason, "actorId", "actorName"
  ) VALUES (
    v_id,'2026-V',p_student_id,v_original,v_previous,p_new_mark,v_scan_sha,
    btrim(p_reason),p_actor_id,v_actor_name
  );

  RETURN QUERY SELECT v_original, v_previous, p_new_mark, v_id;
END $$;

REVOKE ALL ON public."OmrProvisionalMarkCorrectionAudit" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.azm_correct_provisional_omr_mark(TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN
    ('azm_app_dml', 'azm_runtime', 'student_app') LOOP
    EXECUTE format('GRANT SELECT ON public."OmrProvisionalMarkCorrectionAudit" TO %I', r.rolname);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.azm_correct_provisional_omr_mark(TEXT, INTEGER, INTEGER, TEXT, TEXT) TO %I', r.rolname);
  END LOOP;
END $$;
COMMIT;
