import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_EXAMINATIONS, DEMO_RESULTS, buildDemoQuestionRows } from './ResultsDemoData.ts';

test('demo dataset has 4,000 fictional rows for every demo examination', () => {
  for (const examination of DEMO_EXAMINATIONS) {
    assert.equal(DEMO_RESULTS.filter((row) => row.examinationId === examination.id).length, 4000);
  }
  assert.ok(DEMO_RESULTS.every((row) => row.rollNumber.startsWith('DEMO-')));
});

test('question classifications account for all 100 items without scoring uncertain answers', () => {
  for (const row of DEMO_RESULTS.filter((item) => [0, 1, 40, 75].includes(Number(item.rollNumber.slice(-4))))) {
    assert.equal(row.correct + row.wrong + row.multiple + row.blank + row.uncertain, 100);
    if (row.obtainedMarks !== null) assert.equal(row.obtainedMarks, row.correct);
    const questions = buildDemoQuestionRows(row);
    assert.equal(questions.length, 100);
    assert.equal(questions.filter((question) => question.classification === 'Multiple').every((question) => question.marks === 0), true);
    assert.equal(questions.filter((question) => question.classification === 'Blank').every((question) => question.marks === 0), true);
    assert.equal(questions.filter((question) => question.classification === 'Uncertain').every((question) => question.marks === null && question.correct === 'Not available'), true);
  }
});
