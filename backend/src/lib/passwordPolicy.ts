import { z } from 'zod';

/**
 * Shared password policy schema.
 * Requirements:
 * - Minimum 12 characters
 * - Maximum 72 UTF-8 bytes (bcrypt truncation boundary)
 * - Passphrases allowed without forced character composition
 */
export const passwordPolicySchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .refine(
    (val) => Buffer.byteLength(val, 'utf8') <= 72,
    'Password cannot exceed 72 bytes'
  );
