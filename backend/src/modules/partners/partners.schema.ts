import { z } from 'zod';
import { InstitutionType, PartnerStatus } from '@prisma/client';

export const registerPartnerSchema = z.object({
  institutionName: z
    .string()
    .min(3, 'Institution name must be at least 3 characters')
    .max(200, 'Institution name too long')
    .trim(),
  institutionType: z.nativeEnum(InstitutionType),
  campus: z.string().max(100).optional().nullable(),
  address: z.string().min(3, 'Address is required').max(300).trim(),
  district: z.string().min(2, 'District is required').max(100).trim(),
  province: z.string().min(2, 'Province is required').max(100).trim(),
  contactName: z.string().min(2, 'Contact person name is required').max(150).trim(),
  contactDesignation: z.string().min(2, 'Designation is required').max(150).trim(),
  contactMobile: z.string().min(10, 'Valid 10-15 digit mobile number is required').max(20).trim(),
  contactWhatsapp: z.string().max(20).optional().nullable(),
  contactEmail: z.string().email('Invalid email address').optional().or(z.literal('')).nullable(),
  website: z.string().max(200).optional().nullable(),
  classesOffered: z.array(z.string()).min(1, 'Select at least one class offered'),
  studentStrength: z.number().int().positive().optional().nullable(),
  expectedApplicants: z.number().int().positive().optional().nullable(),
  agreedToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the institutional partnership terms',
  }),
  signedAt: z
    .string()
    .or(z.date())
    .transform((v) => new Date(v))
    .optional(),
});

export const updatePartnerStatusSchema = z.object({
  status: z.nativeEnum(PartnerStatus),
  reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional().nullable(),
  expectedStatus: z.nativeEnum(PartnerStatus).optional(),
});

export const partnerQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(PartnerStatus).optional(),
  institutionType: z.nativeEnum(InstitutionType).optional(),
  district: z.string().optional(),
  sortBy: z.enum(['createdAt', 'institutionName', 'partnerCode', 'status', 'district']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z
    .any()
    .transform((v) => (v ? Math.max(1, parseInt(String(v), 10) || 1) : 1))
    .default(1),
  limit: z
    .any()
    .transform((v) => (v ? Math.min(100, Math.max(1, parseInt(String(v), 10) || 25)) : 25))
    .default(25),
});

export type RegisterPartnerInput = z.infer<typeof registerPartnerSchema>;
export type UpdatePartnerStatusInput = z.infer<typeof updatePartnerStatusSchema>;
export type PartnerQueryInput = z.infer<typeof partnerQuerySchema>;

