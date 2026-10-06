import { z } from 'zod';
import { Role } from '@prisma/client';
import { passwordPolicySchema } from '../../lib/passwordPolicy';

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z
    .preprocess((val) => (typeof val === 'string' ? val.trim().toLowerCase() : val), z.string().email('Invalid email address')),
  password: passwordPolicySchema,
  role: z.nativeEnum(Role).default(Role.TEACHER),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).trim().optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  password: passwordPolicySchema.optional(),
});

export const userQuerySchema = z.object({
  search: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  role: z
    .string()
    .optional()
    .transform((v) => (v === 'ALL' || !v?.trim() ? undefined : v.trim()))
    .pipe(z.nativeEnum(Role).optional()),
  status: z
    .string()
    .optional()
    .transform((v) => (v === 'ALL' || !v?.trim() ? undefined : v.trim()))
    .pipe(z.enum(['ACTIVE', 'INACTIVE']).optional()),
  page: z
    .union([z.string(), z.number()])
    .optional()
    .superRefine((v, ctx) => {
      if (v === undefined || v === null || v === '') return;
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      if (!Number.isInteger(n) || n < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Page must be a positive integer greater than or equal to 1',
        });
      }
    })
    .transform((v) => {
      if (v === undefined || v === null || v === '') return 1;
      return typeof v === 'number' ? v : Number(String(v).trim());
    })
    .default(1),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .superRefine((v, ctx) => {
      if (v === undefined || v === null || v === '') return;
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Limit must be an integer between 1 and 100',
        });
      }
    })
    .transform((v) => {
      if (v === undefined || v === null || v === '') return 20;
      return typeof v === 'number' ? v : Number(String(v).trim());
    })
    .default(20),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
