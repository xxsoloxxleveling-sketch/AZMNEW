/** DTO boundary for durable, exam-specific results. Never expose answer keys or raw scans. */
export type OfficialIdentityStatus = 'PENDING' | 'VERIFIED' | 'MISMATCH';
export type OfficialScoringStatus = 'PROVISIONAL' | 'VERIFIED';
export type OfficialVerificationStatus = 'PENDING' | 'VERIFIED' | 'WITHHELD';
export type OfficialPublicationStatus = 'UNPUBLISHED' | 'PUBLISHED' | 'WITHHELD';
export type OfficialResponseClassification = 'CORRECT' | 'WRONG' | 'BLANK' | 'MULTIPLE' | 'UNCERTAIN';
export type OfficialResponseSource = 'OMR_DETECTED' | 'HUMAN_REVIEW' | 'ADMIN_CORRECTION' | 'MANUAL_ENTRY';
export type OfficialResultChangeSource = 'STUDENT_PROFILE' | 'RESULTS_DASHBOARD' | 'MANUAL_ENTRY';

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
  attempt: { id: string; attemptNumber: number; businessDate: string; state: 'CURRENT' | 'HISTORICAL'; boundAt: string } | null;
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
    latestOfficialIssuanceStatus: 'NONE' | 'ISSUED' | 'SUPERSEDED' | 'REVOKED' | 'ATTEMPT_UNVERIFIED';
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

export interface CreateExaminationInput {
  reference: string;
  title: string;
  sessionReference: string;
  /** Non-secret per-version revision identifiers; answer-key contents never leave server storage. */
  paperKeyRevisions: Array<{ paperVersion: string; answerKeyRevision: string }>;
  examDate?: string | null;
  classGroup: string;
  maximumMarks: string;
  questionCount: number;
  scoringPolicy: {
    correctMarks: string;
    wrongMarks: string;
    blankMarks: string;
    multipleMarks: string;
    revision: string;
  };
}

export interface CreateDraftResultInput {
  studentId: string;
  resultReference: string;
  sourceScanReference?: string | null;
  paperVersion?: string | null;
  administrativeRemarks?: string | null;
}

export interface CorrectResultInput {
  expectedRevision: number;
  reason: string;
  source: Exclude<OfficialResultChangeSource, 'MANUAL_ENTRY'>;
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

export interface OfficialResultPage {
  results: OfficialResultSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface OfficialResultCorrectionAuditDto {
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
  source: OfficialResultChangeSource;
  publicationImpact: string;
  occurredAt: string;
}

export interface OfficialDmcPdfData {
  documentType: 'ELECTRONIC' | 'OFFICIAL';
  documentNumber: string;
  resultRevision: number;
  generatedAt: string;
  issuedByName?: string | null;
  verificationReference?: string | null;
  fatherName?: string | null;
  examinationCenter?: string | null;
  result: OfficialResultDetail;
}
