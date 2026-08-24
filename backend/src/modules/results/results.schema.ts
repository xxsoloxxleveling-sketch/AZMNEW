import { z } from 'zod';

export const resultSearchQuerySchema = z.object({
  query: z.string().min(1, 'Search query (Roll Number or CNIC) is required').trim(),
});

export const meritListQuerySchema = z.object({
  category: z.string().optional(),
  district: z.string().optional(),
  search: z.string().optional(),
});

export type ResultSearchQuery = z.infer<typeof resultSearchQuerySchema>;
export type MeritListQuery = z.infer<typeof meritListQuerySchema>;
