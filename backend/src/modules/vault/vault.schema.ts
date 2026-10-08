import { z } from 'zod';

export const vaultDocumentTypeSchema = z.string().trim().regex(
  /^(photo|bform|fatherCnic|dmc(?:_\d+)?|domicile|paymentReceipt|income|signature)$/,
  'Unsupported document type'
);

export const vaultListSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  search: z.string().trim().max(120).optional(),
  type: z.enum(['photo', 'bform', 'fatherCnic', 'dmc', 'domicile', 'paymentReceipt', 'income', 'signature']).optional(),
  status: z.enum(['PENDING_REVIEW', 'VERIFIED', 'REJECTED']).optional(),
  class: z.string().trim().max(100).optional(),
  studentId: z.string().trim().min(1).max(128).optional(),
}).strict();
export type VaultListQuery = z.infer<typeof vaultListSchema>;

export const vaultHistorySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
export type VaultHistoryQuery = z.infer<typeof vaultHistorySchema>;

export const vaultReplaceQuerySchema = z.object({
  revision: z.coerce.number().int().min(1),
}).strict();

export const vaultReviewSchema = z.object({
  status: z.enum(['PENDING_REVIEW', 'VERIFIED', 'REJECTED']),
  reason: z.string().trim().min(5).max(1000).optional(),
  expectedRevision: z.number().int().min(1),
}).strict().superRefine((value, ctx) => {
  if (value.status === 'REJECTED' && !value.reason) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A rejection reason of at least 5 characters is required.' });
  }
  if (value.status !== 'REJECTED' && value.reason) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A rejection reason is permitted only when rejecting.' });
  }
});
export type VaultReviewInput = z.infer<typeof vaultReviewSchema>;

export const VAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const VAULT_SUPPORTED_MIME = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export type VaultFileMime = typeof VAULT_SUPPORTED_MIME[number];

function badFile(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 400 });
}

export function validateVaultFile(bytes: Buffer, providedMime: string, documentType: string): { mime: VaultFileMime; extension: string } {
  const type = vaultDocumentTypeSchema.safeParse(documentType);
  if (!type.success) return badFile('Unsupported document type.');
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return badFile('A nonempty binary file is required.');
  if (bytes.length > VAULT_MAX_FILE_BYTES) return badFile('Files must be 5 MB or smaller.');

  const mime = providedMime.toLowerCase().split(';')[0].trim().replace('image/jpg', 'image/jpeg');
  if (!VAULT_SUPPORTED_MIME.includes(mime as VaultFileMime)) return badFile('Only JPEG, PNG and PDF documents are accepted.');
  if (['photo', 'signature'].includes(type.data) && mime === 'application/pdf') {
    return badFile('Photographs and signatures must be JPEG or PNG images.');
  }

  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isPdf = bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (!((mime === 'image/jpeg' && isJpeg) || (mime === 'image/png' && isPng) || (mime === 'application/pdf' && isPdf))) {
    return badFile('The file content does not match its declared type.');
  }
  return { mime: mime as VaultFileMime, extension: mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg' };
}

export function safeVaultFileName(input: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    return badFile('Invalid file-name encoding.');
  }
  const safe = decoded.replace(/[\\/\u0000-\u001f\u007f<>:"|?*]/g, '_').trim().slice(0, 160);
  if (!safe) return badFile('A valid file name is required.');
  return safe;
}
