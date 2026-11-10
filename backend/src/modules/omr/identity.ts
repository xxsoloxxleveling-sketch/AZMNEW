import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getStudyClassLabel, resolveHsscGroup } from '../students/hsscContract';

export const legacyIdentitySchema = z.object({
  type: z.literal('AZM_OMR'), session: z.string().min(1).max(64), sheetVersion: z.literal(2),
  examId:z.string().min(1).max(128).optional(),
  rollType: z.literal('OFFICIAL'), studentId: z.string().min(1).max(128),
  applicationNo: z.string().min(1).max(128), rollNumber: z.string().min(1).max(128),
});
export function decodeIdentity(input: unknown, signingKey = process.env.OMR_QR_SIGNING_KEY) {
  const signed = z.object({ type: z.literal('AZM_OMR_SIGNED'), payload: z.string().max(4096), signature: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(input);
  if (signed.success) {
    if (!signingKey || signingKey.length < 32) return null;
    const expected = createHmac('sha256', signingKey).update(signed.data.payload).digest();
    if (!timingSafeEqual(expected, Buffer.from(signed.data.signature, 'hex'))) return null;
    try { return legacyIdentitySchema.parse(JSON.parse(Buffer.from(signed.data.payload, 'base64url').toString('utf8'))); }
    catch { return null; }
  }
  const legacy = legacyIdentitySchema.safeParse(input);
  return legacy.success ? legacy.data : null;
}
export function candidateGroup(student: { currentClass: string; hsscGroup?: string | null }) {
  const group = resolveHsscGroup(student);
  if (!group.ready) return null;
  return [getStudyClassLabel(student.currentClass).trim().toUpperCase(), group.group?.toUpperCase()].filter(Boolean).join(' :: ');
}
export function reconcileIdentity(
  input: unknown, student: { id: string; applicationNo: string; rollNumber: string | null; status: string; currentClass: string; hsscGroup?: string | null } | null,
  exam: { id?:string; session: string; candidateGroup: string },
) {
  const qr = decodeIdentity(input);
  return !!(qr && student && student.status === 'ACTIVE' && student.rollNumber &&
    qr.studentId === student.id && qr.applicationNo === student.applicationNo &&
    (!qr.examId || qr.examId===exam.id) && qr.rollNumber === student.rollNumber && qr.session === exam.session && candidateGroup(student) === exam.candidateGroup);
}

/** Printed-identity review may fill missing QR evidence, never override a contradictory QR. */
export function manualQrAgrees(evidence:unknown,student:Parameters<typeof reconcileIdentity>[1],exam:Parameters<typeof reconcileIdentity>[2]) {
  const object=evidence&&typeof evidence==='object'?evidence as Record<string,unknown>:null;
  const diagnostic=object?.qrDiagnostics;
  if(diagnostic&&typeof diagnostic==='object'&&(diagnostic as Record<string,unknown>).reason==='CONFLICTING_QR')return false;
  const qr=object?.qrEnvelope||object?.identity;
  return !qr || reconcileIdentity(qr,student,exam);
}
