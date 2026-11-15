import test from 'node:test';
import assert from 'node:assert/strict';
import { sortProvisionalStudentIds } from '../src/modules/students/provisionalOmrMarks';

test('provisional marks sorting is numeric across the full filtered roster', () => {
  const marks = new Map([
    ['student-1', { obtainedMarks: 9 }],
    ['student-2', { obtainedMarks: 95 }],
    ['student-3', { obtainedMarks: 0 }],
  ]);
  const ids = ['student-4', 'student-1', 'student-3', 'student-2'];
  assert.deepEqual(sortProvisionalStudentIds(ids, marks, 'desc'), ['student-2', 'student-1', 'student-3', 'student-4']);
  assert.deepEqual(sortProvisionalStudentIds(ids, marks, 'asc'), ['student-3', 'student-1', 'student-2', 'student-4']);
  assert.deepEqual(ids, ['student-4', 'student-1', 'student-3', 'student-2'], 'sorting must not mutate inputs');
});
