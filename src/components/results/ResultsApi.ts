import { apiFetch } from '../../lib/apiClient';

export interface ResultsSessionOption {
  id: string;
  businessDate: string;
  examDate: string;
  hallName: string;
  roomNumber: string;
  testCenterName: string | null;
  sessionStatus: string;
  attemptNumber: number;
  isCurrent: boolean;
  recordCount: number;
  legacyScoreCount: number;
  rosterCount: number;
}

export interface BackendStudentResult {
  id: string;
  rollNumber: string | null;
  studentName: string;
  className: string;
  legacyScore: number | null;
  legacyRank: number | null;
  percentage: null;
  maximumMarks: null;
  questionCounts: null;
  resultReference: null;
  status: 'LEGACY_UNVERIFIED';
}

export interface BackendResultsPage {
  sessionId: string;
  verificationStatus: 'UNVERIFIED';
  publicationEnabled: false;
  classOptions: string[];
  results: BackendStudentResult[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface BackendResultsQuery {
  page: number;
  limit: number;
  search: string;
  className: string;
  minimumScore: string;
  maximumScore: string;
  scoreAvailability: 'all' | 'with-score' | 'without-score';
  sortBy: 'rollNumber' | 'studentName' | 'className' | 'legacyScore';
  sortOrder: 'asc' | 'desc';
}

export function getResultsSessions() {
  return apiFetch<ResultsSessionOption[]>('/api/results/admin/sessions');
}

export function getSessionResults(sessionId: string, options: BackendResultsQuery, requestOptions?: RequestInit) {
  const params = new URLSearchParams({ page: String(options.page), limit: String(options.limit) });
  if (options.search.trim()) params.set('search', options.search.trim());
  if (options.className) params.set('className', options.className);
  if (options.minimumScore) params.set('minimumScore', options.minimumScore);
  if (options.maximumScore) params.set('maximumScore', options.maximumScore);
  if (options.scoreAvailability !== 'all') params.set('scoreAvailability', options.scoreAvailability);
  params.set('sortBy', options.sortBy);
  params.set('sortOrder', options.sortOrder);
  return apiFetch<BackendResultsPage>(`/api/results/admin/sessions/${encodeURIComponent(sessionId)}/results?${params.toString()}`, requestOptions);
}
