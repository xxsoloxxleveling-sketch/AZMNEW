import { apiFetch } from './apiClient';

export type ResetMode = 'HALL' | 'EXAM_DATE' | 'CURRENT';
export interface ResetScope { mode: ResetMode; businessDate: string; sessionIds: string[]; testCenterId?: string }
export interface ResetCounts { expectedCount: number; markedCount: number; presentCount: number; lateCount: number; absentCount: number; qrCount: number; manualCount: number }
export interface ResetHall extends ResetCounts { sessionId: string; examHallId: string; hallName: string; roomNumber: string; testCenterName: string | null; businessDate: string; attemptNumber: number; status: string; staffActivity: string; lastMarkAt: string | null }
export interface ResetPreview { challenge: string; expiresAt: string; scope: ResetScope; halls: ResetHall[]; totals: ResetCounts }
export interface ResetResult { resetReference: string; completedAt: string; attempts: { previousSessionId: string; newSessionId: string; examHallId: string; hallName: string; attemptNumber: number; expectedCount: number }[]; affectedCandidates: number; status: 'COMPLETED' }
export interface ResetHistory { operations: { id: string; completedAt: string; actorName: string; reason: string; mode: ResetMode; businessDate: string; affectedCandidates: number; result: ResetResult }[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const countKeys = ['expectedCount', 'markedCount', 'presentCount', 'lateCount', 'absentCount', 'qrCount', 'manualCount'] as const;
const counts = (value: any) => value && countKeys.every(key => Number.isSafeInteger(value[key]) && value[key] >= 0) && value.markedCount === value.presentCount + value.lateCount + value.absentCount && value.markedCount === value.qrCount + value.manualCount && value.markedCount <= value.expectedCount;
const validResult = (result: any): result is ResetResult => !!result && nonempty(result.resetReference) && result.status === 'COMPLETED' && Number.isSafeInteger(result.affectedCandidates) && result.affectedCandidates >= 0 && timestamp(result.completedAt) && Array.isArray(result.attempts) && result.attempts.length > 0 && result.attempts.every((item: any) => item && nonempty(item.examHallId) && nonempty(item.hallName) && nonempty(item.previousSessionId) && nonempty(item.newSessionId) && item.previousSessionId !== item.newSessionId && Number.isSafeInteger(item.attemptNumber) && item.attemptNumber >= 2 && Number.isSafeInteger(item.expectedCount) && item.expectedCount >= 0) && new Set(result.attempts.map((item: any) => item.previousSessionId)).size === result.attempts.length && new Set(result.attempts.map((item: any) => item.newSessionId)).size === result.attempts.length && !result.attempts.some((item: any) => result.attempts.some((other: any) => item.newSessionId === other.previousSessionId)) && result.affectedCandidates === result.attempts.reduce((sum: number, item: any) => sum + item.expectedCount, 0);
export const attendanceResetApi = {
  async preview(scope: ResetScope): Promise<ResetPreview> {
    const result = await apiFetch<ResetPreview>('/api/attendance/reset/preview', { method: 'POST', body: JSON.stringify(scope) });
    if (!nonempty(result?.challenge) || !result.scope || !Array.isArray(result.scope.sessionIds) || result.scope.mode !== scope.mode || !validDate(result.scope.businessDate) || result.scope.businessDate !== scope.businessDate || result.scope.testCenterId !== scope.testCenterId || !timestamp(result.expiresAt) || !Array.isArray(result.halls) || !result.halls.length || !counts(result.totals) || result.halls.some(hall => !hall || !(hall.testCenterName === null || typeof hall.testCenterName === 'string') || !nonempty(hall.sessionId) || !nonempty(hall.examHallId) || !nonempty(hall.hallName) || !nonempty(hall.roomNumber) || !validDate(hall.businessDate) || hall.businessDate !== scope.businessDate || !Number.isInteger(hall.attemptNumber) || hall.attemptNumber < 1 || hall.status !== 'OPEN' || hall.staffActivity !== 'UNKNOWN' || !(hall.lastMarkAt === null || timestamp(hall.lastMarkAt)) || !counts(hall))) throw new Error('The server did not confirm a valid reset impact preview.');
    if (result.halls.length !== scope.sessionIds.length || new Set(result.halls.map(hall => hall.examHallId)).size !== result.halls.length || new Set(result.halls.map(hall => hall.sessionId)).size !== scope.sessionIds.length || result.halls.some(hall => !scope.sessionIds.includes(hall.sessionId))) throw new Error('The reset preview does not match the selected attendance attempts.');
    if (result.scope.sessionIds.length !== scope.sessionIds.length || new Set(result.scope.sessionIds).size !== scope.sessionIds.length || result.scope.sessionIds.some(id => !scope.sessionIds.includes(id)) || countKeys.some(key => (result.totals as any)[key] !== result.halls.reduce((sum, hall) => sum + (hall as any)[key], 0))) throw new Error('The reset impact totals are inconsistent.');
    return result;
  },
  async confirm(challenge: string, reason: string, confirmationText: string, key: string): Promise<ResetResult> {
    const result = await apiFetch<ResetResult>('/api/attendance/reset/confirm', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ challenge, reason, confirmationText }), retryOnColdStart: false });
    if (!validResult(result)) throw new Error('The server response did not confirm the reset. Retry this confirmation to check its outcome.');
    return result;
  },
  async history(page: number): Promise<ResetHistory> {
    const result = await apiFetch<ResetHistory>(`/api/attendance/reset/history?page=${page}&limit=10`);
    const pagination = result?.pagination;
    if (!Array.isArray(result?.operations) || !pagination || !Number.isSafeInteger(pagination.total) || pagination.total < 0 || !Number.isSafeInteger(pagination.page) || pagination.page !== page || !Number.isSafeInteger(pagination.limit) || pagination.limit !== 10 || !Number.isSafeInteger(pagination.totalPages) || pagination.totalPages !== Math.ceil(pagination.total / pagination.limit) || result.operations.length > pagination.limit || result.operations.length > pagination.total || new Set(result.operations.map(event => event?.id)).size !== result.operations.length || result.operations.some(event => !event || !nonempty(event.id) || !nonempty(event.actorName) || !nonempty(event.reason) || !['HALL', 'EXAM_DATE', 'CURRENT'].includes(event.mode) || !validDate(event.businessDate) || !timestamp(event.completedAt) || !validResult(event.result) || event.id !== event.result.resetReference || event.affectedCandidates !== event.result.affectedCandidates)) throw new Error('The reset history response is unavailable.');
    return result;
  },
};
