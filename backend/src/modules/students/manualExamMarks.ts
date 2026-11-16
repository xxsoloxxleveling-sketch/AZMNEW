import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { provisionalEdmcOutcome } from './provisionalOmrMarks';

export interface PublishedManualExamMark {
  studentId: string;
  sessionReference: string;
  rollNumberSnapshot: string;
  applicationNoSnapshot: string;
  obtainedMarks: number;
  maximumMarks: number;
  publishedAt: Date;
  recordedAt: Date;
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
): Promise<Map<string, PublishedManualExamMark>> {
  if (!studentIds.length) return new Map();
  const records = await prisma.manualExamMark.findMany({
    where: {
      sessionReference: '2026-V',
      studentId: { in: studentIds },
    },
    select: {
      sessionReference: true, studentId: true,
      rollNumberSnapshot: true, applicationNoSnapshot: true,
      obtainedMarks: true, maximumMarks: true,
      publishedAt: true, recordedAt: true,
    },
  });
  return new Map(records.map(record => [record.studentId, record]));
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
