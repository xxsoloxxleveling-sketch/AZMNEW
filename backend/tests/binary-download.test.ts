import assert from 'node:assert/strict';

async function run() {
  const values = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  let clicks = 0;
  let revoked = false;
  const timers: (() => void)[] = [];
  (globalThis as any).window = {
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => { revoked = true; } },
    setTimeout: (fn: () => void) => timers.push(fn),
  };
  (globalThis as any).document = {
    createElement: () => ({ click: () => { clicks++; } }),
    body: { appendChild: () => {}, removeChild: () => {} },
  };
  const { setToken, setRefreshToken } = await import('../../src/lib/auth');
  const { apiDownloadPdf, apiFetchProtectedObjectUrl } = await import('../../src/lib/apiClient');
  let refreshes = 0;
  globalThis.fetch = async (url: any, options: any) => {
    if (String(url).endsWith('/api/auth/refresh')) {
      refreshes++;
      return Response.json({ success: true, data: { accessToken: 'fresh' } });
    }
    if (options.headers.Authorization !== 'Bearer fresh') return new Response('', { status: 401 });
    return new Response('%PDF-test', { headers: { 'Content-Type': 'application/pdf' } });
  };
  setToken('expired'); setRefreshToken('refresh');
  await apiDownloadPdf('/api/students/a/roll-slip-pdf', 'slip.pdf');
  assert.equal(clicks, 1);
  assert.equal(refreshes, 1);
  assert.equal(revoked, false, 'Blob URL must survive the download click');
  timers.forEach(fn => fn());
  assert.equal(revoked, true);
  setToken('expired');
  assert.equal(await apiFetchProtectedObjectUrl('/api/students/a/document/photoThumbnail'), 'blob:test');
  assert.equal(refreshes, 2, 'Photo requests must refresh expired tokens too');
  console.log('PASS: PDF and photo token refresh, download click and deferred blob cleanup');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
