import { z } from 'zod';

export const resultSearchQuerySchema = z.object({
  query: z.string().trim().min(1, 'Search query (Roll Number or CNIC) is required').max(128),
});

export const meritListQuerySchema = z.object({
  category: z.string().trim().max(128).optional(),
  district: z.string().trim().max(128).optional(),
  search: z.string().trim().max(128).optional(),
});

export type ResultSearchQuery = z.infer<typeof resultSearchQuerySchema>;
export type MeritListQuery = z.infer<typeof meritListQuerySchema>;
