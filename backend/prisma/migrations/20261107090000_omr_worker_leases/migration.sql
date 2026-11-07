BEGIN;
ALTER TABLE "OmrScanBatch" ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "lockedAt" TIMESTAMP(3), ADD COLUMN "lockedBy" TEXT,
 ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "errorCode" TEXT;
CREATE INDEX "OmrScanBatch_queue_idx" ON "OmrScanBatch"(status,"nextAttemptAt","createdAt");
ALTER TABLE "OmrScanBatch" ADD CONSTRAINT "OmrScanBatch_attempts_check" CHECK(attempts BETWEEN 0 AND 3);
COMMIT;
