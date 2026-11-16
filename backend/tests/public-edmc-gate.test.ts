import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/app';

test('E-DMC public endpoint is closed until explicitly authorized, then rejects incomplete credentials', async () => {
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
      body: JSON.stringify({ rollNumber: 'EXAM-1234', cnic: '1234567890123' }),
    });
    assert.equal(closed.status, 503);
    assert.match(closed.headers.get('cache-control') ?? '', /no-store/);
    assert.equal((await closed.json() as any).success, false);

    process.env.AZM_PUBLIC_EDMC_ENABLED = 'true';
    const malformed = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber: 'EXAM-1234', cnic: '123' }),
    });
    assert.equal(malformed.status, 400, 'Invalid CNIC must be rejected before any DB lookup');
  } finally {
    if (original === undefined) delete process.env.AZM_PUBLIC_EDMC_ENABLED;
    else process.env.AZM_PUBLIC_EDMC_ENABLED = original;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
