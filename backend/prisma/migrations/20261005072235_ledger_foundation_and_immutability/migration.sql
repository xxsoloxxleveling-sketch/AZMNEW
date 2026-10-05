-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'FEE', 'PAYROLL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE', 'OTHER');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "category" TEXT,
ADD COLUMN     "createdByEmail" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdByName" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "referenceNumber" TEXT,
ADD COLUMN     "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'POSTED',
ADD COLUMN     "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedByEmail" TEXT,
ADD COLUMN     "voidedById" TEXT,
ADD COLUMN     "voidedByName" TEXT;

-- Backfill existing rows
UPDATE "Transaction"
SET "transactionDate" = "createdAt",
    "status" = 'POSTED',
    "source" = CASE
      WHEN "relatedFeeId" IS NOT NULL OR "type" = 'FEE_INCOME' THEN 'FEE'::"TransactionSource"
      WHEN "relatedPayrollId" IS NOT NULL OR "type" = 'SALARY_EXPENSE' THEN 'PAYROLL'::"TransactionSource"
      ELSE 'MANUAL'::"TransactionSource"
    END;

-- Positive amount check constraint
ALTER TABLE "Transaction" ADD CONSTRAINT "transaction_amount_positive" CHECK ("amount" > 0);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadHash" TEXT,
    "statusCode" INTEGER NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "Transaction_transactionDate_idx" ON "Transaction"("transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_source_idx" ON "Transaction"("source");

-- CreateIndex
CREATE INDEX "Transaction_relatedFeeId_idx" ON "Transaction"("relatedFeeId");

-- CreateIndex
CREATE INDEX "Transaction_relatedPayrollId_idx" ON "Transaction"("relatedPayrollId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_relatedFeeId_fkey" FOREIGN KEY ("relatedFeeId") REFERENCES "FeeRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_relatedPayrollId_fkey" FOREIGN KEY ("relatedPayrollId") REFERENCES "PayrollRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
