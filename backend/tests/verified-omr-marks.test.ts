import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOmrMarkVerificationQuery, provisionalEdmcOutcome } from '../src/modules/students/provisionalOmrMarks';
import app from '../src/app';

test('signed OMR verification RPC casts every PostgreSQL argument explicitly', () => {
  const query = buildOmrMarkVerificationQuery(
    'student-123', 78, 'Sheet Archive REF 2026V-001',
    'Student, class and printed paper version checked against the original signed sheet.',
    true, true, true, 'superadmin-1',
  );
  assert.match(query.sql, /azm_verify_omr_mark\(/);
  assert.match(query.sql, /\?::integer/);
  assert.equal((query.sql.match(/::boolean/g) ?? []).length, 3);
  assert.equal((query.sql.match(/::text/g) ?? []).length, 4);
  assert.deepEqual(query.values, [
    'student-123', 78, 'Sheet Archive REF 2026V-001',
    'Student, class and printed paper version checked against the original signed sheet.',
    true, true, true, 'superadmin-1',
  ]);
});

test('marks exactly at passing boundary are not a pass', () => {
  assert.equal(provisionalEdmcOutcome(60, 100).resultStatus, 'FAIL');
  assert.equal(provisionalEdmcOutcome(61, 100).resultStatus, 'PASS');
});

test('Super Admin verification API is not publicly accessible', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/students/synthetic-student/verify-omr-mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedCurrentMarks: 78,
        evidenceReference: 'Original sheet archive reference 2026-001',
        reason: 'Checked the original answer sheet and registration identity in full.',
        identityReviewed: true, paperVersionReviewed: true, printedClassReviewed: true,
      }),
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
