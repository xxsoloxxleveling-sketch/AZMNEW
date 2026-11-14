import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { decodeOmrKeypack, OMR_COHORTS, rosterOmrCohort, scoreOmrAnswers, type OmrAnswer } from '../src/modules/results/omrStudioScoring';

const raw = Buffer.alloc(1100, 0); // Fabricated keys: every answer is A.
const digest = createHash('sha256').update(raw).digest('hex');
const pdfDigest = 'synthetic-pdf-digest';
const text = `${raw.toString('base64url')}\n${digest}\n${pdfDigest}\n`;

test('accepts only complete integrity-matched key packages', () => {
  assert.equal(decodeOmrKeypack(text, digest, pdfDigest).length, 44);
  assert.throws(() => decodeOmrKeypack(text, 'incorrect', pdfDigest), /integrity/);
  assert.throws(() => decodeOmrKeypack(text.replace(pdfDigest, 'other'), digest, pdfDigest), /integrity/);
});

test('scores selected class and version using correct, wrong, blank and multiple rules', () => {
  const keys = decodeOmrKeypack(text, digest, pdfDigest);
  const answers: OmrAnswer[] = Array(100).fill('A');
  answers[1] = 'B'; answers[2] = 'BLANK'; answers[3] = 'MULTIPLE';
  const result = scoreOmrAnswers(keys, OMR_COHORTS[0], 'A', answers);
  assert.equal(result.marks, 97);
  assert.deepEqual(result.responses.slice(0, 4).map((item) => item.classification), ['CORRECT', 'WRONG', 'BLANK', 'MULTIPLE']);
  assert.equal(JSON.stringify(result).includes('AAAAAAAAAAAAAAAA'), false);
});

test('rejects unresolved readings, incomplete answers and unknown class or version', () => {
  const keys = decodeOmrKeypack(text, digest, pdfDigest);
  const answers: OmrAnswer[] = Array(100).fill('A');
  answers[44] = 'UNCERTAIN';
  assert.throws(() => scoreOmrAnswers(keys, OMR_COHORTS[0], 'A', answers), /uncertain/i);
  assert.throws(() => scoreOmrAnswers(keys, OMR_COHORTS[0], 'A', answers.slice(0, 99)), /100/);
  assert.throws(() => scoreOmrAnswers(keys, 'Other class', 'A', Array(100).fill('A')), /no approved key/);
  assert.throws(() => scoreOmrAnswers(keys, OMR_COHORTS[0], 'Z', Array(100).fill('A')), /no approved key/);
});

test('uses the requested cohort and paper version rather than the best score', () => {
  const keys = Array.from({ length: 44 }, (_, i) => 'ABCD'[i % 4].repeat(100));
  const answers: OmrAnswer[] = Array(100).fill('A');
  assert.equal(scoreOmrAnswers(keys, OMR_COHORTS[0], 'A', answers).marks, 100);
  assert.equal(scoreOmrAnswers(keys, OMR_COHORTS[0], 'B', answers).marks, 0);
  keys[4] = 'B'.repeat(100);
  assert.equal(scoreOmrAnswers(keys, OMR_COHORTS[1], 'A', answers).marks, 0);
});

test('maps known roster class and group values and refuses ambiguous groups', () => {
  assert.equal(rosterOmrCohort('SSC-I (Class 9th)', null), 'Class 9');
  assert.equal(rosterOmrCohort('First Year', 'Pre-Medical'), 'Class 11 — Pre-Medical');
  assert.equal(rosterOmrCohort('HSSC-II', 'ICS'), 'Class 12 — Pre-Computer Science');
  assert.equal(rosterOmrCohort('BS Program (Undergraduate)', null), 'BS — Combined Groups');
  assert.equal(rosterOmrCohort('First Year', null), null);
  assert.equal(rosterOmrCohort('First Year', 'Arts'), null);
  assert.equal(rosterOmrCohort('unknown', 'Pre-Medical'), null);
});
