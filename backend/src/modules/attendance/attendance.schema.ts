import { z } from 'zod';
import { AttendanceStatus, AttendanceSessionStatus } from '@prisma/client';
import { hallDate } from '../exam-halls/examHalls.service';

export const openSessionSchema = z.object({ examHallId: z.string().trim().min(1) }).strict();
export const closeSessionSchema = z.object({ markRemainingAbsent: z.boolean().default(false) }).strict();
const identityFields = {
  studentId: z.string().trim().min(1).optional(),
  rollNumber: z.string().trim().min(1).optional(),
  qrToken: z.string().trim().min(1).optional(),
  status: z.nativeEnum(AttendanceStatus).default(AttendanceStatus.PRESENT),
};
const validateIdentity = (data: {studentId?: string; rollNumber?: string; qrToken?: string; status: AttendanceStatus}, ctx: z.RefinementCtx) => {
  if ([data.studentId, data.rollNumber, data.qrToken].filter(Boolean).length !== 1)
    ctx.addIssue({ code: 'custom', message: 'Provide exactly one candidate identifier.' });
  if (data.qrToken && data.status !== AttendanceStatus.PRESENT)
    ctx.addIssue({ code: 'custom', message: 'QR marking only permits PRESENT.' });
};
export const markAttendanceSchema = z.object(identityFields).strict().superRefine(validateIdentity);
export const scanAttendanceSchema = z.object({ ...identityFields, sessionId: z.string().trim().min(1) }).strict().superRefine(validateIdentity);
const pagination = { page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) };
export const sessionQuerySchema = z.object({
  includeHistory: z.union([z.boolean(), z.enum(['true', 'false']).transform(value => value === 'true')]).optional(),
  ...pagination, examHallId: z.string().trim().min(1).optional(),
  businessDate: z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !!hallDate(value), 'Invalid business date.').optional(),
  status: z.nativeEnum(AttendanceSessionStatus).optional(),
}).strict();
export const rosterQuerySchema = z.object({ ...pagination, search: z.string().trim().max(200).optional() }).strict();
export const todayAttendanceQuerySchema = z.object({}).strict();
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type ScanAttendanceInput = MarkAttendanceInput & { sessionId: string };
export type SessionQueryInput = z.infer<typeof sessionQuerySchema>;
export type RosterQueryInput = z.infer<typeof rosterQuerySchema>;
export type TodayAttendanceQueryInput = z.infer<typeof todayAttendanceQuerySchema>;

export const resetScopeSchema = z.object({
  mode: z.enum(['HALL', 'SELECTED', 'EXAM_DATE', 'CURRENT']),
  businessDate: z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !!hallDate(value), 'Invalid business date.'),
  sessionIds: z.array(z.string().trim().min(1)).min(1).max(100).refine(ids => new Set(ids).size === ids.length, 'Duplicate sessions are not allowed.'),
  testCenterId: z.string().trim().min(1).optional(),
}).strict().refine(scope => scope.mode !== 'HALL' || scope.sessionIds.length === 1, 'Select exactly one Hall.');
export const resetConfirmSchema = z.object({
  challenge: z.string().min(1).max(32000),
  reason: z.string().trim().min(5).max(1000),
  confirmationText: z.literal('RESET ATTENDANCE'),
}).strict();
export const resetHistorySchema = z.object(pagination).strict();
export type ResetScopeInput = z.infer<typeof resetScopeSchema>;
export type ResetConfirmInput = z.infer<typeof resetConfirmSchema>;
