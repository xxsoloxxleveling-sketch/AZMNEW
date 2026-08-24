import { z } from 'zod';
import { InstitutionType, PartnerStatus } from '@prisma/client';

export const registerPartnerSchema = z.object({
  institutionName: z.string().min(3, 'Institution name must be at least 3 characters'),
  institutionType: z.nativeEnum(InstitutionType),
  campus: z.string().optional(),
  address: z.string().min(3, 'Address is required'),
  district: z.string().min(2, 'District is required'),
  province: z.string().min(2, 'Province is required'),
  contactName: z.string().min(2, 'Contact person name is required'),
  contactDesignation: z.string().min(2, 'Designation is required'),
  contactMobile: z.string().min(10, 'Valid mobile number is required'),
  contactWhatsapp: z.string().optional(),
  contactEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  website: z.string().optional(),
  classesOffered: z.array(z.string()).min(1, 'Select at least one class offered'),
  studentStrength: z.number().int().positive().optional(),
  expectedApplicants: z.number().int().positive().optional(),
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
  partnerCode: z.string().optional(),
});

export const partnerQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(PartnerStatus).optional(),
  institutionType: z.nativeEnum(InstitutionType).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, Math.min(100, parseInt(v, 10))) : 20)),
});

export type RegisterPartnerInput = z.infer<typeof registerPartnerSchema>;
export type UpdatePartnerStatusInput = z.infer<typeof updatePartnerStatusSchema>;
export type PartnerQueryInput = z.infer<typeof partnerQuerySchema>;
