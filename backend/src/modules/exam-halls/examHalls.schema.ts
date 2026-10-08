import { z } from 'zod';

export const createExamHallSchema = z.object({
  name: z.string().trim().min(1, 'Hall name is required'),
  roomNumber: z.string().trim().min(1, 'Room number is required'),
  targetClass: z.string().trim().min(1, 'Target class is required'),
  wing: z.string().optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(100000).default(60),
  invigilatorName: z.string().optional().nullable(),
  invigilatorPhone: z.string().optional().nullable(),
  reportingTime: z.string().trim().optional(),
  examDate: z.string().trim().optional(),
  testCenterId: z.string().min(1).optional().nullable(),
});

export const updateExamHallSchema = createExamHallSchema.partial();

export const batchAssignSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, 'At least one student must be selected').max(1000),
  hallName: z.string().optional(),
  roomNumber: z.string().optional(),
  testCenterName: z.string().optional(),
});

export const updateAllocationSchema = z.object({
  assignedHallId: z.string().min(1).optional().nullable(),
  assignedHall: z.string().optional().nullable(),
  assignedRoom: z.string().optional().nullable(),
  seatNo: z.string().trim().max(100).optional().nullable(),
  testCenterId: z.string().min(1).optional().nullable(),
  testCenterName: z.string().optional().nullable(),
});

export type CreateExamHallInput = z.infer<typeof createExamHallSchema>;
export type UpdateExamHallInput = z.infer<typeof updateExamHallSchema>;
export type BatchAssignInput = z.infer<typeof batchAssignSchema>;
export type UpdateAllocationInput = z.infer<typeof updateAllocationSchema>;

export const candidateQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  class: z.string().trim().max(100).optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  assignment: z.enum(['unassigned', 'assigned', 'all']).default('unassigned'),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type CandidateQueryInput = z.infer<typeof candidateQuerySchema>;
