import { apiFetch } from '../../../lib/apiClient';

export type ResultSession = {
  id: string;
  businessDate: string;
  examDate: string;
  hallName: string;
  roomNumber: string;
  testCenterName: string;
  sessionStatus: string;
  attemptNumber: number;
  isCurrent: boolean;
  rosterCount: number;
  legacyScoreCount: number;
};

export type InterviewRound = {
  id: string;
  sessionRef: string;
  title: string;
  eligibilityThreshold: number;
  maximumMarks: number;
  status: 'SETUP' | 'OPEN' | 'PUBLISHED' | 'FINALIZED';
  revision: number;
  createdAt: string;
  _count?: { halls: number; assignments: number };
};

export type InterviewOverview = {
  round: InterviewRound;
  totalQualifiedCandidates: number;
  allocatedCandidates: number;
  unassignedCandidates: number;
  pendingVerificationCandidates: number;
  lockedCandidates: number;
  activeHallCount: number;
  totalCapacity: number;
  remainingSeats: number;
  completionPercent: number;
  eligibilitySourceStatus: string;
};

export type InterviewHall = {
  id: string;
  roundId: string;
  name: string;
  roomNumber: string;
  venue: string | null;
  interviewDate: string | null;
  reportingTime: string | null;
  scheduleStartAt: string | null;
  scheduleEndAt: string | null;
  capacity: number;
  allowedClasses: string[];
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  assignedCount: number;
  lockedCount: number;
  availableCapacity: number;
};

export type InterviewCandidate = {
  id: string;
  applicationNo: string;
  rollNumber: string | null;
  studentName: string;
  className: string;
  groupName: string | null;
  schoolName: string | null;
  gender: string | null;
  finalApprovedMarks: number | null;
  resultVerificationStatus: 'QUALIFIED' | 'NOT_QUALIFIED' | 'PENDING_VERIFICATION' | 'EXCLUDED_PENDING_REVIEW';
  interviewHall: { id: string; name: string; roomNumber: string } | null;
  assignmentStatus: string;
  isLocked: boolean;
  assignmentId: string | null;
};

export type CandidateFilters = {
  search?: string;
  className?: string;
  gender?: string;
  schoolName?: string;
  hallId?: string;
  minimumMarks?: string;
  maximumMarks?: string;
  assignment?: 'all' | 'assigned' | 'unassigned';
  eligibility?: 'all' | 'qualified' | 'pending' | 'excluded';
  page?: number;
  limit?: number;
};

export type CandidatePage = {
  sessionRef: string;
  verificationStatus: string;
  results: InterviewCandidate[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type AllocationPreview = {
  roundId: string;
  revision: number;
  strategy: 'BALANCED' | 'SEQUENTIAL';
  totalQualifiedCandidates: number;
  alreadyAssignedCandidates: number;
  lockedCandidates: number;
  pendingVerificationCandidates: number;
  availableHallCapacity: number;
  toAllocateCount: number;
  assignments: Array<{ studentId: string; hallId: string; queueNumber: number }>;
  unallocatedStudentIds: string[];
  hallProjection: Array<{
    hallId: string;
    name: string;
    roomNumber: string;
    capacity: number;
    assigned: number;
    locked: number;
    projected: number;
    remaining: number;
  }>;
  planHash: string;
  eligibilitySourceStatus: string;
};

export type AuditPage = {
  rows: Array<{
    id: string;
    action: string;
    actor: { name: string; role: string };
    hallId: string | null;
    studentId: string | null;
    reason: string | null;
    details: Record<string, unknown> | null;
    occurredAt: string;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const json = (method: string, body?: unknown, headers?: Record<string, string>) => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  ...(headers ? { headers } : {}),
  retryOnColdStart: false,
});

const root = (roundId: string) => '/api/interviews/' + encodeURIComponent(roundId);

export const interviewApi = {
  sessions: () => apiFetch<ResultSession[]>('/api/results/admin/sessions'),
  rounds: () => apiFetch<InterviewRound[]>('/api/interviews/rounds'),
  createRound: (body: { sessionRef: string; title: string; eligibilityThreshold: number; maximumMarks: 100 }) =>
    apiFetch<InterviewRound>('/api/interviews/rounds', json('POST', body)),
  overview: (roundId: string) => apiFetch<InterviewOverview>(root(roundId) + '/overview'),
  candidates: (roundId: string, filters: CandidateFilters) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    return apiFetch<CandidatePage>(root(roundId) + '/candidates?' + params.toString());
  },
  halls: (roundId: string) => apiFetch<InterviewHall[]>(root(roundId) + '/halls'),
  createHall: (roundId: string, body: Record<string, unknown>) =>
    apiFetch<InterviewHall>(root(roundId) + '/halls', json('POST', body)),
  updateHall: (hallId: string, body: Record<string, unknown>) =>
    apiFetch<InterviewHall>('/api/interviews/halls/' + encodeURIComponent(hallId), json('PATCH', body)),
  assign: (roundId: string, body: { hallId: string; studentIds: string[]; isLocked: boolean; reason?: string }) =>
    apiFetch(root(roundId) + '/assignments', json('POST', body)),
  move: (assignmentId: string, body: { hallId: string; reason?: string; override?: boolean }) =>
    apiFetch('/api/interviews/assignments/' + encodeURIComponent(assignmentId), json('PATCH', body)),
  lock: (assignmentId: string, reason?: string, override = false) =>
    apiFetch('/api/interviews/assignments/' + encodeURIComponent(assignmentId) + '/lock', json('POST', { reason, override })),
  unlock: (assignmentId: string, reason: string, override = false) =>
    apiFetch('/api/interviews/assignments/' + encodeURIComponent(assignmentId) + '/unlock', json('POST', { reason, override })),
  remove: (assignmentId: string, reason: string, override = false) =>
    apiFetch('/api/interviews/assignments/' + encodeURIComponent(assignmentId), json('DELETE', { reason, override })),
  preview: (roundId: string, strategy: 'BALANCED' | 'SEQUENTIAL') =>
    apiFetch<AllocationPreview>(root(roundId) + '/auto-allocate/preview', json('POST', { strategy })),
  commit: (roundId: string, body: {
    strategy: 'BALANCED' | 'SEQUENTIAL';
    expectedRevision: number;
    planHash: string;
    idempotencyKey: string;
    allowPartial: boolean;
  }) => apiFetch<{ createdCount: number; unallocatedCount: number; idempotentReplay: boolean }>(
    root(roundId) + '/auto-allocate/commit', json('POST', body),
  ),
  publish: (roundId: string) => apiFetch<InterviewRound>(
    '/api/interviews/rounds/' + encodeURIComponent(roundId) + '/publish', json('POST', {}),
  ),
  finalize: (roundId: string, reason: string) => apiFetch<InterviewRound>(
    '/api/interviews/rounds/' + encodeURIComponent(roundId) + '/finalize', json('POST', { reason }),
  ),
  audit: (roundId: string, page = 1, limit = 25) => apiFetch<AuditPage>(
    '/api/interviews/rounds/' + encodeURIComponent(roundId) + '/audit?page=' + page + '&limit=' + limit,
  ),
};
