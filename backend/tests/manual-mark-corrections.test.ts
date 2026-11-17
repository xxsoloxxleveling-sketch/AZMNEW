import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { manualExamMarkCorrectionSchema } from '../src/modules/students/students.schema';
import { buildManualMarkCorrectionQuery } from '../src/modules/students/manualExamMarkCorrections';
import { canCorrectManualMark } from '../../src/components/admin/students/manualApprovalEligibility';
import type { MockStudent } from '../../src/lib/mockApi';

const candidate = {
  testScore: 82, provisionalOmr: null,
  manualExamMark: {
    source: 'SUPER_ADMIN_MANUAL' as const,
    recordedAt: '2026-11-17T10:00:00.000Z',
    originalRecordedMarks: 77,
    manuallyCorrected: true,
    reviewRequired: false, verified: true,
    verifiedAt: '2026-11-17T10:00:01.000Z',
  },
} satisfies Pick<MockStudent,'testScore' | 'provisionalOmr' | 'manualExamMark'>;

function correction(score: number, previous = 82) {
  return {
    expectedCurrentMarks: previous, newMarks: score, expectedCorrectionId: null,
    evidenceReference: 'REGISTER-MANUAL-SYNTHETIC-001',
    reason: 'Independent signed manual result register checked with student attendance.',
    identityReviewed: true, attendanceReviewed: true,
  };
}

test('Super Admin can correct a verified or pending manual mark repeatedly', () => {
  assert.equal(canCorrectManualMark('SUPER_ADMIN', candidate), true);
  assert.equal(canCorrectManualMark('SUPER_ADMIN', {
    ...candidate, manualExamMark: { ...candidate.manualExamMark, verified: false },
  }), true);
  for (const role of ['ADMIN', 'ACCOUNTANT', 'TEACHER', 'STUDENT', '']) {
    assert.equal(canCorrectManualMark(role, candidate), false);
  }
  assert.equal(canCorrectManualMark(null, candidate), false);
  assert.equal(canCorrectManualMark('SUPER_ADMIN', { ...candidate, manualExamMark: null }), false);
  assert.equal(canCorrectManualMark('SUPER_ADMIN', { ...candidate, testScore: null }), false);
  assert.equal(canCorrectManualMark('SUPER_ADMIN', { ...candidate, testScore: 101 }), false);
  assert.equal(canCorrectManualMark('SUPER_ADMIN', {
    ...candidate, provisionalOmr: { verified: false } as NonNullable<MockStudent['provisionalOmr']>,
  }), false);
});

test('score boundaries permit 0 to 100, but no-op, fractional and invalid evidence fail', () => {
  for (const mark of [0, 59, 60, 61, 82, 100]) {
    assert.equal(manualExamMarkCorrectionSchema.safeParse(correction(mark, mark === 82 ? 81 : 82)).success, true);
  }
  for (const mark of [-1, 101, 3.5, Number.NaN]) {
    assert.equal(manualExamMarkCorrectionSchema.safeParse(correction(mark)).success, false);
  }
  assert.equal(manualExamMarkCorrectionSchema.safeParse(correction(82)).success, false);
  assert.equal(manualExamMarkCorrectionSchema.safeParse({ ...correction(83), attendanceReviewed: false }).success, false);
  assert.equal(manualExamMarkCorrectionSchema.safeParse({ ...correction(83), reason: 'too short' }).success, false);
  assert.equal(manualExamMarkCorrectionSchema.safeParse({ ...correction(83), extra: 'ignored?' }).success, false);
});

test('correction uses parameterized SQL and explicit casts, not direct mutation', () => {
  const query = buildManualMarkCorrectionQuery('candidate-synthetic',82,87,null,
    'REGISTER-MANUAL-SYNTHETIC-001','Independent signed result register and attendance reviewed.',
    true,true,'admin-synthetic');
  assert.match(query.sql,/azm_correct_manual_exam_mark/);
  assert.match(query.sql,/::integer/);
  assert.match(query.sql,/::bigint/);
  assert.match(query.sql,/::boolean/);
  assert.match(query.sql,/::text/);
  assert.equal(query.values.length,9);
  assert.equal(query.values[0],'candidate-synthetic');
  assert.equal(query.values[2],87);
});

test('migration is append-only, identity-gated and binds approval to correction ID', () => {
  const migration = fs.readFileSync(path.join(process.cwd(),
    'prisma/migrations/20261117150000_repeatable_manual_exam_mark_corrections/migration.sql'),'utf8');
  const sql = migration.replace(/--[^\n]*/g,'');
  assert.match(sql,/CREATE TABLE public\."ManualExamMarkCorrectionAudit"/);
  assert.match(sql,/ManualExamMarkCorrectionAudit_immutable/);
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.azm_verify_manual_exam_mark/);
  assert.match(sql,/"latestCorrectionId" IS NOT DISTINCT FROM v_revision_id/);
  assert.match(sql,/p_expected_revision_id IS DISTINCT FROM v_latest.id/);
  assert.match(sql,/FOR UPDATE/);
  assert.match(sql,/SUPER_ADMIN_REQUIRED/);
  assert.match(sql,/STALE_MANUAL_MARK/);
  assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE FROM|ALTER TABLE public\."ManualExamMark"|UPDATE public\."ManualExamMark")\b/i);
});
