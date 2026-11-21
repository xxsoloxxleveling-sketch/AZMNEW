import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessInterviewEligibility, getAuthoritativeApprovedResult, resolveInterviewResultRecords,
} from '../src/modules/interviews/eligibility.ts';

const approvedAt = new Date('2026-11-20T08:00:00.000Z');

function officialResult(marks: number, options: {
  studentId?: string; resultId?: string; sessionId?: string; revision?: number;
  verificationStatus?: string; publicationStatus?: string; examPublicationStatus?: string;
  correctionRevision?: number; uncertainCount?: number;
} = {}) {
  const resultRevision = options.revision ?? 1;
  return {
    id: options.resultId ?? `result-${options.studentId ?? 'one'}-${options.sessionId ?? 'hall-a'}`,
    resultReference: `official-${options.studentId ?? 'one'}-${options.sessionId ?? 'hall-a'}`,
    studentId: options.studentId ?? 'student-one',
    examinationId: 'session-v-exam',
    attendanceSessionId: options.sessionId ?? 'exam-hall-a-attempt-1',
    paperVersion: 'A',
    obtainedMarks: marks,
    maximumMarks: 100,
    uncertainCount: options.uncertainCount ?? 0,
    identityStatus: 'VERIFIED',
    scoringStatus: 'VERIFIED',
    verificationStatus: options.verificationStatus ?? 'VERIFIED',
    publicationStatus: options.publicationStatus ?? 'PUBLISHED',
    resultRevision,
    verifiedAt: approvedAt,
    verifiedById: 'super-admin-1',
    publishedAt: approvedAt,
    publishedById: 'super-admin-1',
    corrections: options.correctionRevision === 0 ? [] : [{
      id: 'correction-audit', previousRevision: resultRevision - 1,
      newRevision: options.correctionRevision ?? resultRevision, occurredAt: approvedAt,
    }],
    examination: {
      id: 'session-v-exam', reference: 'EXAM-2026-V', sessionReference: '2026-V',
      maximumMarks: 100, publicationStatus: options.examPublicationStatus ?? 'PUBLISHED',
      publishedAt: approvedAt, publishedById: 'super-admin-1', revision: 4,
      paperKeyRevisions: [{ paperVersion: 'A' }],
    },
    attendanceSession: {
      id: options.sessionId ?? 'exam-hall-a-attempt-1', isCurrent: true, status: 'CLOSED',
    },
    attemptBinding: {
      sessionId: options.sessionId ?? 'exam-hall-a-attempt-1', studentId: options.studentId ?? 'student-one',
    },
  };
}

describe('Session V interview eligibility', () => {
  it('applies the fixed 60/100 boundary', () => {
    assert.equal(assessInterviewEligibility(getAuthoritativeApprovedResult(officialResult(59))).status, 'NOT_QUALIFIED');
    assert.equal(assessInterviewEligibility(getAuthoritativeApprovedResult(officialResult(60))).status, 'QUALIFIED');
  });

  it('rejects attempts to lower the campaign threshold', () => {
    const result = getAuthoritativeApprovedResult(officialResult(59));
    assert.equal(assessInterviewEligibility(result, 59).status, 'PENDING_VERIFICATION');
  });

  it('uses the latest approved correction revision and rejects an audit mismatch', () => {
    const corrected = officialResult(62, { revision: 2, correctionRevision: 2 });
    const source = getAuthoritativeApprovedResult(corrected);
    assert.equal(assessInterviewEligibility(source).status, 'QUALIFIED');
    assert.equal(source?.revision, 'result-one-hall-a:r2:e4');
    assert.equal(getAuthoritativeApprovedResult(officialResult(62, { revision: 2, correctionRevision: 1 })), null);
  });

  it('keeps withheld official results excluded for administrative review', () => {
    const resolved = resolveInterviewResultRecords([officialResult(90, { verificationStatus: 'WITHHELD', publicationStatus: 'WITHHELD' })]);
    assert.equal(resolved.eligibility.status, 'EXCLUDED_PENDING_REVIEW');
    assert.equal(resolved.eligibility.status === 'EXCLUDED_PENDING_REVIEW' && resolved.eligibility.reason, 'WITHHELD');
  });

  it('does not promote provisional OMR values or legacy test scores', () => {
    assert.equal(getAuthoritativeApprovedResult({ obtainedMarks: 100, testScore: 100, examination: null }), null);
    assert.equal(resolveInterviewResultRecords([]).eligibility.status, 'PENDING_VERIFICATION');
  });

  it('excludes multiple current official records for one candidate instead of selecting one', () => {
    const first = officialResult(61, { sessionId: 'hall-a-attempt-1', resultId: 'result-hall-a' });
    const second = officialResult(80, { sessionId: 'hall-b-attempt-1', resultId: 'result-hall-b' });
    const resolved = resolveInterviewResultRecords([first, second]);
    assert.equal(resolved.eligibility.status, 'EXCLUDED_PENDING_REVIEW');
    assert.equal(resolved.eligibility.status === 'EXCLUDED_PENDING_REVIEW' && resolved.eligibility.reason, 'DUPLICATE_OFFICIAL_RESULTS');
  });

  it('accepts eligible candidates from separate original examination halls in one campaign', () => {
    const hallA = resolveInterviewResultRecords([officialResult(60, { studentId: 'candidate-a', sessionId: 'hall-a-attempt-1' })]);
    const hallB = resolveInterviewResultRecords([officialResult(75, { studentId: 'candidate-b', sessionId: 'hall-b-attempt-1' })]);
    assert.equal(hallA.eligibility.status, 'QUALIFIED');
    assert.equal(hallB.eligibility.status, 'QUALIFIED');
    assert.equal(hallA.result?.reference.includes('candidate-a'), true);
    assert.equal(hallB.result?.reference.includes('candidate-b'), true);
  });

  it('requires the official result, examination, and attempt to be verified and published', () => {
    assert.equal(getAuthoritativeApprovedResult(officialResult(90, { publicationStatus: 'UNPUBLISHED' })), null);
    assert.equal(getAuthoritativeApprovedResult(officialResult(90, { examPublicationStatus: 'DRAFT' })), null);
    assert.equal(getAuthoritativeApprovedResult(officialResult(90, { uncertainCount: 1 })), null);
    assert.equal(getAuthoritativeApprovedResult({ ...officialResult(90), testScore: 100, attemptBinding: null }), null);
  });
});
