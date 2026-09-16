import { z } from 'zod';

const validTypes = ['urgent', 'registration', 'exam', 'info'] as const;

function isValidDateString(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return true;
  if (typeof val !== 'string') return false;
  const parsed = Date.parse(val);
  return !isNaN(parsed);
}

export const createAnnouncementSchema = z
  .object({
    title: z
      .string({ required_error: 'Title is required' })
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(150, 'Title cannot exceed 150 characters'),
    subtitle: z
      .string()
      .trim()
      .max(200, 'Subtitle cannot exceed 200 characters')
      .nullable()
      .optional(),
    message: z
      .string({ required_error: 'Message is required' })
      .trim()
      .min(5, 'Message must be at least 5 characters')
      .max(2000, 'Message cannot exceed 2000 characters'),
    type: z.enum(validTypes, {
      errorMap: () => ({ message: 'Type must be one of: urgent, registration, exam, info' }),
    }),
    badge: z
      .string({ required_error: 'Badge is required' })
      .trim()
      .min(1, 'Badge is required')
      .max(30, 'Badge cannot exceed 30 characters'),
    isPinned: z.boolean().default(false),
    isPublished: z.boolean().default(true),
    publishStartAt: z
      .preprocess((val) => (val === '' ? null : val), z.string().nullable().optional())
      .refine(isValidDateString, { message: 'Invalid publishStartAt datetime string' }),
    publishEndAt: z
      .preprocess((val) => (val === '' ? null : val), z.string().nullable().optional())
      .refine(isValidDateString, { message: 'Invalid publishEndAt datetime string' }),
  })
  .strict({ message: 'Unrecognized field in announcement payload' })
  .refine(
    (data) => {
      if (data.publishStartAt && data.publishEndAt) {
        return new Date(data.publishStartAt) <= new Date(data.publishEndAt);
      }
      return true;
    },
    {
      message: 'publishStartAt must be earlier than or equal to publishEndAt',
      path: ['publishStartAt'],
    }
  );

export const updateAnnouncementSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(150, 'Title cannot exceed 150 characters')
      .optional(),
    subtitle: z
      .string()
      .trim()
      .max(200, 'Subtitle cannot exceed 200 characters')
      .nullable()
      .optional(),
    message: z
      .string()
      .trim()
      .min(5, 'Message must be at least 5 characters')
      .max(2000, 'Message cannot exceed 2000 characters')
      .optional(),
    type: z
      .enum(validTypes, {
        errorMap: () => ({ message: 'Type must be one of: urgent, registration, exam, info' }),
      })
      .optional(),
    badge: z
      .string()
      .trim()
      .min(1, 'Badge cannot be empty')
      .max(30, 'Badge cannot exceed 30 characters')
      .optional(),
    isPinned: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    publishStartAt: z
      .preprocess((val) => (val === '' ? null : val), z.string().nullable().optional())
      .refine(isValidDateString, { message: 'Invalid publishStartAt datetime string' }),
    publishEndAt: z
      .preprocess((val) => (val === '' ? null : val), z.string().nullable().optional())
      .refine(isValidDateString, { message: 'Invalid publishEndAt datetime string' }),
  })
  .strict({ message: 'Unrecognized field in announcement update payload' })
  .refine(
    (data) => {
      if (data.publishStartAt && data.publishEndAt) {
        return new Date(data.publishStartAt) <= new Date(data.publishEndAt);
      }
      return true;
    },
    {
      message: 'publishStartAt must be earlier than or equal to publishEndAt',
      path: ['publishStartAt'],
    }
  );

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
