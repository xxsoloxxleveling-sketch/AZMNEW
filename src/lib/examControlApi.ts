import { apiFetch } from './apiClient';
export type ControlAction = 'RESET' | 'DELETE' | 'FREEZE' | 'UNFREEZE' | 'MAP_RESULTS';
export interface ControlScope {
    action: ControlAction;
    testCenterId: string;
    businessDate: string;
    sessionIds: string[];
    entireLineage: boolean;
    clearAllocations: boolean;
    unfreeze: boolean;
    replace: boolean;
    resultStudentIds?: string[];
    ownershipEvidence?: string;
    moveStudentId?: string;
    destinationHallId?: string;
}
export interface Attempt {
    id: string;
    examHallId: string;
    attemptNumber: number;
    isCurrent: boolean;
    status: 'PRE_OPEN' | 'OPEN' | 'CLOSED' | 'CANCELLED';
    revision: number;
    expected: number;
    marked: number;
    present: number;
    late: number;
    absent: number;
}
export interface ControlCurrent {
    legacyResults: {
        id: string;
        fullName: string;
        score: number | null;
        rank: number | null;
        sessionIds: string[];
    }[];
    movableStudents: {
        id: string;
        fullName: string;
        assignedHallId: string;
    }[];
    businessDate: string;
    testCenter: {
        id: string;
        name: string;
    };
    placement: {
        frozen: boolean;
        revision: number;
        changedBy: string | null;
        changedAt: string | null;
        reason: string | null;
    };
    halls: {
        id: string;
        name: string;
        roomNumber: string;
        configuredForDate: boolean;
        assignedCount: number;
        current: Attempt | null;
        attempts: Attempt[];
        canPrepare: boolean;
    }[];
}
export interface ControlPreview {
    move: {
        studentName: string;
        destinationHallName: string;
        destinationCenterName: string;
    } | null;
    scope: ControlScope;
    phrase: string;
    challenge: string;
    expiresAt: string;
    centerName: string;
    attempts: Attempt[];
    totals: {
        marks: number;
        rosterEntries: number;
        qr: number;
        manual: number;
        linkedResults: number;
        allocationsToClear: number;
    };
    placementAfter: string;
    unfreezeScope: {
        hallCount: number;
    } | null;
}
export interface ControlResult {
    operationId: string;
    status: 'COMPLETED';
    deletedMarks: number;
    deletedRosterEntries: number;
    clearedAllocations: number;
    replacements: {
        examHallId: string;
        newSessionId: string;
        attemptNumber: number;
        status: 'PRE_OPEN';
    }[];
    reprintRequired: boolean;
    completedAt: string;
}
export interface PendingControl {
    key: string;
    body: {
        challenge: string;
        reason: string;
        confirmationText: string;
    };
    scope: ControlScope;
}
export type ControlOperationStatus = ControlResult | {
    status: 'NOT_FOUND' | 'UNKNOWN';
    terminal: false;
} | {
    status: 'EXPIRED';
    terminal: true;
    expiresAt?: string;
};
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
function validatedResult(result: any): ControlResult {
    if (result?.status !== 'COMPLETED' || !nonempty(result.operationId) ||
        ![result.deletedMarks, result.deletedRosterEntries, result.clearedAllocations].every(count) ||
        typeof result.reprintRequired !== 'boolean' || !nonempty(result.completedAt) || !Number.isFinite(Date.parse(result.completedAt)) ||
        !Array.isArray(result.replacements) || result.replacements.some((attempt: any) =>
            !nonempty(attempt?.examHallId) || !nonempty(attempt.newSessionId) ||
            !Number.isSafeInteger(attempt.attemptNumber) || attempt.attemptNumber < 1 || attempt.status !== 'PRE_OPEN') ||
        new Set(result.replacements.map((attempt: any) => attempt.newSessionId)).size !== result.replacements.length) {
        throw new Error('Operation outcome unavailable. Check operation status before another action.');
    }
    return result;
}
export const examControlApi = {
    currentHall: (hallId: string) => apiFetch<{
        session: import('./mockApi').AttendanceSession | null;
        canPrepare: boolean;
        canOpen: boolean;
    }>(`/api/attendance/sessions/current-state/${encodeURIComponent(hallId)}`),
    current: (testCenterId: string, businessDate: string) => apiFetch<ControlCurrent>(`/api/attendance/control/current?${new URLSearchParams({ testCenterId, businessDate })}`),
    prepare: (examHallId: string) => apiFetch('/api/attendance/control/prepare', { method: 'POST', body: JSON.stringify({ examHallId }), retryOnColdStart: false }),
    preview: async (scope: ControlScope): Promise<ControlPreview> => {
        const preview = await apiFetch<ControlPreview>('/api/attendance/control/preview', { method: 'POST', body: JSON.stringify(scope) });
        if (!preview?.scope || !nonempty(preview.challenge) || !nonempty(preview.phrase) ||
            !nonempty(preview.expiresAt) || !Number.isFinite(Date.parse(preview.expiresAt)) ||
            ['action', 'testCenterId', 'businessDate', 'entireLineage', 'clearAllocations', 'unfreeze', 'replace', 'moveStudentId', 'destinationHallId']
                .some(field => preview.scope[field as keyof ControlScope] !== scope[field as keyof ControlScope]) ||
            !Array.isArray(preview.scope.sessionIds) || !Array.isArray(preview.attempts) ||
            !scope.sessionIds.every(id => preview.scope.sessionIds.includes(id)) ||
            (!scope.entireLineage && (preview.scope.sessionIds.length !== scope.sessionIds.length || preview.scope.sessionIds.some(id => !scope.sessionIds.includes(id)))) ||
            preview.attempts.length !== preview.scope.sessionIds.length || preview.attempts.some(attempt => !preview.scope.sessionIds.includes(attempt.id))) {
            throw new Error('The server returned a different impact scope. Review the current selection again.');
        }
        return preview;
    },
    confirm: async (pending: PendingControl) => {
        const result = await apiFetch<ControlResult>('/api/attendance/control/confirm', { method: 'POST', headers: { 'Idempotency-Key': pending.key }, body: JSON.stringify(pending.body), retryOnColdStart: false });
        return validatedResult(result);
    },
    operation: async (pending: PendingControl): Promise<ControlOperationStatus> => {
        const status = await apiFetch<ControlOperationStatus>(
            `/api/attendance/control/operations/${encodeURIComponent(pending.key)}/status`,
            { method: 'POST', body: JSON.stringify({ challenge: pending.body.challenge }), retryOnColdStart: false },
        );
        if (status?.status === 'COMPLETED') return validatedResult(status);
        if (status?.status === 'EXPIRED' && status.terminal === true) return status;
        if ((status?.status === 'NOT_FOUND' || status?.status === 'UNKNOWN') && status.terminal === false) return status;
        throw new Error('The operation status could not be verified. Keep the original request and check again.');
    },
    history: (testCenterId: string, businessDate: string, page: number) => apiFetch<{
        id: string;
        actorName: string;
        action: string;
        reason: string;
        scope: ControlScope;
        result: ControlResult;
        completedAt: string;
    }[]>(`/api/attendance/control/history?${new URLSearchParams({ testCenterId, businessDate, page: String(page) })}`),
};
