-- CreateEnum
CREATE TYPE "GrievanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "assignedHall" TEXT,
ADD COLUMN     "assignedHallId" TEXT,
ADD COLUMN     "assignedRoom" TEXT,
ADD COLUMN     "overallRank" INTEGER,
ADD COLUMN     "seatNo" TEXT,
ADD COLUMN     "testScore" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "TestCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "campus" TEXT,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "province" TEXT NOT NULL DEFAULT 'Khyber Pakhtunkhwa',
    "capacity" INTEGER NOT NULL DEFAULT 300,
    "reportingTime" TEXT NOT NULL DEFAULT '09:00 AM',
    "testDate" TEXT NOT NULL DEFAULT 'Sunday, 15 November 2026',
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamHall" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "targetClass" TEXT NOT NULL,
    "wing" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 60,
    "invigilatorName" TEXT,
    "invigilatorPhone" TEXT,
    "reportingTime" TEXT NOT NULL DEFAULT '09:00 AM',
    "examDate" TEXT NOT NULL DEFAULT 'Sunday, 15 November 2026',
    "testCenterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamHall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrievanceTicket" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cnicOrRollNo" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "GrievanceStatus" NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrievanceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestCenter_code_key" ON "TestCenter"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GrievanceTicket_ticketId_key" ON "GrievanceTicket"("ticketId");

-- AddForeignKey
ALTER TABLE "ExamHall" ADD CONSTRAINT "ExamHall_testCenterId_fkey" FOREIGN KEY ("testCenterId") REFERENCES "TestCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
