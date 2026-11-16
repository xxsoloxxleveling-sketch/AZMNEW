import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/app';
import { bulkVerifiedOmrMarkSchema } from '../src/modules/students/students.schema';

const reason = 'All selected original OMR sheets, versions and identity documents were reviewed before batch attestation.';
const evidenceReference = 'Signed batch review register 2026-V-001';
const student = (id: string) => ({ studentId: id, expectedCurrentMarks: 78 });

test('batch verification requires unique students and verified evidence', () => {
  const base = {
    students: [student('student-a'), student('student-b')],
    evidenceReference, reason,
    identityReviewed: true, paperVersionReviewed: true, printedClassReviewed: true,
  };
  assert.equal(bulkVerifiedOmrMarkSchema.safeParse(base).success, true);
  assert.equal(bulkVerifiedOmrMarkSchema.safeParse({ ...base, students: [student('a'), student('a')] }).success, false);
  assert.equal(bulkVerifiedOmrMarkSchema.safeParse({ ...base, students: Array.from({ length: 101 }, (_, i) => student(String(i))) }).success, false);
  assert.equal(bulkVerifiedOmrMarkSchema.safeParse({ ...base, paperVersionReviewed: false }).success, false);
  assert.equal(bulkVerifiedOmrMarkSchema.safeParse({ ...base, students: [{ ...student('a'), expectedCurrentMarks: 101 }] }).success, false);
});

test('batch endpoint denies unauthenticated verification', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const addr = server.address();
    assert(addr && typeof addr !== 'string');
    const response = await fetch('http://127.0.0.1:' + addr.port + '/api/students/verify-selected-omr-marks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        students: [student('synthetic-student')],
        evidenceReference, reason,
        identityReviewed: true, paperVersionReviewed: true, printedClassReviewed: true,
      }),
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
});
