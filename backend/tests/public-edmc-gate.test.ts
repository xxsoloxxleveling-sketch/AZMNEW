import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/app';
import { publicEdmcLookupSchema } from '../src/modules/students/students.schema';

test('CNIC-only E-DMC schema validates exact identifiers and rejects roll-number fields', () => {
  assert.equal(publicEdmcLookupSchema.safeParse({ cnic: '1234567890123' }).success, true);
  assert.equal(publicEdmcLookupSchema.safeParse({ cnic: '12345-6789012-3' }).success, true);
  assert.equal(publicEdmcLookupSchema.safeParse({ cnic: '123' }).success, false);
  assert.equal(publicEdmcLookupSchema.safeParse({ rollNumber: 'EXAM-1234', cnic: '1234567890123' }).success, false);
});

test('E-DMC lookup remains closed and rejects malformed or extra identifiers when enabled', async () => {
  const original = process.env.AZM_PUBLIC_EDMC_ENABLED;
  delete process.env.AZM_PUBLIC_EDMC_ENABLED;
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert(address && typeof address !== 'string');
    const endpoint = `http://127.0.0.1:${address.port}/api/students/public/omr-marks`;

    const closed = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnic: '1234567890123' }),
    });
    assert.equal(closed.status, 503);
    assert.match(closed.headers.get('cache-control') ?? '', /no-store/);
    assert.equal((await closed.json() as any).success, false);

    process.env.AZM_PUBLIC_EDMC_ENABLED = 'true';
    const malformed = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnic: '123' }),
    });
    assert.equal(malformed.status, 400, 'Invalid CNIC must be rejected before any DB lookup');
    const disallowRoll = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber: 'EXAM-1234', cnic: '1234567890123' }),
    });
    assert.equal(disallowRoll.status, 400, 'Roll number is not a required or accepted E-DMC lookup field');
  } finally {
    if (original === undefined) delete process.env.AZM_PUBLIC_EDMC_ENABLED;
    else process.env.AZM_PUBLIC_EDMC_ENABLED = original;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
