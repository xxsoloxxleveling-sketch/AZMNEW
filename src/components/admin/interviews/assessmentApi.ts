import { apiFetch } from '../../../lib/apiClient';

export type PanelMember = { id: string; name: string; position: 1 | 2 | 3 };
export type AssessmentPanel = { id: string; panel: number; revision: number; members: PanelMember[] };
export type AssessmentAttendance = 'UNKNOWN' | 'PRESENT' | 'ABSENT';
export type WrittenMarkSource = {
  marks: number | null;
  maximumMarks: number;
  isFinal: boolean;
  sourceType: string | null;
  reference: string | null;
  revision: string | null;
  status: string;
};
export type AssessmentTotals = {
  written: number | null;
  interview: number | null;
  extracurricular: number | null;
  academic: number | null;
  personality: number | null;
  total: number | null;
};
export type MemberScore = { memberId: string; interview: number | null; personality: number | null };
export type CandidateAssessment = {
  id: string;
  revision: number;
  status: 'DRAFT' | 'SUBMITTED';
  attendance: AssessmentAttendance;
  panelRevision: number;
  members: PanelMember[];
  scores: MemberScore[];
  extracurricular: number | null;
  extracurricularEvidence: string;
  extracurricularReviewed: boolean;
  academic: number | null;
  academicEvidence: string;
  academicReviewed: boolean;
  notes: string;
  reason?: string | null;
  actorName: string;
  createdAt: string;
  written: WrittenMarkSource;
  totals: AssessmentTotals;
  issues: string[];
};
export type AssessmentRosterRow = {
  placementId: string;
  studentId: string;
  rollNumber: string | null;
  studentName: string;
  className: string;
  panel: number;
  batch: number;
  sequence: number;
  slotTime: string;
  printedMarks: number;
  written: WrittenMarkSource;
  assessment: CandidateAssessment | null;
};
export type CandidateAssessmentDetail = AssessmentRosterRow & {
  panelConfiguration: AssessmentPanel | null;
  hasSubmittedAssessment: boolean;
};
export type AssessmentRoster = {
  roundId: string;
  policyVersion: string;
  panels: AssessmentPanel[];
  panelOptions: number[];
  batchOptions: number[];
  classOptions: string[];
  rows: AssessmentRosterRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
export type AssessmentFilters = {
  panel?: number;
  batch?: number;
  search?: string;
  className?: string;
  page?: number;
  limit?: number;
};
export type SaveAssessmentInput = {
  expectedRevision: number;
  panelRevision: number;
  attendance: AssessmentAttendance;
  scores: MemberScore[];
  extracurricular: number | null;
  extracurricularEvidence: string;
  extracurricularReviewed: boolean;
  academic: number | null;
  academicEvidence: string;
  academicReviewed: boolean;
  notes: string;
  reason?: string;
};
export type MeritAwardCode = 'UMRAH_TICKET' | 'LAPTOP' | 'FULL_YEAR_SCHOLARSHIP' | 'PARTIAL_SCHOLARSHIP'
  | 'EDUCATIONAL_VOUCHER' | 'CASH_PRIZE_3000' | 'CASH_PRIZE_5000';
export type MeritAward = {
  id: string | null;
  revision: number;
  awardCode: MeritAwardCode | null;
  actorName: string | null;
  createdAt: string | null;
};
export type MeritPreviewRow = Pick<AssessmentRosterRow, 'placementId' | 'studentId' | 'rollNumber' | 'studentName' | 'className' | 'panel' | 'batch' | 'written'> & {
  /** Current registration details; optional while older API releases are in use. */
  fatherName?: string;
  institute?: string;
  /** Stored registration category, not a calculated scholarship award. */
  scholarshipCategory?: string;
  /** An administrator's saved award decision, independent of marks and registration category. */
  meritAward?: MeritAward;
  rank: number | null;
  /** Exact competition rank across the whole round, before display filters. */
  overallRank?: number | null;
  status: 'READY' | 'INCOMPLETE' | 'ABSENT' | 'SOURCE_CHANGED';
  assessmentStatus: 'DRAFT' | 'SUBMITTED' | 'NOT_STARTED';
  issues: string[];
  totals: AssessmentTotals;
};
export type MeritPreview = {
  provisional: true;
  publicationEnabled: false;
  policyVersion: string;
  rankMethod: 'SHARED_COMPETITION_WITHIN_CLASS';
  overallRankMethod?: 'SHARED_COMPETITION_ALL_CLASSES';
  overallRankedCandidates?: number;
  manualAwardsEnabled?: boolean;
  rows: MeritPreviewRow[];
  summary: { total: number; ready: number; incomplete: number; absent: number };
  classOptions: string[];
};

const root = (roundId: string) => '/api/interviews/' + encodeURIComponent(roundId) + '/assessment';
const query = (filters: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
};
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body), retryOnColdStart: false });

export const assessmentApi = {
  roster: (roundId: string, filters: AssessmentFilters = {}) =>
    apiFetch<AssessmentRoster>(root(roundId) + '/roster?' + query(filters)),
  panels: (roundId: string) => apiFetch<AssessmentPanel[]>(root(roundId) + '/panels'),
  savePanel: (roundId: string, panel: number, body: { expectedRevision: number; members: Array<{ name: string }>; reason: string }) =>
    apiFetch<AssessmentPanel>(root(roundId) + '/panels/' + panel, json('PUT', body)),
  candidate: (roundId: string, placementId: string) =>
    apiFetch<CandidateAssessmentDetail>(root(roundId) + '/candidates/' + encodeURIComponent(placementId)),
  history: (roundId: string, placementId: string) =>
    apiFetch<CandidateAssessment[]>(root(roundId) + '/candidates/' + encodeURIComponent(placementId) + '/history'),
  save: (roundId: string, placementId: string, body: SaveAssessmentInput & { idempotencyKey: string }) =>
    apiFetch<CandidateAssessment>(root(roundId) + '/candidates/' + encodeURIComponent(placementId) + '/save', json('POST', body)),
  submit: (roundId: string, placementId: string, body: SaveAssessmentInput & { idempotencyKey: string }) =>
    apiFetch<CandidateAssessment>(root(roundId) + '/candidates/' + encodeURIComponent(placementId) + '/submit', json('POST', body)),
  merit: (roundId: string, className = '') =>
    apiFetch<MeritPreview>(root(roundId) + '/merit?' + query({ className })),
  saveMeritAward: (roundId: string, placementId: string, body: {
    expectedRevision: number; idempotencyKey: string; awardCode: MeritAwardCode | null;
  }) => apiFetch<MeritAward>(root(roundId) + '/candidates/' + encodeURIComponent(placementId) + '/merit-award', json('PUT', body)),
};
