import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// This register is deliberately separate from protected Student.testScore,
// ExaminationResult and DMC issuance. Only marks with publishedAt appear online.
export interface ProvisionalOmrMark {
  studentId: string;
  obtainedMarks: number;
  maximumMarks: number;
  publishedAt: Date;
  originalScannedMarks: number;
  manuallyCorrected: boolean;
  reviewCategory: string;
  identityStatus: string;
  paperVersionStatus: string;
  printedClassDisagrees: boolean;
  manualReviewRequired: boolean;
  verified: boolean;
  verifiedAt: Date | null;
}

export async function findPublishedProvisionalMarks(studentIds: string[]): Promise<Map<string, ProvisionalOmrMark>> {
  if (studentIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<ProvisionalOmrMark[]>(Prisma.sql`
    SELECT m."studentId",
      COALESCE(m."correctedMarks",m."obtainedMarks") AS "obtainedMarks",
      m."maximumMarks", m."publishedAt",
      m."obtainedMarks" AS "originalScannedMarks",
      (m."correctedMarks" IS NOT NULL) AS "manuallyCorrected",
      m."reviewCategory", m."identityStatus",
      m."paperVersionStatus", m."printedClassDisagrees", m."manualReviewRequired",
      COALESCE(seal.valid, FALSE) AS "verified",
      CASE WHEN seal.valid THEN seal."verifiedAt" ELSE NULL END AS "verifiedAt"
    FROM public."OmrProvisionalMark" m
    LEFT JOIN public."Student" s ON s.id=m."studentId"
    LEFT JOIN LATERAL (
      SELECT c.id FROM public."OmrProvisionalMarkCorrectionAudit" c
      WHERE c."sessionReference"=m."sessionReference" AND c."studentId"=m."studentId"
      ORDER BY c."occurredAt" DESC, c.id DESC LIMIT 1
    ) latest_correction ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        (
          v."verifiedMarks" = COALESCE(m."correctedMarks",m."obtainedMarks")
          AND v."maximumMarks" = m."maximumMarks"
          AND v."scanSha256" = m."scanSha256"
          AND v."latestCorrectionId" IS NOT DISTINCT FROM latest_correction.id
          AND v."rollNumberSnapshot" = s."rollNumber"
          AND v."applicationNoSnapshot" = s."applicationNo"
          AND v."fullNameSnapshot" = s."fullName"
          AND v."fatherNameSnapshot" = s."fatherName"
          AND v."currentClassSnapshot" = s."currentClass"
          AND v."rollNumberSnapshot" = m."rollNumberSnapshot"
          AND v."applicationNoSnapshot" = m."applicationNoSnapshot"
          AND s.status::TEXT = 'ACTIVE'
        ) AS valid,
        v."verifiedAt"
      FROM public."OmrMarkVerificationAudit" v
      WHERE v."sessionReference"=m."sessionReference" AND v."studentId"=m."studentId"
      ORDER BY v.id DESC LIMIT 1
    ) seal ON TRUE
    WHERE m."sessionReference" = '2026-V' AND m."publishedAt" IS NOT NULL
      AND m."studentId" IN (${Prisma.join(studentIds)})
  `);
  return new Map(rows.map((item) => [item.studentId, item]));
}

/** A provisional pass does not imply scholarship selection or final verification. */
export function provisionalEdmcOutcome(obtained: number, maximum: number, passThreshold = 60) {
  if (!Number.isInteger(obtained) || !Number.isInteger(maximum) || maximum <= 0
    || obtained < 0 || obtained > maximum || passThreshold < 0 || passThreshold > maximum) {
    throw new Error('Invalid provisional examination score');
  }
  return {
    resultStatus: obtained > passThreshold ? 'PASS' as const : 'FAIL' as const,
    percentage: Number((obtained / maximum * 100).toFixed(2)),
  };
}

/** Candidate-only view of published but not yet verified overall OMR marks.
 * Deliberately excludes name, father, roll, application, photo and any scan
 * evidence because a bare CNIC is not robust proof of document ownership.
 */
export function publicCurrentOmrMarks(mark: ProvisionalOmrMark) {
  const score = provisionalEdmcOutcome(mark.obtainedMarks, mark.maximumMarks);
  return {
    status: 'REVIEW_REQUIRED' as const,
    session: 'Session V · 2026',
    obtainedMarks: mark.obtainedMarks,
    maximumMarks: mark.maximumMarks,
    percentage: score.percentage,
    resultStatus: score.resultStatus,
    passThreshold: 60,
    publishedAt: mark.publishedAt.toISOString(),
    notice: 'These are the currently recorded examination marks. Review and verification are still pending; scores may be corrected. This is not an Official / Original DMC and does not guarantee a scholarship. The next selection phase is interviews.',
  };
}

/** Numeric ordering across the filtered roster, with students lacking a mark last. */
export function sortProvisionalStudentIds(
  ids: string[],
  marks: ReadonlyMap<string, Pick<ProvisionalOmrMark, 'obtainedMarks'>>,
  direction: 'asc' | 'desc',
): string[] {
  return [...ids].sort((a, b) => {
    const first = marks.get(a)?.obtainedMarks;
    const second = marks.get(b)?.obtainedMarks;
    if (first === undefined && second === undefined) return a.localeCompare(b);
    if (first === undefined) return 1;
    if (second === undefined) return -1;
    const difference = direction === 'asc' ? first - second : second - first;
    return difference || a.localeCompare(b);
  });
}


export interface ProvisionalMarkCorrectionReceipt {
  originalScannedMarks: number;
  previousMarks: number;
  newMarks: number;
  correctionId: string;
}

export interface ProvisionalMarkCorrectionHistoryItem {
  id: string;
  originalScannedMarks: number;
  previousEffectiveMarks: number;
  newEffectiveMarks: number;
  reason: string;
  actorName: string;
  occurredAt: Date;
}

function httpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

// Prisma sends JavaScript integer parameters as PostgreSQL int8. The audited
// SECURITY DEFINER function explicitly accepts int4, so cast every argument
// rather than relying on PostgreSQL function-resolution coercion.
export function buildProvisionalMarkCorrectionQuery(
  studentId: string,
  expectedCurrentMarks: number,
  newMarks: number,
  reason: string,
  actorId: string,
): Prisma.Sql {
  return Prisma.sql`
    SELECT original_marks, previous_marks, updated_marks, correction_id
    FROM public.azm_correct_provisional_omr_mark(
      ${studentId}::text, ${expectedCurrentMarks}::integer, ${newMarks}::integer,
      ${reason}::text, ${actorId}::text
    )
  `;
}

export async function correctPublishedProvisionalOmrMark(
  studentId: string,
  expectedCurrentMarks: number,
  newMarks: number,
  reason: string,
  actorId: string,
): Promise<ProvisionalMarkCorrectionReceipt> {
  try {
    // DB validates the actor's SUPER_ADMIN status, locks the row, preserves
    // original scan marks and appends the correction audit atomically.
    const rows = await prisma.$queryRaw<Array<{
      original_marks: number;
      previous_marks: number;
      updated_marks: number;
      correction_id: string;
    }>>(buildProvisionalMarkCorrectionQuery(studentId, expectedCurrentMarks, newMarks, reason, actorId));
    const result = rows[0];
    if (!result) throw httpError(404, 'Published provisional marks not found for this student.');
    return {
      originalScannedMarks: result.original_marks,
      previousMarks: result.previous_marks,
      newMarks: result.updated_marks,
      correctionId: result.correction_id,
    };
  } catch (error) {
    const details = String((error as any)?.meta?.message ?? (error as Error).message ?? '');
    if (details.includes('STALE_PROVISIONAL_MARK')) throw httpError(409, 'Marks changed since opening the editor. Refresh and try again.');
    if (details.includes('PROVISIONAL_MARK_NOT_FOUND')) throw httpError(404, 'This student does not have published provisional OMR marks.');
    if (details.includes('SUPER_ADMIN_REQUIRED')) throw httpError(403, 'An active Super Admin account is required to correct marks.');
    if (details.includes('NO_MARK_CHANGE')) throw httpError(400, 'Enter a new mark different from the current value.');
    if (details.includes('INVALID_MARK_CORRECTION')) throw httpError(400, 'Invalid mark or correction reason.');
    throw error;
  }
}

export interface MarkVerificationReceipt {
  verificationId: string;
  verifiedMarks: number;
  verifiedAt: Date;
}

/** Explicitly signed evidence for the particular score revision. */
export function buildOmrMarkVerificationQuery(
  studentId: string,
  expectedCurrentMarks: number,
  evidenceReference: string,
  reason: string,
  identityReviewed: boolean,
  paperVersionReviewed: boolean,
  printedClassReviewed: boolean,
  actorId: string,
): Prisma.Sql {
  return Prisma.sql`
    SELECT verification_id, verified_marks, verified_at
    FROM public.azm_verify_omr_mark(
      ${studentId}::text, ${expectedCurrentMarks}::integer,
      ${evidenceReference}::text, ${reason}::text,
      ${identityReviewed}::boolean, ${paperVersionReviewed}::boolean,
      ${printedClassReviewed}::boolean, ${actorId}::text
    )
  `;
}

export async function verifyPublishedOmrMark(
  studentId: string,
  expectedCurrentMarks: number,
  evidenceReference: string,
  reason: string,
  identityReviewed: boolean,
  paperVersionReviewed: boolean,
  printedClassReviewed: boolean,
  actorId: string,
): Promise<MarkVerificationReceipt> {
  try {
    const rows = await prisma.$queryRaw<Array<{
      verification_id: string;
      verified_marks: number;
      verified_at: Date;
    }>>(buildOmrMarkVerificationQuery(
      studentId, expectedCurrentMarks, evidenceReference, reason,
      identityReviewed, paperVersionReviewed, printedClassReviewed, actorId,
    ));
    const row = rows[0];
    if (!row) throw httpError(409, 'Verification receipt was not produced.');
    return {
      verificationId: row.verification_id,
      verifiedMarks: row.verified_marks,
      verifiedAt: row.verified_at,
    };
  } catch (error) {
    const details = String((error as any)?.meta?.message ?? (error as Error).message ?? '');
    if (details.includes('STALE_MARK')) throw httpError(409, 'Marks have changed. Refresh before verifying.');
    if (details.includes('MARK_NOT_FOUND')) throw httpError(404, 'No published marks exist for this student.');
    if (details.includes('ALREADY_VERIFIED')) throw httpError(409, 'This score revision is already verified.');
    if (details.includes('IDENTITY_SNAPSHOT_MISMATCH')) throw httpError(409, 'Student identity or roll number does not match the original OMR scan. Reconcile records before verification.');
    if (details.includes('SUPER_ADMIN_REQUIRED')) throw httpError(403, 'An active Super Admin is required to verify marks.');
    if (details.includes('INVALID_VERIFICATION_EVIDENCE')) throw httpError(400, 'Verification requires evidence, a detailed reason and explicit review of identity, paper version and class.');
    throw error;
  }
}

export async function getProvisionalMarkCorrectionHistory(studentId: string): Promise<ProvisionalMarkCorrectionHistoryItem[]> {
  return prisma.$queryRaw<ProvisionalMarkCorrectionHistoryItem[]>`
    SELECT id, "originalScannedMarks", "previousEffectiveMarks", "newEffectiveMarks",
      reason, "actorName", "occurredAt"
    FROM public."OmrProvisionalMarkCorrectionAudit"
    WHERE "studentId"=${studentId} AND "sessionReference"='2026-V'
    ORDER BY "occurredAt" DESC, id DESC LIMIT 50
  `;
}
