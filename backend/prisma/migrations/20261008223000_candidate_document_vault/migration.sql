-- Additive document-review ledger. No existing document or student row is deleted
-- or rewritten; historical records receive a truthful PENDING_REVIEW default.
CREATE TYPE "DocumentReviewStatus" AS ENUM ('PENDING_REVIEW', 'VERIFIED', 'REJECTED');
CREATE TYPE "StudentDocumentAuditAction" AS ENUM ('UPLOADED', 'REPLACED', 'VERIFIED', 'REJECTED', 'REOPENED');

ALTER TABLE "StudentDocument"
  ADD COLUMN "reviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedByName" TEXT,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "uploadedById" TEXT;

CREATE TABLE "StudentDocumentAudit" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "action" "StudentDocumentAuditAction" NOT NULL,
  "fromStatus" "DocumentReviewStatus",
  "toStatus" "DocumentReviewStatus",
  "reason" TEXT,
  "previousObjectPath" TEXT,
  "previousBucket" TEXT,
  "previousFileName" TEXT,
  "previousMimeType" TEXT,
  "previousSha256" TEXT,
  "newObjectPath" TEXT,
  "newBucket" TEXT,
  "newFileName" TEXT,
  "newMimeType" TEXT,
  "newSha256" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentDocumentAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudentDocument_reviewStatus_createdAt_idx" ON "StudentDocument"("reviewStatus", "createdAt");
CREATE INDEX "StudentDocumentAudit_documentId_createdAt_idx" ON "StudentDocumentAudit"("documentId", "createdAt");
CREATE INDEX "StudentDocumentAudit_studentId_createdAt_idx" ON "StudentDocumentAudit"("studentId", "createdAt");
