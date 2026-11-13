CREATE TYPE "ExaminationPublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'WITHHELD');
CREATE TYPE "ExaminationResultIdentityStatus" AS ENUM ('PENDING', 'VERIFIED', 'MISMATCH');
CREATE TYPE "ExaminationResultScoringStatus" AS ENUM ('PROVISIONAL', 'VERIFIED');
CREATE TYPE "ExaminationResultVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'WITHHELD');
CREATE TYPE "ExaminationResultPublicationStatus" AS ENUM ('UNPUBLISHED', 'PUBLISHED', 'WITHHELD');
CREATE TYPE "ResultResponseClassification" AS ENUM ('CORRECT', 'WRONG', 'BLANK', 'MULTIPLE', 'UNCERTAIN');
CREATE TYPE "ResultResponseSource" AS ENUM ('OMR_DETECTED', 'HUMAN_REVIEW', 'ADMIN_CORRECTION', 'MANUAL_ENTRY');
CREATE TYPE "ResultChangeSource" AS ENUM ('STUDENT_PROFILE', 'RESULTS_DASHBOARD', 'MANUAL_ENTRY', 'EXAM_CONFIGURATION', 'DMC_ISSUANCE');
CREATE TYPE "DmcDocumentType" AS ENUM ('ELECTRONIC', 'OFFICIAL');
CREATE TYPE "DmcIssuanceEventType" AS ENUM ('ISSUED', 'SUPERSEDED', 'REVOKED');

CREATE TABLE "Examination" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sessionReference" TEXT NOT NULL,
    "examDate" DATE,
    "classGroup" TEXT NOT NULL,
    "maximumMarks" DECIMAL(8,2) NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "scoringPolicy" JSONB NOT NULL,
    "publicationStatus" "ExaminationPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Examination_questionCount_positive" CHECK ("questionCount" > 0),
    CONSTRAINT "Examination_maximumMarks_positive" CHECK ("maximumMarks" > 0),
    CONSTRAINT "Examination_revision_positive" CHECK ("revision" > 0),
    CONSTRAINT "Examination_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExaminationResult" (
    "id" TEXT NOT NULL,
    "resultReference" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "sourceScanReference" TEXT,
    "paperVersion" TEXT,
    "obtainedMarks" DECIMAL(8,2),
    "maximumMarks" DECIMAL(8,2) NOT NULL,
    "correctCount" INTEGER,
    "wrongCount" INTEGER,
    "blankCount" INTEGER,
    "multipleCount" INTEGER,
    "uncertainCount" INTEGER,
    "identityStatus" "ExaminationResultIdentityStatus" NOT NULL DEFAULT 'PENDING',
    "scoringStatus" "ExaminationResultScoringStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "verificationStatus" "ExaminationResultVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "publicationStatus" "ExaminationResultPublicationStatus" NOT NULL DEFAULT 'UNPUBLISHED',
    "resultRevision" INTEGER NOT NULL DEFAULT 1,
    "administrativelyAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "administrativeAdjustmentReason" TEXT,
    "administrativeRemarks" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExaminationResult_maximumMarks_positive" CHECK ("maximumMarks" > 0),
    CONSTRAINT "ExaminationResult_resultRevision_positive" CHECK ("resultRevision" > 0),
    CONSTRAINT "ExaminationResult_counts_nonnegative" CHECK (("correctCount" IS NULL OR "correctCount" >= 0) AND ("wrongCount" IS NULL OR "wrongCount" >= 0) AND ("blankCount" IS NULL OR "blankCount" >= 0) AND ("multipleCount" IS NULL OR "multipleCount" >= 0) AND ("uncertainCount" IS NULL OR "uncertainCount" >= 0)),
    CONSTRAINT "ExaminationResult_obtainedMarks_range" CHECK ("obtainedMarks" IS NULL OR ("obtainedMarks" >= 0 AND "obtainedMarks" <= "maximumMarks")),
    CONSTRAINT "ExaminationResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResultQuestionResponse" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "detectedAnswer" TEXT,
    "reviewedAnswer" TEXT,
    "classification" "ResultResponseClassification" NOT NULL,
    "marksAwarded" DECIMAL(8,2),
    "responseSource" "ResultResponseSource" NOT NULL,
    "reviewMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResultQuestionResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResultCorrectionAudit" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "previousRevision" INTEGER NOT NULL,
    "newRevision" INTEGER NOT NULL,
    "oldValues" JSONB NOT NULL,
    "newValues" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "source" "ResultChangeSource" NOT NULL,
    "publicationImpact" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResultCorrectionAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExaminationAudit" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "previousValues" JSONB NOT NULL,
    "newValues" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "source" "ResultChangeSource" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExaminationAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExaminationPublicationAudit" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "previousStatus" "ExaminationPublicationStatus" NOT NULL,
    "newStatus" "ExaminationPublicationStatus" NOT NULL,
    "previousRevision" INTEGER NOT NULL,
    "newRevision" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExaminationPublicationAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExaminationPaperKeyRevision" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "paperVersion" TEXT NOT NULL,
    "answerKeyRevision" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExaminationPaperKeyRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DmcIssuancePreparation" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "resultRevision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DmcIssuancePreparation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DmcIssuance" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "documentType" "DmcDocumentType" NOT NULL,
    "resultRevision" INTEGER NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "verificationReference" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedByName" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DmcIssuance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DmcIssuanceEvent" (
    "id" TEXT NOT NULL,
    "issuanceId" TEXT NOT NULL,
    "eventType" "DmcIssuanceEventType" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DmcIssuanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Examination_reference_key" ON "Examination"("reference");
CREATE INDEX "Examination_publicationStatus_examDate_idx" ON "Examination"("publicationStatus", "examDate");
CREATE INDEX "Examination_classGroup_sessionReference_idx" ON "Examination"("classGroup", "sessionReference");
CREATE UNIQUE INDEX "ExaminationResult_resultReference_key" ON "ExaminationResult"("resultReference");
CREATE UNIQUE INDEX "ExaminationResult_sourceScanReference_key" ON "ExaminationResult"("sourceScanReference");
CREATE UNIQUE INDEX "ExaminationResult_studentId_examinationId_key" ON "ExaminationResult"("studentId", "examinationId");
CREATE INDEX "ExaminationResult_examinationId_publicationStatus_verificationStatus_idx" ON "ExaminationResult"("examinationId", "publicationStatus", "verificationStatus");
CREATE INDEX "ExaminationResult_studentId_createdAt_idx" ON "ExaminationResult"("studentId", "createdAt");
CREATE INDEX "ExaminationResult_updatedAt_idx" ON "ExaminationResult"("updatedAt");
CREATE UNIQUE INDEX "ResultQuestionResponse_resultId_questionNumber_key" ON "ResultQuestionResponse"("resultId", "questionNumber");
CREATE INDEX "ResultQuestionResponse_resultId_classification_idx" ON "ResultQuestionResponse"("resultId", "classification");
CREATE INDEX "ResultCorrectionAudit_resultId_occurredAt_idx" ON "ResultCorrectionAudit"("resultId", "occurredAt");
CREATE INDEX "ResultCorrectionAudit_studentId_examinationId_occurredAt_idx" ON "ResultCorrectionAudit"("studentId", "examinationId", "occurredAt");
CREATE INDEX "ExaminationAudit_examinationId_occurredAt_idx" ON "ExaminationAudit"("examinationId", "occurredAt");
CREATE INDEX "ExaminationPublicationAudit_examinationId_occurredAt_idx" ON "ExaminationPublicationAudit"("examinationId", "occurredAt");
CREATE UNIQUE INDEX "ExaminationPaperKeyRevision_examinationId_paperVersion_key" ON "ExaminationPaperKeyRevision"("examinationId", "paperVersion");
CREATE INDEX "ExaminationPaperKeyRevision_examinationId_createdAt_idx" ON "ExaminationPaperKeyRevision"("examinationId", "createdAt");
CREATE INDEX "DmcIssuancePreparation_resultId_expiresAt_idx" ON "DmcIssuancePreparation"("resultId", "expiresAt");
CREATE INDEX "DmcIssuancePreparation_actorId_expiresAt_idx" ON "DmcIssuancePreparation"("actorId", "expiresAt");
CREATE UNIQUE INDEX "DmcIssuance_certificateNumber_key" ON "DmcIssuance"("certificateNumber");
CREATE UNIQUE INDEX "DmcIssuance_verificationReference_key" ON "DmcIssuance"("verificationReference");
CREATE UNIQUE INDEX "DmcIssuance_resultId_documentType_issueNumber_key" ON "DmcIssuance"("resultId", "documentType", "issueNumber");
CREATE UNIQUE INDEX "DmcIssuance_issuedById_idempotencyKey_key" ON "DmcIssuance"("issuedById", "idempotencyKey");
CREATE INDEX "DmcIssuance_resultId_issuedAt_idx" ON "DmcIssuance"("resultId", "issuedAt");
CREATE INDEX "DmcIssuanceEvent_issuanceId_occurredAt_idx" ON "DmcIssuanceEvent"("issuanceId", "occurredAt");

ALTER TABLE "Examination" ADD CONSTRAINT "Examination_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Examination" ADD CONSTRAINT "Examination_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationResult" ADD CONSTRAINT "ExaminationResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationResult" ADD CONSTRAINT "ExaminationResult_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationResult" ADD CONSTRAINT "ExaminationResult_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationResult" ADD CONSTRAINT "ExaminationResult_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationResult" ADD CONSTRAINT "ExaminationResult_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultQuestionResponse" ADD CONSTRAINT "ResultQuestionResponse_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ExaminationResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultCorrectionAudit" ADD CONSTRAINT "ResultCorrectionAudit_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ExaminationResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultCorrectionAudit" ADD CONSTRAINT "ResultCorrectionAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationAudit" ADD CONSTRAINT "ExaminationAudit_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationAudit" ADD CONSTRAINT "ExaminationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationPublicationAudit" ADD CONSTRAINT "ExaminationPublicationAudit_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationPublicationAudit" ADD CONSTRAINT "ExaminationPublicationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationPaperKeyRevision" ADD CONSTRAINT "ExaminationPaperKeyRevision_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationPaperKeyRevision" ADD CONSTRAINT "ExaminationPaperKeyRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DmcIssuancePreparation" ADD CONSTRAINT "DmcIssuancePreparation_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ExaminationResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DmcIssuancePreparation" ADD CONSTRAINT "DmcIssuancePreparation_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DmcIssuance" ADD CONSTRAINT "DmcIssuance_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "ExaminationResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DmcIssuance" ADD CONSTRAINT "DmcIssuance_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DmcIssuanceEvent" ADD CONSTRAINT "DmcIssuanceEvent_issuanceId_fkey" FOREIGN KEY ("issuanceId") REFERENCES "DmcIssuance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DmcIssuanceEvent" ADD CONSTRAINT "DmcIssuanceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_official_result_audit_mutation"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Official result audit and issuance history are append-only.' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "ResultCorrectionAudit_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "ResultCorrectionAudit"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_official_result_audit_mutation"();
CREATE TRIGGER "ExaminationAudit_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "ExaminationAudit"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_official_result_audit_mutation"();
CREATE TRIGGER "ExaminationPublicationAudit_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "ExaminationPublicationAudit"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_official_result_audit_mutation"();
CREATE TRIGGER "ExaminationPaperKeyRevision_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "ExaminationPaperKeyRevision"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_official_result_audit_mutation"();
CREATE TRIGGER "DmcIssuance_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "DmcIssuance"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_official_result_audit_mutation"();
CREATE TRIGGER "DmcIssuanceEvent_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "DmcIssuanceEvent"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_official_result_audit_mutation"();

REVOKE ALL ON "Examination", "ExaminationResult", "ResultQuestionResponse", "ResultCorrectionAudit",
  "ExaminationAudit", "ExaminationPublicationAudit", "ExaminationPaperKeyRevision",
  "DmcIssuancePreparation", "DmcIssuance", "DmcIssuanceEvent" FROM PUBLIC;

ALTER TABLE "Examination" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExaminationResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResultQuestionResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResultCorrectionAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExaminationAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExaminationPublicationAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExaminationPaperKeyRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DmcIssuancePreparation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DmcIssuance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DmcIssuanceEvent" ENABLE ROW LEVEL SECURITY;

-- Existing restricted runtime role only. The migration never creates or alters a role.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'azm_app_dml') THEN
    GRANT SELECT, INSERT, UPDATE ON "Examination", "ExaminationResult", "ResultQuestionResponse" TO azm_app_dml;
    GRANT SELECT, INSERT ON "ResultCorrectionAudit", "ExaminationAudit", "ExaminationPublicationAudit",
      "ExaminationPaperKeyRevision", "DmcIssuance", "DmcIssuanceEvent" TO azm_app_dml;
    GRANT SELECT, INSERT, DELETE ON "DmcIssuancePreparation" TO azm_app_dml;

    CREATE POLICY azm_results_examination_runtime ON "Examination" FOR ALL TO azm_app_dml USING (true) WITH CHECK (true);
    CREATE POLICY azm_results_result_runtime ON "ExaminationResult" FOR ALL TO azm_app_dml USING (true) WITH CHECK (true);
    CREATE POLICY azm_results_response_runtime ON "ResultQuestionResponse" FOR ALL TO azm_app_dml USING (true) WITH CHECK (true);
    CREATE POLICY azm_results_correction_audit_runtime ON "ResultCorrectionAudit" FOR ALL TO azm_app_dml USING (true) WITH CHECK (true);
    CREATE POLICY azm_results_exam_audit_runtime ON "ExaminationAudit" FOR ALL TO azm_app_dml USING (true) WITH CHECK (true);
    CREATE POLICY azm_results_exam_publication_audit_runtime ON "ExaminationPublicationAudit" FOR ALL TO azm_app_dml USING (true) WITH CHECK (true);
    CREATE POLICY azm_results_paper_revision_runtime ON "ExaminationPaperKeyRevision" FOR ALL TO azm_app_dml USING (true) WITH CHECK (true);
    CREATE POLICY azm_results_dmc_preparation_runtime ON "DmcIssuancePreparation" FOR ALL TO azm_app_dml USING (true) WITH CHECK (true);
    CREATE POLICY azm_results_dmc_issuance_runtime ON "DmcIssuance" FOR ALL TO azm_app_dml USING (true) WITH CHECK (true);
    CREATE POLICY azm_results_dmc_issuance_event_runtime ON "DmcIssuanceEvent" FOR ALL TO azm_app_dml USING (true) WITH CHECK (true);
  END IF;
END $$;
