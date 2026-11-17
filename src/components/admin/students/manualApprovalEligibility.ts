import type { MockStudent } from '../../../lib/mockApi';

type ManualApprovalCandidate = Pick<MockStudent, 'manualExamMark' | 'provisionalOmr' | 'testScore'>;

/** Only a real, pending manual mark can enter the independent review flow. */
export function hasPendingManualApproval(student: ManualApprovalCandidate): boolean {
  return Boolean(
    student.manualExamMark && !student.manualExamMark.verified &&
    !student.provisionalOmr &&
    typeof student.testScore === 'number' &&
    Number.isInteger(student.testScore) &&
    student.testScore >= 0 && student.testScore <= 100,
  );
}

/** Approval controls are available exclusively to Super Admin accounts. */
export function canApproveManualMark(
  role: string | null | undefined, student: ManualApprovalCandidate,
): boolean {
  return role === 'SUPER_ADMIN' && hasPendingManualApproval(student);
}

/** Previously approved as well as pending manual scores may be corrected.
 * The source must be manual and the score must be a valid whole number. */
export function hasManualMarksForCorrection(student: ManualApprovalCandidate): boolean {
  return Boolean(
    student.manualExamMark && !student.provisionalOmr &&
    typeof student.testScore === 'number' && Number.isInteger(student.testScore) &&
    student.testScore >= 0 && student.testScore <= 100,
  );
}

export function canCorrectManualMark(
  role: string | null | undefined, student: ManualApprovalCandidate,
): boolean {
  return role === 'SUPER_ADMIN' && hasManualMarksForCorrection(student);
}
