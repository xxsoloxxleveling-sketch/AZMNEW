import { z } from 'zod';
import { StaffStatus } from '@prisma/client';

export const createStaffSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  role: z
    .string({ required_error: 'Role / Designation is required' })
    .trim()
    .min(2, 'Role / Designation is required (e.g. Teacher, Accountant)')
    .max(100, 'Role cannot exceed 100 characters'),
  cnic: z
    .string({ required_error: 'CNIC is required' })
    .trim()
    .refine(
      (v) => /^(\d{13}|\d{5}-\d{7}-\d)$/.test(v),
      'CNIC must be a valid 13-digit identity number (e.g. 12345-1234567-1 or 1234512345671)'
    ),
  phone: z
    .string({ required_error: 'Valid phone number is required' })
    .trim()
    .refine(
      (v) =>
        /^\+?[0-9\s-]{7,20}$/.test(v) &&
        v.replace(/\D/g, '').length >= 7 &&
        v.replace(/\D/g, '').length <= 15,
      'Please enter a valid telephone number (7-15 digits, optional + prefix)'
    ),
  salary: z
    .number({ required_error: 'Salary must be a positive number' })
    .positive('Salary must be greater than 0')
    .max(10000000, 'Salary exceeds maximum allowable limit'),
  joinDate: z
    .string()
    .or(z.date())
    .transform((v) => (v ? new Date(v) : new Date()))
    .optional(),
});

export const updateStaffSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters')
    .optional(),
  role: z
    .string()
    .trim()
    .min(2, 'Role / Designation is required')
    .max(100, 'Role cannot exceed 100 characters')
    .optional(),
  cnic: z
    .string()
    .trim()
    .refine(
      (v) => /^(\d{13}|\d{5}-\d{7}-\d)$/.test(v),
      'CNIC must be a valid 13-digit identity number (e.g. 12345-1234567-1 or 1234512345671)'
    )
    .optional(),
  phone: z
    .string()
    .trim()
    .refine(
      (v) =>
        /^\+?[0-9\s-]{7,20}$/.test(v) &&
        v.replace(/\D/g, '').length >= 7 &&
        v.replace(/\D/g, '').length <= 15,
      'Please enter a valid telephone number (7-15 digits, optional + prefix)'
    )
    .optional(),
  salary: z.number().positive('Salary must be greater than 0').max(10000000).optional(),
  joinDate: z
    .string()
    .or(z.date())
    .transform((v) => (v ? new Date(v) : undefined))
    .optional(),
  status: z.nativeEnum(StaffStatus).optional(),
});

export const staffQuerySchema = z.object({
  search: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  role: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  status: z
    .string()
    .optional()
    .transform((v) => (v === 'ALL' || !v?.trim() ? undefined : v.trim()))
    .pipe(z.nativeEnum(StaffStatus).optional()),
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

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type StaffQueryInput = z.infer<typeof staffQuerySchema>;
