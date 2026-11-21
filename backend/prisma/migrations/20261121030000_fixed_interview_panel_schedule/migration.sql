-- Additive fixed administrative interview timetable. No student marks or exam placement changes.
ALTER TYPE "InterviewAuditAction" ADD VALUE IF NOT EXISTS 'FIXED_SCHEDULE_IMPORTED';

CREATE TABLE "InterviewFixedSchedule" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "csvSha256" VARCHAR(64) NOT NULL,
  "pdfSha256" VARCHAR(64) NOT NULL,
  "interviewDate" DATE NOT NULL,
  "importedById" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewFixedSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InterviewFixedSchedule_roundId_key" UNIQUE ("roundId"),
  CONSTRAINT "InterviewFixedSchedule_csvSha256_check" CHECK ("csvSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "InterviewFixedSchedule_pdfSha256_check" CHECK ("pdfSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "InterviewFixedSchedule_roundId_fkey" FOREIGN KEY ("roundId")
    REFERENCES "InterviewRound" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewFixedSchedule_importedById_fkey" FOREIGN KEY ("importedById")
    REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "InterviewFixedPlacement" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "panel" INTEGER NOT NULL,
  "batch" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "slotTime" TEXT NOT NULL,
  "printedMarks" INTEGER NOT NULL,
  CONSTRAINT "InterviewFixedPlacement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InterviewFixedPlacement_panel_check" CHECK ("panel" BETWEEN 1 AND 6),
  CONSTRAINT "InterviewFixedPlacement_batch_check" CHECK ("batch" BETWEEN 1 AND 2),
  CONSTRAINT "InterviewFixedPlacement_sequence_check" CHECK ("sequence" BETWEEN 1 AND 30),
  CONSTRAINT "InterviewFixedPlacement_marks_check" CHECK ("printedMarks" BETWEEN 60 AND 100),
  CONSTRAINT "InterviewFixedPlacement_scheduleId_fkey" FOREIGN KEY ("scheduleId")
    REFERENCES "InterviewFixedSchedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewFixedPlacement_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewFixedPlacement_scheduleId_studentId_key" UNIQUE ("scheduleId", "studentId"),
  CONSTRAINT "InterviewFixedPlacement_scheduleId_panel_batch_sequence_key" UNIQUE ("scheduleId", "panel", "batch", "sequence"),
  CONSTRAINT "InterviewFixedPlacement_scheduleId_panel_batch_slotTime_key" UNIQUE ("scheduleId", "panel", "batch", "slotTime")
);
CREATE INDEX "InterviewFixedPlacement_studentId_idx" ON "InterviewFixedPlacement" ("studentId");

-- Neither this imported schedule nor its placements can be changed silently.
-- An explicitly reviewed amendment feature must create separate replacement evidence.
CREATE FUNCTION azm_reject_fixed_interview_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Approved fixed interview schedule is append-only'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "InterviewFixedSchedule_immutable"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "InterviewFixedSchedule"
FOR EACH STATEMENT EXECUTE FUNCTION azm_reject_fixed_interview_mutation();

CREATE TRIGGER "InterviewFixedPlacement_immutable"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "InterviewFixedPlacement"
FOR EACH STATEMENT EXECUTE FUNCTION azm_reject_fixed_interview_mutation();

REVOKE ALL ON "InterviewFixedSchedule" FROM PUBLIC;
REVOKE ALL ON "InterviewFixedPlacement" FROM PUBLIC;
