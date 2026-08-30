-- Additive metadata-only file model. Legacy Student columns are intentionally retained.
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectPath" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER,
    "checksumSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentDocument_bucket_objectPath_key"
ON "StudentDocument"("bucket", "objectPath");

CREATE INDEX "StudentDocument_studentId_documentType_idx"
ON "StudentDocument"("studentId", "documentType");

ALTER TABLE "StudentDocument"
ADD CONSTRAINT "StudentDocument_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- The backend is the only intended reader. With no policies, Supabase Data API
-- clients cannot read this private metadata table directly.
ALTER TABLE "StudentDocument" ENABLE ROW LEVEL SECURITY;
