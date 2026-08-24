import { z } from 'zod';

export const createExamHallSchema = z.object({
  name: z.string().min(1, 'Hall name is required'),
  roomNumber: z.string().min(1, 'Room number is required'),
  targetClass: z.string().min(1, 'Target class is required'),
  wing: z.string().optional().nullable(),
  capacity: z.union([z.number(), z.string().transform((v) => parseInt(v, 10) || 60)]).default(60),
  invigilatorName: z.string().optional().nullable(),
  invigilatorPhone: z.string().optional().nullable(),
  reportingTime: z.string().default('09:00 AM'),
  examDate: z.string().default('Sunday, 15 November 2026'),
  testCenterId: z.string().optional().nullable(),
});

export const updateExamHallSchema = createExamHallSchema.partial();

export const batchAssignSchema = z.object({
  studentIds: z.array(z.string()).min(1, 'At least one student must be selected'),
  hallName: z.string().optional(),
  roomNumber: z.string().optional(),
  testCenterName: z.string().optional(),
});

export const updateAllocationSchema = z.object({
  assignedHallId: z.string().optional().nullable(),
  assignedHall: z.string().optional().nullable(),
  assignedRoom: z.string().optional().nullable(),
  seatNo: z.string().optional().nullable(),
  testCenterName: z.string().optional().nullable(),
});

export type CreateExamHallInput = z.infer<typeof createExamHallSchema>;
export type UpdateExamHallInput = z.infer<typeof updateExamHallSchema>;
export type BatchAssignInput = z.infer<typeof batchAssignSchema>;
export type UpdateAllocationInput = z.infer<typeof updateAllocationSchema>;
