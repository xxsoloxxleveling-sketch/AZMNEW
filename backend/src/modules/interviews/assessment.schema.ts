import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const INTERVIEW_ASSESSMENT_POLICY = 'SESSION_V_2026_60_20_10_5_5_V1';
const score = (maximum: number) => z.number().finite().min(0).max(maximum)
  .refine(value => new Prisma.Decimal(value).decimalPlaces() <= 2, 'Use at most two decimal places.').nullable();
const evidence = z.string().trim().max(2000);
export const assessmentPanelParamsSchema = z.object({ panel: z.coerce.number().int().min(1).max(6) });
export const assessmentPanelSchema = z.object({
  expectedRevision: z.number().int().min(0),
  members: z.array(z.object({ name: z.string().trim().min(2).max(100) }).strict()).length(3),
  reason: z.string().trim().min(3).max(2000),
}).strict().superRefine((value, ctx) => {
  const names = value.members.map(member => member.name.replace(/\s+/g, ' ').toLocaleLowerCase('en'));
  if (new Set(names).size !== 3) ctx.addIssue({ code: 'custom', path: ['members'], message: 'Enter three distinct panel members.' });
});
export const assessmentSaveSchema = z.object({
  expectedRevision: z.number().int().min(0),
  panelRevision: z.number().int().min(1),
  idempotencyKey: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/),
  attendance: z.enum(['UNKNOWN', 'PRESENT', 'ABSENT']),
  scores: z.array(z.object({
    memberId: z.string().min(1).max(100), interview: score(20), personality: score(5),
  }).strict()).length(3),
  extracurricular: score(10),
  extracurricularEvidence: evidence,
  extracurricularReviewed: z.boolean(),
  academic: score(5),
  academicEvidence: evidence,
  academicReviewed: z.boolean(),
  notes: z.string().trim().max(4000).default(''),
  reason: z.string().trim().max(2000).default(''),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.scores.map(card => card.memberId)).size !== 3) {
    ctx.addIssue({ code: 'custom', path: ['scores'], message: 'Each panel member must have exactly one scorecard.' });
  }
});
export const assessmentRosterQuerySchema = z.object({
  panel: z.coerce.number().int().min(1).max(6).optional(),
  batch: z.coerce.number().int().min(1).max(2).optional(),
  search: z.string().trim().max(120).optional(),
  className: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export const assessmentMeritQuerySchema = z.object({ className: z.string().trim().max(120).optional() }).strict();

export const MERIT_AWARD_CODES = [
  'UMRAH_TICKET', 'LAPTOP', 'FULL_YEAR_SCHOLARSHIP', 'PARTIAL_SCHOLARSHIP',
  'EDUCATIONAL_VOUCHER', 'CASH_PRIZE_3000', 'CASH_PRIZE_5000',
] as const;
export const meritAwardSaveSchema = z.object({
  expectedRevision: z.number().int().min(0),
  idempotencyKey: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/),
  awardCode: z.enum(MERIT_AWARD_CODES).nullable(),
}).strict();
export type MeritAwardCode = typeof MERIT_AWARD_CODES[number];
export type MeritAwardInput = z.infer<typeof meritAwardSaveSchema>;
export type MeritAwardDto = {
  id: string | null; revision: number; awardCode: MeritAwardCode | null;
  actorName: string | null; createdAt: string | null;
};

export type AssessmentInput = z.infer<typeof assessmentSaveSchema>;
export type PanelInput = z.infer<typeof assessmentPanelSchema>;
export type AssessmentRosterQuery = z.infer<typeof assessmentRosterQuerySchema>;
export type PanelMember = { id: string; name: string; position: number };
export type PanelDto = { id: string; panel: number; revision: number; members: PanelMember[] };
export type WrittenMarkDto = {
  marks: number | null; maximumMarks: number; isFinal: boolean; sourceType: string | null;
  reference: string | null; revision: string | null; status: string;
};
export type AssessmentTotals = {
  written: number | null; interview: number | null; extracurricular: number | null;
  personality: number | null; academic: number | null; total: number | null;
};
export type AssessmentDto = {
  id: string; revision: number; status: 'DRAFT' | 'SUBMITTED'; attendance: AssessmentInput['attendance'];
  panelRevision: number; members: PanelMember[]; scores: AssessmentInput['scores'];
  extracurricular: number | null; extracurricularEvidence: string; extracurricularReviewed: boolean;
  academic: number | null; academicEvidence: string; academicReviewed: boolean;
  notes: string; reason: string; actorName: string; createdAt: string; written: WrittenMarkDto;
  policyVersion: string; totals: AssessmentTotals; issues: string[];
};
