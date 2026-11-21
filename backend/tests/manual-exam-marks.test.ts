import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { manualExamMarkEntrySchema } from '../src/modules/students/students.schema';
import { buildManualExamMarkEntryQuery, publicCurrentManualMarks } from '../src/modules/students/manualExamMarks';
import app from '../src/app';

const valid = {
  obtainedMarks: 78,
  evidenceReference: 'SIGNED-EXAM-REGISTER-2026-V-001',
  reason: 'Examiner signed the checked mark register and approved this manual entry.',
  identityReviewed: true,
  attendanceReviewed: true,
} as const;

test('manual entry requires exact marks, evidence, a detailed reason and two confirmations', () => {
  assert.equal(manualExamMarkEntrySchema.safeParse(valid).success, true);
  assert.equal(manualExamMarkEntrySchema.safeParse({ ...valid, obtainedMarks: 0 }).success, true);
  assert.equal(manualExamMarkEntrySchema.safeParse({ ...valid, obtainedMarks: 100 }).success, true);
  for (const bad of [
    { ...valid, obtainedMarks: -1 },
    { ...valid, obtainedMarks: 101 },
    { ...valid, obtainedMarks: 78.5 },
    { ...valid, reason: 'Too short' },
    { ...valid, evidenceReference: 'missing' },
    { ...valid, identityReviewed: false },
    { ...valid, attendanceReviewed: false },
    { ...valid, unexpected: 'extra' },
  ]) {
    assert.equal(manualExamMarkEntrySchema.safeParse(bad).success, false);
  }
});

test('the manual entry SQL uses explicit types and the authorized DB function', () => {
  const query = buildManualExamMarkEntryQuery(
    'student-A', 75, valid.evidenceReference, valid.reason, true, true, 'super-admin-A',
  );
  assert.match(query.sql, /public\.azm_record_manual_exam_mark/);
  assert.match(query.sql, /::integer/);
  assert.equal((query.sql.match(/::boolean/g) || []).length, 2);
  assert.deepEqual(query.values, [
    'student-A', 75, valid.evidenceReference, valid.reason, true, true, 'super-admin-A',
  ]);
});

test('public manual marks expose only a review-pending score, never scan claims or identity', () => {
  const payload = publicCurrentManualMarks({
    obtainedMarks: 61, maximumMarks: 100,
    publishedAt: new Date('2026-11-16T06:00:00.000Z'),
  });
  assert.equal(payload.status, 'REVIEW_REQUIRED');
  assert.equal(payload.source, 'MANUAL_ENTRY');
  assert.equal(payload.resultStatus, 'PASS');
  assert.equal(payload.obtainedMarks, 61);
  const text = JSON.stringify(payload);
  for (const forbidden of ['fullName', 'fatherName', 'rollNumber', 'cnicOrBForm',
    'applicationNo', 'scanSha256', 'actorName', 'sourceEvidenceReference']) {
    assert.ok(!text.includes(forbidden), 'Leaked private field: '+forbidden);
  }
  assert.equal(publicCurrentManualMarks({
    obtainedMarks: 60, maximumMarks: 100,
    publishedAt: new Date('2026-11-16T06:00:00.000Z'),
  }).resultStatus, 'PASS');
});

test('manual-mark endpoint cannot be used by an unauthenticated visitor', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert(address && typeof address !== 'string');
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/students/synthetic/manual-exam-mark`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) },
    );
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('migration is append-only, keeps old OMR marks, blocks duplicate sources', () => {
  const migration = fs.readFileSync(path.join(process.cwd(),
    'prisma/migrations/20261116110000_superadmin_manual_exam_mark_entry/migration.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE public\."ManualExamMark"/);
  assert.match(migration, /CREATE TRIGGER "ManualExamMark_immutable"/);
  assert.match(migration, /"OmrProvisionalMark_manual_source_exclusion"/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /SUPER_ADMIN_REQUIRED/);
  assert.match(migration, /STUDENT_ALREADY_HAS_MARKS/);
  assert.match(migration, /OFFICIAL_RESULT_ALREADY_RECORDED/);
  assert.doesNotMatch(migration, /UPDATE public\."OmrProvisionalMark"/);
  assert.doesNotMatch(migration, /DELETE FROM public\."OmrProvisionalMark"/);
});
