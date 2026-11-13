import { z } from 'zod';

export const resultSearchQuerySchema = z.object({
  query: z.string().min(1, 'Search query (Roll Number or CNIC) is required').trim(),
});

export const meritListQuerySchema = z.object({
  category: z.string().optional(),
  district: z.string().optional(),
  search: z.string().optional(),
});

export const adminResultsPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  className: z.string().trim().max(80).optional(),
  minimumScore: z.coerce.number().min(0).max(100).optional(),
  maximumScore: z.coerce.number().min(0).max(100).optional(),
  scoreAvailability: z.enum(['all', 'with-score', 'without-score']).default('all'),
  sortBy: z.enum(['rollNumber', 'studentName', 'className', 'legacyScore']).default('rollNumber'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
}).superRefine((value, ctx) => {
  if (value.minimumScore !== undefined && value.maximumScore !== undefined && value.minimumScore > value.maximumScore) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maximumScore'], message: 'Maximum score must be greater than or equal to minimum score.' });
  }
  if (value.scoreAvailability === 'without-score' && (value.minimumScore !== undefined || value.maximumScore !== undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scoreAvailability'], message: 'Score range filters require records with a legacy score.' });
  }
});

export type ResultSearchQuery = z.infer<typeof resultSearchQuerySchema>;
export type MeritListQuery = z.infer<typeof meritListQuerySchema>;
export type AdminResultsPageQuery = z.infer<typeof adminResultsPageQuerySchema>;

const boundedId = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const plainText = (max: number) => z.string().trim().min(1).max(max);
const decimalText = z.string().trim().regex(/^-?\d{1,6}(?:\.\d{1,2})?$/, 'Enter a number with at most two decimal places.');
const positiveDecimalText = decimalText.refine((value) => Number(value) > 0, 'Value must be greater than zero.');
const paperVersion = z.string().trim().min(1).max(16).regex(/^[A-Za-z0-9_-]+$/);
const detectedAnswerText = z.string().trim().max(16).nullable();
const reviewedAnswerText = z.enum(['A', 'B', 'C', 'D']).nullable();

export const officialResultsPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).default(''),
  classGroup: z.string().trim().max(100).optional(),
  examinationId: boundedId.optional(),
  status: z.enum(['NO_SCORE', 'PROVISIONAL', 'VERIFIED', 'PUBLISHED', 'WITHHELD', 'CORRECTED', 'OFFICIAL_DMC_ISSUED']).optional(),
  sortBy: z.enum(['rollNumber', 'studentName', 'classGroup', 'examDate', 'obtainedMarks']).default('rollNumber'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const officialExaminationsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export const createExaminationSchema = z.object({
  reference: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  title: plainText(160),
  sessionReference: plainText(80),
  paperKeyRevisions: z.array(z.object({ paperVersion, answerKeyRevision: plainText(80) }).strict()).min(1).max(12)
    .refine((items) => new Set(items.map((item) => item.paperVersion.toUpperCase())).size === items.length, 'Paper versions must be unique.'),
  examDate: z.string().date().nullable().optional(),
  classGroup: plainText(100),
  maximumMarks: positiveDecimalText,
  questionCount: z.number().int().min(1).max(500),
  scoringPolicy: z.object({
    correctMarks: decimalText,
    wrongMarks: decimalText,
    blankMarks: decimalText,
    multipleMarks: decimalText,
    revision: plainText(80),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  const correct = Number(value.scoringPolicy.correctMarks);
  const maximum = Number(value.maximumMarks);
  if (correct <= 0 || correct * value.questionCount < maximum) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scoringPolicy', 'correctMarks'], message: 'The approved correct-answer marks must cover the exam maximum.' });
  }
});

export const createDraftResultSchema = z.object({
  studentId: boundedId,
  resultReference: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9_-]+$/),
  sourceScanReference: z.string().trim().max(128).regex(/^[A-Za-z0-9_.:-]+$/).nullable().optional(),
  paperVersion: paperVersion.nullable().optional(),
  administrativeRemarks: z.string().trim().max(1000).nullable().optional(),
}).strict();

const responseCorrectionSchema = z.object({
  questionNumber: z.number().int().min(1).max(500),
  detectedAnswer: detectedAnswerText.optional(),
  reviewedAnswer: reviewedAnswerText.optional(),
  classification: z.enum(['CORRECT', 'WRONG', 'BLANK', 'MULTIPLE', 'UNCERTAIN']),
}).strict();

export const correctResultSchema = z.object({
  expectedRevision: z.number().int().min(1),
  reason: z.string().trim().min(12).max(1000),
  source: z.enum(['STUDENT_PROFILE', 'RESULTS_DASHBOARD']),
  changes: z.object({
    paperVersion: paperVersion.nullable().optional(),
    obtainedMarks: decimalText.nullable().optional(),
    identityStatus: z.enum(['PENDING', 'VERIFIED', 'MISMATCH']).optional(),
    scoringStatus: z.enum(['PROVISIONAL', 'VERIFIED']).optional(),
    verificationStatus: z.enum(['PENDING', 'VERIFIED', 'WITHHELD']).optional(),
    publicationStatus: z.enum(['UNPUBLISHED', 'PUBLISHED', 'WITHHELD']).optional(),
    administrativeRemarks: z.string().trim().max(1000).nullable().optional(),
    responses: z.array(responseCorrectionSchema).min(1).max(500).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'At least one proposed change is required.'),
}).strict().superRefine((value, ctx) => {
  if (value.changes.responses && value.changes.obtainedMarks !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['changes', 'obtainedMarks'], message: 'A question-level correction computes marks; do not submit a separate score override in the same change.' });
  }
  const qnums = value.changes.responses?.map((response) => response.questionNumber) ?? [];
  if (new Set(qnums).size !== qnums.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['changes', 'responses'], message: 'Question numbers must be unique.' });
  }
});

export const examinationPublicationSchema = z.object({
  expectedRevision: z.number().int().min(1),
  action: z.enum(['PUBLISH', 'WITHHOLD']),
  reason: z.string().trim().min(12).max(1000),
}).strict();

export const dmcPrepareSchema = z.object({ expectedRevision: z.number().int().min(1) }).strict();
export const dmcIssueSchema = z.object({
  preparationId: boundedId,
  expectedRevision: z.number().int().min(1),
  idempotencyKey: z.string().uuid(),
}).strict();
export const dmcRevokeSchema = z.object({ reason: z.string().trim().min(12).max(1000) }).strict();

export type OfficialResultsPageQuery = z.infer<typeof officialResultsPageQuerySchema>;
export type CreateExaminationRequest = z.infer<typeof createExaminationSchema>;
export type CreateDraftResultRequest = z.infer<typeof createDraftResultSchema>;
export type CorrectResultRequest = z.infer<typeof correctResultSchema>;
export type ExaminationPublicationRequest = z.infer<typeof examinationPublicationSchema>;
