import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/app';
import { assertVerifiedEdmcScore, buildVerifiedEdmcHtml } from '../src/modules/students/verifiedEdmcPdf';
import type { ProvisionalOmrMark } from '../src/modules/students/provisionalOmrMarks';

function mark(verified: boolean, score: number): ProvisionalOmrMark {
  return {
    verified, verifiedAt: verified ? new Date('2026-11-16T08:00:00Z') : null,
    obtainedMarks: score, maximumMarks: 100,
  } as ProvisionalOmrMark;
}

test('verified E-DMC cannot be issued for an unverified score', () => {
  assert.throws(() => assertVerifiedEdmcScore(mark(false, 78)), /Verify this student/);
  assert.doesNotThrow(() => assertVerifiedEdmcScore(mark(true, 78)));
  assert.doesNotThrow(() => assertVerifiedEdmcScore(mark(true, 60)));
});

test('certificate escapes student data, includes AZM notices and no subject-wise scores', () => {
  const html = buildVerifiedEdmcHtml({
    fullName: '<script>alert(1)</script>', fatherName: 'Khan & Sons',
    rollNumber: 'AZMVS-2026-001', applicationNo: 'APP-0001',
    className: 'Class 10', studyGroup: null, semester: null,
    schoolName: 'School of Learning', district: 'Abbottabad', testCenter: null,
    verifiedAt: new Date('2026-11-16T08:00:00Z'),
    obtainedMarks: 61, maximumMarks: 100, photoDataUrl: null, logoDataUrl: null,
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Khan &amp; Sons/);
  assert.match(html, /Final obtained marks/);
  assert.match(html, /Original DMC/);
  assert.match(html, /second phase of selection will be interviews/);
  assert.match(html, /does not guarantee the award of a scholarship/);
  assert.match(html, /61<small> \/ 100/);
  assert.match(html, /Result status/);
  assert.match(html, /PASS/);
  assert.doesNotMatch(html, /Mathematics|English Marks|Science Marks/);
});

test('the protected E-DMC PDF endpoint rejects unauthenticated requests', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert(address && typeof address !== 'string');
    const response = await fetch(
      'http://127.0.0.1:' + address.port + '/api/students/synthetic/verified-edmc.pdf',
    );
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve,reject) =>
      server.close(error => error ? reject(error) : resolve()));
  }
});
