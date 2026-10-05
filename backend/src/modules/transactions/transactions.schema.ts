import { z } from 'zod';
import { TransactionType, TransactionStatus, TransactionSource, PaymentMethod } from '@prisma/client';

export const transactionQuerySchema = z.object({
  page: z
    .any()
    .transform((v) => (v ? Math.max(1, parseInt(String(v), 10) || 1) : 1))
    .default(1),
  limit: z
    .any()
    .transform((v) => (v ? Math.min(100, Math.max(1, parseInt(String(v), 10) || 20)) : 20))
    .default(20),
  type: z
    .string()
    .optional()
    .transform((v) => (v === 'ALL' || !v ? undefined : v))
    .pipe(z.nativeEnum(TransactionType).optional()),
  status: z
    .string()
    .optional()
    .transform((v) => (v === 'ALL' || !v ? undefined : v))
    .pipe(z.nativeEnum(TransactionStatus).optional()),
  source: z
    .string()
    .optional()
    .transform((v) => (v === 'ALL' || !v ? undefined : v))
    .pipe(z.nativeEnum(TransactionSource).optional()),
  search: z.string().optional().transform((v) => v?.trim() || undefined),
  startDate: z.string().optional().transform((v) => v?.trim() || undefined),
  endDate: z.string().optional().transform((v) => v?.trim() || undefined),
  sortBy: z.enum(['transactionDate', 'createdAt', 'amount']).optional().default('transactionDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const transactionSummaryQuerySchema = z.object({
  startDate: z.string().optional().transform((v) => v?.trim() || undefined),
  endDate: z.string().optional().transform((v) => v?.trim() || undefined),
  type: z
    .string()
    .optional()
    .transform((v) => (v === 'ALL' || !v ? undefined : v))
    .pipe(z.nativeEnum(TransactionType).optional()),
  source: z
    .string()
    .optional()
    .transform((v) => (v === 'ALL' || !v ? undefined : v))
    .pipe(z.nativeEnum(TransactionSource).optional()),
});

export const voidTransactionSchema = z.object({
  reason: z
    .string({ required_error: 'Void reason is required' })
    .trim()
    .min(1, 'A non-empty reason for voiding this transaction is required')
    .max(500, 'Void reason cannot exceed 500 characters'),
}).strict();

export const createManualTransactionSchema = z.object({
  type: z.enum([TransactionType.OTHER_INCOME, TransactionType.OTHER_EXPENSE], {
    errorMap: () => ({
      message: 'Manual transactions only support OTHER_INCOME and OTHER_EXPENSE. Fee and salary transactions are automated.',
    }),
  }),
  amount: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Transaction amount must be strictly greater than 0'),
  description: z
    .string()
    .trim()
    .min(3, 'Description must be at least 3 characters')
    .max(500, 'Description cannot exceed 500 characters'),
  transactionDate: z
    .string()
    .or(z.date())
    .transform((v) => new Date(v))
    .optional(),
  category: z.string().max(100).optional().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().nullable(),
  referenceNumber: z.string().max(100).optional().nullable(),
}).strict();

export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
export type TransactionSummaryQueryInput = z.infer<typeof transactionSummaryQuerySchema>;
export type VoidTransactionInput = z.infer<typeof voidTransactionSchema>;
export type CreateManualTransactionInput = z.infer<typeof createManualTransactionSchema>;
