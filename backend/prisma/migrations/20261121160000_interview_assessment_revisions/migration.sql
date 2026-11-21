-- Additive interview evaluation records. No existing placements, marks, DMCs or grants are modified.
CREATE TABLE "InterviewPanelRevision" (
  "id" TEXT PRIMARY KEY,
  "roundId" TEXT NOT NULL REFERENCES "InterviewRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "panel" INTEGER NOT NULL CHECK ("panel" BETWEEN 1 AND 6),
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  "members" JSONB NOT NULL,
  "reason" TEXT NOT NULL CHECK (length(btrim("reason")) BETWEEN 3 AND 2000),
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewPanelRevision_roundId_panel_revision_key" UNIQUE ("roundId", "panel", "revision")
);
CREATE INDEX "InterviewPanelRevision_roundId_panel_createdAt_idx" ON "InterviewPanelRevision"("roundId", "panel", "createdAt");

CREATE TABLE "InterviewAssessmentRevision" (
  "id" TEXT PRIMARY KEY,
  "roundId" TEXT NOT NULL REFERENCES "InterviewRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "placementId" TEXT NOT NULL REFERENCES "InterviewFixedPlacement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "panelRevisionId" TEXT NOT NULL REFERENCES "InterviewPanelRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  "status" TEXT NOT NULL CHECK ("status" IN ('DRAFT', 'SUBMITTED')),
  "attendance" TEXT NOT NULL CHECK ("attendance" IN ('UNKNOWN', 'PRESENT', 'ABSENT')),
  "scores" JSONB NOT NULL,
  "extracurricular" DECIMAL(5,2) CHECK ("extracurricular" BETWEEN 0 AND 10),
  "extracurricularEvidence" TEXT NOT NULL DEFAULT '',
  "extracurricularReviewed" BOOLEAN NOT NULL DEFAULT false,
  "academic" DECIMAL(5,2) CHECK ("academic" BETWEEN 0 AND 5),
  "academicEvidence" TEXT NOT NULL DEFAULT '',
  "academicReviewed" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT NOT NULL DEFAULT '',
  "reason" TEXT NOT NULL DEFAULT '',
  "classSnapshot" TEXT NOT NULL,
  "writtenSnapshot" JSONB NOT NULL CHECK (jsonb_typeof("writtenSnapshot") = 'object'),
  "policyVersion" TEXT NOT NULL DEFAULT 'SESSION_V_2026_60_20_10_5_5_V1'
    CHECK ("policyVersion" = 'SESSION_V_2026_60_20_10_5_5_V1'),
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorName" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "requestHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewAssessmentRevision_placementId_revision_key" UNIQUE ("placementId", "revision"),
  CONSTRAINT "InterviewAssessmentRevision_roundId_idempotencyKey_key" UNIQUE ("roundId", "idempotencyKey"),
  CONSTRAINT "InterviewAssessmentRevision_submission_key_check" CHECK
    (("idempotencyKey" IS NULL AND "requestHash" IS NULL) OR
      ("idempotencyKey" IS NOT NULL AND "requestHash" IS NOT NULL
        AND length("idempotencyKey") BETWEEN 8 AND 100 AND "requestHash" ~ '^[a-f0-9]{64}$')),
  CONSTRAINT "InterviewAssessmentRevision_submitted_check" CHECK (
    "status" <> 'SUBMITTED' OR ("idempotencyKey" IS NOT NULL AND (
      "attendance" = 'ABSENT' OR (
        "attendance" = 'PRESENT' AND "extracurricular" IS NOT NULL AND "academic" IS NOT NULL
        AND "extracurricularReviewed" AND "academicReviewed"
        AND length(btrim("extracurricularEvidence")) >= 3 AND length(btrim("academicEvidence")) >= 3
        AND coalesce("writtenSnapshot"->>'isFinal' = 'true', false)
        AND coalesce("writtenSnapshot"->>'status' = 'QUALIFIED', false)
      )
    ))
  )
);
CREATE INDEX "InterviewAssessmentRevision_roundId_placementId_createdAt_idx" ON "InterviewAssessmentRevision"("roundId", "placementId", "createdAt");
CREATE INDEX "InterviewAssessmentRevision_panelRevisionId_idx" ON "InterviewAssessmentRevision"("panelRevisionId");

CREATE FUNCTION azm_validate_interview_assessment_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE member JSONB; card JSONB; component TEXT; score NUMERIC; placement_round TEXT; placement_panel INTEGER;
  membership public."InterviewPanelRevision"%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME = 'InterviewPanelRevision' THEN
    IF jsonb_typeof(NEW."members") <> 'array' OR jsonb_array_length(NEW."members") <> 3 THEN
      RAISE EXCEPTION 'Exactly three distinct named interview members are required' USING ERRCODE = '23514';
    END IF;
    FOR member IN SELECT value FROM jsonb_array_elements(NEW."members") LOOP
      IF jsonb_typeof(member) <> 'object' OR coalesce(length(btrim(member->>'id')),0) = 0
        OR coalesce(length(btrim(member->>'name')),0) NOT BETWEEN 2 AND 100
        OR member->>'position' NOT IN ('1','2','3') THEN
        RAISE EXCEPTION 'Invalid interview member' USING ERRCODE = '23514';
      END IF;
    END LOOP;
    IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(NEW."members")) <> 3
      OR (SELECT count(DISTINCT lower(regexp_replace(btrim(value->>'name'), '\s+', ' ', 'g'))) FROM jsonb_array_elements(NEW."members")) <> 3
      OR (SELECT count(DISTINCT value->>'position') FROM jsonb_array_elements(NEW."members")) <> 3 THEN
      RAISE EXCEPTION 'Duplicate interview member' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT schedule."roundId", placement."panel" INTO placement_round, placement_panel
    FROM public."InterviewFixedPlacement" placement
    JOIN public."InterviewFixedSchedule" schedule ON schedule.id = placement."scheduleId"
    WHERE placement.id = NEW."placementId";
  SELECT * INTO membership FROM public."InterviewPanelRevision" WHERE id = NEW."panelRevisionId";
  IF placement_round IS DISTINCT FROM NEW."roundId" OR membership."roundId" IS DISTINCT FROM NEW."roundId"
    OR placement_panel IS DISTINCT FROM membership."panel" THEN
    RAISE EXCEPTION 'Assessment must match its fixed placement and panel' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(NEW."writtenSnapshot"->'isFinal') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(NEW."writtenSnapshot"->'maximumMarks') IS DISTINCT FROM 'number'
    OR coalesce(jsonb_typeof(NEW."writtenSnapshot"->'marks') NOT IN ('number', 'null'), true)
    OR jsonb_typeof(NEW."writtenSnapshot"->'status') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Invalid written mark snapshot' USING ERRCODE = '23514';
  END IF;
  IF (NEW."writtenSnapshot"->>'maximumMarks')::numeric <= 0 THEN
    RAISE EXCEPTION 'Invalid written mark scale' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(NEW."writtenSnapshot"->'marks') = 'number' THEN
    score := (NEW."writtenSnapshot"->>'marks')::numeric;
    IF score < 0 OR score > (NEW."writtenSnapshot"->>'maximumMarks')::numeric OR scale(score) > 2 THEN
      RAISE EXCEPTION 'Invalid written mark snapshot' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."status" = 'SUBMITTED' AND NEW."attendance" = 'PRESENT' THEN
    IF jsonb_typeof(NEW."writtenSnapshot"->'marks') IS DISTINCT FROM 'number'
      OR (NEW."writtenSnapshot"->>'maximumMarks')::numeric <> 100
      OR (NEW."writtenSnapshot"->>'marks')::numeric < 60
      OR coalesce(length(btrim(NEW."writtenSnapshot"->>'reference')),0) = 0
      OR coalesce(length(btrim(NEW."writtenSnapshot"->>'revision')),0) = 0 THEN
      RAISE EXCEPTION 'Submitted assessments require a final written source reference and revision' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF jsonb_typeof(NEW."scores") <> 'array' OR jsonb_array_length(NEW."scores") <> 3 THEN
    RAISE EXCEPTION 'Exactly three member scorecards are required' USING ERRCODE = '23514';
  END IF;
  IF ARRAY(SELECT value->>'memberId' FROM jsonb_array_elements(NEW."scores") ORDER BY value->>'memberId')
    IS DISTINCT FROM ARRAY(SELECT value->>'id' FROM jsonb_array_elements(membership."members") ORDER BY value->>'id') THEN
    RAISE EXCEPTION 'Scores must match the saved panel membership' USING ERRCODE = '23514';
  END IF;
  FOR card IN SELECT value FROM jsonb_array_elements(NEW."scores") LOOP
    FOREACH component IN ARRAY ARRAY['interview','personality'] LOOP
      IF NOT (card ? component) OR jsonb_typeof(card->component) NOT IN ('null','number') THEN
        RAISE EXCEPTION 'Invalid member score' USING ERRCODE = '23514';
      END IF;
      IF jsonb_typeof(card->component) = 'number' THEN
        score := (card->>component)::numeric;
        IF score < 0 OR score > (CASE WHEN component = 'interview' THEN 20 ELSE 5 END) OR scale(score) > 2 THEN
          RAISE EXCEPTION 'Member score outside approved scale' USING ERRCODE = '23514';
        END IF;
      ELSIF NEW."status" = 'SUBMITTED' AND NEW."attendance" = 'PRESENT' THEN
        RAISE EXCEPTION 'Submitted present assessments require complete member scores' USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InterviewPanelRevision_validate" BEFORE INSERT ON "InterviewPanelRevision"
FOR EACH ROW EXECUTE FUNCTION azm_validate_interview_assessment_insert();
CREATE TRIGGER "InterviewAssessmentRevision_validate" BEFORE INSERT ON "InterviewAssessmentRevision"
FOR EACH ROW EXECUTE FUNCTION azm_validate_interview_assessment_insert();

CREATE FUNCTION azm_reject_interview_assessment_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Interview assessment history is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "InterviewPanelRevision_immutable"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "InterviewPanelRevision"
FOR EACH STATEMENT EXECUTE FUNCTION azm_reject_interview_assessment_mutation();
CREATE TRIGGER "InterviewAssessmentRevision_immutable"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "InterviewAssessmentRevision"
FOR EACH STATEMENT EXECUTE FUNCTION azm_reject_interview_assessment_mutation();
REVOKE ALL ON "InterviewPanelRevision", "InterviewAssessmentRevision" FROM PUBLIC;
DO $$
DECLARE client_role TEXT;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON public."InterviewPanelRevision", public."InterviewAssessmentRevision" FROM %I', client_role);
    END IF;
  END LOOP;
END;
$$;
