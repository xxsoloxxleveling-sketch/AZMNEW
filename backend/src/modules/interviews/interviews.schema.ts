import { z } from 'zod';
import { SESSION_V_CAMPAIGN_REF, SESSION_V_PASS_MARKS } from './eligibility';

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().nullable();
const validDate = z.string().refine(value => {
  const date = new Date(value + 'T00:00:00.000Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}, 'Use a valid YYYY-MM-DD date.');

export const createRoundSchema = z.object({
  sessionRef: z.literal(SESSION_V_CAMPAIGN_REF),
  title: z.string().trim().min(1).max(160),
  eligibilityThreshold: z.coerce.number().int().refine(value => value === SESSION_V_PASS_MARKS, 'Session V passing marks are fixed at 60/100.').default(SESSION_V_PASS_MARKS),
  maximumMarks: z.literal(100).default(100),
}).strict();

export const createHallSchema = z.object({
  name: z.string().trim().min(1).max(120),
  roomNumber: z.string().trim().min(1).max(80),
  venue: optionalText(200),
  interviewDate: validDate.optional().nullable(),
  reportingTime: optionalText(80),
  scheduleStartAt: z.string().datetime().optional().nullable(),
  scheduleEndAt: z.string().datetime().optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(100000),
  allowedClasses: z.array(z.string().trim().min(1).max(100)).max(100).optional().default([]),
  description: optionalText(1000),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).strict();
export const updateHallSchema = createHallSchema.partial().strict();

export const candidateQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  className: z.string().trim().max(100).optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  schoolName: z.string().trim().max(200).optional(),
  hallId: z.string().trim().min(1).optional(),
  minimumMarks: z.coerce.number().int().min(0).max(100).optional(),
  maximumMarks: z.coerce.number().int().min(0).max(100).optional(),
  assignment: z.enum(['unassigned', 'assigned', 'all']).default('all'),
  eligibility: z.enum(['all', 'qualified', 'unqualified', 'pending', 'excluded']).default('all'),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict().refine(
  query => query.minimumMarks === undefined || query.maximumMarks === undefined || query.minimumMarks <= query.maximumMarks,
  { path: ['maximumMarks'], message: 'Maximum marks must be at least minimum marks.' },
);

export const createAssignmentsSchema = z.object({
  hallId: z.string().trim().min(1),
  studentIds: z.array(z.string().trim().min(1)).min(1).max(500),
  isLocked: z.boolean().default(true),
  reason: z.string().trim().max(500).optional(),
}).strict();
export const updateAssignmentSchema = z.object({
  hallId: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional(),
  override: z.boolean().default(false),
}).strict();
export const lockAssignmentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  override: z.boolean().default(false),
}).strict();
export const unlockAssignmentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  override: z.boolean().default(false),
}).strict();
export const removeAssignmentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  override: z.boolean().default(false),
}).strict();

export const autoAllocatePreviewSchema = z.object({
  strategy: z.enum(['BALANCED', 'SEQUENTIAL']).default('BALANCED'),
}).strict();
export const autoAllocateCommitSchema = autoAllocatePreviewSchema.extend({
  expectedRevision: z.coerce.number().int().min(0),
  planHash: z.string().regex(/^[a-f0-9]{64}$/i),
  idempotencyKey: z.string().uuid(),
  allowPartial: z.boolean().default(false),
}).strict();
export const finalizeRoundSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
export const resultApprovalSchema = z.object({
  evidenceReference: z.string().trim().min(3).max(500),
  evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  reason: z.string().trim().min(10).max(1000),
}).strict();
export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type CreateHallInput = z.infer<typeof createHallSchema>;
export type UpdateHallInput = z.infer<typeof updateHallSchema>;
export type CandidateQuery = z.infer<typeof candidateQuerySchema>;
export type CreateAssignmentsInput = z.infer<typeof createAssignmentsSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type LockAssignmentInput = z.infer<typeof lockAssignmentSchema>;
export type UnlockAssignmentInput = z.infer<typeof unlockAssignmentSchema>;
export type RemoveAssignmentInput = z.infer<typeof removeAssignmentSchema>;
export type AutoAllocatePreviewInput = z.infer<typeof autoAllocatePreviewSchema>;
export type AutoAllocateCommitInput = z.infer<typeof autoAllocateCommitSchema>;
export type ResultApprovalInput = z.infer<typeof resultApprovalSchema>;
