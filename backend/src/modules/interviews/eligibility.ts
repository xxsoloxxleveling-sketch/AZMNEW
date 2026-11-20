export type ApprovedResultSource = {
  marks: number;
  maximumMarks: number;
  verificationStatus: string;
  isFinal: boolean;
  reference: string;
  revision: string;
};

export type InterviewEligibility =
  | { status: 'QUALIFIED'; approvedMarks: number; sourceReference: string; sourceRevision: string }
  | { status: 'NOT_QUALIFIED'; approvedMarks: number; sourceReference: string; sourceRevision: string }
  | { status: 'PENDING_VERIFICATION'; reason: 'NO_FINAL_RESULT' | 'NOT_VERIFIED' | 'UNSUPPORTED_SCALE' | 'INVALID_SCORE' }
  | { status: 'EXCLUDED_PENDING_REVIEW'; reason: 'WITHHELD' };

const acceptedStatuses = new Set(['VERIFIED', 'APPROVED', 'FINAL_APPROVED']);

/**
 * Fail-closed adapter. The current Results API does not expose a verified,
 * corrected final result entity, so legacy Student.testScore is not read.
 */
export function getAuthoritativeApprovedResult(_student: unknown): ApprovedResultSource | null {
  return null;
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
  if (!result.isFinal || !acceptedStatuses.has(status)) {
    return { status: 'PENDING_VERIFICATION', reason: 'NOT_VERIFIED' };
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
