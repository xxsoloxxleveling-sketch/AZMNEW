import { apiDownloadPdf, apiFetch, apiFetchProtectedObjectUrl, apiOpenPdfForPrint } from '../../lib/apiClient';

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

export type OfficialIdentityStatus = 'PENDING' | 'VERIFIED' | 'MISMATCH';
export type OfficialScoringStatus = 'PROVISIONAL' | 'VERIFIED';
export type OfficialVerificationStatus = 'PENDING' | 'VERIFIED' | 'WITHHELD';
export type OfficialPublicationStatus = 'UNPUBLISHED' | 'PUBLISHED' | 'WITHHELD';
export type OfficialResponseClassification = 'CORRECT' | 'WRONG' | 'BLANK' | 'MULTIPLE' | 'UNCERTAIN';
export type OfficialResponseSource = 'OMR_DETECTED' | 'HUMAN_REVIEW' | 'ADMIN_CORRECTION' | 'MANUAL_ENTRY';
export type OfficialDocumentStatus = 'NONE' | 'ISSUED' | 'SUPERSEDED' | 'REVOKED';

export interface OfficialExaminationSummary {
  id: string;
  revision: number;
  reference: string;
  title: string;
  sessionReference: string;
  examDate: string | null;
  classGroup: string;
  maximumMarks: string;
  questionCount: number;
  paperVersions: string[];
  publicationStatus: 'DRAFT' | 'PUBLISHED' | 'WITHHELD';
}

export interface OfficialResultStudentSummary {
  id: string;
  fullName: string;
  rollNumber: string | null;
  applicationNo: string;
  classGroup: string;
}

export interface OfficialResultSummary {
  id: string;
  resultReference: string;
  studentId: string;
  examinationId: string;
  student: OfficialResultStudentSummary;
  examination: OfficialExaminationSummary;
  paperVersion: string | null;
  obtainedMarks: string | null;
  maximumMarks: string;
  correctCount: number | null;
  wrongCount: number | null;
  blankCount: number | null;
  multipleCount: number | null;
  uncertainCount: number | null;
  identityStatus: OfficialIdentityStatus;
  scoringStatus: OfficialScoringStatus;
  verificationStatus: OfficialVerificationStatus;
  publicationStatus: OfficialPublicationStatus;
  resultRevision: number;
  administrativelyAdjusted: boolean;
  administrativeAdjustmentReason: string | null;
  verifiedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: {
    electronicAvailable: boolean;
    latestOfficialIssuanceStatus: OfficialDocumentStatus;
    officialIssuanceCount: number;
  };
}

export interface OfficialResultQuestionResponse {
  questionNumber: number;
  detectedAnswer: string | null;
  reviewedAnswer: string | null;
  classification: OfficialResponseClassification;
  marksAwarded: string | null;
  responseSource: OfficialResponseSource;
}

export interface OfficialResultDetail extends OfficialResultSummary {
  sourceScanReference: string | null;
  responses: OfficialResultQuestionResponse[];
  administrativeRemarks: string | null;
}

export interface OfficialResultsPage {
  results: OfficialResultSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface OfficialExaminationOption {
  id: string;
  revision: number;
  reference: string;
  title: string;
  sessionReference: string;
  examDate: string | null;
  classGroup: string;
  questionCount: number;
  maximumMarks: string;
  paperVersions: string[];
  publicationStatus: 'DRAFT' | 'PUBLISHED' | 'WITHHELD';
}

export interface OfficialCorrectionAudit {
  id: string;
  resultId: string;
  studentId: string;
  examinationId: string;
  previousRevision: number;
  newRevision: number;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  reason: string;
  actorId: string;
  actorName: string;
  source: 'STUDENT_PROFILE' | 'RESULTS_DASHBOARD' | 'MANUAL_ENTRY';
  publicationImpact: string;
  occurredAt: string;
}

export interface OfficialDocumentIssuance {
  id: string;
  documentNumber: string;
  resultRevision: number;
  status: Exclude<OfficialDocumentStatus, 'NONE'>;
  issuedAt: string;
  issuer: string;
  verificationReference: string;
  reason: string | null;
}

export interface OfficialDmcIssueResult {
  id: string;
  documentNumber: string;
  resultRevision: number;
  issuedAt: string;
  status: 'ISSUED' | 'SUPERSEDED' | 'REVOKED';
}

export interface OfficialResultsQuery {
  page: number;
  limit: number;
  search?: string;
  classGroup?: string;
  examinationId?: string;
  status?: string;
}

export interface CreateOfficialExaminationInput {
  reference: string;
  title: string;
  sessionReference: string;
  examDate?: string | null;
  classGroup: string;
  maximumMarks: string;
  questionCount: number;
  paperKeyRevisions: Array<{ paperVersion: string; answerKeyRevision: string }>;
  scoringPolicy: {
    correctMarks: string;
    wrongMarks: string;
    blankMarks: string;
    multipleMarks: string;
    revision: string;
  };
}

export interface OfficialCorrectionInput {
  expectedRevision: number;
  reason: string;
  source: 'STUDENT_PROFILE' | 'RESULTS_DASHBOARD';
  changes: {
    paperVersion?: string | null;
    obtainedMarks?: string | null;
    identityStatus?: OfficialIdentityStatus;
    scoringStatus?: OfficialScoringStatus;
    verificationStatus?: OfficialVerificationStatus;
    publicationStatus?: OfficialPublicationStatus;
    administrativeRemarks?: string | null;
    responses?: Array<{
      questionNumber: number;
      detectedAnswer?: string | null;
      reviewedAnswer?: string | null;
      classification: OfficialResponseClassification;
    }>;
  };
}

export interface OfficialDmcPreparation {
  preparationId: string;
  expiresAt: string;
}

export interface OfficialExaminationPublicationInput {
  expectedRevision: number;
  action: 'PUBLISH' | 'WITHHOLD';
  reason: string;
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

export function getOfficialResults(query: OfficialResultsQuery, requestOptions?: RequestInit) {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.classGroup) params.set('classGroup', query.classGroup);
  if (query.examinationId) params.set('examinationId', query.examinationId);
  if (query.status) params.set('status', query.status);
  return apiFetch<OfficialResultsPage>(`/api/results/admin/results?${params.toString()}`, requestOptions);
}

export function getOfficialExaminations(requestOptions?: RequestInit) {
  return apiFetch<OfficialExaminationOption[]>('/api/results/admin/examinations', requestOptions);
}

export function createOfficialExamination(input: CreateOfficialExaminationInput) {
  return apiFetch<OfficialExaminationOption>('/api/results/admin/examinations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function publishOfficialExamination(examinationId: string, input: OfficialExaminationPublicationInput) {
  return apiFetch<OfficialExaminationOption>(`/api/results/admin/examinations/${encodeURIComponent(examinationId)}/publication`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createOfficialDraftResult(examId: string, input: {
  studentId: string;
  resultReference: string;
  sourceScanReference?: string | null;
  paperVersion?: string | null;
  administrativeRemarks?: string | null;
}) {
  return apiFetch<OfficialResultDetail>(`/api/results/admin/examinations/${encodeURIComponent(examId)}/results`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getStudentOfficialResults(studentId: string, requestOptions?: RequestInit) {
  return apiFetch<OfficialResultSummary[]>(`/api/results/admin/students/${encodeURIComponent(studentId)}`, requestOptions);
}

export function getOfficialResultDetail(resultId: string, requestOptions?: RequestInit) {
  return apiFetch<OfficialResultDetail>(`/api/results/admin/${encodeURIComponent(resultId)}`, requestOptions);
}

export function getOfficialResultCorrections(resultId: string, requestOptions?: RequestInit) {
  return apiFetch<OfficialCorrectionAudit[]>(`/api/results/admin/${encodeURIComponent(resultId)}/corrections`, requestOptions);
}

export function correctOfficialResult(resultId: string, input: OfficialCorrectionInput) {
  return apiFetch<OfficialResultDetail>(`/api/results/admin/${encodeURIComponent(resultId)}/corrections`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function previewElectronicDmc(resultId: string) {
  return apiFetchProtectedObjectUrl(`/api/results/admin/${encodeURIComponent(resultId)}/dmc/electronic`);
}

export function downloadElectronicDmc(resultId: string, filename: string) {
  return apiDownloadPdf(`/api/results/admin/${encodeURIComponent(resultId)}/dmc/electronic`, filename);
}

export function printElectronicDmc(resultId: string) {
  return apiOpenPdfForPrint(`/api/results/admin/${encodeURIComponent(resultId)}/dmc/electronic`, { title: 'Electronic Detailed Marks Certificate' });
}

export function prepareOfficialDmc(resultId: string, expectedRevision: number) {
  return apiFetch<OfficialDmcPreparation>(`/api/results/admin/${encodeURIComponent(resultId)}/dmc/official/prepare`, {
    method: 'POST',
    body: JSON.stringify({ expectedRevision }),
  });
}

export async function previewPreparedOfficialDmc(resultId: string, preparationId: string) {
  return apiFetchProtectedObjectUrl(`/api/results/admin/${encodeURIComponent(resultId)}/dmc/official/preparations/${encodeURIComponent(preparationId)}/preview`);
}

export function issuePreparedOfficialDmc(resultId: string, payload: { preparationId: string; expectedRevision: number; idempotencyKey: string }) {
  return apiFetch<OfficialDocumentIssuance>(`/api/results/admin/${encodeURIComponent(resultId)}/dmc/official/issue`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getOfficialDmcIssuances(resultId: string, requestOptions?: RequestInit) {
  return apiFetch<OfficialDocumentIssuance[]>(`/api/results/admin/${encodeURIComponent(resultId)}/dmc/official/issuances`, requestOptions);
}

export function downloadOfficialDmc(resultId: string, issuanceId: string, filename: string) {
  return apiDownloadPdf(`/api/results/admin/${encodeURIComponent(resultId)}/dmc/official/${encodeURIComponent(issuanceId)}`, filename);
}

export function printOfficialDmc(resultId: string, issuanceId: string) {
  return apiOpenPdfForPrint(`/api/results/admin/${encodeURIComponent(resultId)}/dmc/official/${encodeURIComponent(issuanceId)}`, { title: 'Official Detailed Marks Certificate' });
}

export function revokeOfficialDmc(resultId: string, issuanceId: string, payload: { reason: string }) {
  return apiFetch<void>(`/api/results/admin/${encodeURIComponent(resultId)}/dmc/official/${encodeURIComponent(issuanceId)}/revoke`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
