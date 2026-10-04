-- AlterTable: Reconcile partnerCode nullability schema drift from historical 0_init
-- Environments containing legacy NULL partnerCode rows must remediate those rows before deployment.
-- This migration deliberately does not backfill or invent partner codes; it must fail rather than fabricate IDs.
ALTER TABLE "PartnerInstitution" ALTER COLUMN "partnerCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "PartnerInstitution" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- CreateTable
CREATE TABLE "PartnerCodeSequence" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PartnerCodeSequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "PartnerStatusAudit" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "previousStatus" "PartnerStatus" NOT NULL,
    "newStatus" "PartnerStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "changedByEmail" TEXT,
    "changedByName" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerStatusAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerInstitution_status_idx" ON "PartnerInstitution"("status");

-- CreateIndex
CREATE INDEX "PartnerInstitution_institutionType_idx" ON "PartnerInstitution"("institutionType");

-- CreateIndex
CREATE INDEX "PartnerInstitution_district_idx" ON "PartnerInstitution"("district");

-- CreateIndex
CREATE INDEX "PartnerInstitution_createdAt_idx" ON "PartnerInstitution"("createdAt");

-- CreateIndex
CREATE INDEX "PartnerInstitution_institutionName_idx" ON "PartnerInstitution"("institutionName");

-- CreateIndex
CREATE INDEX "PartnerStatusAudit_partnerId_idx" ON "PartnerStatusAudit"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerStatusAudit_changedAt_idx" ON "PartnerStatusAudit"("changedAt");

-- AddForeignKey
ALTER TABLE "PartnerStatusAudit" ADD CONSTRAINT "PartnerStatusAudit_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
