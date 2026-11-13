import { z } from 'zod';

export const resultSearchQuerySchema = z.object({
  query: z.string().min(1, 'Search query (Roll Number or CNIC) is required').trim(),
});

export const meritListQuerySchema = z.object({
  category: z.string().optional(),
  district: z.string().optional(),
  search: z.string().optional(),
});

export const adminResultsPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  className: z.string().trim().max(80).optional(),
  minimumScore: z.coerce.number().min(0).max(100).optional(),
  maximumScore: z.coerce.number().min(0).max(100).optional(),
  scoreAvailability: z.enum(['all', 'with-score', 'without-score']).default('all'),
  sortBy: z.enum(['rollNumber', 'studentName', 'className', 'legacyScore']).default('rollNumber'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
}).superRefine((value, ctx) => {
  if (value.minimumScore !== undefined && value.maximumScore !== undefined && value.minimumScore > value.maximumScore) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maximumScore'], message: 'Maximum score must be greater than or equal to minimum score.' });
  }
  if (value.scoreAvailability === 'without-score' && (value.minimumScore !== undefined || value.maximumScore !== undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scoreAvailability'], message: 'Score range filters require records with a legacy score.' });
  }
});

export type ResultSearchQuery = z.infer<typeof resultSearchQuerySchema>;
export type MeritListQuery = z.infer<typeof meritListQuerySchema>;
export type AdminResultsPageQuery = z.infer<typeof adminResultsPageQuerySchema>;
