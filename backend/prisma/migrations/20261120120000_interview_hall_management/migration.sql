-- Additive Interview Management domain. Examination halls, placements and marks stay unchanged.
CREATE TYPE "InterviewRoundStatus" AS ENUM ('SETUP', 'OPEN', 'PUBLISHED', 'FINALIZED');
CREATE TYPE "InterviewHallStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "InterviewAllocationType" AS ENUM ('MANUAL', 'AUTO');
CREATE TYPE "InterviewAuditAction" AS ENUM (
  'ROUND_CREATED', 'ROUND_PUBLISHED', 'ROUND_FINALIZED',
  'HALL_CREATED', 'HALL_UPDATED', 'HALL_DEACTIVATED',
  'ASSIGNED_MANUAL', 'ASSIGNED_AUTO', 'REASSIGNED',
  'LOCKED', 'UNLOCKED', 'UNASSIGNED', 'AUTO_ALLOCATION_COMMITTED'
);

CREATE TABLE "InterviewRound" (
  "id" TEXT NOT NULL,
  "sessionRef" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "eligibilityThreshold" INTEGER NOT NULL DEFAULT 60,
  "maximumMarks" INTEGER NOT NULL DEFAULT 100,
  "status" "InterviewRoundStatus" NOT NULL DEFAULT 'SETUP',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewRound_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InterviewRound_marks_check" CHECK (
    "maximumMarks" > 0 AND "eligibilityThreshold" >= 0 AND
    "eligibilityThreshold" <= "maximumMarks"
  ),
  CONSTRAINT "InterviewRound_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "InterviewRound_createdById_fkey" FOREIGN KEY ("createdById")
    REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewRound_publishedById_fkey" FOREIGN KEY ("publishedById")
    REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InterviewRound_sessionRef_key" ON "InterviewRound"("sessionRef");
CREATE INDEX "InterviewRound_status_createdAt_idx" ON "InterviewRound"("status", "createdAt");

CREATE TABLE "InterviewHall" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "roomNumber" TEXT NOT NULL,
  "venue" TEXT,
  "interviewDate" DATE,
  "reportingTime" TEXT,
  "scheduleStartAt" TIMESTAMP(3),
  "scheduleEndAt" TIMESTAMP(3),
  "capacity" INTEGER NOT NULL,
  "allowedClasses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "description" TEXT,
  "status" "InterviewHallStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewHall_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InterviewHall_capacity_check" CHECK ("capacity" > 0),
  CONSTRAINT "InterviewHall_schedule_check" CHECK (
    ("scheduleStartAt" IS NULL AND "scheduleEndAt" IS NULL) OR
    ("scheduleStartAt" IS NOT NULL AND "scheduleEndAt" IS NOT NULL AND
     "scheduleEndAt" > "scheduleStartAt")
  ),
  CONSTRAINT "InterviewHall_roundId_fkey" FOREIGN KEY ("roundId")
    REFERENCES "InterviewRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "InterviewHall_roundId_status_interviewDate_idx" ON "InterviewHall"("roundId", "status", "interviewDate");
CREATE INDEX "InterviewHall_venue_roomNumber_interviewDate_idx" ON "InterviewHall"("venue", "roomNumber", "interviewDate");

CREATE TABLE "InterviewAssignment" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "hallId" TEXT NOT NULL,
  "approvedResultReference" TEXT,
  "resultRevision" TEXT,
  "approvedMarksSnapshot" INTEGER,
  "allocationType" "InterviewAllocationType" NOT NULL,
  "queueNumber" INTEGER,
  "isLocked" BOOLEAN NOT NULL DEFAULT FALSE,
  "lockedAt" TIMESTAMP(3),
  "lockedById" TEXT,
  "assignedById" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  CONSTRAINT "InterviewAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InterviewAssignment_lock_state_check" CHECK (
    ("isLocked" AND "lockedAt" IS NOT NULL AND "lockedById" IS NOT NULL) OR
    (NOT "isLocked" AND "lockedAt" IS NULL AND "lockedById" IS NULL)
  ),
  CONSTRAINT "InterviewAssignment_queue_check" CHECK ("queueNumber" IS NULL OR "queueNumber" > 0),
  CONSTRAINT "InterviewAssignment_marks_check" CHECK (
    "approvedMarksSnapshot" IS NULL OR
    ("approvedMarksSnapshot" >= 0 AND "approvedMarksSnapshot" <= 100)
  ),
  CONSTRAINT "InterviewAssignment_roundId_fkey" FOREIGN KEY ("roundId")
    REFERENCES "InterviewRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewAssignment_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewAssignment_hallId_fkey" FOREIGN KEY ("hallId")
    REFERENCES "InterviewHall"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewAssignment_lockedById_fkey" FOREIGN KEY ("lockedById")
    REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewAssignment_assignedById_fkey" FOREIGN KEY ("assignedById")
    REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewAssignment_roundId_studentId_key" UNIQUE ("roundId", "studentId"),
  CONSTRAINT "InterviewAssignment_hallId_queueNumber_key" UNIQUE ("hallId", "queueNumber")
);
CREATE INDEX "InterviewAssignment_roundId_hallId_isLocked_idx" ON "InterviewAssignment"("roundId", "hallId", "isLocked");
CREATE INDEX "InterviewAssignment_studentId_idx" ON "InterviewAssignment"("studentId");

CREATE TABLE "InterviewAllocationAudit" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "hallId" TEXT,
  "assignmentId" TEXT,
  "studentId" TEXT,
  "actorId" TEXT NOT NULL,
  "action" "InterviewAuditAction" NOT NULL,
  "idempotencyKey" TEXT,
  "reason" TEXT,
  "details" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewAllocationAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InterviewAllocationAudit_roundId_fkey" FOREIGN KEY ("roundId")
    REFERENCES "InterviewRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewAllocationAudit_hallId_fkey" FOREIGN KEY ("hallId")
    REFERENCES "InterviewHall"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewAllocationAudit_actorId_fkey" FOREIGN KEY ("actorId")
    REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InterviewAllocationAudit_roundId_idempotencyKey_key" UNIQUE ("roundId", "idempotencyKey")
);
CREATE INDEX "InterviewAllocationAudit_roundId_occurredAt_idx" ON "InterviewAllocationAudit"("roundId", "occurredAt");
CREATE INDEX "InterviewAllocationAudit_hallId_occurredAt_idx" ON "InterviewAllocationAudit"("hallId", "occurredAt");
CREATE INDEX "InterviewAllocationAudit_studentId_occurredAt_idx" ON "InterviewAllocationAudit"("studentId", "occurredAt");

CREATE FUNCTION azm_reject_interview_audit_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Interview allocation audit is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "InterviewAllocationAudit_immutable"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "InterviewAllocationAudit"
FOR EACH STATEMENT EXECUTE FUNCTION azm_reject_interview_audit_mutation();

REVOKE ALL ON "InterviewRound" FROM PUBLIC;
REVOKE ALL ON "InterviewHall" FROM PUBLIC;
REVOKE ALL ON "InterviewAssignment" FROM PUBLIC;
REVOKE ALL ON "InterviewAllocationAudit" FROM PUBLIC;
