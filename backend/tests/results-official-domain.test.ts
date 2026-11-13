import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://synthetic:synthetic@127.0.0.1:1/results_test';
process.env.DIRECT_URL = 'postgresql://synthetic:synthetic@127.0.0.1:1/results_test';
process.env.JWT_ACCESS_SECRET = 'synthetic-results-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'synthetic-results-test-refresh-secret';
process.env.QR_SECRET = 'synthetic-results-test-qr-secret';

const responseFixture = (questionNumber: number, classification: string) => ({
  questionNumber,
  classification,
});

test('DMC eligibility requires complete, internally consistent question and count evidence', async () => {
  const { hasCompleteResponseEvidence, isDmcEligible } = await import('../src/modules/results/official-results.service');
  const result: any = {
    studentId: 'synthetic-student', attendanceSessionId: 'synthetic-attempt',
    attemptBinding: {sessionId:'synthetic-attempt',studentId:'synthetic-student'},
    examination: {
      questionCount: 4,
      publicationStatus: 'PUBLISHED',
      paperKeyRevisions: [{ paperVersion: 'A', answerKeyRevision: 'key-rev-a' }],
    },
    paperVersion: 'A',
    obtainedMarks: '4',
    identityStatus: 'VERIFIED',
    scoringStatus: 'VERIFIED',
    verificationStatus: 'VERIFIED',
    publicationStatus: 'PUBLISHED',
    correctCount: 2,
    wrongCount: 1,
    blankCount: 1,
    multipleCount: 0,
    uncertainCount: 0,
    responses: [
      responseFixture(1, 'CORRECT'), responseFixture(2, 'CORRECT'),
      responseFixture(3, 'WRONG'), responseFixture(4, 'BLANK'),
    ],
  };

  assert.equal(hasCompleteResponseEvidence(result), true);
  assert.equal(isDmcEligible(result), true);
  assert.equal(isDmcEligible({...result,attemptBinding:null}),false,'unbound result cannot issue a DMC');

  assert.equal(isDmcEligible({ ...result, blankCount: null }), false, 'missing count evidence blocks DMC');
  assert.equal(isDmcEligible({ ...result, wrongCount: 0 }), false, 'counts must agree with per-question records');
  assert.equal(isDmcEligible({ ...result, paperVersion: 'B' }), false, 'paper version must match an exact registered mapping');
  assert.equal(isDmcEligible({ ...result, responses: result.responses.slice(0, 3) }), false, 'all questions must have a response row');
  assert.equal(isDmcEligible({ ...result, responses: [...result.responses.slice(0, 3), responseFixture(3, 'BLANK')] }), false, 'question sequence must be complete and unique');

  const uncertain = {
    ...result,
    correctCount: 1,
    wrongCount: 1,
    uncertainCount: 1,
    responses: [
      responseFixture(1, 'CORRECT'), responseFixture(2, 'WRONG'),
      responseFixture(3, 'UNCERTAIN'), responseFixture(4, 'BLANK'),
    ],
  };
  assert.equal(hasCompleteResponseEvidence(uncertain), true, 'uncertainty is valid evidence but does not allow issuance');
  assert.equal(isDmcEligible(uncertain), false);
});
