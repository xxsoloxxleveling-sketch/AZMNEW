import { z } from 'zod';
import { StaffStatus } from '@prisma/client';

export const createStaffSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  role: z.string().min(2, 'Role / Designation is required (e.g. Teacher, Accountant)'),
  cnic: z.string().min(5, 'CNIC is required').trim(),
  phone: z.string().min(10, 'Valid phone number is required'),
  salary: z.number().positive('Salary must be greater than 0'),
  joinDate: z
    .string()
    .or(z.date())
    .transform((v) => (v ? new Date(v) : new Date()))
    .optional(),
});

export const updateStaffSchema = createStaffSchema.partial().extend({
  status: z.nativeEnum(StaffStatus).optional(),
});

export const staffQuerySchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.nativeEnum(StaffStatus).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, Math.min(100, parseInt(v, 10))) : 20)),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type StaffQueryInput = z.infer<typeof staffQuerySchema>;
