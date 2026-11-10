import { z } from 'zod';
const fourDecimals=(value:number)=>Math.abs(Math.round(value*10000)/10000-value)<1e-9;
const qrAttempt=z.object({decoded:z.boolean(),attempts:z.number().int().min(0).max(4),reason:z.string().max(32),detected:z.boolean().optional(),symbolSidePixels:z.number().nonnegative().nullable().optional()});
export const option = z.enum(['A','B','C','D']);
export const response = z.enum(['A','B','C','D','BLANK','MULTIPLE','UNCERTAIN']);
export const examInput = z.object({
  code: z.string().trim().min(3).max(64), title: z.string().trim().min(3).max(160),
  session: z.string().trim().min(1).max(64), candidateGroup: z.string().trim().min(1).max(128),
  examDate: z.string().datetime({ offset: true }), questionCount: z.literal(100).default(100),
  correctMarks: z.number().positive().max(1000).refine(fourDecimals,'Use at most four decimal places').default(1), incorrectPenalty: z.number().min(0).max(1000).refine(fourDecimals,'Use at most four decimal places').default(0),
  minimumScore: z.number().min(-100000).max(100000).refine(fourDecimals,'Use at most four decimal places').nullable().optional(),
  allowedVersions: z.array(option).min(1).max(4).refine(a=>new Set(a).size===a.length),
  releaseAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().refine(value=>value.minimumScore==null||Math.round(value.minimumScore*10000)<=value.questionCount*Math.round(value.correctMarks*10000),{message:'Minimum score exceeds maximum',path:['minimumScore']});
export const keyInput = z.object({ paperVersion: option, answers: z.array(option).length(100), isSynthetic: z.boolean().default(true) }).strict();
export const reasonInput = z.object({ reason: z.string().trim().min(8).max(500) }).strict();
export const reviewInput = z.object({
  reason: z.string().trim().min(8).max(500),
  answers: z.array(z.object({ question: z.number().int().min(1).max(100), answer: response }).strict()).max(100).default([]),
  examConfirmed:z.literal(true).optional(),
  printedRollNumber: z.string().trim().min(1).max(128).optional(), identityConfirmed: z.literal(true).optional(),
  paperVersion: option.optional(), identityLookup: z.string().trim().min(1).max(128).optional(),
}).strict().refine(v=>!v.identityLookup || (!!v.printedRollNumber && v.identityConfirmed===true),'Printed roll and explicit identity confirmation required').refine(v=>new Set(v.answers.map(a=>a.question)).size===v.answers.length,'Duplicate question corrections');
export const pageInput = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), status: z.string().regex(/^[A-Z_]+$/).max(32).optional(), search: z.string().trim().max(100).optional() });
export const permissionInput = z.object({ userId: z.string().min(1).max(128), canScan: z.boolean(), canReview: z.boolean(), canManage: z.boolean() }).strict();
export const workerOutput = z.object({
  status: z.enum(['RECOGNIZED','REVIEW_REQUIRED','INVALID']), template: z.string().max(64).optional(),
  reason: z.string().max(128).optional(), calibration: z.literal('SYNTHETIC_ONLY').optional(),
  officialScoringAllowed: z.literal(false), identity: z.unknown().optional(), qrEnvelope: z.unknown().optional(),
  physicalValidationRequired:z.boolean().optional(),
  qrDiagnostics:z.union([qrAttempt,z.object({normalized:qrAttempt,original:qrAttempt,reason:z.string().max(32).optional()})]).optional(),
  layoutDiagnostics:z.record(z.unknown()).optional(),
  geometry:z.object({radius:z.number().positive().max(50),questions:z.array(z.array(z.tuple([z.number().min(0).max(1980),z.number().min(0).max(2800)])).length(4)).length(100),versions:z.array(z.tuple([z.number().min(0).max(1980),z.number().min(0).max(2800)])).length(4)}).optional(),
  paperVersion: z.object({ answer: response }).passthrough().optional(),
  responses: z.array(z.object({ question: z.number().int().min(1).max(100), answer: response, darkness: z.array(z.number().min(0).max(1)).length(4), reviewRequired: z.boolean(),outlineSupport:z.array(z.number().min(0).max(1)).length(4).optional(),reason:z.string().max(64).optional() })).length(100).optional(),
  examConfirmed:z.literal(true).optional(),
  printedRollNumber: z.string().max(128).nullable().optional(),
  quality: z.object({ registration: z.number().min(0).max(1), focus: z.number().nonnegative() }).optional(),
}).strip();
