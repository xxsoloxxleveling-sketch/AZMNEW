import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  findPublishedProvisionalMarks, ProvisionalOmrMark,
} from '../students/provisionalOmrMarks';
import {
  findPublishedManualExamMarks, PublishedManualExamMark,
} from '../students/manualExamMarks';
import {
  ApprovedResultSource, assessInterviewEligibility, getAuthoritativeApprovedResult,
  InterviewEligibility, resolveInterviewResultRecords, SESSION_V_CAMPAIGN_REF,
} from './eligibility';

export type FinalWrittenMarkResolution = {
  result: ApprovedResultSource | null;
  eligibility: InterviewEligibility;
};

type Db = PrismaClient | Prisma.TransactionClient;
type PublishedMark = ProvisionalOmrMark | PublishedManualExamMark;

function timestamp(value: Date | null | undefined): string | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

/** The same currently valid seal used by the Student list, with a reproducible
 * source revision for assessment snapshots. Reading a mark never verifies it.
 */
function sealedSource(
  studentId: string,
  mark: PublishedMark,
  sourceType: 'VERIFIED_OMR' | 'VERIFIED_MANUAL',
): ApprovedResultSource {
  const verified = mark.verified === true && timestamp(mark.verifiedAt) !== null;
  const revision = createHash('sha256').update(JSON.stringify({
    sourceType, sessionReference: SESSION_V_CAMPAIGN_REF, studentId,
    marks: mark.obtainedMarks, maximumMarks: mark.maximumMarks,
    publishedAt: timestamp(mark.publishedAt),
    recordedAt: 'recordedAt' in mark ? timestamp(mark.recordedAt) : null,
    scanSha256: 'scanSha256' in mark ? mark.scanSha256 ?? null : null,
    latestCorrectionId: mark.latestCorrectionId ?? null,
    verificationId: mark.verificationId ?? null,
    verifiedAt: timestamp(mark.verifiedAt), verified,
  })).digest('hex');
  return {
    marks: mark.obtainedMarks, maximumMarks: mark.maximumMarks,
    verificationStatus: verified ? 'VERIFIED' : 'NOT_VERIFIED', isFinal: verified,
    reference: `${sourceType}:${SESSION_V_CAMPAIGN_REF}:${studentId}`,
    revision, sourceType,
  };
}

/** Match Student-list precedence (published OMR, then published manual).
 * A pending/invalidated primary seal must not be bypassed using a different
 * register. Official results are an explicit fallback, never a new mandatory
 * approval step for an already verified Student-list score.
 */
export function resolveFinalWrittenMark(
  studentId: string,
  omr: ProvisionalOmrMark | undefined,
  manual: PublishedManualExamMark | undefined,
  officialRecords: unknown[] = [],
): FinalWrittenMarkResolution {
  const withheld = officialRecords.map(getAuthoritativeApprovedResult)
    .find(result => result?.verificationStatus === 'WITHHELD');
  if (withheld) {
    return { result: withheld, eligibility: { status: 'EXCLUDED_PENDING_REVIEW', reason: 'WITHHELD' } };
  }
  const official = resolveInterviewResultRecords(officialRecords);
  if (official.eligibility.status === 'EXCLUDED_PENDING_REVIEW') return official;

  const primary = omr ? sealedSource(studentId, omr, 'VERIFIED_OMR')
    : manual ? sealedSource(studentId, manual, 'VERIFIED_MANUAL') : null;
  if (!primary) return official;

  const eligibility = assessInterviewEligibility(primary);
  if (eligibility.status === 'PENDING_VERIFICATION') return { result: primary, eligibility };

  const alternatives = [
    official.result,
    omr && manual ? sealedSource(studentId, manual, 'VERIFIED_MANUAL') : null,
  ].filter((result): result is ApprovedResultSource => Boolean(result?.isFinal));
  if (alternatives.some(result => result.marks !== primary.marks || result.maximumMarks !== primary.maximumMarks)) {
    return { result: null, eligibility: { status: 'EXCLUDED_PENDING_REVIEW', reason: 'CONFLICTING_FINAL_SOURCES' } };
  }
  return { result: primary, eligibility };
}

/** Load final written marks inside the caller's transaction when supplied.
 * Optional preloaded official rows let the campaign snapshot reuse its query.
 */
export async function loadFinalWrittenMarks(
  db: Db,
  studentIds: string[],
  officialRows?: unknown[],
): Promise<Map<string, FinalWrittenMarkResolution>> {
  const ids = [...new Set(studentIds)];
  if (!ids.length) return new Map();
  const [omr, manual, official] = await Promise.all([
    findPublishedProvisionalMarks(ids, db),
    findPublishedManualExamMarks(ids, db),
    officialRows !== undefined ? Promise.resolve(officialRows) : db.examinationResult.findMany({
      where: { studentId: { in: ids }, examination: { sessionReference: SESSION_V_CAMPAIGN_REF } },
      include: {
        examination: {
          select: {
            id: true, reference: true, sessionReference: true, maximumMarks: true,
            publicationStatus: true, publishedAt: true, publishedById: true, revision: true,
            paperKeyRevisions: { select: { paperVersion: true } },
          },
        },
        attendanceSession: { select: { id: true, isCurrent: true, status: true } },
        attemptBinding: { select: { sessionId: true, studentId: true } },
        corrections: {
          select: { previousRevision: true, newRevision: true, occurredAt: true, id: true },
          orderBy: [{ newRevision: 'desc' }, { occurredAt: 'desc' }, { id: 'desc' }], take: 1,
        },
      },
    }),
  ]);
  const byStudent = new Map<string, unknown[]>();
  for (const record of official) {
    if (!record || typeof record !== 'object' || !('studentId' in record) || typeof record.studentId !== 'string') continue;
    byStudent.set(record.studentId, [...(byStudent.get(record.studentId) ?? []), record]);
  }
  return new Map(ids.map(studentId => [studentId, resolveFinalWrittenMark(
    studentId, omr.get(studentId), manual.get(studentId), byStudent.get(studentId) ?? [],
  )]));
}
