-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ScholarshipCategory" AS ENUM ('GENERAL_MERIT', 'FINANCIALLY_NEEDY', 'ORPHAN', 'PERSON_WITH_DISABILITY');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE');

-- CreateEnum
CREATE TYPE "FinalStatus" AS ENUM ('SHORTLISTED', 'NOT_SHORTLISTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('SCHOOL', 'COLLEGE', 'ACADEMY', 'UNIVERSITY');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('QR_SCAN', 'MANUAL');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('FEE_INCOME', 'SALARY_EXPENSE', 'OTHER_INCOME', 'OTHER_EXPENSE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "studentId" TEXT,
    "registrationCentre" TEXT,
    "rollNumber" TEXT,
    "qrToken" TEXT NOT NULL,
    "qrImageUrl" TEXT,
    "photoUrl" TEXT,
    "uploadedDocsJson" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fullName" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "age" INTEGER,
    "cnicOrBForm" TEXT NOT NULL,
    "nationality" TEXT NOT NULL DEFAULT 'Pakistani',
    "religion" TEXT,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "studentMobile" TEXT,
    "parentMobile" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "currentClass" TEXT NOT NULL,
    "hsscGroup" TEXT,
    "bsDepartment" TEXT,
    "bsSemester" TEXT,
    "schoolName" TEXT NOT NULL,
    "boardOrUniversity" TEXT NOT NULL,
    "currentRollNo" TEXT,
    "scholarshipCategory" "ScholarshipCategory" NOT NULL,
    "guardianOccupation" TEXT,
    "guardianMonthlyIncome" DECIMAL(65,30),
    "emergencyContact" TEXT NOT NULL,
    "emergencyRelation" TEXT NOT NULL,
    "applicantSignedAt" TIMESTAMP(3),
    "parentSignedAt" TIMESTAMP(3),
    "referralSource" TEXT,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examLevel" TEXT NOT NULL,
    "boardOrUni" TEXT,
    "yearOfPassing" TEXT,
    "totalMarks" INTEGER,
    "obtainedMarks" INTEGER,
    "percentage" DECIMAL(65,30),

    CONSTRAINT "AcademicRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChecklist" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bformCnicCopy" BOOLEAN NOT NULL DEFAULT false,
    "fatherCnicCopy" BOOLEAN NOT NULL DEFAULT false,
    "passportPhotos" BOOLEAN NOT NULL DEFAULT false,
    "previousResultCard" BOOLEAN NOT NULL DEFAULT false,
    "domicileCertificate" BOOLEAN NOT NULL DEFAULT false,
    "incomeCertificate" BOOLEAN NOT NULL DEFAULT false,
    "otherDocuments" TEXT,

    CONSTRAINT "DocumentChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeUseRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentVerifiedBy" TEXT,
    "documentVerifiedAt" TIMESTAMP(3),
    "eligibility" "EligibilityStatus",
    "eligibilityRemarks" TEXT,
    "testRollNo" TEXT,
    "testCentre" TEXT,
    "testReportingTime" TEXT,
    "testDate" TIMESTAMP(3),
    "interviewDate" TIMESTAMP(3),
    "interviewTime" TEXT,
    "panelNo" TEXT,
    "finalStatus" "FinalStatus",
    "officeRemarks" TEXT,
    "authorizedBy" TEXT,

    CONSTRAINT "OfficeUseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerInstitution" (
    "id" TEXT NOT NULL,
    "partnerCode" TEXT,
    "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "institutionName" TEXT NOT NULL,
    "institutionType" "InstitutionType" NOT NULL,
    "campus" TEXT,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactDesignation" TEXT NOT NULL,
    "contactMobile" TEXT NOT NULL,
    "contactWhatsapp" TEXT,
    "contactEmail" TEXT,
    "website" TEXT,
    "classesOffered" TEXT[],
    "studentStrength" INTEGER,
    "expectedApplicants" INTEGER,
    "agreedToTerms" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3),
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerInstitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AttendanceStatus" NOT NULL,
    "markedByUserId" TEXT NOT NULL,
    "method" "AttendanceMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amountDue" DECIMAL(65,30) NOT NULL,
    "amountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "FeeStatus" NOT NULL DEFAULT 'UNPAID',
    "challanNumber" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "cnic" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "salary" DECIMAL(65,30) NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT NOT NULL,
    "relatedFeeId" TEXT,
    "relatedPayrollId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_applicationNo_key" ON "Student"("applicationNo");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_rollNumber_key" ON "Student"("rollNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_qrToken_key" ON "Student"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "Student_cnicOrBForm_key" ON "Student"("cnicOrBForm");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChecklist_studentId_key" ON "DocumentChecklist"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeUseRecord_studentId_key" ON "OfficeUseRecord"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerInstitution_partnerCode_key" ON "PartnerInstitution"("partnerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_date_key" ON "Attendance"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRecord_challanNumber_key" ON "FeeRecord"("challanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_cnic_key" ON "Staff"("cnic");

-- AddForeignKey
ALTER TABLE "AcademicRecord" ADD CONSTRAINT "AcademicRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChecklist" ADD CONSTRAINT "DocumentChecklist_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeUseRecord" ADD CONSTRAINT "OfficeUseRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRecord" ADD CONSTRAINT "FeeRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
