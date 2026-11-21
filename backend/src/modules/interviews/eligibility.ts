export type ApprovedResultSource = {
  marks: number;
  maximumMarks: number;
  verificationStatus: string;
  isFinal: boolean;
  reference: string;
  revision: string;
  sourceType?: 'VERIFIED_OMR' | 'VERIFIED_MANUAL' | 'OFFICIAL_RESULT';
};

export type InterviewEligibility =
  | { status: 'QUALIFIED'; approvedMarks: number; sourceReference: string; sourceRevision: string }
  | { status: 'NOT_QUALIFIED'; approvedMarks: number; sourceReference: string; sourceRevision: string }
  | { status: 'PENDING_VERIFICATION'; reason: 'NO_FINAL_RESULT' | 'NOT_VERIFIED' | 'UNSUPPORTED_SCALE' | 'INVALID_SCORE' | 'PASS_MARKS_FIXED' }
  | { status: 'EXCLUDED_PENDING_REVIEW'; reason: 'WITHHELD' | 'DUPLICATE_OFFICIAL_RESULTS' | 'CONFLICTING_FINAL_SOURCES' };

export const SESSION_V_CAMPAIGN_REF = '2026-V';
export const SESSION_V_PASS_MARKS = 60;

function numeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    const parsed = Number(value.toNumber());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Reads only the current, attempt-bound, verified and published ExaminationResult record. */
export function getAuthoritativeApprovedResult(value: unknown): ApprovedResultSource | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, any>;
  const exam = row.examination;
  if (!exam || typeof exam !== 'object') return null;

  if ([row.verificationStatus, row.publicationStatus, exam.publicationStatus].includes('WITHHELD')) {
    return {
      marks: 0, maximumMarks: 100, verificationStatus: 'WITHHELD', isFinal: false,
      reference: String(row.resultReference ?? row.id ?? 'withheld'), revision: String(row.resultRevision ?? 'unknown'),
      sourceType: 'OFFICIAL_RESULT',
    };
  }

  const marks = numeric(row.obtainedMarks);
  const maximumMarks = numeric(row.maximumMarks);
  const examMaximumMarks = numeric(exam.maximumMarks);
  const resultRevision = Number(row.resultRevision);
  const latestCorrection = Array.isArray(row.corrections) ? row.corrections[0] : undefined;
  const currentAttendance = row.attendanceSession;
  const binding = row.attemptBinding;
  const hasCorrectionMismatch = latestCorrection && (
    Number(latestCorrection.newRevision) !== resultRevision
    || Number(latestCorrection.previousRevision) !== resultRevision - 1
  );
  const correctedWithoutAudit = resultRevision > 1 && !latestCorrection;
  const registeredPaper = typeof row.paperVersion === 'string' && row.paperVersion.length > 0
    && Array.isArray(exam.paperKeyRevisions)
    && exam.paperKeyRevisions.some((item: any) => String(item.paperVersion).toUpperCase() === row.paperVersion.toUpperCase());

  if (exam.sessionReference !== SESSION_V_CAMPAIGN_REF
    || exam.publicationStatus !== 'PUBLISHED'
    || row.publicationStatus !== 'PUBLISHED'
    || row.verificationStatus !== 'VERIFIED'
    || row.scoringStatus !== 'VERIFIED'
    || row.identityStatus !== 'VERIFIED'
    || !row.verifiedAt || !row.verifiedById || !row.publishedAt || !row.publishedById
    || !exam.publishedAt || !exam.publishedById
    || marks === null || maximumMarks !== 100 || examMaximumMarks !== 100
    || !Number.isInteger(marks) || marks < 0 || marks > 100
    || row.uncertainCount !== 0
    || !row.attendanceSessionId || currentAttendance?.id !== row.attendanceSessionId
    || currentAttendance?.isCurrent !== true || currentAttendance?.status === 'CANCELLED'
    || binding?.sessionId !== row.attendanceSessionId || binding?.studentId !== row.studentId
    || !registeredPaper || !Number.isInteger(resultRevision) || resultRevision < 1
    || hasCorrectionMismatch || correctedWithoutAudit) return null;

  const reference = typeof row.resultReference === 'string' && row.resultReference.trim() ? row.resultReference : '';
  if (!reference) return null;
  return {
    marks,
    maximumMarks,
    verificationStatus: row.verificationStatus,
    isFinal: true,
    reference,
    revision: `${row.id}:r${resultRevision}:e${Number(exam.revision) || 1}`,
    sourceType: 'OFFICIAL_RESULT',
  };
}

export function resolveInterviewResultRecords(records: unknown[]): {
  result: ApprovedResultSource | null;
  eligibility: InterviewEligibility;
} {
  const mapped = records.map(record => ({ record, approved: getAuthoritativeApprovedResult(record) }));
  const approved = mapped.filter(item => item.approved?.isFinal).map(item => item.approved as ApprovedResultSource);
  if (approved.length > 1) {
    return { result: null, eligibility: { status: 'EXCLUDED_PENDING_REVIEW', reason: 'DUPLICATE_OFFICIAL_RESULTS' } };
  }
  if (approved.length === 1) {
    const result = approved[0];
    return { result, eligibility: assessInterviewEligibility(result) };
  }
  if (mapped.some(item => item.approved?.verificationStatus === 'WITHHELD')) {
    return {
      result: mapped.find(item => item.approved?.verificationStatus === 'WITHHELD')!.approved,
      eligibility: { status: 'EXCLUDED_PENDING_REVIEW', reason: 'WITHHELD' },
    };
  }
  return { result: null, eligibility: { status: 'PENDING_VERIFICATION', reason: records.length ? 'NOT_VERIFIED' : 'NO_FINAL_RESULT' } };
}

export function assessInterviewEligibility(
  result: ApprovedResultSource | null,
  threshold = 60,
  expectedMaximumMarks = 100,
): InterviewEligibility {
  if (!result) return { status: 'PENDING_VERIFICATION', reason: 'NO_FINAL_RESULT' };

  const status = result.verificationStatus.toUpperCase();
  if (status === 'WITHHELD') {
    return { status: 'EXCLUDED_PENDING_REVIEW', reason: 'WITHHELD' };
  }
  if (!result.isFinal || status !== 'VERIFIED') {
    return { status: 'PENDING_VERIFICATION', reason: 'NOT_VERIFIED' };
  }
  if (threshold !== SESSION_V_PASS_MARKS) {
    return { status: 'PENDING_VERIFICATION', reason: 'PASS_MARKS_FIXED' };
  }
  if (result.maximumMarks !== expectedMaximumMarks || expectedMaximumMarks !== 100) {
    return { status: 'PENDING_VERIFICATION', reason: 'UNSUPPORTED_SCALE' };
  }
  if (!Number.isInteger(result.marks) || result.marks < 0 || result.marks > expectedMaximumMarks) {
    return { status: 'PENDING_VERIFICATION', reason: 'INVALID_SCORE' };
  }

  const base = {
    approvedMarks: result.marks,
    sourceReference: result.reference,
    sourceRevision: result.revision,
  };
  return result.marks >= threshold
    ? { status: 'QUALIFIED', ...base }
    : { status: 'NOT_QUALIFIED', ...base };
}
