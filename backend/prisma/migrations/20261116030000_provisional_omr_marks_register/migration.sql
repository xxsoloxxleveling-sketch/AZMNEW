-- Session V 2026: provisional scan scores live in their own register.
-- Never overwrite Student.testScore or change official ExaminationResult/DMC.
BEGIN;

CREATE TABLE public."OmrProvisionalMark" (
  "studentId" TEXT NOT NULL,
  "sessionReference" TEXT NOT NULL DEFAULT '2026-V',
  "rollNumberSnapshot" TEXT NOT NULL,
  "applicationNoSnapshot" TEXT NOT NULL,
  "obtainedMarks" INTEGER NOT NULL CHECK ("obtainedMarks" BETWEEN 0 AND 100),
  "maximumMarks" INTEGER NOT NULL DEFAULT 100 CHECK ("maximumMarks" = 100),
  "scanSha256" TEXT NOT NULL UNIQUE CHECK ("scanSha256" ~ '^[0-9a-f]{64}$'),
  "sourceBatchSha256" TEXT NOT NULL CHECK ("sourceBatchSha256" ~ '^[0-9a-f]{64}$'),
  "sourceFile" TEXT NOT NULL,
  "paperVersion" TEXT NOT NULL CHECK ("paperVersion" IN ('A', 'B', 'C', 'D')),
  "paperVersionStatus" TEXT NOT NULL,
  "identityStatus" TEXT NOT NULL,
  "printedClassDisagrees" BOOLEAN NOT NULL,
  "manualReviewRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  "reviewCategory" TEXT NOT NULL CHECK ("reviewCategory" IN
    ('READY_HIGH_CONFIDENCE', 'PROVISIONAL_VERSION_REVIEW',
    'HOLD_IDENTITY', 'HOLD_PRINTED_CLASS', 'HOLD_SCORE', 'HOLD_PAPER_VERSION')),
  "publishedAt" TIMESTAMP(3),
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OmrProvisionalMark_pkey" PRIMARY KEY ("sessionReference", "studentId"),
  CONSTRAINT "OmrProvisionalMark_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON DELETE RESTRICT
);
CREATE INDEX "OmrProvisionalMark_sessionReference_marks_idx"
  ON public."OmrProvisionalMark" ("sessionReference", "obtainedMarks" DESC);
CREATE INDEX "OmrProvisionalMark_reviewCategory_idx"
  ON public."OmrProvisionalMark" ("sessionReference", "reviewCategory");

-- A separate immutable event records this extraordinary provisional publication.
CREATE TABLE public."OmrProvisionalBatchAudit" (
  "id" TEXT PRIMARY KEY,
  "sessionReference" TEXT NOT NULL,
  "sourceBatchSha256" TEXT NOT NULL CHECK ("sourceBatchSha256" ~ '^[0-9a-f]{64}$'),
  "batchSize" INTEGER NOT NULL CHECK ("batchSize" > 0),
  "publishedSize" INTEGER NOT NULL,
  "reviewRequiredCount" INTEGER NOT NULL,
  "operatorReason" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE FUNCTION public.azm_reject_provisional_batch_audit_edit()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Provisional batch audit events are append-only';
END $$;
CREATE TRIGGER "OmrProvisionalBatchAudit_immutable"
BEFORE UPDATE OR DELETE ON public."OmrProvisionalBatchAudit"
FOR EACH ROW EXECUTE FUNCTION public.azm_reject_provisional_batch_audit_edit();

REVOKE ALL ON public."OmrProvisionalMark", public."OmrProvisionalBatchAudit" FROM PUBLIC;
ALTER TABLE public."OmrProvisionalMark" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "OmrProvisionalMark_app_read" ON public."OmrProvisionalMark"
FOR SELECT USING (TRUE);

-- Existing authorized application DB roles can SELECT but cannot publish or edit.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN
    ('azm_app_dml', 'azm_app_readonly', 'azm_app_runtime') LOOP
    EXECUTE format('GRANT SELECT ON public."OmrProvisionalMark" TO %I', r.rolname);
  END LOOP;
END $$;
COMMIT;
