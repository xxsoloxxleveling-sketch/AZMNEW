import assert from 'node:assert/strict';
import test from 'node:test';
import { studentQuerySchema, provisionalOmrMarksLookupSchema } from '../src/modules/students/students.schema';

test('student directory accepts full-roster marks ordering in both directions', () => {
  const ascending = studentQuerySchema.parse({ marksSort: 'asc', page: '2', limit: '20' });
  const descending = studentQuerySchema.parse({ marksSort: 'desc', schoolName: 'Model School' });
  assert.equal(ascending.marksSort, 'asc');
  assert.equal(ascending.page, 2);
  assert.equal(descending.marksSort, 'desc');
  assert.equal(descending.schoolName, 'Model School');
});

test('marks ordering is optional and rejects unsanctioned sorting instructions', () => {
  assert.equal(studentQuerySchema.parse({ page: '1' }).marksSort, undefined);
  assert.equal(studentQuerySchema.safeParse({ marksSort: 'random' }).success, false);
  assert.equal(studentQuerySchema.safeParse({ marksSort: 'testScore desc; DROP TABLE Student' }).success, false);
});

test('public marks lookup requires both a bounded roll number and matching CNIC', () => {
  const valid = provisionalOmrMarksLookupSchema.safeParse({
    rollNumber: 'AZMVS-2026-0001',
    cnic: '13503-0000000-0',
  });
  assert.equal(valid.success, true);
  assert.equal(provisionalOmrMarksLookupSchema.safeParse({ rollNumber: 'AZMVS-2026-0001' }).success, false);
  assert.equal(provisionalOmrMarksLookupSchema.safeParse({ cnic: '13503-0000000-0' }).success, false);
  assert.equal(provisionalOmrMarksLookupSchema.safeParse({ rollNumber: '%', cnic: '13503-0000000-0' }).success, false);
});
