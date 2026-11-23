-- Manual merit awards are separate from registration categories and all examination scores.
-- This migration adds empty history only; no student is assigned an award automatically.
CREATE TABLE "InterviewMeritAwardRevision" (
  "id" TEXT PRIMARY KEY,
  "roundId" TEXT NOT NULL REFERENCES "InterviewRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "placementId" TEXT NOT NULL REFERENCES "InterviewFixedPlacement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  "awardCode" VARCHAR(40) CHECK ("awardCode" IN (
    'UMRAH_TICKET', 'LAPTOP', 'FULL_YEAR_SCHOLARSHIP', 'PARTIAL_SCHOLARSHIP',
    'EDUCATIONAL_VOUCHER', 'CASH_PRIZE_3000', 'CASH_PRIZE_5000'
  )),
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorName" TEXT NOT NULL,
  "idempotencyKey" VARCHAR(100) NOT NULL CHECK ("idempotencyKey" ~ '^[A-Za-z0-9_-]{8,100}$'),
  "requestHash" VARCHAR(64) NOT NULL CHECK ("requestHash" ~ '^[a-f0-9]{64}$'),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewMeritAwardRevision_placementId_revision_key" UNIQUE ("placementId", "revision"),
  CONSTRAINT "InterviewMeritAwardRevision_roundId_idempotencyKey_key" UNIQUE ("roundId", "idempotencyKey")
);
CREATE INDEX "InterviewMeritAwardRevision_roundId_placementId_createdAt_idx"
  ON "InterviewMeritAwardRevision"("roundId", "placementId", "createdAt");

CREATE FUNCTION azm_validate_interview_merit_award_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE placement_round TEXT; current_category TEXT; actor_role TEXT; actor_status TEXT;
BEGIN
  SELECT schedule."roundId", student."scholarshipCategory"::text INTO placement_round, current_category
    FROM public."InterviewFixedPlacement" placement
    JOIN public."InterviewFixedSchedule" schedule ON schedule.id = placement."scheduleId"
    JOIN public."Student" student ON student.id = placement."studentId"
    WHERE placement.id = NEW."placementId";
  IF placement_round IS DISTINCT FROM NEW."roundId" THEN
    RAISE EXCEPTION 'Merit award must match its fixed placement and round' USING ERRCODE = '23514';
  END IF;
  IF NEW."awardCode" IS NOT NULL AND current_category IS DISTINCT FROM 'GENERAL_MERIT' THEN
    RAISE EXCEPTION 'Manual merit awards require a General Merit registration' USING ERRCODE = '23514';
  END IF;
  SELECT "role"::text, "status" INTO actor_role, actor_status FROM public."User" WHERE id = NEW."actorId";
  IF actor_role IS NULL OR actor_role NOT IN ('ADMIN', 'SUPER_ADMIN') OR actor_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'Manual merit awards require an active administrator' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InterviewMeritAwardRevision_validate" BEFORE INSERT ON "InterviewMeritAwardRevision"
FOR EACH ROW EXECUTE FUNCTION azm_validate_interview_merit_award_insert();
CREATE TRIGGER "InterviewMeritAwardRevision_immutable"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "InterviewMeritAwardRevision"
FOR EACH STATEMENT EXECUTE FUNCTION azm_reject_interview_assessment_mutation();

REVOKE ALL ON "InterviewMeritAwardRevision" FROM PUBLIC;
DO $$
DECLARE client_role TEXT;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON public."InterviewMeritAwardRevision" FROM %I', client_role);
    END IF;
  END LOOP;
END;
$$;
