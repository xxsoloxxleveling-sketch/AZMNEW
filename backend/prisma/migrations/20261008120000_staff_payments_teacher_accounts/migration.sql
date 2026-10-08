-- Additive only: historical staff, users, payroll and ledger rows remain unchanged.
ALTER TYPE "TransactionSource" ADD VALUE 'STAFF_PAYMENT';
ALTER TABLE "Staff" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD COLUMN "relatedStaffId" TEXT;
CREATE INDEX "Transaction_relatedStaffId_idx" ON "Transaction"("relatedStaffId");
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_relatedStaffId_fkey" FOREIGN KEY ("relatedStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
