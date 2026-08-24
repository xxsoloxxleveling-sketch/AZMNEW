import { z } from 'zod';
import { FeeStatus } from '@prisma/client';

export const generateChallanSchema = z
  .object({
    studentId: z.string().optional(),
    currentClass: z.string().optional(),
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format (e.g. 2026-08)'),
    amountDue: z.number().positive('Amount due must be greater than 0'),
    dueDate: z
      .string()
      .or(z.date())
      .transform((v) => (v ? new Date(v) : new Date()))
      .optional(),
  })
  .refine((data) => data.studentId || data.currentClass, {
    message: 'Either studentId (single student) or currentClass (bulk generation) must be provided.',
  });

export const markPaidSchema = z.object({
  amountPaid: z.number().positive('Paid amount must be greater than 0').optional(),
  paidAt: z
    .string()
    .or(z.date())
    .transform((v) => (v ? new Date(v) : new Date()))
    .optional(),
  paymentMethod: z.string().default('CASH'),
  notes: z.string().optional(),
});

export const feeQuerySchema = z.object({
  studentId: z.string().optional(),
  month: z.string().optional(),
  status: z.nativeEnum(FeeStatus).optional(),
  search: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, Math.min(100, parseInt(v, 10))) : 20)),
});

export type GenerateChallanInput = z.infer<typeof generateChallanSchema>;
export type MarkPaidInput = z.infer<typeof markPaidSchema>;
export type FeeQueryInput = z.infer<typeof feeQuerySchema>;
