import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

function bad(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

export function buildManualMarkCorrectionQuery(
  studentId: string, expectedCurrentMarks: number, newMarks: number,
  evidenceReference: string, reason: string,
  identityReviewed: boolean, attendanceReviewed: boolean, actorId: string,
): Prisma.Sql {
  return Prisma.sql`
    SELECT correction_id, previous_effective_marks, new_effective_marks, corrected_at
    FROM public.azm_correct_manual_exam_mark(
      ${studentId}::text,${expectedCurrentMarks}::integer,
      ${newMarks}::integer,${evidenceReference}::text,${reason}::text,
      ${identityReviewed}::boolean,${attendanceReviewed}::boolean,${actorId}::text
    )
  `;
}

export async function correctManualExamMark(
  studentId: string, expectedCurrentMarks: number, newMarks: number,
  evidenceReference: string, reason: string,
  identityReviewed: boolean, attendanceReviewed: boolean, actorId: string,
) {
  try {
    const rows = await prisma.$queryRaw<Array<{
      correction_id: string; previous_effective_marks: number;
      new_effective_marks: number; corrected_at: Date;
    }>>(buildManualMarkCorrectionQuery(
      studentId, expectedCurrentMarks, newMarks, evidenceReference,
      reason, identityReviewed, attendanceReviewed, actorId,
    ));
    if (!rows[0]) throw bad(409, 'The score was not changed. Refresh and retry.');
    return {
      correctionId: rows[0].correction_id,
      previousMarks: rows[0].previous_effective_marks,
      newMarks: rows[0].new_effective_marks,
      correctedAt: rows[0].corrected_at,
    };
  } catch (error) {
    const details = String((error as any)?.meta?.message ?? (error as Error)?.message ?? '');
    if (details.includes('SUPER_ADMIN_REQUIRED')) throw bad(403, 'Only an active Super Admin may correct marks.');
    if (details.includes('INVALID_MANUAL_CORRECTION_EVIDENCE')) throw bad(400, 'A valid mark, supporting reference, reason and identity/attendance checks are required.');
    if (details.includes('NO_MANUAL_MARK_CHANGE')) throw bad(400, 'The new score must differ from the current score.');
    if (details.includes('MANUAL_MARK_NOT_FOUND')) throw bad(404, 'No manual examination mark exists for this student.');
    if (details.includes('STALE_MANUAL_MARK')) throw bad(409, 'Another correction was recorded. Refresh and retry.');
    if (details.includes('MANUAL_IDENTITY_MISMATCH') || details.includes('STUDENT_NOT_ACTIVE'))
      throw bad(409, 'The original manual score no longer matches this student identity or status.');
    if (details.includes('CONFLICTING_EXAM_MARK_SOURCE'))
      throw bad(409, 'An OMR or official result exists. Use the corresponding audited results workflow.');
    throw error;
  }
}

/** Restricted to the authenticated Super Admin route, newest 100 for UI.
 * All correction events remain permanently in the database. */
export async function getManualMarkCorrectionHistory(studentId: string) {
  const entries = await prisma.manualExamMarkCorrectionAudit.findMany({
    where: { sessionReference: '2026-V', studentId },
    orderBy: { id: 'desc' },
    take: 100,
    select: {
      id: true, originalRecordedMarks: true,
      previousEffectiveMarks: true, newEffectiveMarks: true,
      evidenceReference: true, reason: true,
      actorName: true, occurredAt: true,
    },
  });
  return entries.map(entry => ({ ...entry, id: entry.id.toString() }));
}
