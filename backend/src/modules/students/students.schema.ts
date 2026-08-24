import { z } from 'zod';
import { Gender, ScholarshipCategory, StudentStatus, EligibilityStatus, FinalStatus } from '@prisma/client';

export const academicRecordSchema = z.object({
  examLevel: z.string().min(1, 'Exam level is required'),
  boardOrUni: z.string().optional(),
  yearOfPassing: z.string().optional(),
  totalMarks: z.number().int().optional(),
  obtainedMarks: z.number().int().optional(),
  percentage: z.number().optional(),
});

export const documentChecklistSchema = z.object({
  bformCnicCopy: z.boolean().default(false),
  fatherCnicCopy: z.boolean().default(false),
  passportPhotos: z.boolean().default(false),
  previousResultCard: z.boolean().default(false),
  domicileCertificate: z.boolean().default(false),
  incomeCertificate: z.boolean().default(false),
  otherDocuments: z.string().optional(),
});

export const officeUseUpdateSchema = z.object({
  documentVerifiedBy: z.string().optional(),
  documentVerifiedAt: z
    .string()
    .or(z.date())
    .transform((v) => new Date(v))
    .optional(),
  eligibility: z.nativeEnum(EligibilityStatus).optional(),
  eligibilityRemarks: z.string().optional(),
  testRollNo: z.string().optional(),
  testCentre: z.string().optional(),
  testReportingTime: z.string().optional(),
  testDate: z
    .string()
    .or(z.date())
    .transform((v) => new Date(v))
    .optional(),
  interviewDate: z
    .string()
    .or(z.date())
    .transform((v) => new Date(v))
    .optional(),
  interviewTime: z.string().optional(),
  panelNo: z.string().optional(),
  finalStatus: z.nativeEnum(FinalStatus).optional(),
  officeRemarks: z.string().optional(),
  authorizedBy: z.string().optional(),
});

export const createStudentSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  fatherName: z.string().min(2, 'Father name must be at least 2 characters'),
  gender: z.nativeEnum(Gender),
  dateOfBirth: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  age: z.number().int().positive().optional(),
  cnicOrBForm: z
    .string()
    .min(5, 'CNIC or B-Form must be at least 5 characters')
    .trim(),
  nationality: z.string().default('Pakistani'),
  religion: z.string().optional(),

  // Part B: Contact
  address: z.string().min(3, 'Address is required'),
  district: z.string().min(2, 'District is required'),
  province: z.string().min(2, 'Province is required'),
  studentMobile: z.string().optional(),
  parentMobile: z.string().min(10, 'Parent mobile number is required'),
  whatsapp: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),

  // Part C: Educational
  currentClass: z.string().min(1, 'Current class is required'),
  hsscGroup: z.string().optional(),
  bsDepartment: z.string().optional(),
  bsSemester: z.string().optional(),
  schoolName: z.string().min(2, 'School name is required'),
  boardOrUniversity: z.string().default('BISE'),
  currentRollNo: z.string().optional(),

  // Part D: Scholarship
  scholarshipCategory: z
    .nativeEnum(ScholarshipCategory)
    .default(ScholarshipCategory.GENERAL_MERIT),

  // Part E: Emergency & Family
  guardianOccupation: z.string().optional(),
  guardianMonthlyIncome: z.number().optional(),
  emergencyContact: z.string().min(5, 'Emergency contact is required'),
  emergencyRelation: z.string().min(2, 'Emergency relation is required'),

  // Part F: Declaration Dates
  applicantSignedAt: z
    .string()
    .or(z.date())
    .transform((v) => new Date(v))
    .optional(),
  parentSignedAt: z
    .string()
    .or(z.date())
    .transform((v) => new Date(v))
    .optional(),

  // Part I: Referral Source
  referralSource: z.string().optional(),

  // Related data (Parts G, H, L)
  academicRecords: z.array(academicRecordSchema).optional(),
  documents: documentChecklistSchema.optional(),
  registrationCentre: z.string().optional(),
  photoUrl: z.string().optional(),
});

export const updateStudentSchema = createStudentSchema.partial().extend({
  status: z.nativeEnum(StudentStatus).optional(),
});

export const studentQuerySchema = z.object({
  search: z.string().optional(),
  classLevel: z.string().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, Math.min(100, parseInt(val, 10))) : 20)),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentQueryInput = z.infer<typeof studentQuerySchema>;
export type OfficeUseUpdateInput = z.infer<typeof officeUseUpdateSchema>;
