import assert from 'node:assert/strict';
import test from 'node:test';
import { publicCurrentOmrMarks, type ProvisionalOmrMark } from '../src/modules/students/provisionalOmrMarks';
import { studentsService } from '../src/modules/students/students.service';

const mark = (score: number): ProvisionalOmrMark => ({
  studentId: 'private-student-id', obtainedMarks: score, maximumMarks: 100,
  publishedAt: new Date('2026-11-16T01:00:00.000Z'),
  originalScannedMarks: 66, manuallyCorrected: true,
  reviewCategory: 'HOLD_IDENTITY', identityStatus: 'POSSIBLE_ROLL_ONLY',
  paperVersionStatus: 'AUTO_PROVISIONAL', printedClassDisagrees: false,
  manualReviewRequired: true, verified: false, verifiedAt: null,
});

test('unverified marks public response contains only recorded score, not PII or scanned evidence', () => {
  const output = publicCurrentOmrMarks(mark(75));
  assert.equal(output.status, 'REVIEW_REQUIRED');
  assert.equal(output.obtainedMarks, 75, 'Latest effective Super Admin-corrected score must be used');
  assert.equal(output.maximumMarks, 100);
  assert.equal(output.percentage, 75);
  assert.equal(output.resultStatus, 'PASS');
  assert.match(output.notice, /review|verified|correct/i);
  const body = JSON.stringify(output);
  for (const privateValue of ['private-student-id','HOLD_IDENTITY','POSSIBLE_ROLL_ONLY','AUTO_PROVISIONAL',
    'fullName','fatherName','photoDataUrl','rollNumber','applicationNo','scanSha256','originalScannedMarks']) {
    assert.ok(!body.includes(privateValue), 'Public data exposed private value: '+privateValue);
  }
});

test('public current-score rule fails at 60 and passes at 61, never implies verification', () => {
  assert.equal(publicCurrentOmrMarks(mark(60)).resultStatus, 'FAIL');
  assert.equal(publicCurrentOmrMarks(mark(61)).resultStatus, 'PASS');
  assert.equal(publicCurrentOmrMarks(mark(61)).status, 'REVIEW_REQUIRED');
  assert.throws(() => publicCurrentOmrMarks(mark(101)));
});


test('trivially repeated-digit legacy CNIC identifiers cannot reveal public results', async () => {
  for (const placeholder of ['0000000000000','1111111111111','9999999999999']) {
    const result = await studentsService.lookupProvisionalOmrMarks(placeholder);
    assert.equal(result.found, false);
    assert.ok(!('data' in result), 'Placeholder CNIC unexpectedly yielded student details');
  }
});
