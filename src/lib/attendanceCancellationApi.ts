import { apiFetch } from './apiClient';

export interface CancellationImpact {
  expectedCount: number;
  markedCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  qrCount: number;
  manualCount: number;
  scoredOrRankedCandidates: number;
  feeReferences: number;
  feeTransactions: number;
  documentReferences: number;
  documentAuditReferences: number;
  externalOmrOrResults: 'UNKNOWN';
}
export interface CancellationPreview {
  challenge: string;
  expiresAt: string;
  purgeAttendance: boolean;
  session: {
    id: string;
    examHallId: string;
    hallName: string;
    roomNumber: string;
    examDate: string;
    businessDate: string;
    attemptNumber: number;
    status: 'OPEN' | 'CLOSED';
  };
  impact: CancellationImpact;
  blockers: string[];
}
export interface CancellationResult {
  cancellationReference: string;
  sessionId: string;
  previousStatus: 'OPEN' | 'CLOSED';
  status: 'CANCELLED';
  cancelledAt: string;
  purgeAttendance: boolean;
  deletedCount: number;
  retainedCount: number;
  expectedCount: number;
}
export interface CancellationConfirm {
  challenge: string;
  reason: string;
  confirmationText: 'CANCEL SESSION' | 'CANCEL SESSION AND DELETE ATTENDANCE';
  approvalReference?: string;
  retentionApproved?: boolean;
  externalDispositionAttested?: boolean;
  irreversibleDeletionAcknowledged?: boolean;
  closedEvidenceApproved?: boolean;
}
export interface CancellationHistory {
  operations: {
    id: string;
    sessionId: string;
    actorName: string;
    reason: string;
    approvalReference: string | null;
    previousStatus: 'OPEN' | 'CLOSED';
    businessDate: string;
    purgeAttendance: boolean;
    markedCount: number;
    deletedCount: number;
    retainedCount: number;
    expectedCount: number;
    cancelledAt: string;
  }[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
const nonempty = (s: unknown): s is string => typeof s === 'string' && !!s.trim();
const integer = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && /^\d{4}-\d\d-\d\dT/.test(value);
const fields = [
  'expectedCount', 'markedCount', 'presentCount', 'lateCount', 'absentCount',
  'qrCount', 'manualCount', 'scoredOrRankedCandidates',
  'feeReferences', 'feeTransactions', 'documentReferences', 'documentAuditReferences',
] as const;
function validImpact(value: any): value is CancellationImpact {
  return !!value && fields.every(key => integer(value[key])) &&
    value.markedCount === value.presentCount + value.lateCount + value.absentCount &&
    value.markedCount === value.qrCount + value.manualCount &&
    value.markedCount <= value.expectedCount &&
    value.scoredOrRankedCandidates <= value.expectedCount &&
    value.externalOmrOrResults === 'UNKNOWN';
}
function validResult(value: any): value is CancellationResult {
  return !!value && nonempty(value.cancellationReference) && nonempty(value.sessionId) &&
    ['OPEN','CLOSED'].includes(value.previousStatus) && value.status === 'CANCELLED' &&
    timestamp(value.cancelledAt) && typeof value.purgeAttendance === 'boolean' &&
    integer(value.deletedCount) && integer(value.retainedCount) && integer(value.expectedCount) &&
    value.deletedCount + value.retainedCount <= value.expectedCount &&
    (!value.purgeAttendance || value.retainedCount === 0);
}
export const attendanceCancellationApi = {
  async preview(sessionId: string, purgeAttendance: boolean): Promise<CancellationPreview> {
    const result = await apiFetch<CancellationPreview>(
      '/api/attendance/sessions/' + encodeURIComponent(sessionId) + '/cancel/preview',
      { method: 'POST', body: JSON.stringify({ purgeAttendance }) },
    );
    if (!result || !nonempty(result.challenge) || !timestamp(result.expiresAt) ||
      result.purgeAttendance !== purgeAttendance || !result.session ||
      result.session.id !== sessionId || !nonempty(result.session.examHallId) ||
      !nonempty(result.session.hallName) || !nonempty(result.session.roomNumber) ||
      !nonempty(result.session.businessDate) || !nonempty(result.session.examDate) ||
      !integer(result.session.attemptNumber) || result.session.attemptNumber < 1 ||
      !['OPEN','CLOSED'].includes(result.session.status) || !validImpact(result.impact) ||
      !Array.isArray(result.blockers) || result.blockers.some(x => !nonempty(x)))
      throw new Error('The server did not confirm a valid, session-specific cancellation impact preview.');
    return result;
  },
  async confirm(sessionId: string, input: CancellationConfirm, idempotencyKey: string): Promise<CancellationResult> {
    const result = await apiFetch<CancellationResult>(
      '/api/attendance/sessions/' + encodeURIComponent(sessionId) + '/cancel/confirm',
      { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(input), retryOnColdStart: false },
    );
    if (!validResult(result) || result.sessionId !== sessionId)
      throw new Error('Cancellation outcome was not confirmed. Retry the same confirmation to check its result.');
    return result;
  },
  async history(page = 1): Promise<CancellationHistory> {
    const result = await apiFetch<CancellationHistory>(
      '/api/attendance/cancellations/history?page=' + page + '&limit=10',
    );
    const p = result?.pagination;
    if (!Array.isArray(result?.operations) || !p || p.page !== page || p.limit !== 10 ||
      !integer(p.total) || !integer(p.totalPages) || p.totalPages !== Math.ceil(p.total / p.limit) ||
      result.operations.length > p.limit || result.operations.some(op =>
        !op || !nonempty(op.id) || !nonempty(op.sessionId) || !nonempty(op.actorName) ||
        !nonempty(op.reason) || !['OPEN','CLOSED'].includes(op.previousStatus) ||
        !timestamp(op.cancelledAt) || typeof op.purgeAttendance !== 'boolean' ||
        !integer(op.deletedCount) || !integer(op.markedCount) || !integer(op.expectedCount) ||
        op.deletedCount > op.markedCount || !integer(op.retainedCount)))
      throw new Error('The cancellation audit history response is unavailable.');
    return result;
  },
};
