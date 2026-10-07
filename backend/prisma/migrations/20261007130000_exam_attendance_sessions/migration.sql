-- CreateEnum
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- DropIndex
DROP INDEX "Attendance_studentId_date_key";

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "sessionId" TEXT;

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "examHallId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedByUserId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "hallNameSnapshot" TEXT NOT NULL,
    "roomNumberSnapshot" TEXT NOT NULL,
    "testCenterNameSnapshot" TEXT,
    "examDateSnapshot" TEXT NOT NULL,
    "reportingTimeSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSessionCandidate" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fullNameSnapshot" TEXT NOT NULL,
    "rollNumberSnapshot" TEXT,
    "applicationNoSnapshot" TEXT NOT NULL,
    "currentClassSnapshot" TEXT NOT NULL,
    "seatNoSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSessionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceSession_businessDate_idx" ON "AttendanceSession"("businessDate");

-- CreateIndex
CREATE INDEX "AttendanceSession_status_idx" ON "AttendanceSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSession_examHallId_businessDate_key" ON "AttendanceSession"("examHallId", "businessDate");

-- CreateIndex
CREATE INDEX "AttendanceSessionCandidate_studentId_idx" ON "AttendanceSessionCandidate"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSessionCandidate_sessionId_studentId_key" ON "AttendanceSessionCandidate"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_studentId_key" ON "Attendance"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_examHallId_fkey" FOREIGN KEY ("examHallId") REFERENCES "ExamHall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSessionCandidate" ADD CONSTRAINT "AttendanceSessionCandidate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSessionCandidate" ADD CONSTRAINT "AttendanceSessionCandidate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_studentId_fkey" FOREIGN KEY ("sessionId", "studentId") REFERENCES "AttendanceSessionCandidate"("sessionId", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;
