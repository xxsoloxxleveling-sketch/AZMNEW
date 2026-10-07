import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';

async function run() {
  const { build } = require(path.resolve(__dirname, '../../node_modules/esbuild'));
  const bundled = await build({
    stdin: { contents: `export { mockApi } from './src/lib/mockApi';`, resolveDir: path.resolve(__dirname, '../..'), loader: 'ts' },
    bundle: true, write: false, format: 'iife', globalName: 'AttendanceApiTest', platform: 'browser',
    define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://attendance.test' }) },
    logLevel: 'silent',
  });
  let payload: any;
  let status = 200;
  let lastUrl = '';
  let lastOptions: RequestInit | undefined;
  let calls = 0;
  const storage = new Map<string, string>();
  const context = vm.createContext({
    console, setTimeout, clearTimeout, URLSearchParams, URL, AbortController, Headers, TextEncoder, TextDecoder,
    Blob, Response, Buffer, btoa, atob,
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    window: { location: { origin: 'http://attendance.test', hostname: 'attendance.test' } },
    fetch: async (url: string, options: RequestInit) => {
      calls++; lastUrl = url; lastOptions = options;
      return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
    },
  });
  vm.runInContext(bundled.outputFiles[0].text, context);
  const api = (context as any).AttendanceApiTest.mockApi;
  let passed = 0;
  const check = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log(`PASS: ${name}`); };
  const candidate = { studentId: 'c1', fullNameSnapshot: 'Frozen Candidate', rollNumberSnapshot: null, applicationNoSnapshot: 'APP-1', currentClassSnapshot: 'Informational class', seatNoSnapshot: null, status: 'NOT_MARKED', method: null, markedAt: null };
  const pagination = { page: 1, limit: 25, total: 1, totalPages: 1 };
  const stats = { expectedCount: 1, markedCount: 0, presentCount: 0, lateCount: 0, absentCount: 0, unmarkedCount: 1, attendancePercentage: 0 };
  const response = (data: unknown) => { status = 200; payload = { success: true, data }; };
  await check('roster call is typed, paginated and session scoped', async () => {
    response({ candidates: [candidate], pagination });
    const result = await api.getAttendanceSessionCandidates('session/a', { page: 1, limit: 25, search: 'APP-1' });
    assert.equal(result.candidates[0].studentId, 'c1');
    const url = new URL(lastUrl); assert.equal(url.pathname, '/api/attendance/sessions/session%2Fa/candidates');
    assert.equal(url.searchParams.get('search'), 'APP-1'); assert.equal(url.searchParams.get('limit'), '25'); assert(!url.searchParams.has('class'));
  });
  await check('truthful empty roster is accepted', async () => {
    response({ candidates: [], pagination: { ...pagination, total: 0, totalPages: 0 } });
    assert.equal((await api.getAttendanceSessionCandidates('s1')).candidates.length, 0);
  });
  await check('missing roster is rejected rather than empty', async () => {
    response({ pagination }); await assert.rejects(() => api.getAttendanceSessionCandidates('s1'), /Invalid frozen attendance roster/);
  });
  await check('invalid roster status is rejected', async () => {
    response({ candidates: [{ ...candidate, status: 'EXCUSED' }], pagination }); await assert.rejects(() => api.getAttendanceSessionCandidates('s1'), /Invalid frozen attendance roster/);
  });
  await check('invalid pagination is rejected', async () => {
    response({ candidates: [candidate], pagination: { ...pagination, total: -1 } }); await assert.rejects(() => api.getAttendanceSessionCandidates('s1'), /Invalid attendance pagination/);
  });
  await check('roster HTTP failures propagate', async () => {
    status = 503; payload = { success: false, error: { message: 'Roster unavailable' } }; await assert.rejects(() => api.getAttendanceSessionCandidates('s1'), /Roster unavailable/);
  });
  await check('malformed metrics cannot fabricate a session summary', async () => {
    response({ session: { id: 's1', examHallId: 'h1' }, stats: { ...stats, expectedCount: undefined }, roster: [candidate] }); await assert.rejects(() => api.getAttendanceSession('s1'), /Invalid examination attendance metrics/);
  });
  await check('inconsistent counts are rejected', async () => {
    response({ session: { id: 's1', examHallId: 'h1' }, stats: { ...stats, markedCount: 1 }, roster: [candidate] }); await assert.rejects(() => api.getAttendanceSession('s1'), /Inconsistent examination attendance metrics/);
  });
  await check('no denominator accepts null and rejects fabricated zero percentage', async () => {
    const empty = { ...stats, expectedCount: 0, unmarkedCount: 0, attendancePercentage: null };
    response({ session: { id: 's1', examHallId: 'h1' }, stats: empty, roster: [] }); assert.equal((await api.getAttendanceSession('s1')).stats.attendancePercentage, null);
    response({ session: { id: 's1', examHallId: 'h1' }, stats: { ...empty, attendancePercentage: 0 }, roster: [] }); await assert.rejects(() => api.getAttendanceSession('s1'), /Inconsistent examination attendance metrics/);
  });
  await check('history retains labelled legacy records outside session metrics', async () => {
    response({ student: { id: 'c1' }, stats, history: [], pagination, legacyHistory: [{ id: 'old', label: 'Legacy attendance record' }] });
    const result = await api.getStudentAttendanceHistory('c1'); assert.equal(result.legacyHistory[0].label, 'Legacy attendance record'); assert.equal(result.stats.expectedCount, 1);
  });
  await check('opening cannot succeed without a backend session identity', async () => {
    response({ session: { examHallId: 'h1', status: 'OPEN' }, stats, roster: [candidate] }); await assert.rejects(() => api.createAttendanceSession({ examHallId: 'h1' }), /Invalid attendance session identity/);
  });
  console.log(`Attendance 13B adapter: ${passed} PASS, 0 FAIL.`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
