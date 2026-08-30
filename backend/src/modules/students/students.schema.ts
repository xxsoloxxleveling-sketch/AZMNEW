import { z } from 'zod';
import { Gender, ScholarshipCategory, StudentStatus, EligibilityStatus, FinalStatus } from '@prisma/client';

export const academicRecordSchema = z.object({
  examLevel: z.string().default('Class 9th'),
  boardOrUni: z.string().optional().nullable(),
  yearOfPassing: z.string().optional().nullable(),
  totalMarks: z.number().optional().nullable(),
  obtainedMarks: z.number().optional().nullable(),
  percentage: z.number().optional().nullable(),
});

export const documentChecklistSchema = z.object({
  bformCnicCopy: z.boolean().default(false),
  fatherCnicCopy: z.boolean().default(false),
  passportPhotos: z.boolean().default(false),
  previousResultCard: z.boolean().default(false),
  domicileCertificate: z.boolean().default(false),
  incomeCertificate: z.boolean().default(false),
  otherDocuments: z.string().optional().nullable(),
});

export const safeDateTransform = (val: any) => {
  if (!val) return undefined;
  if (typeof val === 'string' && (val.startsWith('data:') || val.length > 50)) {
    return undefined;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
};

export const officeUseUpdateSchema = z.object({
  documentVerifiedBy: z.string().optional(),
  documentVerifiedAt: z
    .union([z.string(), z.date(), z.null(), z.undefined()])
    .transform(safeDateTransform)
    .optional(),
  eligibility: z.nativeEnum(EligibilityStatus).optional(),
  eligibilityRemarks: z.string().optional(),
  testRollNo: z.string().optional(),
  testCentre: z.string().optional(),
  testReportingTime: z.string().optional(),
  testDate: z
    .union([z.string(), z.date(), z.null(), z.undefined()])
    .transform(safeDateTransform)
    .optional(),
  interviewDate: z
    .union([z.string(), z.date(), z.null(), z.undefined()])
    .transform(safeDateTransform)
    .optional(),
  interviewTime: z.string().optional(),
  panelNo: z.string().optional(),
  finalStatus: z.nativeEnum(FinalStatus).optional(),
  officeRemarks: z.string().optional(),
  authorizedBy: z.string().optional(),
});

export const createStudentSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  fatherName: z.string().min(1, 'Father name is required'),
  gender: z
    .string()
    .or(z.nativeEnum(Gender))
    .transform((val) => (String(val).toUpperCase() === 'FEMALE' ? Gender.FEMALE : Gender.MALE))
    .default(Gender.MALE),
  dateOfBirth: z
    .union([z.string(), z.date(), z.null(), z.undefined()])
    .transform((val) => {
      const d = safeDateTransform(val);
      return d || new Date('2008-01-01');
    })
    .default(new Date('2008-01-01')),
  age: z.union([z.number(), z.string().transform((v) => parseInt(v, 10) || undefined)]).optional(),
  cnicOrBForm: z
    .string()
    .min(5, 'CNIC or B-Form must be at least 5 characters')
    .trim(),
  nationality: z.string().default('Pakistani'),
  religion: z.string().optional().nullable(),

  // Part B: Contact
  address: z.string().min(1, 'Address is required'),
  district: z.string().min(1, 'District is required'),
  province: z.string().default('Khyber Pakhtunkhwa'),
  studentMobile: z.string().optional().nullable(),
  parentMobile: z.string().min(5, 'Parent mobile number is required'),
  whatsapp: z.string().optional().nullable(),
  email: z.string().optional().nullable(),

  // Part C: Educational
  currentClass: z.string().min(1, 'Current class is required'),
  hsscGroup: z.string().optional().nullable(),
  bsDepartment: z.string().optional().nullable(),
  bsSemester: z.string().optional().nullable(),
  schoolName: z.string().min(1, 'School name is required'),
  boardOrUniversity: z.string().default('BISE'),
  currentRollNo: z.string().optional().nullable(),

  // Part D: Scholarship
  scholarshipCategory: z
    .string()
    .or(z.nativeEnum(ScholarshipCategory))
    .transform((val) => {
      const v = String(val).toUpperCase();
      if (v.includes('ORPHAN')) return ScholarshipCategory.ORPHAN;
      if (v.includes('DISAB') || v.includes('SPECIAL')) return ScholarshipCategory.PERSON_WITH_DISABILITY;
      if (v.includes('NEEDY') || v.includes('FINANC')) return ScholarshipCategory.FINANCIALLY_NEEDY;
      return ScholarshipCategory.GENERAL_MERIT;
    })
    .default(ScholarshipCategory.GENERAL_MERIT),

  // Part E: Emergency & Family
  guardianOccupation: z.string().optional().nullable(),
  guardianMonthlyIncome: z.union([z.number(), z.string().transform((v) => Number(v) || 0)]).optional(),
  emergencyContact: z.string().min(1, 'Emergency contact is required'),
  emergencyRelation: z.string().default('Guardian'),

  // Part F: Declaration Dates & Signatures
  applicantSignedAt: z
    .union([z.string(), z.date(), z.null(), z.undefined()])
    .transform(safeDateTransform)
    .optional(),
  parentSignedAt: z
    .union([z.string(), z.date(), z.null(), z.undefined()])
    .transform(safeDateTransform)
    .optional(),
  signatureDataUrl: z.string().optional().nullable(),
  signature: z.string().optional().nullable(),

  // Part I: Referral Source
  referralSource: z.string().optional().nullable(),

  // Related data (Parts G, H, L)
  academicRecords: z.array(academicRecordSchema).optional(),
  documents: documentChecklistSchema.optional(),
  uploadedDocuments: z.record(z.any()).optional(),
  registrationCentre: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});


export const updateStudentSchema = createStudentSchema.partial().extend({
  status: z.nativeEnum(StudentStatus).optional(),
});

export const studentQuerySchema = z.object({
  search: z.string().optional(),
  classLevel: z.string().optional(),
  status: z
    .string()
    .optional()
    .transform((val) => (val && val.toUpperCase() !== 'ALL' ? (val.toUpperCase() as StudentStatus) : undefined)),
  gender: z
    .string()
    .optional()
    .transform((val) => (val && val.toUpperCase() !== 'ALL' ? (val.toUpperCase() as Gender) : undefined)),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, Math.min(250, parseInt(val, 10))) : 50)),
});

const hasUploadedFile = (value: unknown) => {
  if (typeof value === 'string') return value.startsWith('data:') || value.length > 0;
  return Boolean(value && typeof value === 'object' && ((value as any).dataUrl || (value as any).supabasePath || (value as any).path));
};

// Only public online registration is strict. Admin walk-ins remain supported and
// can be completed later by staff without pretending their documents exist.
export const publicRegistrationSchema = createStudentSchema.superRefine((data, ctx) => {
  const docs: Record<string, unknown> = data.uploadedDocuments || {};
  const required: Array<[string, unknown]> = [
    ['Candidate photo', docs.photo || data.photoUrl],
    ['Candidate B-Form / CNIC', docs.bform || docs.bformUploaded],
    ['Father / guardian CNIC', docs.fatherCnic || docs.fatherCnicUploaded],
    ['DMC / result card', docs.dmc || docs.dmcUploaded || docs.dmc_1],
    ['Digital signature', docs.signature || data.signatureDataUrl],
  ];
  for (const [label, value] of required) {
    if (!hasUploadedFile(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is required for online registration.`, path: ['uploadedDocuments'] });
    }
  }
});

export const ALLOWED_FILE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const uploadDocumentSchema = z
  .object({
    studentId: z.string().optional(),
    applicationNo: z.string().optional(),
    cnicOrBForm: z.string().optional(),
    docType: z
      .string()
      .regex(
        /^(photo|photoThumbnail|bform|fatherCnic|dmc(?:_\d+)?|domicile|paymentReceipt)$/,
        'Unsupported document type'
      ),
    fileName: z.string().optional(),
    fileData: z.string().min(1, 'File data is required'),
    contentType: z.string().optional(),
    uploadSessionToken: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    let mimeType = data.contentType?.toLowerCase();
    let byteLength = 0;

    if (data.fileData.startsWith('data:')) {
      const match = data.fileData.match(/^data:([^;]+);base64,(.*)$/s);
      if (match) {
        if (!mimeType) {
          mimeType = match[1].toLowerCase();
        }
        const b64Data = match[2];
        byteLength = Buffer.byteLength(b64Data, 'base64');
      } else {
        byteLength = Buffer.byteLength(data.fileData);
      }
    } else {
      byteLength = Buffer.byteLength(data.fileData, 'base64');
    }

    if (mimeType === 'image/jpg') {
      mimeType = 'image/jpeg';
    }

    if (!mimeType && data.fileName) {
      const ext = data.fileName.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'pdf') mimeType = 'application/pdf';
    }

    if (!mimeType || !ALLOWED_FILE_MIME_TYPES.includes(mimeType as any)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid file type "${mimeType || 'unknown'}". Only JPEG, PNG, and PDF files are allowed.`,
        path: ['fileData'],
      });
    }

    if (byteLength > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (byteLength / (1024 * 1024)).toFixed(2);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File size (${sizeMb}MB) exceeds the maximum allowed limit of 5MB.`,
        path: ['fileData'],
      });
    }
  });

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type StudentQueryInput = z.infer<typeof studentQuerySchema>;
export type OfficeUseUpdateInput = z.infer<typeof officeUseUpdateSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
