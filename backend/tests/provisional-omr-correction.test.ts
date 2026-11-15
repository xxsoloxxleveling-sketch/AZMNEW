import assert from 'node:assert/strict';
import test from 'node:test';
import { provisionalOmrMarkCorrectionSchema } from '../src/modules/students/students.schema';
import { sortProvisionalStudentIds, buildProvisionalMarkCorrectionQuery } from '../src/modules/students/provisionalOmrMarks';

test('Super Admin correction input requires exact integer marks and a meaningful reason', () => {
  const good = provisionalOmrMarkCorrectionSchema.parse({
    expectedCurrentMarks: 54,
    newMarks: 60,
    reason: 'Reviewed marked answer sheet and confirmed scoring issue.',
  });
  assert.equal(good.newMarks, 60);
  for (const value of [-1, 101, 14.5, '60', null]) {
    assert.equal(provisionalOmrMarkCorrectionSchema.safeParse({
      expectedCurrentMarks: 54, newMarks: value, reason: 'Checked original answer sheet.'
    }).success, false);
  }
  assert.equal(provisionalOmrMarkCorrectionSchema.safeParse({
    expectedCurrentMarks: 54, newMarks: 60, reason: 'Changed.',
  }).success, false);
  assert.equal(provisionalOmrMarkCorrectionSchema.safeParse({
    expectedCurrentMarks: 54, newMarks: 60, reason: 'Verified against original scan.', role: 'SUPER_ADMIN',
  }).success, false, 'request cannot control its own authorizer role');
});

test('sort handles corrected effective marks numerically and places absent marks last', () => {
  const marks = new Map([
    ['first', { obtainedMarks: 5 }],
    ['second', { obtainedMarks: 92 }],
    ['third', { obtainedMarks: 0 }],
  ]);
  const ids = ['missing', 'first', 'third', 'second'];
  assert.deepEqual(sortProvisionalStudentIds(ids, marks, 'desc'), ['second', 'first', 'third', 'missing']);
  assert.deepEqual(sortProvisionalStudentIds(ids, marks, 'asc'), ['third', 'first', 'second', 'missing']);
  assert.deepEqual(ids, ['missing', 'first', 'third', 'second']);
});

test('the correction SQL explicitly casts Prisma number params to PostgreSQL integer arguments', () => {
  const query = buildProvisionalMarkCorrectionQuery('student-1', 54, 60, 'Checked original answer sheet.', 'admin-1');
  assert.match(query.sql, /azm_correct_provisional_omr_mark\(/);
  assert.match(query.sql, /::text,\s*\?::integer,\s*\?::integer,\s*\?::text,\s*\?::text/);
  assert.deepEqual(query.values, ['student-1', 54, 60, 'Checked original answer sheet.', 'admin-1']);
});
