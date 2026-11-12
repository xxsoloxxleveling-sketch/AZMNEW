export type OmrDetectedAnswer = 'A' | 'B' | 'C' | 'D' | 'BLANK' | 'MULTIPLE' | 'UNCERTAIN';
export type OmrPaperVersion = 'A' | 'B' | 'C' | 'D';

/** Proposed contract only. The existing scanner does not currently send this event. */
export interface FutureOmrRecognitionEvent {
  eventId: string;
  sourceScanId: string;
  examId: string;
  claimedStudentId: string | null;
  paperVersion: OmrPaperVersion | null;
  answerKeyRevision: number | null;
  recognizedAt: string;
  responses: Array<{
    question: number;
    detectedAnswer: OmrDetectedAnswer;
    reviewRequired: boolean;
  }>;
}

export type FutureOmrRecognitionState = 'CAPTURED' | 'RECOGNIZED' | 'UNCERTAIN' | 'INVALID';
export type FutureOmrIdentityState = 'UNVERIFIED' | 'MATCHED' | 'CONFLICT' | 'VERIFIED';
export type FutureOmrScoringState = 'NOT_SCORED' | 'PROVISIONAL' | 'VERIFIED';
export type FutureOmrPublicationState = 'DRAFT' | 'READY' | 'PUBLISHED' | 'WITHHELD';
export type FutureOmrDecision = 'IDENTITY_UNRESOLVED' | 'REVIEW_REQUIRED' | 'READY_FOR_SERVER_VERIFICATION';

export interface FutureOmrInspection {
  recognitionState: FutureOmrRecognitionState;
  identityState: FutureOmrIdentityState;
  scoringState: FutureOmrScoringState;
  publicationState: FutureOmrPublicationState;
  decision: FutureOmrDecision;
  issues: string[];
}

/**
 * Checks only the proposed message shape. It does not match a student, validate
 * an exam/key, score answers, establish trust, write a result, or publish marks.
 */
export function inspectFutureOmrEvent(event: FutureOmrRecognitionEvent, expectedQuestionCount: number): FutureOmrInspection {
  const issues: string[] = [];
  if (!event.eventId.trim()) issues.push('eventId is required for future idempotency checks.');
  if (!event.sourceScanId.trim()) issues.push('sourceScanId is required.');
  if (!event.examId.trim()) issues.push('examId is required.');
  if (!Number.isInteger(expectedQuestionCount) || expectedQuestionCount < 1) issues.push('Expected question count must be a positive integer.');
  if (!Number.isFinite(Date.parse(event.recognizedAt))) issues.push('recognizedAt must be a valid timestamp.');

  const questions = event.responses.map((response) => response.question);
  if (questions.length !== expectedQuestionCount) issues.push('Response count must equal the examination question count.');
  if (new Set(questions).size !== questions.length) issues.push('Question numbers must be unique.');
  if (questions.some((question) => !Number.isInteger(question) || question < 1 || question > expectedQuestionCount)) {
    issues.push('Question numbers must cover only the expected 1-based question range.');
  }
  for (const response of event.responses) {
    if (response.detectedAnswer === 'UNCERTAIN' && !response.reviewRequired) {
      issues.push(`Question ${response.question} is uncertain and must require review.`);
    }
    if ((response.detectedAnswer === 'BLANK' || response.detectedAnswer === 'MULTIPLE') && response.reviewRequired) {
      issues.push(`Question ${response.question} must use UNCERTAIN when review is required.`);
    }
  }

  const structurallyValid = issues.length === 0;
  const hasUncertain = event.responses.some((response) => response.detectedAnswer === 'UNCERTAIN');
  const hasRequiredIdentityEvidence = Boolean(event.claimedStudentId?.trim());
  const hasExamVersion = Boolean(event.paperVersion && Number.isInteger(event.answerKeyRevision) && event.answerKeyRevision! > 0);
  const recognitionState: FutureOmrRecognitionState = !structurallyValid
    ? 'INVALID'
    : hasUncertain ? 'UNCERTAIN' : 'RECOGNIZED';
  const decision: FutureOmrDecision = !structurallyValid || hasUncertain || !hasExamVersion
    ? 'REVIEW_REQUIRED'
    : !hasRequiredIdentityEvidence ? 'IDENTITY_UNRESOLVED' : 'READY_FOR_SERVER_VERIFICATION';

  return {
    recognitionState,
    identityState: 'UNVERIFIED',
    scoringState: 'NOT_SCORED',
    publicationState: 'DRAFT',
    decision,
    issues,
  };
}
