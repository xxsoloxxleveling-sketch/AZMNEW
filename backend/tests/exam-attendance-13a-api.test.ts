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
  const stats = { expectedCount: 1, markedCount: 1, presentCount: 1, lateCount: 0, absentCount: 0, unmarkedCount: 0, attendancePercentage: 100 };
  const detail = { session: { id: 's1', examHallId: 'h1' }, stats, roster: [] };

  await check('paginated session list uses route and filters', async () => {
    payload = { success: true, data: { sessions: [], pagination: { page: 2, limit: 10, total: 0, totalPages: 0 } } };
    const result = await api.getAttendanceSessions({ page: 2, limit: 10 });
    assert.equal(result.sessions.length, 0);
    const query = new URL(lastUrl).searchParams;
    assert.equal(new URL(lastUrl).pathname, '/api/attendance/sessions');
    assert.equal(query.get('page'), '2'); assert.equal(query.get('limit'), '10');
  });
  await check('detail/create/close validate session payloads and routes', async () => {
    payload = { success: true, data: detail };
    assert.equal((await api.getAttendanceSession('s/1')).session.id, 's1');
    assert.match(lastUrl, /\/api\/attendance\/sessions\/s%2F1$/);
    await api.createAttendanceSession({ examHallId: 'h1' });
    assert.equal(new URL(lastUrl).pathname, '/api/attendance/sessions');
    assert.deepEqual(JSON.parse(String(lastOptions?.body)), { examHallId: 'h1' });
    await api.closeAttendanceSession('s1', { markRemainingAbsent: true });
    assert.equal(new URL(lastUrl).pathname, '/api/attendance/sessions/s1/close');
    assert.deepEqual(JSON.parse(String(lastOptions?.body)), { markRemainingAbsent: true });
    payload = { success: true, data: {} };
    await assert.rejects(() => api.getAttendanceSession('s1'), /Invalid attendance session detail/);
    await assert.rejects(() => api.createAttendanceSession({ examHallId: 'h1' }), /Invalid created attendance session/);
    await assert.rejects(() => api.closeAttendanceSession('s1'), /Invalid closed attendance session/);
  });
  await check('mark preserves identifier type and rejects missing session', async () => {
    payload = { success: true, data: { attendance: { id: 'a1' }, student: { id: 'st1' } } };
    const beforeMissingSession = calls;
    await assert.rejects(() => api.scanAttendance({ rollNumber: 'R-4', status: 'PRESENT' }), /session is required/);
    assert.equal(calls, beforeMissingSession);
    await api.scanAttendance({ sessionId: 's1', rollNumber: 'R-4', status: 'LATE' });
    assert.equal(new URL(lastUrl).pathname, '/api/attendance/sessions/s1/mark');
    assert.deepEqual(JSON.parse(String(lastOptions?.body)), { rollNumber: 'R-4', status: 'LATE' });
    await api.markAttendanceSession('s1', { qrToken: 'qr-4', status: 'PRESENT' });
    assert.deepEqual(JSON.parse(String(lastOptions?.body)), { qrToken: 'qr-4', status: 'PRESENT' });
    await assert.rejects(() => api.markAttendanceSession('s1', { studentId: 'st1', rollNumber: 'R-4', status: 'PRESENT' }), /exactly one/);
  });
  await check('session API propagates backend errors', async () => {
    status = 409; payload = { success: false, error: { message: 'Session is closed' } };
    await assert.rejects(() => api.getAttendanceSessions(), /Session is closed/);
    await assert.rejects(() => api.markAttendanceSession('s1', { studentId: 'st1', status: 'PRESENT' }), /Session is closed/);
    status = 200;
  });
  await check('today/history errors reject instead of producing zero or empty data', async () => {
    status = 503; payload = { success: false, error: { message: 'Attendance unavailable' } };
    await assert.rejects(() => api.getTodayAttendance(), /Attendance unavailable/);
    await assert.rejects(() => api.getStudentAttendanceHistory('st1'), /Attendance unavailable/);
    status = 200;
  });
  await check('malformed today response is unavailable, never synthetic zero', async () => {
    payload = { success: true, data: {} };
    await assert.rejects(() => api.getTodayAttendance(), /Invalid examination attendance summary/);
  });
  await check('dashboard uses session count and keeps a null percentage', async () => {
    const overview = { stats: { totalStudents: 50 }, attendanceToday: { sessionCount: 0, expectedCount: 8, markedCount: 5, presentCount: 4, lateCount: 1, absentCount: 0, unmarkedCount: 3, attendancePercentage: null }, period: { date: '2026-10-07' } };
    const callsLeft = async (url: string) => url.includes('/api/fees?status=UNPAID')
      ? { success: true, data: [] }
      : { success: true, data: overview };
    const originalFetch = context.fetch;
    context.fetch = async (url: string, options: RequestInit) => {
      calls++; lastUrl = url; lastOptions = options;
      const responsePayload = await callsLeft(url);
      return new Response(JSON.stringify(responsePayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const result = await api.getDashboardOverview();
    assert.equal(result.attendanceToday.sessionCount, 0);
    assert.equal(result.attendanceToday.attendancePercentage, null);
    assert.equal(result.stats.attendancePercentage, null);
    assert.equal(result.attendanceTrends.find((item: any) => item.isToday).hasSession, false);
    context.fetch = originalFetch;
  });
  console.log(`Exam attendance API contract: ${passed} PASS, 0 FAIL.`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
