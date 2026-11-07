import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreOmr, type ApprovedKey, type OmrResponse } from '../src/modules/omr/scoring';
const context = { examId: 'synthetic-exam', candidateGroup: 'CLASS-6', paperVersion: 'A' as const };
const key: ApprovedKey = { ...context, id: 'synthetic-key', revision: 1, status: 'APPROVED', answers: Array(100).fill('A') };
const policy = { questionCount: 100, correctMarks: 1, incorrectPenalty: 0 };
const grade = (answer: OmrResponse) => scoreOmr(Array(100).fill(answer), key, policy, context);
test('all correct, wrong and blank scores use actual answers', () => {
  assert.equal(grade('A').adjustedScore, 100); assert.equal(grade('B').adjustedScore, 0);
  assert.equal(grade('BLANK').blank, 100); assert.equal(grade('BLANK').rawScore, 0);
});
test('ambiguous rows are retained and require review', () => {
  assert.equal(grade('MULTIPLE').multiple, 100); assert.equal(grade('UNCERTAIN').uncertain, 100);
  assert.equal(grade('MULTIPLE').reviewRequired, true); assert.equal(grade('UNCERTAIN').reviewRequired, true);
});
test('negative marking and an optional explicit floor use exact decimal arithmetic', () => {
  const result = scoreOmr(Array(100).fill('B'), key, { ...policy, incorrectPenalty: .125 }, context);
  assert.equal(result.rawScore, -12.5); assert.equal(result.adjustedScore, -12.5);
  assert.equal(scoreOmr(Array(100).fill('B'), key, { ...policy, incorrectPenalty: .125, minimumScore: 0 }, context).adjustedScore, 0);
});
test('missing, draft and wrong-version/group/exam keys are rejected', () => {
  const responses = Array(100).fill('A');
  for (const invalid of [null, { ...key, status: 'DRAFT' as const }, { ...key, paperVersion: 'B' as const }, { ...key, candidateGroup: 'CLASS-10' }, { ...key, examId: 'other' }]) {
    assert.throws(() => scoreOmr(responses, invalid, policy, context));
  }
});
test('revisions remain explicit and previous key data is not mutated', () => {
  const snapshot = JSON.stringify(key);
  assert.equal(scoreOmr(Array(100).fill('B'), { ...key, revision: 2, answers: Array(100).fill('B') }, policy, context).rawScore, 100);
  assert.equal(JSON.stringify(key), snapshot); assert.equal(grade('B').answerKeyRevision, 1);
});
test('invalid lengths, options and unsafe policies are rejected', () => {
  assert.throws(() => scoreOmr([], key, policy, context));
  assert.throws(() => scoreOmr(Array(100).fill('INVALID'), key, policy, context));
  for (const correctMarks of [NaN, Infinity, 0, -1, .123456, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => scoreOmr(Array(100).fill('A'), key, { ...policy, correctMarks }, context));
  }
});
