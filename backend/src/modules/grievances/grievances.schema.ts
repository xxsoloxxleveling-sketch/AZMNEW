import { z } from 'zod';
import { GrievanceStatus } from '@prisma/client';

export const createGrievanceSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email format').optional().nullable().or(z.literal('')),
  phone: z.string().min(5, 'Contact phone number is required'),
  category: z.string().min(1, 'Query category is required'),
  cnicOrRollNo: z.string().optional().nullable(),
  subject: z.string().optional().default('Grievance / Candidate Inquiry'),
  message: z.string().min(3, 'Detailed query message is required'),
});

export const updateGrievanceSchema = z.object({
  status: z.nativeEnum(GrievanceStatus).optional(),
  response: z.string().optional().nullable(),
});

export type CreateGrievanceInput = z.infer<typeof createGrievanceSchema>;
export type UpdateGrievanceInput = z.infer<typeof updateGrievanceSchema>;
