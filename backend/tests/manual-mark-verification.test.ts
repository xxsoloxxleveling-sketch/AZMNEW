import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { verifiedManualExamMarkSchema } from '../src/modules/students/students.schema';
import { buildManualExamVerificationQuery } from '../src/modules/students/manualExamMarks';
import { buildVerifiedEdmcHtml } from '../src/modules/students/verifiedEdmcPdf';
import app from '../src/app';

const valid = {
  expectedCurrentMarks: 82,
  evidenceReference: 'SIGNED-REGISTER-2026-V-VERIFY-01',
  reason: 'Independently compared the signed examination register, student identity, attendance and total.',
  identityReviewed: true,
  attendanceReviewed: true,
  marksEvidenceReviewed: true,
} as const;

test('manual verification is evidence-gated, score-specific and disallows extra fields', () => {
  assert.equal(verifiedManualExamMarkSchema.safeParse(valid).success, true);
  for (const invalid of [
    { ...valid, expectedCurrentMarks: -1 },
    { ...valid, expectedCurrentMarks: 101 },
    { ...valid, expectedCurrentMarks: 82.5 },
    { ...valid, evidenceReference: 'short' },
    { ...valid, reason: 'short' },
    { ...valid, identityReviewed: false },
    { ...valid, attendanceReviewed: false },
    { ...valid, marksEvidenceReviewed: false },
    { ...valid, actorId: 'spoofed-actor' },
  ]) assert.equal(verifiedManualExamMarkSchema.safeParse(invalid).success, false);
});

test('database verification call uses parameters and exact expected marks', () => {
  const sql = buildManualExamVerificationQuery(
    'candidate', 82, valid.evidenceReference, valid.reason, true, true, true, 'reviewer',
  );
  assert.match(sql.sql, /azm_verify_manual_exam_mark/);
  assert.match(sql.sql, /::integer/);
  assert.equal((sql.sql.match(/::boolean/g) || []).length, 3);
  assert.deepEqual(sql.values, [
    'candidate', 82, valid.evidenceReference, valid.reason, true, true, true, 'reviewer',
  ]);
});

test('verified E-DMC labels manual source without inventing an OMR answer sheet', () => {
  const html = buildVerifiedEdmcHtml({
    fullName: 'Synthetic Exam Candidate',
    fatherName: 'Synthetic Parent',
    rollNumber: 'AZM-TEST-1', applicationNo: 'APP-TEST-1',
    className: 'Class 6', studyGroup: null, semester: null,
    schoolName: 'Synthetic School', district: null, testCenter: null,
    verifiedAt: new Date('2026-11-17T10:00:00Z'),
    obtainedMarks: 82, maximumMarks: 100,
    resultSource: 'MANUAL_ENTRY',
    photoDataUrl: null, logoDataUrl: null,
  });
  assert.match(html, /Verified administrative mark entry/);
  assert.match(html, /82/);
  assert.doesNotMatch(html, /Scanned OMR original sheet/);
});

test('unauthenticated manual verification endpoint rejects a write before validation', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert(address && typeof address !== 'string');
    const res = await fetch(`http://127.0.0.1:${address.port}/api/students/synthetic/verify-manual-exam-mark`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid),
    });
    assert.equal(res.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('manual verification migration is append-only and uses restricted database RPC', () => {
  const text = fs.readFileSync(path.join(process.cwd(),
    'prisma/migrations/20261117110000_verified_manual_exam_mark_audit/migration.sql'), 'utf8');
  assert.match(text, /CREATE TABLE public\."ManualExamMarkVerificationAudit"/);
  assert.match(text, /"ManualExamMarkVerificationAudit_immutable"/);
  assert.match(text, /CREATE FUNCTION public\.azm_verify_manual_exam_mark/);
  assert.match(text, /FROM public\."Student" s WHERE s\.id=p_student_id FOR UPDATE;/);
  // Existing ManualExamMark is postgres-owned in production. The immutable
  // source needs SELECT, not an UPDATE-capable row lock, under student_app.
  const markRead = text.match(/SELECT m\.\* INTO v_mark[\s\S]*?;/)?.[0];
  assert.ok(markRead, 'Verification must read the original manual score');
  assert.doesNotMatch(markRead, /FOR (UPDATE|NO KEY UPDATE|SHARE|KEY SHARE)/);
  assert.match(text, /MANUAL_MARK_ALREADY_VERIFIED/);
  assert.match(text, /STALE_MANUAL_MARK/);
  assert.match(text, /MANUAL_IDENTITY_MISMATCH/);
  assert.doesNotMatch(text, /UPDATE public\."ManualExamMark"/);
  assert.doesNotMatch(text, /UPDATE public\."OmrProvisionalMark"/);
  assert.doesNotMatch(text, /DELETE FROM public\."ManualExamMark"/);
});
