import assert from 'node:assert/strict';
import test from 'node:test';
import { canApproveManualMark, hasPendingManualApproval } from '../../src/components/admin/students/manualApprovalEligibility';
import type { MockStudent } from '../../src/lib/mockApi';

type Candidate = Pick<MockStudent, 'manualExamMark' | 'provisionalOmr' | 'testScore'>;
const pending: Candidate = {
  testScore: 82,
  provisionalOmr: null,
  manualExamMark: {
    source: 'SUPER_ADMIN_MANUAL',
    recordedAt: '2026-11-17T00:00:00.000Z',
    reviewRequired: true,
    verified: false,
    verifiedAt: null,
  },
};

test('manual approval appears only for pending manual scores and only for Super Admin', () => {
  assert.equal(canApproveManualMark('SUPER_ADMIN', pending), true);
  for (const role of ['ADMIN', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'PARENT', '']) {
    assert.equal(canApproveManualMark(role, pending), false, role);
  }
  assert.equal(canApproveManualMark(null, pending), false);
});

test('manual approval never appears when an OMR exists, a manual mark is verified or a mark is absent', () => {
  assert.equal(hasPendingManualApproval({ ...pending, manualExamMark: null }), false);
  assert.equal(hasPendingManualApproval({
    ...pending, manualExamMark: { ...pending.manualExamMark!, verified: true },
  }), false);
  assert.equal(hasPendingManualApproval({
    ...pending, provisionalOmr: { verified: false } as NonNullable<Candidate['provisionalOmr']>,
  }), false);
  assert.equal(hasPendingManualApproval({ ...pending, testScore: null }), false);
  assert.equal(hasPendingManualApproval({ ...pending, testScore: undefined }), false);
});

test('valid pass/fail boundary marks are eligible for independent manual review', () => {
  for (const score of [0, 59, 60, 61, 82, 100]) {
    assert.equal(hasPendingManualApproval({ ...pending, testScore: score }), true, String(score));
  }
  for (const score of [-1, 20.5, 101, Number.NaN, Infinity]) {
    assert.equal(hasPendingManualApproval({ ...pending, testScore: score }), false, String(score));
  }
});
