BEGIN;
-- CreateTable
CREATE TABLE "OmrExam" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "candidateGroup" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "questionCount" INTEGER NOT NULL DEFAULT 100,
    "correctMarks" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "incorrectPenalty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "minimumScore" DECIMAL(12,4),
    "allowedVersions" TEXT[] DEFAULT ARRAY['A', 'B', 'C', 'D']::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publicationStatus" TEXT NOT NULL DEFAULT 'WITHHELD',
    "releaseAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OmrExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmrExamPermission" (
    "examId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canScan" BOOLEAN NOT NULL DEFAULT false,
    "canReview" BOOLEAN NOT NULL DEFAULT false,
    "canManage" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OmrExamPermission_pkey" PRIMARY KEY ("examId","userId")
);

-- CreateTable
CREATE TABLE "OmrAnswerKeyRevision" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "candidateGroup" TEXT NOT NULL,
    "paperVersion" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "subjectMap" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmrAnswerKeyRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmrScanBatch" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "originalObjectKey" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmrScanBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmrScanBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "scanId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "errorCode" TEXT,

    CONSTRAINT "OmrScanBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmrScan" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT,
    "fileHash" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL DEFAULT 1,
    "originalObjectKey" TEXT NOT NULL,
    "annotationObjectKey" TEXT,
    "templateVersion" TEXT,
    "paperVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "rawDetection" JSONB,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityOverrideReason" TEXT,
    "errorCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OmrScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmrDetectedResponse" (
    "scanId" TEXT NOT NULL,
    "question" INTEGER NOT NULL,
    "detectedAnswer" TEXT NOT NULL,
    "reviewedAnswer" TEXT,
    "evidence" JSONB NOT NULL,

    CONSTRAINT "OmrDetectedResponse_pkey" PRIMARY KEY ("scanId","question")
);

-- CreateTable
CREATE TABLE "OmrExamResult" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sourceScanId" TEXT NOT NULL,
    "answerKeyId" TEXT NOT NULL,
    "grade" JSONB NOT NULL,
    "score" DECIMAL(12,4) NOT NULL,
    "maximumScore" DECIMAL(12,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rank" INTEGER,
    "subjectScores" JSONB,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OmrExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmrCorrectionAudit" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "question" INTEGER,
    "previous" JSONB NOT NULL,
    "next" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmrCorrectionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmrPublicationAudit" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OmrPublicationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OmrExam_createdBy_idx" ON "OmrExam"("createdBy");

-- CreateIndex
CREATE INDEX "OmrExam_status_examDate_idx" ON "OmrExam"("status", "examDate");

-- CreateIndex
CREATE UNIQUE INDEX "OmrExam_code_candidateGroup_key" ON "OmrExam"("code", "candidateGroup");

-- CreateIndex
CREATE INDEX "OmrExamPermission_userId_idx" ON "OmrExamPermission"("userId");

-- CreateIndex
CREATE INDEX "OmrAnswerKeyRevision_createdBy_idx" ON "OmrAnswerKeyRevision"("createdBy");

-- CreateIndex
CREATE INDEX "OmrAnswerKeyRevision_approvedBy_idx" ON "OmrAnswerKeyRevision"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "OmrAnswerKeyRevision_examId_candidateGroup_paperVersion_rev_key" ON "OmrAnswerKeyRevision"("examId", "candidateGroup", "paperVersion", "revision");

-- CreateIndex
CREATE INDEX "OmrScanBatch_examId_createdAt_idx" ON "OmrScanBatch"("examId", "createdAt");

-- CreateIndex
CREATE INDEX "OmrScanBatch_uploadedBy_idx" ON "OmrScanBatch"("uploadedBy");

-- CreateIndex
CREATE INDEX "OmrScanBatchItem_scanId_idx" ON "OmrScanBatchItem"("scanId");

-- CreateIndex
CREATE UNIQUE INDEX "OmrScanBatchItem_batchId_pageIndex_key" ON "OmrScanBatchItem"("batchId", "pageIndex");

-- CreateIndex
CREATE INDEX "OmrScan_status_nextAttemptAt_createdAt_idx" ON "OmrScan"("status", "nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "OmrScan_studentId_idx" ON "OmrScan"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "OmrScan_examId_fileHash_pageIndex_key" ON "OmrScan"("examId", "fileHash", "pageIndex");

-- CreateIndex
CREATE INDEX "OmrExamResult_studentId_idx" ON "OmrExamResult"("studentId");

-- CreateIndex
CREATE INDEX "OmrExamResult_sourceScanId_idx" ON "OmrExamResult"("sourceScanId");

-- CreateIndex
CREATE INDEX "OmrExamResult_answerKeyId_idx" ON "OmrExamResult"("answerKeyId");

-- CreateIndex
CREATE INDEX "OmrExamResult_approvedBy_idx" ON "OmrExamResult"("approvedBy");

-- CreateIndex
CREATE INDEX "OmrExamResult_examId_status_idx" ON "OmrExamResult"("examId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OmrExamResult_examId_studentId_key" ON "OmrExamResult"("examId", "studentId");

-- CreateIndex
CREATE INDEX "OmrCorrectionAudit_scanId_createdAt_idx" ON "OmrCorrectionAudit"("scanId", "createdAt");

-- CreateIndex
CREATE INDEX "OmrCorrectionAudit_actorId_idx" ON "OmrCorrectionAudit"("actorId");

-- CreateIndex
CREATE INDEX "OmrPublicationAudit_resultId_createdAt_idx" ON "OmrPublicationAudit"("resultId", "createdAt");

-- CreateIndex
CREATE INDEX "OmrPublicationAudit_actorId_idx" ON "OmrPublicationAudit"("actorId");

-- AddForeignKey
ALTER TABLE "OmrExam" ADD CONSTRAINT "OmrExam_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrExamPermission" ADD CONSTRAINT "OmrExamPermission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "OmrExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrExamPermission" ADD CONSTRAINT "OmrExamPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrAnswerKeyRevision" ADD CONSTRAINT "OmrAnswerKeyRevision_examId_fkey" FOREIGN KEY ("examId") REFERENCES "OmrExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrAnswerKeyRevision" ADD CONSTRAINT "OmrAnswerKeyRevision_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrAnswerKeyRevision" ADD CONSTRAINT "OmrAnswerKeyRevision_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrScanBatch" ADD CONSTRAINT "OmrScanBatch_examId_fkey" FOREIGN KEY ("examId") REFERENCES "OmrExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrScanBatch" ADD CONSTRAINT "OmrScanBatch_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrScanBatchItem" ADD CONSTRAINT "OmrScanBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OmrScanBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrScanBatchItem" ADD CONSTRAINT "OmrScanBatchItem_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "OmrScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrScan" ADD CONSTRAINT "OmrScan_examId_fkey" FOREIGN KEY ("examId") REFERENCES "OmrExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrScan" ADD CONSTRAINT "OmrScan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrDetectedResponse" ADD CONSTRAINT "OmrDetectedResponse_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "OmrScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrExamResult" ADD CONSTRAINT "OmrExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "OmrExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrExamResult" ADD CONSTRAINT "OmrExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrExamResult" ADD CONSTRAINT "OmrExamResult_sourceScanId_fkey" FOREIGN KEY ("sourceScanId") REFERENCES "OmrScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrExamResult" ADD CONSTRAINT "OmrExamResult_answerKeyId_fkey" FOREIGN KEY ("answerKeyId") REFERENCES "OmrAnswerKeyRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrExamResult" ADD CONSTRAINT "OmrExamResult_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrCorrectionAudit" ADD CONSTRAINT "OmrCorrectionAudit_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "OmrScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrCorrectionAudit" ADD CONSTRAINT "OmrCorrectionAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrPublicationAudit" ADD CONSTRAINT "OmrPublicationAudit_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "OmrExamResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmrPublicationAudit" ADD CONSTRAINT "OmrPublicationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- OMR evidence is additive: no attendance, existing score, or student data is rewritten.
ALTER TABLE "OmrExam" ADD CONSTRAINT omr_exam_policy CHECK (
  "questionCount" BETWEEN 1 AND 100 AND "correctMarks">0 AND "incorrectPenalty">=0
  AND ("minimumScore" IS NULL OR "minimumScore" <= "questionCount"*"correctMarks")
  AND cardinality("allowedVersions") BETWEEN 1 AND 4
  AND "allowedVersions" <@ ARRAY['A','B','C','D']::text[]
  AND status IN ('DRAFT','APPROVED','CLOSED')
  AND "publicationStatus" IN ('WITHHELD','PUBLISHED','WITHDRAWN'));
ALTER TABLE "OmrAnswerKeyRevision" ADD CONSTRAINT omr_key_state CHECK (
  revision>0 AND "paperVersion" IN ('A','B','C','D') AND status IN ('DRAFT','APPROVED')
  AND (status<>'APPROVED' OR ("approvedBy" IS NOT NULL AND "approvedAt" IS NOT NULL)));
CREATE FUNCTION public.azm_omr_valid_answers(jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN jsonb_typeof($1) <> 'array' THEN false ELSE
 jsonb_array_length($1) BETWEEN 1 AND 100 AND NOT EXISTS (
 SELECT 1 FROM jsonb_array_elements($1) a WHERE a NOT IN ('"A"'::jsonb,'"B"'::jsonb,'"C"'::jsonb,'"D"'::jsonb)) END
$$;
ALTER TABLE "OmrAnswerKeyRevision" ADD CONSTRAINT omr_key_answers CHECK (azm_omr_valid_answers(answers));
ALTER TABLE "OmrDetectedResponse" ADD CONSTRAINT omr_response_shape CHECK (
 question BETWEEN 1 AND 100 AND "detectedAnswer" IN ('A','B','C','D','BLANK','MULTIPLE','UNCERTAIN')
 AND ("reviewedAnswer" IS NULL OR "reviewedAnswer" IN ('A','B','C','D','BLANK','MULTIPLE','UNCERTAIN')));
ALTER TABLE "OmrScan" ADD CONSTRAINT omr_scan_state CHECK (
 "fileHash" ~ '^[a-f0-9]{64}$' AND "pageIndex" BETWEEN 1 AND 25 AND attempts>=0
 AND status IN ('QUEUED','PROCESSING','REVIEW_REQUIRED','RECOGNIZED','INVALID','FAILED','VERIFIED','REJECTED'));
ALTER TABLE "OmrScanBatchItem" ADD CONSTRAINT omr_batch_page CHECK ("pageIndex" BETWEEN 1 AND 25);
ALTER TABLE "OmrExamResult" ADD CONSTRAINT omr_result_state CHECK (
 "maximumScore">0 AND score<="maximumScore" AND (rank IS NULL OR rank>0)
 AND status IN ('DRAFT','VERIFIED','PUBLISHED','WITHHELD','WITHDRAWN')
 AND (status<>'PUBLISHED' OR ("publishedAt" IS NOT NULL AND "approvedBy" IS NOT NULL AND "approvedAt" IS NOT NULL)));
ALTER TABLE "OmrCorrectionAudit" ADD CONSTRAINT omr_correction_reason CHECK (length(trim(reason))>=8);
ALTER TABLE "OmrPublicationAudit" ADD CONSTRAINT omr_publication_reason CHECK (
 length(trim(reason))>=8 AND action IN ('APPROVED','PUBLISHED','WITHHELD','WITHDRAWN','REEVALUATED','CORRECTED'));

CREATE FUNCTION public.azm_omr_immutable_audit() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'OMR audit evidence is append-only'; END $$;
CREATE TRIGGER "OmrCorrectionAudit_immutable" BEFORE UPDATE OR DELETE OR TRUNCATE ON "OmrCorrectionAudit"
FOR EACH STATEMENT EXECUTE FUNCTION azm_omr_immutable_audit();
CREATE TRIGGER "OmrPublicationAudit_immutable" BEFORE UPDATE OR DELETE OR TRUNCATE ON "OmrPublicationAudit"
FOR EACH STATEMENT EXECUTE FUNCTION azm_omr_immutable_audit();

CREATE FUNCTION public.azm_omr_guard_key() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE exam "OmrExam";
BEGIN
 IF TG_OP<>'INSERT' AND OLD.status='APPROVED' THEN RAISE EXCEPTION 'Approved OMR key revisions are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 SELECT * INTO exam FROM "OmrExam" WHERE id=NEW."examId";
 IF (NEW.status='APPROVED' AND exam.status<>'APPROVED') OR exam.id IS NULL OR exam."candidateGroup"<>NEW."candidateGroup"
 OR NOT NEW."paperVersion"=ANY(exam."allowedVersions") OR jsonb_array_length(NEW.answers)<>exam."questionCount"
 THEN RAISE EXCEPTION 'OMR key does not match exam policy'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OmrAnswerKeyRevision_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OmrAnswerKeyRevision"
FOR EACH ROW EXECUTE FUNCTION azm_omr_guard_key();

CREATE FUNCTION public.azm_omr_guard_exam() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.status<>'DRAFT' AND ROW(NEW.code,NEW.session,NEW."candidateGroup",NEW."questionCount",NEW."correctMarks",NEW."incorrectPenalty",NEW."minimumScore",NEW."allowedVersions")
 IS DISTINCT FROM ROW(OLD.code,OLD.session,OLD."candidateGroup",OLD."questionCount",OLD."correctMarks",OLD."incorrectPenalty",OLD."minimumScore",OLD."allowedVersions")
 THEN RAISE EXCEPTION 'Approved OMR exam policy is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OmrExam_policy_guard" BEFORE UPDATE ON "OmrExam" FOR EACH ROW EXECUTE FUNCTION azm_omr_guard_exam();

CREATE FUNCTION public.azm_omr_guard_scan_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF ROW(NEW."examId",NEW."fileHash",NEW."pageIndex",NEW."originalObjectKey") IS DISTINCT FROM
 ROW(OLD."examId",OLD."fileHash",OLD."pageIndex",OLD."originalObjectKey") OR
 (OLD."rawDetection" IS NOT NULL AND NEW."rawDetection" IS DISTINCT FROM OLD."rawDetection")
 THEN RAISE EXCEPTION 'Original OMR scan evidence is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OmrScan_evidence_guard" BEFORE UPDATE ON "OmrScan" FOR EACH ROW EXECUTE FUNCTION azm_omr_guard_scan_evidence();

CREATE FUNCTION public.azm_omr_guard_result() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE k "OmrAnswerKeyRevision"; s "OmrScan"; e "OmrExam";
BEGIN
 SELECT * INTO k FROM "OmrAnswerKeyRevision" WHERE id=NEW."answerKeyId";
 SELECT * INTO s FROM "OmrScan" WHERE id=NEW."sourceScanId";
 SELECT * INTO e FROM "OmrExam" WHERE id=NEW."examId";
 IF k.id IS NULL OR k.status<>'APPROVED' OR k."examId"<>NEW."examId" OR k."candidateGroup"<>e."candidateGroup"
 OR s.id IS NULL OR s."examId"<>NEW."examId" OR s."studentId" IS DISTINCT FROM NEW."studentId"
 OR NOT s."identityVerified" OR s."paperVersion" IS DISTINCT FROM k."paperVersion"
 THEN RAISE EXCEPTION 'OMR result identity, exam or key mismatch'; END IF;
 IF TG_OP='UPDATE' AND OLD.status='PUBLISHED' AND ROW(NEW.grade,NEW.score,NEW."answerKeyId",NEW."sourceScanId",NEW."studentId",NEW."examId")
 IS DISTINCT FROM ROW(OLD.grade,OLD.score,OLD."answerKeyId",OLD."sourceScanId",OLD."studentId",OLD."examId")
 THEN RAISE EXCEPTION 'Withdraw and audit an official result before reevaluation'; END IF;
 IF NEW.status='PUBLISHED' AND (s.status<>'VERIFIED' OR e.status<>'APPROVED' OR e."releaseAt" IS NULL OR e."releaseAt">CURRENT_TIMESTAMP OR k."isSynthetic")
 THEN RAISE EXCEPTION 'OMR publication gate is closed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OmrExamResult_identity_guard" BEFORE INSERT OR UPDATE ON "OmrExamResult"
FOR EACH ROW EXECUTE FUNCTION azm_omr_guard_result();

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['OmrExam','OmrExamPermission','OmrAnswerKeyRevision','OmrScanBatch','OmrScanBatchItem','OmrScan','OmrDetectedResponse','OmrExamResult','OmrCorrectionAudit','OmrPublicationAudit'] LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='azm_app_dml') THEN
   EXECUTE format('CREATE POLICY azm_backend_omr ON public.%I FOR ALL TO azm_app_dml USING(true) WITH CHECK(true)',t);
   IF t IN ('OmrCorrectionAudit','OmrPublicationAudit') THEN
    EXECUTE format('GRANT SELECT,INSERT ON public.%I TO azm_app_dml',t);
   ELSE EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO azm_app_dml',t); END IF;
  END IF;
 END LOOP;
END $$;
COMMIT;
