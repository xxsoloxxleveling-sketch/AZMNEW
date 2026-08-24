import { z } from 'zod';
import { PayrollStatus } from '@prisma/client';

export const runPayrollSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format (e.g. 2026-08)'),
});

export const markPayrollPaidSchema = z.object({
  paidAt: z
    .string()
    .or(z.date())
    .transform((v) => (v ? new Date(v) : new Date()))
    .optional(),
  paymentMethod: z.string().default('BANK_TRANSFER'),
  notes: z.string().optional(),
});

export const payrollQuerySchema = z.object({
  month: z.string().optional(),
  status: z.nativeEnum(PayrollStatus).optional(),
  staffId: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, Math.min(100, parseInt(v, 10))) : 20)),
});

export type RunPayrollInput = z.infer<typeof runPayrollSchema>;
export type MarkPayrollPaidInput = z.infer<typeof markPayrollPaidSchema>;
export type PayrollQueryInput = z.infer<typeof payrollQuerySchema>;
