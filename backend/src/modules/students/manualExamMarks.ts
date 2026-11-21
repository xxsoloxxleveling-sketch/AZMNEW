import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { provisionalEdmcOutcome } from './provisionalOmrMarks';

export interface PublishedManualExamMark {
  studentId: string;
  sessionReference: string;
  rollNumberSnapshot: string;
  applicationNoSnapshot: string;
  obtainedMarks: number;
  originalRecordedMarks: number;
  manuallyCorrected: boolean;
  latestCorrectionId: string | null;
  maximumMarks: number;
  publishedAt: Date;
  recordedAt: Date;
  verified: boolean;
  verifiedAt: Date | null;
  verificationId?: string | null;
}

export interface ManualExamMarkReceipt {
  recordedMarks: number;
  recordedAt: Date;
}

function httpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

export function buildManualExamMarkEntryQuery(
  studentId: string,
  obtainedMarks: number,
  evidenceReference: string,
  reason: string,
  identityReviewed: boolean,
  attendanceReviewed: boolean,
  actorId: string,
): Prisma.Sql {
  // The database function independently authorizes Super Admin and checks
  // the student/OMR/official-result register under a Student row lock.
  return Prisma.sql`
    SELECT recorded_marks, recorded_at
    FROM public.azm_record_manual_exam_mark(
      ${studentId}::text,${obtainedMarks}::integer,
      ${evidenceReference}::text,${reason}::text,
      ${identityReviewed}::boolean,${attendanceReviewed}::boolean,
      ${actorId}::text
    )
  `;
}

export async function addManualExamMark(
  studentId: string,
  obtainedMarks: number,
  evidenceReference: string,
  reason: string,
  identityReviewed: boolean,
  attendanceReviewed: boolean,
  actorId: string,
): Promise<ManualExamMarkReceipt> {
  try {
    const rows = await prisma.$queryRaw<Array<{
      recorded_marks: number;
      recorded_at: Date;
    }>>(buildManualExamMarkEntryQuery(
      studentId, obtainedMarks, evidenceReference, reason,
      identityReviewed, attendanceReviewed, actorId,
    ));
    if (!rows[0]) throw httpError(409, 'Manual examination mark was not recorded. Refresh and try again.');
    return { recordedMarks: rows[0].recorded_marks, recordedAt: rows[0].recorded_at };
  } catch (error) {
    const details = String((error as any)?.meta?.message ?? (error as Error).message ?? '');
    if (details.includes('SUPER_ADMIN_REQUIRED')) throw httpError(403, 'Only an active Super Admin can add examination marks.');
    if (details.includes('INVALID_MANUAL_MARK_EVIDENCE')) throw httpError(400, 'Enter a mark from 0 to 100, an evidence reference, a detailed reason and both review confirmations.');
    if (details.includes('STUDENT_NOT_ELIGIBLE_FOR_MANUAL_MARK')) throw httpError(409, 'This student does not have an active registration with an issued examination roll number.');
    if (details.includes('STUDENT_ALREADY_HAS_MARKS') ||
        details.includes('OMR_MARK_ALREADY_RECORDED') ||
        details.includes('MANUAL_MARK_ALREADY_RECORDED') ||
        details.includes('OFFICIAL_RESULT_ALREADY_RECORDED') ||
        details.includes('23505')) {
      throw httpError(409, 'This student already has examination marks or an official result. Existing marks cannot be replaced through Add Marks.');
    }
    throw error;
  }
}

/** Read only the current manual entries. OMR marks are fetched separately,
 * and a later OMR import cannot overwrite these records.
 */
export async function findPublishedManualExamMarks(
  studentIds: string[],
  db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma,
): Promise<Map<string, PublishedManualExamMark>> {
  if (!studentIds.length) return new Map();
  // Calculate the current seal from the newest immutable audit. A
  // post-verification identity change invalidates it without deleting history.
  const records = await db.$queryRaw<PublishedManualExamMark[]>(Prisma.sql`
    SELECT m."studentId",m."sessionReference",
      m."rollNumberSnapshot",m."applicationNoSnapshot",
      COALESCE(correction."newEffectiveMarks",m."obtainedMarks") AS "obtainedMarks",
      m."obtainedMarks" AS "originalRecordedMarks",
      (correction.id IS NOT NULL) AS "manuallyCorrected",
      correction.id::TEXT AS "latestCorrectionId",
      m."maximumMarks",COALESCE(correction."occurredAt",m."publishedAt") AS "publishedAt",m."recordedAt",
      COALESCE(seal.valid,FALSE) AS "verified", seal."verificationId",
      CASE WHEN seal.valid THEN seal."verifiedAt" ELSE NULL END AS "verifiedAt"
    FROM public."ManualExamMark" m
    LEFT JOIN public."Student" student ON student.id=m."studentId"
    LEFT JOIN LATERAL (
      SELECT c.id,c."newEffectiveMarks",c."occurredAt"
      FROM public."ManualExamMarkCorrectionAudit" c
      WHERE c."sessionReference"=m."sessionReference"
        AND c."studentId"=m."studentId"
      ORDER BY c.id DESC LIMIT 1
    ) correction ON TRUE
    LEFT JOIN LATERAL (
      SELECT (
        audit."verifiedMarks"=COALESCE(correction."newEffectiveMarks",m."obtainedMarks")
        AND audit."latestCorrectionId" IS NOT DISTINCT FROM correction.id
        AND audit."maximumMarks"=m."maximumMarks"
        AND audit."recordedAtSnapshot"=m."recordedAt"
        AND audit."rollNumberSnapshot"=m."rollNumberSnapshot"
        AND audit."applicationNoSnapshot"=m."applicationNoSnapshot"
        AND audit."rollNumberSnapshot"=student."rollNumber"
        AND audit."applicationNoSnapshot"=student."applicationNo"
        AND audit."fullNameSnapshot"=student."fullName"
        AND audit."fatherNameSnapshot"=student."fatherName"
        AND audit."currentClassSnapshot"=student."currentClass"
        AND student.status::TEXT='ACTIVE'
        AND student."testScore" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public."OmrProvisionalMark" omr
          WHERE omr."sessionReference"=m."sessionReference"
            AND omr."studentId"=m."studentId"
        )
        AND NOT EXISTS (
          SELECT 1 FROM public."ExaminationResult" result
          WHERE result."studentId"=m."studentId"
        )
      ) AS valid, audit."verifiedAt", audit.id::TEXT AS "verificationId"
      FROM public."ManualExamMarkVerificationAudit" audit
      WHERE audit."sessionReference"=m."sessionReference"
        AND audit."studentId"=m."studentId"
      ORDER BY audit.id DESC LIMIT 1
    ) seal ON TRUE
    WHERE m."sessionReference"='2026-V'
      AND m."publishedAt" IS NOT NULL
      AND m."studentId" IN (${Prisma.join(studentIds)})
  `);
  return new Map(records.map(record => [record.studentId, record]));
}

export interface ManualExamVerificationReceipt {
  verificationId: string;
  verifiedMarks: number;
  verifiedAt: Date;
}

export function buildManualExamVerificationQuery(
  studentId: string,
  expectedCurrentMarks: number,
  evidenceReference: string,
  reason: string,
  identityReviewed: boolean,
  attendanceReviewed: boolean,
  marksEvidenceReviewed: boolean,
  actorId: string,
): Prisma.Sql {
  return Prisma.sql`
    SELECT verification_id, verified_marks, verified_at
    FROM public.azm_verify_manual_exam_mark(
      ${studentId}::text,${expectedCurrentMarks}::integer,
      ${evidenceReference}::text,${reason}::text,
      ${identityReviewed}::boolean,${attendanceReviewed}::boolean,
      ${marksEvidenceReviewed}::boolean,${actorId}::text
    )
  `;
}

export async function verifyManualExamMark(
  studentId: string,
  expectedCurrentMarks: number,
  evidenceReference: string,
  reason: string,
  identityReviewed: boolean,
  attendanceReviewed: boolean,
  marksEvidenceReviewed: boolean,
  actorId: string,
): Promise<ManualExamVerificationReceipt> {
  try {
    const receipts = await prisma.$queryRaw<Array<{
      verification_id: string; verified_marks: number; verified_at: Date;
    }>>(buildManualExamVerificationQuery(
      studentId, expectedCurrentMarks, evidenceReference, reason,
      identityReviewed, attendanceReviewed, marksEvidenceReviewed, actorId,
    ));
    if (!receipts[0]) throw httpError(409, 'Manual verification receipt was not recorded.');
    return {
      verificationId: receipts[0].verification_id,
      verifiedMarks: receipts[0].verified_marks,
      verifiedAt: receipts[0].verified_at,
    };
  } catch (error) {
    const details = String((error as any)?.meta?.message ?? (error as Error).message ?? '');
    if (details.includes('SUPER_ADMIN_REQUIRED')) throw httpError(403, 'Only an active Super Admin can verify examination marks.');
    if (details.includes('INVALID_MANUAL_VERIFICATION_EVIDENCE')) throw httpError(400, 'Verification requires original evidence, a detailed reason and all three review confirmations.');
    if (details.includes('MANUAL_MARK_NOT_FOUND')) throw httpError(404, 'There is no manually recorded mark for this student.');
    if (details.includes('STALE_MANUAL_MARK')) throw httpError(409, 'The recorded score changed. Refresh before verifying.');
    if (details.includes('MANUAL_MARK_ALREADY_VERIFIED')) throw httpError(409, 'This manual score has already been verified.');
    if (details.includes('MANUAL_IDENTITY_MISMATCH') || details.includes('STUDENT_NOT_ACTIVE'))
      throw httpError(409, 'The current student identity no longer matches the manual examination entry.');
    if (details.includes('CONFLICTING_EXAM_MARK_SOURCE'))
      throw httpError(409, 'A conflicting official result or OMR score exists; manual verification is blocked.');
    throw error;
  }
}

/** A manually entered mark is visible as review-required, never as a
 * verified E-DMC or falsely labelled as an OMR scan.
 */
export function publicCurrentManualMarks(record: Pick<PublishedManualExamMark,
  'obtainedMarks' | 'maximumMarks' | 'publishedAt'>) {
  const score = provisionalEdmcOutcome(record.obtainedMarks, record.maximumMarks);
  return {
    status: 'REVIEW_REQUIRED' as const,
    source: 'MANUAL_ENTRY' as const,
    session: 'Session V · 2026',
    obtainedMarks: record.obtainedMarks,
    maximumMarks: record.maximumMarks,
    percentage: score.percentage,
    resultStatus: score.resultStatus,
    passThreshold: 60,
    publishedAt: record.publishedAt.toISOString(),
    notice: 'This overall score was entered manually by examination administration and is awaiting independent verification. It is not a verified E-DMC or Official / Original DMC, does not guarantee a scholarship, and may be reviewed before interviews.',
  };
}
