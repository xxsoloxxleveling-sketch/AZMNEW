-- Additive only. No historical Student value is inferred or rewritten.
CREATE TABLE "StudentStudyGroupCorrection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "oldClass" TEXT NOT NULL,
  "newClass" TEXT NOT NULL,
  "oldGroup" TEXT,
  "newGroup" TEXT,
  "basis" TEXT NOT NULL CHECK (length(btrim("basis")) BETWEEN 3 AND 500),
  "previousUpdatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentStudyGroupCorrection_group" CHECK ("newGroup" IS NULL OR "newGroup" IN
    ('Pre-Medical','Pre-Engineering','ICS','FA','I.Com','General Science'))
);
CREATE INDEX "StudentStudyGroupCorrection_studentId_correctedAt_idx" ON "StudentStudyGroupCorrection"("studentId","correctedAt");
CREATE FUNCTION azm_reject_study_group_audit_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN RAISE EXCEPTION 'Study group correction evidence is append-only' USING ERRCODE = '23514'; END;
$$;
CREATE TRIGGER "StudentStudyGroupCorrection_immutable" BEFORE UPDATE OR DELETE OR TRUNCATE
ON "StudentStudyGroupCorrection" FOR EACH STATEMENT EXECUTE FUNCTION azm_reject_study_group_audit_mutation();
REVOKE ALL ON "StudentStudyGroupCorrection" FROM PUBLIC;
ALTER TABLE "StudentStudyGroupCorrection" ENABLE ROW LEVEL SECURITY;
-- Existing production runtime group only; no new roles or credential changes.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azm_app_dml') THEN
    GRANT SELECT, INSERT ON "StudentStudyGroupCorrection" TO azm_app_dml;
    CREATE POLICY azm_backend_study_group_audit ON "StudentStudyGroupCorrection"
      FOR ALL TO azm_app_dml USING (true) WITH CHECK (true);
  END IF;
END $$;
