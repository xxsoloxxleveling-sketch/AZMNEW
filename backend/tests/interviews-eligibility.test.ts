import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessInterviewEligibility, getAuthoritativeApprovedResult, type ApprovedResultSource } from '../src/modules/interviews/eligibility.ts';

function approved(marks: number, overrides: Partial<ApprovedResultSource> = {}): ApprovedResultSource {
  return {
    marks,
    maximumMarks: 100,
    verificationStatus: 'VERIFIED',
    isFinal: true,
    reference: 'official-result-1',
    revision: 'revision-2',
    ...overrides,
  };
}

describe('interview eligibility', () => {
  it('qualifies a verified final score of 60', () => {
    assert.equal(assessInterviewEligibility(approved(60)).status, 'QUALIFIED');
  });

  it('does not qualify a verified final score of 59', () => {
    assert.equal(assessInterviewEligibility(approved(59)).status, 'NOT_QUALIFIED');
  });

  it('keeps missing, unverified and provisional results pending', () => {
    assert.equal(assessInterviewEligibility(null).status, 'PENDING_VERIFICATION');
    assert.equal(assessInterviewEligibility(approved(90, { verificationStatus: 'UNVERIFIED' })).status, 'PENDING_VERIFICATION');
    assert.equal(assessInterviewEligibility(approved(90, { isFinal: false })).status, 'PENDING_VERIFICATION');
  });

  it('excludes withheld results for review', () => {
    assert.equal(assessInterviewEligibility(approved(90, { verificationStatus: 'WITHHELD' })).status, 'EXCLUDED_PENDING_REVIEW');
  });

  it('uses the verified corrected result revision rather than an unrelated legacy score', () => {
    const corrected = approved(62, { reference: 'corrected-official-result', revision: 'revision-3' });
    const outcome = assessInterviewEligibility(corrected);
    assert.equal(outcome.status, 'QUALIFIED');
    assert.equal(outcome.status === 'QUALIFIED' || outcome.status === 'NOT_QUALIFIED' ? outcome.approvedMarks : null, 62);
    assert.equal(outcome.status === 'QUALIFIED' || outcome.status === 'NOT_QUALIFIED' ? outcome.sourceRevision : null, 'revision-3');
  });

  it('does not treat a score from a different maximum-mark scale as final eligibility', () => {
    assert.equal(assessInterviewEligibility(approved(80, { maximumMarks: 120 })).status, 'PENDING_VERIFICATION');
  });

  it('keeps the live adapter closed while Results has no verified final source', () => {
    assert.equal(getAuthoritativeApprovedResult({ testScore: 99 }), null);
  });
});
