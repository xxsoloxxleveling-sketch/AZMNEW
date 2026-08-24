import { z } from 'zod';

export const createTestCenterSchema = z.object({
  name: z.string().min(1, 'Center name is required'),
  code: z.string().min(1, 'Center code is required').trim(),
  campus: z.string().optional().nullable(),
  address: z.string().min(1, 'Address is required'),
  district: z.string().min(1, 'District is required'),
  province: z.string().default('Khyber Pakhtunkhwa'),
  capacity: z.union([z.number(), z.string().transform((v) => parseInt(v, 10) || 300)]).default(300),
  reportingTime: z.string().default('09:00 AM'),
  testDate: z.string().default('Sunday, 15 November 2026'),
  contactPerson: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateTestCenterSchema = createTestCenterSchema.partial();

export type CreateTestCenterInput = z.infer<typeof createTestCenterSchema>;
export type UpdateTestCenterInput = z.infer<typeof updateTestCenterSchema>;
