import { z } from 'zod';
import { AttendanceStatus, AttendanceMethod } from '@prisma/client';

export const scanAttendanceSchema = z
  .object({
    qrToken: z.string().optional(),
    rollNumber: z.string().optional(),
    studentId: z.string().optional(),
    status: z.nativeEnum(AttendanceStatus).default(AttendanceStatus.PRESENT),
    date: z
      .string()
      .or(z.date())
      .transform((v) => (v ? new Date(v) : new Date()))
      .optional(),
  })
  .refine(
    (data) => data.qrToken || data.rollNumber || data.studentId,
    {
      message:
        'Either qrToken (for QR scan) or rollNumber / studentId (for manual marking) must be provided.',
    }
  );

export const todayAttendanceQuerySchema = z.object({
  classLevel: z.string().optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  method: z.nativeEnum(AttendanceMethod).optional(),
});

export type ScanAttendanceInput = z.infer<typeof scanAttendanceSchema>;
export type TodayAttendanceQueryInput = z.infer<typeof todayAttendanceQuerySchema>;
