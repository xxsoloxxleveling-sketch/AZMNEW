import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectFutureOmrEvent, type FutureOmrRecognitionEvent } from './FutureOmrContract.ts';

function event(overrides: Partial<FutureOmrRecognitionEvent> = {}): FutureOmrRecognitionEvent {
  return {
    eventId: 'event-001',
    sourceScanId: 'scan-001',
    examId: 'exam-001',
    claimedStudentId: 'student-001',
    paperVersion: 'A',
    answerKeyRevision: 1,
    recognizedAt: '2026-11-13T10:00:00Z',
    responses: [
      { question: 1, detectedAnswer: 'A', reviewRequired: false },
      { question: 2, detectedAnswer: 'MULTIPLE', reviewRequired: false },
      { question: 3, detectedAnswer: 'BLANK', reviewRequired: false },
    ],
    ...overrides,
  };
}

test('confident multiple and blank answers remain non-review classifications and never score on the client', () => {
  const result = inspectFutureOmrEvent(event(), 3);
  assert.equal(result.recognitionState, 'RECOGNIZED');
  assert.equal(result.decision, 'READY_FOR_SERVER_VERIFICATION');
  assert.equal(result.scoringState, 'NOT_SCORED');
  assert.equal(result.identityState, 'UNVERIFIED');
  assert.equal(result.publicationState, 'DRAFT');
});

test('missing student identity is unresolved rather than assigned by a guessed roll number', () => {
  const result = inspectFutureOmrEvent(event({ claimedStudentId: null }), 3);
  assert.equal(result.decision, 'IDENTITY_UNRESOLVED');
  assert.equal(result.identityState, 'UNVERIFIED');
  assert.equal(result.scoringState, 'NOT_SCORED');
});

test('paper versions are represented explicitly and a missing answer-key revision requires review', () => {
  assert.equal(inspectFutureOmrEvent(event({ paperVersion: 'B' }), 3).decision, 'READY_FOR_SERVER_VERIFICATION');
  const missingKey = inspectFutureOmrEvent(event({ answerKeyRevision: null }), 3);
  assert.equal(missingKey.decision, 'REVIEW_REQUIRED');
  assert.equal(missingKey.scoringState, 'NOT_SCORED');
});

test('uncertain answers require review while confident multiple and blank answers do not', () => {
  const uncertain = event({ responses: [
    { question: 1, detectedAnswer: 'A', reviewRequired: false },
    { question: 2, detectedAnswer: 'UNCERTAIN', reviewRequired: true },
    { question: 3, detectedAnswer: 'BLANK', reviewRequired: false },
  ] });
  assert.equal(inspectFutureOmrEvent(uncertain, 3).decision, 'REVIEW_REQUIRED');
  const contradictory = event({ responses: [
    { question: 1, detectedAnswer: 'A', reviewRequired: false },
    { question: 2, detectedAnswer: 'UNCERTAIN', reviewRequired: false },
    { question: 3, detectedAnswer: 'BLANK', reviewRequired: false },
  ] });
  assert.equal(inspectFutureOmrEvent(contradictory, 3).recognitionState, 'INVALID');
});

test('duplicate or incomplete question sets are rejected as malformed recognition events', () => {
  const duplicated = event({ responses: [
    { question: 1, detectedAnswer: 'A', reviewRequired: false },
    { question: 1, detectedAnswer: 'B', reviewRequired: false },
    { question: 3, detectedAnswer: 'BLANK', reviewRequired: false },
  ] });
  assert.equal(inspectFutureOmrEvent(duplicated, 3).recognitionState, 'INVALID');
  assert.equal(inspectFutureOmrEvent(event({ responses: event().responses.slice(0, 2) }), 3).recognitionState, 'INVALID');
});
