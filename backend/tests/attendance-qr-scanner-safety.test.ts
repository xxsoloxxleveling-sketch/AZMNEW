import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import express from 'express';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'backend');
let passed = 0;
const check = async (label: string, work: () => unknown | Promise<unknown>) => { await work(); passed++; console.log('PASS: ' + label); };

async function adapterChecks() {
  const { build } = require(path.join(root, 'node_modules/esbuild'));
  const bundle = await build({ stdin: { contents: `export { mockApi } from './src/lib/mockApi';`, resolveDir: root, loader: 'ts' }, bundle: true, write: false, format: 'iife', globalName: 'Api', platform: 'browser', define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://attendance.test' }) }, logLevel: 'silent' });
  let code = 200, payload: unknown, networkFailure = false, calls = 0, lastUrl = '', lastBody: any;
  const storage = new Map<string, string>();
  const context = vm.createContext({ console, setTimeout, clearTimeout, URL, URLSearchParams, AbortController, Headers, Response, Blob, Buffer, btoa, atob, TextEncoder, TextDecoder,
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    window: { location: { origin: 'http://attendance.test', hostname: 'attendance.test' } },
    fetch: async (url: string, options: RequestInit) => { calls++; lastUrl = url; lastBody = JSON.parse(String(options.body)); if (networkFailure) throw new Error('Network unavailable'); return new Response(JSON.stringify(payload), { status: code, headers: { 'Content-Type': 'application/json' } }); },
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  const api = (context as any).Api.mockApi;
  const token = 'qr_fixture_1.' + 'a'.repeat(64);
  const result = { attendance: { id: 'persisted', sessionId: 's1', studentId: 'c1', status: 'PRESENT', method: 'QR_SCAN', markedByUserId: 'real-staff', createdAt: '2026-10-08T10:00:00Z' }, student: { id: 'c1', fullName: 'Frozen candidate', status: 'ACTIVE', rollNumber: 'R1', currentClass: 'Class 9th' } };
  const scan = (qrToken = token) => api.scanAttendance({ sessionId: 's1', qrToken });
  await check('adapter uses scan route and normalizes only AZM signed token URLs', async () => {
    payload = { success: true, data: result };
    for (const text of [token, '/attend?token=' + token, 'https://azmaio.com/attend?token=' + token]) {
      assert.equal((await scan(text)).attendance.id, 'persisted'); assert.equal(new URL(lastUrl).pathname, '/api/attendance/scan'); assert.deepEqual(lastBody, { sessionId: 's1', qrToken: token, status: 'PRESENT' });
    }
    const previous = calls;
    for (const text of ['R1', '1234567890123', 'APP-1', 'https://evil.test/attend?token=' + token, '/elsewhere?token=' + token, '/attend?token=' + token + '&token=' + token, token + '.extra']) await assert.rejects(() => scan(text), /Invalid Candidate QR/);
    assert.equal(calls, previous);
  });
  await check('HTTP/network/auth failures throw with no student lookup or fabricated attendance', async () => {
    for (const status of [400, 401, 403, 404, 409, 503]) { code = status; payload = { success: false, error: { message: 'Fixture failure' } }; const previous = calls; await assert.rejects(scan); assert.equal(calls, previous + 1); }
    networkFailure = true; const previous = calls; await assert.rejects(scan); assert.equal(calls, previous + 1); networkFailure = false; code = 200;
  });
  await check('malformed or wrong-session success responses cannot confirm persistence', async () => {
    for (const data of [{}, { attendance: {}, student: {} }, { ...result, attendance: { ...result.attendance, sessionId: 'other' } }, { ...result, attendance: { ...result.attendance, markedByUserId: '' } }, { ...result, attendance: { ...result.attendance, createdAt: 'bad-date' } }, { ...result, attendance: { ...result.attendance, status: 'ABSENT' } }]) {
      payload = { success: true, data }; await assert.rejects(scan, /persisted attendance record/);
    }
    payload = { success: true, data: { ...result, alreadyMarked: true, attendance: { ...result.attendance, status: 'LATE', method: 'MANUAL' } } };
    assert.equal((await scan()).attendance.status, 'LATE');
  });
  await check('manual compatibility still calls the unchanged session mark adapter', async () => {
    payload = { success: true, data: { attendance: { id: 'manual' }, student: { id: 'c1' } } };
    await api.scanAttendance({ sessionId: 's1', rollNumber: 'R1', status: 'LATE' });
    assert.equal(new URL(lastUrl).pathname, '/api/attendance/sessions/s1/mark'); assert.equal(lastBody.status, 'LATE');
  });
}

async function browserChecks(app: ReturnType<typeof express>, detail: any, tokens: string[]) {
  const { build } = require(path.join(root, 'node_modules/esbuild'));
  const qrImages = await Promise.all(tokens.map(token => QRCode.toDataURL(token, { scale: 8, margin: 4 })));
  const fixture = `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import jsQR from 'jsqr';
    import { QrScannerTab } from './src/components/admin/attendance/QrScannerTab';
    import { AttendanceHubView } from './src/components/admin/attendance/AttendanceHubView';
    const root = createRoot(document.getElementById('root'));
    const detail = ${JSON.stringify(detail)};
    window.__images = ${JSON.stringify(qrImages)};
    window.__calls = 0; window.__beeps = 0; window.__vibrations = 0; window.__stops = 0; window.__mode = ''; window.__cameraDelay = false;
    Object.defineProperty(navigator, 'vibrate', { value: () => { window.__vibrations++; return true; } });
    window.AudioContext = class { currentTime = 0; destination = {}; createGain() { return { gain: {value:0}, connect() {} }; } createOscillator() { return { frequency: {value:0}, connect() {}, start() { window.__beeps++; }, stop() { this.onended?.(); } }; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } };
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (url, options) => {
      if (String(url).includes('/api/attendance/scan')) {
        window.__calls++;
        if (window.__mode === 'hold') await new Promise(resolve => { window.__releaseScan = resolve; });
        if (window.__mode === 'fail') return new Response(JSON.stringify({success:false,error:{message:'Offline'}}), {status:503});
      }
      return nativeFetch(url, options);
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      if (window.__cameraDelay) await new Promise(resolve => { window.__releaseCamera = resolve; });
      const canvas = document.createElement('canvas'); canvas.width=640; canvas.height=480;
      const context = canvas.getContext('2d');
      let activeImage;
      const paint = () => { context.fillStyle='white'; context.fillRect(0,0,640,480); if(activeImage) context.drawImage(activeImage,Math.floor((640-activeImage.width)/2),Math.floor((480-activeImage.height)/2)); };
      const draw = async index => { const image = new Image(); image.src = window.__images[index]; await image.decode(); activeImage=image; paint(); };
      await draw(0); window.__showQr = draw;
      const stream = canvas.captureStream(15);
      const repaint=setInterval(paint,65);
      stream.getTracks().forEach(track => { const stop=track.stop.bind(track); track.stop=()=>{clearInterval(repaint);window.__stops++;stop();}; });
      return stream;
    } });
    window.__unmount = () => root.render(null);
    window.__hubMount = () => root.render(<AttendanceHubView role="TEACHER" />);
    window.__readQr = () => { const video=document.querySelector('video'); if(!video?.videoWidth) return ''; const canvas=document.createElement('canvas'); canvas.width=video.videoWidth; canvas.height=video.videoHeight; const context=canvas.getContext('2d'); context.drawImage(video,0,0); const image=context.getImageData(0,0,canvas.width,canvas.height); return jsQR(image.data,image.width,image.height)?.data; };
    window.__mount = () => root.render(<QrScannerTab detail={detail} onManualAttendance={() => { root.render(<p>Manual attendance selected</p>); }} />);
    window.__mount();
  `;
  const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: root }, bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'import.meta.env': JSON.stringify({ PROD: true }) }, logLevel: 'silent', plugins: [{ name: 'fixture-auth', setup(builder: any) {
    builder.onResolve({ filter: /authContext$/ }, () => ({ path: 'fixture-auth', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useAuth=()=>({isLoading:false,role:"TEACHER"});', loader: 'js' }));
  } }] });
  const cssDir = path.join(root, 'dist/assets');
  const css = fs.readFileSync(path.join(cssDir, fs.readdirSync(cssDir).find(name => name.endsWith('.css'))!), 'utf8');
  app.get('/fixture.js', (_req, res) => res.type('js').send(bundle.outputFiles[0].text));
  app.get('/fixture.css', (_req, res) => res.type('css').send(css));
  app.get('/', (_req, res) => res.send('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync(localChrome) ? localChrome : undefined), args: ['--no-sandbox'] });
    const page = await browser.newPage(); const errors: string[] = [];
    page.on('pageerror', error => errors.push(String(error)));
    const url = `http://127.0.0.1:${(server.address() as any).port}`;
    await page.goto(url);
    const click = async (label: string) => { await page.evaluate(text => { const button = Array.from(document.querySelectorAll('button')).find(item => item.textContent === text); if (!button || button.disabled) throw new Error('Unavailable button: ' + text); button.click(); }, label); };
    const textIncludes = (text: string) => page.waitForFunction(text => document.body.innerText.includes(text), {}, text);
    await check('desktop/mobile scanner layouts have no overflow and keyboard focus is visible', async () => {
      for (const width of [1280, 768, 390]) { await page.setViewport({ width, height: 900 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
      await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'BUTTON');
      assert(await page.evaluate(() => { const style = getComputedStyle(document.activeElement!); return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0; }));
      await page.screenshot({ path: path.join(root, 'dist/scanner-mobile-qa.png') });
    });
    await check('real jsQR decode locks same/different candidates until explicit next, feedback follows persistence', async () => {
      await page.evaluate(() => { (window as any).__mode = 'hold'; });
      await click('Connect camera'); await textIncludes('QR detected — verifying attendance');
      assert.equal(await page.evaluate(() => (window as any).__beeps + (window as any).__vibrations), 0);
      await page.evaluate(() => (window as any).__showQr(1));
      await page.waitForFunction(token => (window as any).__readQr() === token, { timeout: 5000 }, tokens[1]);
      await new Promise(resolve => setTimeout(resolve, 500));
      assert.equal(await page.evaluate(() => (window as any).__calls), 1);
      await page.evaluate(() => { (window as any).__mode = ''; (window as any).__releaseScan(); });
      await textIncludes('Attendance Marked');
      assert.equal(await page.evaluate(() => (window as any).__beeps), 1); assert.equal(await page.evaluate(() => (window as any).__vibrations), 1);
      await page.screenshot({ path: path.join(root, 'dist/scanner-success-mobile-qa.png') });
      await page.setViewport({ width: 1280, height: 900 });
      await page.screenshot({ path: path.join(root, 'dist/scanner-success-desktop-qa.png') });
      await new Promise(resolve => setTimeout(resolve, 350)); assert.equal(await page.evaluate(() => (window as any).__calls), 1);
      await click('Scan Next Candidate'); await textIncludes('Attendance Marked');
      assert.equal(await page.evaluate(() => (window as any).__calls), 2);
      assert(await page.evaluate(() => (document.querySelector('video') as HTMLVideoElement).srcObject !== null));
    });
    await check('duplicate presents the original record without positive beep/haptic', async () => {
      await page.evaluate(() => (window as any).__showQr(0)); await page.waitForFunction(token => (window as any).__readQr() === token, { timeout: 5000 }, tokens[0]); await click('Scan Next Candidate'); await textIncludes('Already Marked');
      assert.equal(await page.evaluate(() => (window as any).__beeps), 2); assert.equal(await page.evaluate(() => (window as any).__vibrations), 2);
      assert(await page.evaluate(() => document.body.innerText.includes('QR_SCAN')));
    });
    await check('failed backend scan remains NOT saved with no positive feedback; manual fallback releases camera', async () => {
      await page.evaluate(() => { (window as any).__mode = 'fail'; }); await click('Scan Next Candidate'); await textIncludes('Attendance NOT saved');
      assert.equal(await page.evaluate(() => (window as any).__beeps), 2); assert.equal(await page.evaluate(() => (window as any).__vibrations), 2);
      assert(!(await page.evaluate(() => document.body.innerText.includes('Attendance Marked'))));
      await page.screenshot({ path: path.join(root, 'dist/scanner-error-qa.png') });
      await click("Can't scan? Mark attendance manually"); await textIncludes('Manual attendance selected');
      assert((await page.evaluate(() => (window as any).__stops)) > 0);
    });
    await check('late camera resolutions after switch/unmount release stale tracks', async () => {
      await page.evaluate(() => { (window as any).__cameraDelay = true; (window as any).__mount(); }); await textIncludes('Connect camera'); await click('Connect camera');
      await page.waitForFunction(() => !!(window as any).__releaseCamera);
      await page.evaluate(() => { (window as any).__olderCamera = (window as any).__releaseCamera; }); await click('Switch camera');
      await page.waitForFunction(() => (window as any).__releaseCamera !== (window as any).__olderCamera);
      const previous = await page.evaluate(() => (window as any).__stops);
      await page.evaluate(() => (window as any).__olderCamera()); await page.waitForFunction(previous => (window as any).__stops > previous, {}, previous);
      await page.evaluate(() => { (window as any).__unmount(); (window as any).__releaseCamera(); }); await page.waitForFunction(previous => (window as any).__stops > previous + 1, {}, previous);
    });
    await check('camera permission errors expose reconnect and manual actions without raw exception', async () => {
      await page.evaluate("Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Private technical exception', 'NotAllowedError'); } }); window.__mount();");
      await textIncludes('Connect camera'); await click('Connect camera'); await textIncludes('Camera permission was denied');
      assert(!(await page.evaluate(() => document.body.innerText.includes('Private technical exception'))));
      assert.equal(errors.length, 0, errors.join('\n'));
    });
    await check('actual Attendance Hub switches from QR to the existing ManualAttendanceTab', async () => {
      await page.evaluate(() => (window as any).__hubMount()); await textIncludes('Candidate camera1');
      await click('QR attendance'); await textIncludes('Connect camera');
      await click("Can't scan? Mark attendance manually"); await textIncludes('Candidate camera1');
      assert(!(await page.evaluate(() => document.body.innerText.includes('Connect camera'))));
    });
    await check('QR image fallback decodes locally, submits through signed endpoint and does not claim a duplicate as new attendance', async () => {
      await page.evaluate(() => { (window as any).__mode = ''; (window as any).__mount(); }); await textIncludes('Connect camera');
      const callsBefore = await page.evaluate(() => (window as any).__calls);
      const feedbackBefore = await page.evaluate(() => (window as any).__beeps + (window as any).__vibrations);
      await page.evaluate(async () => {
        const encoded = (window as any).__images[0];
        const blob = await (await fetch(encoded)).blob();
        const file = new File([blob], 'candidate-qr.png', { type: 'image/png' });
        const input = document.querySelector('input[aria-label="Choose a QR image"]') as HTMLInputElement;
        if (!input) throw new Error('Missing QR-image fallback control');
        const files = new DataTransfer();
        files.items.add(file);
        input.files = files.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await textIncludes('Already Marked');
      assert.equal(await page.evaluate(() => (window as any).__calls), callsBefore + 1);
      assert.equal(await page.evaluate(() => (window as any).__beeps + (window as any).__vibrations), feedbackBefore);
    });
    await check('QR image fallback rejects unsupported files without sending attendance', async () => {
      await click('Scan Next Candidate');
      await page.waitForFunction(() => !document.body.innerText.includes('Already Marked'), { timeout: 10000 });
      const callsBefore = await page.evaluate(() => (window as any).__calls);
      await page.evaluate(() => {
        const file = new File(['<script>'], 'invalid.html', { type: 'text/html' });
        const input = document.querySelector('input[aria-label="Choose a QR image"]') as HTMLInputElement;
        const files = new DataTransfer();
        files.items.add(file);
        input.files = files.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await textIncludes('Choose a JPEG, PNG, or WebP');
      assert.equal(await page.evaluate(() => (window as any).__calls), callsBefore);
    });
  } finally { await browser?.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

async function run() {
  await adapterChecks();
  assert.notEqual(process.env.NODE_ENV, 'production');
  const source = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname), 'Only an explicit localhost test connection is permitted.');
  const name = 'attendance_qr_' + randomUUID().replace(/-/g, '');
  const admin = new Client({ connectionString: source.toString() }); await admin.connect();
  let created = false, db: any, shared: any;
  try {
    await admin.query(`CREATE DATABASE "${name}"`); created = true;
    const url = new URL(source); url.pathname = '/' + name; url.searchParams.delete('schema');
    process.env.DATABASE_URL = url.toString(); process.env.DIRECT_URL = url.toString(); process.env.NODE_ENV = 'test';
    // Same UUID-isolated local migration fixture used by accepted 13C tests.
    execFileSync(process.execPath, [path.join(backend, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.join(backend, 'prisma/schema.prisma')], { cwd: backend, env: process.env, stdio: 'pipe' });
    const { PrismaClient } = await import('@prisma/client'); db = new PrismaClient();
    const { attendanceService: attendance } = await import('../src/modules/attendance/attendance.service');
    const { qrService } = await import('../src/modules/attendance/qr.service');
    shared = (await import('../src/lib/prisma')).prisma;
    const { default: routes } = await import('../src/modules/attendance/attendance.routes');
    const { errorHandler } = await import('../src/middleware/error.middleware');
    const { signAccessToken } = await import('../src/lib/jwt');
    await db.user.create({ data: { id: 'staff', name: 'Fixture examiner', email: 'staff@test.invalid', passwordHash: 'fixture', role: 'TEACHER' } });
    for (const id of ['a', 'b']) await db.examHall.create({ data: { id, name: 'Fixture Hall ' + id, roomNumber: 'Room ' + id, targetClass: 'Class 9th', capacity: 20, examDate: '2026-11-15', reportingTime: '08:00' } });
    const tokens: Record<string, string> = {};
    for (const id of ['valid', 'manual', 'inactive', 'foreign', 'race', 'camera1', 'camera2']) {
      tokens[id] = qrService.generateSignedQrToken(id);
      await db.student.create({ data: { id, applicationNo: 'APP-' + id, qrToken: tokens[id], fullName: 'Candidate ' + id, fatherName: 'Fixture', gender: 'MALE', dateOfBirth: new Date('2008-01-01'), cnicOrBForm: 'CNIC-' + id, address: 'Fixture', district: 'Fixture', province: 'Fixture', parentMobile: 'Fixture', currentClass: 'Class 9th', schoolName: 'Fixture', boardOrUniversity: 'Fixture', scholarshipCategory: 'GENERAL_MERIT', emergencyContact: 'Fixture', emergencyRelation: 'Fixture', assignedHallId: id === 'foreign' ? 'b' : 'a', seatNo: 'Seat-' + id, rollNumber: 'R-' + id, status: id === 'inactive' ? 'INACTIVE' : 'ACTIVE' } });
    }
    const detail = await attendance.openSession('a', 'staff'), sessionId = detail.session.id;
    const scan = (qrToken: string, operator = 'staff') => attendance.scanOrMarkAttendance({ sessionId, qrToken, status: 'PRESENT' }, operator);
    const reject = (work: () => Promise<unknown>, status: number) => assert.rejects(work, (error: any) => error.statusCode === status);
    let original: any;
    await check('valid signed QR persists with real staff and correct frozen Hall/session association', async () => {
      original = await scan(tokens.valid); const stored = await db.attendance.findUnique({ where: { id: original.attendance.id } });
      assert.equal(stored.sessionId, sessionId); assert.equal(stored.studentId, 'valid'); assert.equal(stored.markedByUserId, 'staff'); assert.equal(stored.method, 'QR_SCAN'); assert.equal(stored.status, 'PRESENT'); assert.equal(detail.session.examHallId, 'a');
    });
    await check('invalid signatures, nonexistent/inactive candidates and wrong-Hall membership reject without writes', async () => {
      const count = await db.attendance.count();
      await reject(() => scan(tokens.valid.slice(0, -1) + (tokens.valid.endsWith('a') ? 'b' : 'a')), 400);
      await reject(() => scan(qrService.generateSignedQrToken('missing')), 404); await reject(() => scan(tokens.inactive), 409); await reject(() => scan(tokens.foreign), 409); await reject(() => scan(tokens.valid, ''), 401);
      assert.equal(await db.attendance.count(), count);
    });
    await check('duplicate QR returns exact original record and does not overwrite attribution/time/status', async () => {
      const duplicate = await scan(tokens.valid); assert.equal((duplicate as any).alreadyMarked, true); assert.deepEqual(duplicate.attendance, original.attendance); assert.equal(await db.attendance.count({ where: { sessionId, studentId: 'valid' } }), 1);
    });
    await check('manual duplicate semantics stay 409; QR displays the existing MANUAL LATE record unchanged', async () => {
      const mark = await attendance.mark(sessionId, { studentId: 'manual', status: 'LATE' }, 'staff');
      await reject(() => attendance.mark(sessionId, { studentId: 'manual', status: 'PRESENT' }, 'staff'), 409);
      await reject(() => attendance.scanOrMarkAttendance({ sessionId, rollNumber: 'R-manual', status: 'PRESENT' }, 'staff'), 409);
      await reject(() => attendance.mark(sessionId, { qrToken: tokens.valid, status: 'PRESENT' }, 'staff'), 409);
      const duplicate = await scan(tokens.manual); assert.deepEqual(duplicate.attendance, mark.attendance); assert.equal((duplicate as any).alreadyMarked, true);
    });
    await check('concurrent QR duplicates serialize to one persisted mark and one original-record response', async () => {
      const results = await Promise.all([scan(tokens.race), scan(tokens.race)]); assert.equal(results.filter(result => (result as any).alreadyMarked).length, 1); assert.equal(results[0].attendance.id, results[1].attendance.id); assert.equal(await db.attendance.count({ where: { sessionId, studentId: 'race' } }), 1);
    });
    const app = express(); app.use(express.json());
    const jwt = signAccessToken({ userId: 'staff', email: 'staff@test.invalid', role: 'TEACHER', name: 'Fixture examiner', tokenVersion: 0 });
    // The local browser fixture uses the real authenticated route with a synthetic staff account.
    app.use('/api/attendance', (req, _res, next) => { if (req.headers['x-fixture-auth'] !== 'none') req.headers.authorization = 'Bearer ' + jwt; next(); }, routes);
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const base = `http://127.0.0.1:${(server.address() as any).port}/api/attendance/scan`;
      const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, qrToken: tokens.valid }) });
      await check('scan controller duplicate response is HTTP 200 with the authoritative original mark', async () => { assert.equal(response.status, 200); const body: any = await response.json(); assert.equal(body.data.alreadyMarked, true); assert.equal(body.data.attendance.id, original.attendance.id); });
      const unauthenticated = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-fixture-auth': 'none' }, body: JSON.stringify({ sessionId, qrToken: tokens.valid }) });
      await check('existing authenticated route continues rejecting missing authentication', () => assert.equal(unauthenticated.status, 401));
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
    await browserChecks(app, detail, [tokens.camera1, tokens.camera2]);
    await attendance.closeSession(sessionId, false, 'staff');
    await check('closed Hall session still rejects QR writes', () => reject(() => scan(tokens.valid), 409));
    console.log(`QR scanner safety: ${passed} PASS, 0 FAIL.`);
  } finally {
    await db?.$disconnect(); await shared?.$disconnect();
    // Remove only the uniquely named disposable database created by this test.
    if (created) { await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [name]); await admin.query(`DROP DATABASE "${name}"`); }
    await admin.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
