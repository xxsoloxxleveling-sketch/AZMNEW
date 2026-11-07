BEGIN;
CREATE TABLE "OmrLegacyPublication"(
 id TEXT PRIMARY KEY,"studentId" TEXT NOT NULL,"actorId" TEXT NOT NULL,state TEXT NOT NULL,
 "isSynthetic" BOOLEAN NOT NULL DEFAULT true,snapshot JSONB NOT NULL,"evidenceReference" TEXT NOT NULL,
 reason TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT omr_legacy_state CHECK(state IN ('PUBLISHED','WITHHELD') AND length(trim(reason))>=8 AND length(trim("evidenceReference"))>=8),
 CONSTRAINT "OmrLegacyPublication_studentId_fkey" FOREIGN KEY("studentId") REFERENCES "Student"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "OmrLegacyPublication_actorId_fkey" FOREIGN KEY("actorId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OmrLegacyPublication_studentId_createdAt_idx" ON "OmrLegacyPublication"("studentId","createdAt");
CREATE INDEX "OmrLegacyPublication_actorId_idx" ON "OmrLegacyPublication"("actorId");
CREATE TRIGGER "OmrLegacyPublication_immutable" BEFORE UPDATE OR DELETE OR TRUNCATE ON "OmrLegacyPublication" FOR EACH STATEMENT EXECUTE FUNCTION azm_omr_immutable_audit();
CREATE FUNCTION azm_omr_guard_legacy_release() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM "User" u WHERE u.id=NEW."actorId" AND u.role='SUPER_ADMIN' AND u.status='ACTIVE') THEN RAISE EXCEPTION 'Historical release requires an active Super Admin'; END IF;
 IF NEW.state='PUBLISHED' AND NEW."isSynthetic" THEN RAISE EXCEPTION 'Synthetic historical data cannot be published'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OmrLegacyPublication_release_guard" BEFORE INSERT ON "OmrLegacyPublication" FOR EACH ROW EXECUTE FUNCTION azm_omr_guard_legacy_release();
ALTER TABLE "OmrLegacyPublication" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "OmrLegacyPublication" FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='azm_app_dml') THEN
 GRANT SELECT,INSERT ON "OmrLegacyPublication" TO azm_app_dml;
 CREATE POLICY azm_backend_omr ON "OmrLegacyPublication" FOR ALL TO azm_app_dml USING(true) WITH CHECK(true);
END IF; END $$;
COMMIT;
