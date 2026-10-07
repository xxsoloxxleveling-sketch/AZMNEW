import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import dotenv from 'dotenv';
import express from 'express';
import puppeteer from 'puppeteer';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'backend');

async function run() {
  dotenv.config({ path: path.join(backend, '.env'), quiet: true });
  assert.notEqual(process.env.NODE_ENV, 'production', 'production test environment is prohibited');
  const source = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname), 'only local PostgreSQL is permitted');
  const dbName = 'attendance13c_live_' + randomUUID().replace(/-/g, '');
  const url = new URL(source); url.pathname = `/${dbName}`; url.searchParams.delete('schema');
  const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), NODE_ENV: 'test' };
  process.env.DATABASE_URL = env.DATABASE_URL; process.env.DIRECT_URL = env.DIRECT_URL; process.env.NODE_ENV = 'test';
  const admin = new Client({ connectionString: source.toString() }); await admin.connect();
  let db: any, api: any, web: any;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  let passed = 0;
  const check = async (name: string, fn: () => unknown | Promise<unknown>) => { await fn(); passed++; console.log('PASS: ' + name); };
  try {
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const cli = path.join(backend, 'node_modules', 'prisma', 'build', 'index.js');
    execFileSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', path.join(backend, 'prisma', 'schema.prisma')], { cwd: backend, env, stdio: 'pipe' });
    const { PrismaClient } = await import('@prisma/client'); db = new PrismaClient();
    const { default: backendApp } = await import('../src/app');
    const { signAccessToken } = await import('../src/lib/jwt');
    const center = await db.testCenter.create({ data: { name: '13C Live Test Center', code: 'LIVE13C', address: '', district: '', province: '' } });
    const hall = (id: string, name: string, date: string) => db.examHall.create({ data: { id, name, roomNumber: `Room ${id}`, targetClass: 'Class 9th', capacity: 20, examDate: date, reportingTime: '08:00', testCenterId: center.id } });
    const student = (id: string, className: string, assignedHallId?: string, assignedHall?: string) => db.student.create({ data: { id, applicationNo: 'APP-' + id, qrToken: 'QR-' + id, fullName: 'Candidate ' + id, fatherName: 'Fixture', gender: 'MALE', dateOfBirth: new Date('2008-01-01'), cnicOrBForm: 'CNIC-' + id, address: 'Fixture', district: 'Fixture', province: 'Fixture', parentMobile: 'Fixture', currentClass: className, schoolName: 'Fixture', boardOrUniversity: 'Fixture', scholarshipCategory: 'GENERAL_MERIT', emergencyContact: 'Fixture', emergencyRelation: 'Fixture', assignedHallId, assignedHall, seatNo: `Seat-${id}` } });
    await db.user.createMany({ data: ['live-admin', 'live-teacher'].map((id, index) => ({ id, name: index ? 'Live Teacher' : 'Live Admin', email: `${id}@test.invalid`, passwordHash: 'test-only', role: index ? 'TEACHER' : 'ADMIN' })) });
    await hall('hall-a-13c', '13C Hall A', '15 November 2026'); await hall('hall-b-13c', '13C Hall B', '16 November 2026'); await hall('hall-c-13c', '13C Hall C', '17 November 2026');
    await student('a1-13c', 'Class 9th', 'hall-a-13c'); await student('a2-13c', 'Class 10th', 'hall-a-13c'); await student('a3-13c', 'First Year', 'hall-a-13c'); await student('a4-13c', 'Class 9th', 'hall-a-13c'); await student('a5-13c', 'Class 9th', 'hall-a-13c');
    await student('b1-13c', 'Class 9th', 'hall-b-13c'); await student('b2-13c', 'Class 10th', 'hall-b-13c');
    await student('legacy-13c', 'Class 9th', undefined, '13C Hall A');

    api = backendApp.listen(0, '127.0.0.1'); await new Promise<void>(resolve => api.once('listening', resolve));
    const apiBase = `http://127.0.0.1:${api.address().port}`;
    const { build } = require(path.join(root, 'node_modules', 'esbuild'));
    const bundle = await build({ entryPoints: [path.join(root, 'src', 'main.tsx')], outfile: path.join(os.tmpdir(), `azm-att13c-${dbName}.js`), bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: apiBase }) }, logLevel: 'silent', loader: { '.svg': 'dataurl' }, plugins: [{ name: 'skip-tailwind-entry', setup(builder: any) { builder.onResolve({ filter: /index\.css$/ }, () => ({ path: 'app-css', namespace: 'test-css' })); builder.onLoad({ filter: /.*/, namespace: 'test-css' }, () => ({ contents: '', loader: 'css' })); } }] });
    web = express();
    const js = bundle.outputFiles.find((f: any) => f.path.endsWith('.js'))!;
    const assets = path.join(root, 'dist', 'assets'); const cssFile = path.join(assets, fs.readdirSync(assets).find(name => name.endsWith('.css'))!);
    web.get('/bundle.js', (_req: any, res: any) => res.type('js').send(js.text));
    web.get('/bundle.css', (_req: any, res: any) => res.sendFile(cssFile));
    web.get('*', (_req: any, res: any) => res.send('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'));
    web = web.listen(0, '127.0.0.1'); await new Promise<void>(resolve => web.once('listening', resolve));
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'], executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const page = await browser.newPage(); const pageErrors: string[] = []; const httpFailures: string[] = []; const attendanceRequests: string[] = [];
    page.on('pageerror', (e: unknown) => pageErrors.push(String(e)));
    page.on('request', request => { if (request.url().startsWith(apiBase + '/api/attendance/')) { const url = new URL(request.url()); attendanceRequests.push(url.pathname + url.search); } });
    page.on('response', response => { if (response.url().startsWith(apiBase) && response.status() >= 400) httpFailures.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    const frontend = `http://127.0.0.1:${web.address().port}`;
    const token = (role: 'ADMIN' | 'TEACHER') => signAccessToken({ userId: role === 'ADMIN' ? 'live-admin' : 'live-teacher', email: `live-${role.toLowerCase()}@test.invalid`, role, name: role === 'ADMIN' ? 'Live Admin' : 'Live Teacher', tokenVersion: 0 });
    let authScriptId: string | undefined;
    let loginVisit = 0;
    const login = async (role: 'ADMIN' | 'TEACHER') => {
      if (authScriptId) await page.removeScriptToEvaluateOnNewDocument(authScriptId);
      const authScript = await page.evaluateOnNewDocument((userToken: string, userRole: string) => {
        localStorage.setItem('jps_access_token', userToken);
        localStorage.setItem('jps_current_user', JSON.stringify({ id: userRole === 'ADMIN' ? 'live-admin' : 'live-teacher', name: userRole === 'ADMIN' ? 'Live Admin' : 'Live Teacher', email: `live-${userRole.toLowerCase()}@test.invalid`, role: userRole, status: 'ACTIVE', tokenVersion: 0 }));
      }, token(role), role);
      authScriptId = authScript.identifier;
      await page.goto(frontend + '/?qaRole=' + role + '&visit=' + (++loginVisit) + '#attendance');
      await page.waitForFunction(() => document.body.innerText.includes('Examination Attendance Hub'));
      await page.waitForSelector('#attendance-hall option[value="hall-a-13c"]');
      await page.waitForFunction(() => !(document.querySelector('#attendance-hall') as HTMLSelectElement)?.disabled);
    };
    const text = () => page.evaluate(() => document.body.innerText);
    const click = async (label: string) => {
      await page.waitForFunction(value => Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === value && !button.disabled), {}, label);
      const buttons = await page.$$('button');
      for (const button of buttons) if ((await button.evaluate(el => el.textContent))?.trim() === label) { await button.focus(); await page.keyboard.press('Enter'); return; }
      throw new Error(`button not found: ${label}`);
    };
    const openSession = async () => { await click('Open Attendance Session'); await page.waitForSelector('[role="dialog"]'); await click('Open Session'); await page.waitForFunction(() => document.body.innerText.includes('OPEN SESSION')); };
    const mark = async (studentName: string, status?: 'PRESENT' | 'LATE' | 'ABSENT') => {
      await page.waitForFunction(name => Array.from(document.querySelectorAll('tr')).some(row => row.innerText.includes(name) && row.innerText.includes('Mark Attendance')), {}, studentName);
      const rows = await page.$$('tr');
      for (const row of rows) if ((await row.evaluate(el => el.innerText)).includes(studentName)) { const trigger = await row.$('button'); await trigger!.focus(); await page.keyboard.press('Enter'); break; }
      await page.waitForSelector('[role="dialog"]');
      if (status) await page.select('#attendance-mark-status', status);
      await click('Record Attendance');
      await page.waitForFunction(name => Array.from(document.querySelectorAll('tr')).some(row => row.innerText.includes(name) && !row.innerText.includes('Mark Attendance')), {}, studentName);
    };
    const selectHall = async (id: string) => { if (await page.$eval('#attendance-hall', element => (element as HTMLSelectElement).value) !== id) await page.select('#attendance-hall', id); await page.waitForFunction(value => (document.querySelector('#attendance-hall') as HTMLSelectElement)?.value === value, {}, id); };
    try {
      await check('real App and authenticated API render admin Attendance workspace', async () => { await login('ADMIN'); assert.match(await text(), /13C Hall A/); });
      await check('real App disables empty Hall opening without creating a session', async () => {
        await selectHall('hall-c-13c');
        await page.waitForFunction(() => document.body.innerText.includes('No explicitly assigned candidates are available for this Hall.'));
        const disabled = await page.$$eval('button', buttons => buttons.find(button => button.textContent?.trim() === 'Open Attendance Session')?.disabled);
        assert.equal(disabled, true); assert.equal(await db.attendanceSession.count({ where: { examHallId: 'hall-c-13c' } }), 0);
      });
      await check('keyboard Center and Hall selection reaches the real no-session workspace', async () => {
        await page.focus('#attendance-center'); await page.keyboard.press('End'); await page.keyboard.press('Tab');
        assert.equal(await page.$eval('#attendance-center', element => (element as HTMLSelectElement).value), center.id);
        await page.focus('#attendance-hall'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Tab');
        await page.waitForFunction(() => (document.querySelector('#attendance-hall') as HTMLSelectElement)?.value === 'hall-a-13c' && document.body.innerText.includes('No attendance session has been opened'));
      });
      await check('opening through UI snapshots explicit Hall assignments across classes only', async () => {
        await selectHall('hall-a-13c');
        for (const [width, height] of [[1440,900],[768,1024],[390,844]]) {
          await page.setViewport({ width, height }); await click('Open Attendance Session'); await page.waitForSelector('[role="dialog"]');
          const box = await page.$eval('[role="dialog"]', (el: any) => { const r = el.getBoundingClientRect(), footer = el.lastElementChild.getBoundingClientRect(); return { bottom: r.bottom, footerBottom: footer.bottom, height: innerHeight }; });
          assert(box.bottom <= box.height + 1 && box.footerBottom <= box.height + 1, JSON.stringify(box));
          await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
          await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          const focus = await page.evaluate(() => ({ id: (document.activeElement as HTMLElement)?.id, text: (document.activeElement as HTMLElement)?.textContent?.trim() }));
          assert(focus.text === 'Open Attendance Session' || ['attendance-hall', 'attendance-search'].includes(focus.id), JSON.stringify(focus));
        }
        await page.setViewport({ width: 1440, height: 900 }); await openSession();
        await page.waitForFunction(() => document.body.innerText.includes('Candidate a5-13c'));
        const roster = await text(); for (const id of ['Candidate a1-13c','Candidate a2-13c','Candidate a3-13c','Candidate a4-13c','Candidate a5-13c']) assert(roster.includes(id), id);
        assert(!roster.includes('Candidate b1-13c')); assert(!roster.includes('Candidate legacy-13c'));
        const session = await db.attendanceSession.findFirst({ where: { examHallId: 'hall-a-13c' }, include: { candidates: true } }); assert.equal(session.candidates.length, 5);
      });
      await check('mark dialog fits three viewports and Escape restores row-action focus without writing', async () => {
        for (const [width, height] of [[1440,900],[768,1024],[390,844]]) {
          await page.setViewport({ width, height });
          await page.waitForFunction(() => Array.from(document.querySelectorAll('tr')).some(row => row.innerText.includes('Candidate a1-13c') && row.innerText.includes('Mark Attendance')));
          const rows = await page.$$('tr'); for (const row of rows) if ((await row.evaluate(el => el.innerText)).includes('Candidate a1-13c')) { await row.$eval('button', (button: any) => { button.focus(); button.click(); }); break; }
          await page.waitForSelector('[role="dialog"]');
          const box = await page.$eval('[role="dialog"]', (el: any) => { const r = el.getBoundingClientRect(), footer = el.lastElementChild.getBoundingClientRect(); return { bottom: r.bottom, footerBottom: footer.bottom, height: innerHeight }; });
          assert(box.bottom <= box.height + 1 && box.footerBottom <= box.height + 1, JSON.stringify(box));
          await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
          await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          const focus = await page.evaluate(() => ({ id: (document.activeElement as HTMLElement)?.id, text: (document.activeElement as HTMLElement)?.textContent || '' }));
          assert(/Mark Attendance/.test(focus.text) || ['attendance-hall', 'attendance-search'].includes(focus.id), JSON.stringify(focus));
        }
        assert.equal(await db.attendance.count({ where: { studentId: 'a1-13c' } }), 0);
      });
      await check('real UI writes PRESENT, LATE, and ABSENT to PostgreSQL', async () => {
        await mark('Candidate a1-13c', 'PRESENT'); await mark('Candidate a2-13c', 'LATE'); await mark('Candidate a3-13c', 'ABSENT');
        const records = await db.attendance.findMany({ where: { studentId: { in: ['a1-13c','a2-13c','a3-13c'] } }, orderBy: { studentId: 'asc' } });
        assert.deepEqual(records.map((r: any) => [r.studentId, r.status, r.markedByUserId, r.method]), [['a1-13c','PRESENT','live-admin','MANUAL'],['a2-13c','LATE','live-admin','MANUAL'],['a3-13c','ABSENT','live-admin','MANUAL']]);
      });
      await check('Teacher uses real App to mark permitted unmarked candidate with authenticated identity', async () => {
        await login('TEACHER'); await selectHall('hall-a-13c');
        await page.waitForFunction(() => document.body.innerText.includes('Candidate a4-13c'));
        const teacherButtons = await page.$$eval('button', buttons => buttons.map(button => button.textContent?.trim() || ''));
        assert(!teacherButtons.some(label => /Open Attendance Session|Close Attendance Session|Hall Management|Manage Halls|Exam Halls/i.test(label)), JSON.stringify(teacherButtons));
        for (const [width, height] of [[1440,900],[768,1024],[390,844]]) {
          await page.setViewport({ width, height });
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          const trigger = await page.$('[aria-label="Frozen Hall roster table"] tbody tr:nth-child(4) button'); assert(trigger); await trigger.focus(); await page.keyboard.press('Enter');
          await page.waitForSelector('[role="dialog"]');
          for (let tab = 0; tab < 8; tab++) { await page.keyboard.press('Tab'); assert(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement))); }
          assert(await page.$eval('#root', element => element.hasAttribute('inert')));
          const footer = await page.$eval('[role="dialog"]', element => element.lastElementChild!.getBoundingClientRect().bottom); assert(footer <= height);
          await page.screenshot({ path: path.join(os.tmpdir(), `azm-13c-teacher-mark-${width}.png`) });
          await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
        }
        await page.setViewport({ width: 1440, height: 900 });
        await mark('Candidate a4-13c', 'PRESENT');
        const record = await db.attendance.findFirst({ where: { studentId: 'a4-13c' } }); assert.equal(record.markedByUserId, 'live-teacher'); assert.equal(record.status, 'PRESENT');
      });
      await check('close unchecked preserves remaining candidate as NOT_MARKED in frozen roster', async () => {
        await login('ADMIN'); await selectHall('hall-a-13c'); await page.waitForFunction(() => document.body.innerText.includes('Candidate a5-13c'));
        for (const [width, height] of [[1440,900],[768,1024],[390,844]]) {
          await page.setViewport({ width, height }); await click('Close Attendance Session'); await page.waitForSelector('[role="dialog"]');
          const box = await page.$eval('[role="dialog"]', (el: any) => { const r = el.getBoundingClientRect(), footer = el.lastElementChild.getBoundingClientRect(); return { bottom: r.bottom, footerBottom: footer.bottom, height: innerHeight }; });
          assert(box.bottom <= box.height + 1 && box.footerBottom <= box.height + 1, JSON.stringify(box));
          await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
          await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          const focus = await page.evaluate(() => ({ id: (document.activeElement as HTMLElement)?.id, text: (document.activeElement as HTMLElement)?.textContent?.trim() }));
          assert(focus.text === 'Close Attendance Session' || ['attendance-hall', 'attendance-search'].includes(focus.id), JSON.stringify(focus));
        }
        await page.setViewport({ width: 1440, height: 900 });
        await click('Close Attendance Session'); await page.waitForSelector('[role="dialog"]'); await click('Close Session');
        await page.waitForFunction(() => !document.querySelector('[role="dialog"]') && document.body.innerText.includes('CLOSED SESSION'));
        const a = await db.attendanceSession.findFirst({ where: { examHallId: 'hall-a-13c' }, include: { candidates: { where: { studentId: 'a5-13c' }, include: { attendance: true } } } });
        assert.equal(a.candidates[0].attendance, null);
        await page.waitForFunction(() => Array.from(document.querySelectorAll('tr')).some(row => row.innerText.includes('Candidate a5-13c') && row.innerText.includes('NOT MARKED')));
      });
      await check('close checked marks only remaining Hall B candidate ABSENT and preserves prior mark', async () => {
        await selectHall('hall-b-13c'); await openSession(); await mark('Candidate b1-13c', 'LATE');
        await click('Close Attendance Session'); await page.waitForSelector('#attendance-close-absent'); await page.click('#attendance-close-absent'); await click('Close Session');
        await page.waitForFunction(() => !document.querySelector('[role="dialog"]') && document.body.innerText.includes('CLOSED SESSION'));
        const rows = await db.attendance.findMany({ where: { session: { examHallId: 'hall-b-13c' } }, orderBy: { studentId: 'asc' } });
        assert.deepEqual(rows.map((r: any) => [r.studentId, r.status]), [['b1-13c','LATE'],['b2-13c','ABSENT']]);
      });
      await check('closed Hall session retains full Hall and candidate snapshots after current allocation and metadata change', async () => {
        const { AttendanceService } = await import('../src/modules/attendance/attendance.service');
        const { ExamHallsService } = await import('../src/modules/exam-halls/examHalls.service');
        const sessions = new AttendanceService(db), hallService = new ExamHallsService(db);
        const before = await sessions.getSession((await db.attendanceSession.findFirst({ where: { examHallId: 'hall-a-13c' } })).id);
        await hallService.updateStudentAllocation('a1-13c', { assignedHallId: 'hall-b-13c' });
        await db.student.update({ where: { id: 'a1-13c' }, data: { seatNo: 'Changed Seat' } });
        await db.examHall.update({ where: { id: 'hall-a-13c' }, data: { name: 'Renamed Current Hall', roomNumber: 'Changed Current Room', examDate: '30 November 2026', reportingTime: '11:00' } });
        await db.testCenter.update({ where: { id: center.id }, data: { name: 'Renamed Current Center' } });
        const after = await sessions.getSession(before.session.id);
        assert.deepEqual(after.session, before.session); assert.equal(after.stats.expectedCount, 5);
        const oldCandidate = before.roster.find((r: any) => r.studentId === 'a1-13c'); const newCandidate = after.roster.find((r: any) => r.studentId === 'a1-13c');
        assert.equal(newCandidate.seatNoSnapshot, oldCandidate.seatNoSnapshot); assert.equal(newCandidate.fullNameSnapshot, oldCandidate.fullNameSnapshot);
        assert.deepEqual(after.roster, before.roster);
        await login('ADMIN'); await selectHall('hall-a-13c'); await page.waitForFunction(() => document.body.innerText.includes('13C Hall A') && document.body.innerText.includes('Candidate a1-13c'));
        const displayed = await page.$eval('[aria-label="Attendance session"]', (el: any) => el.innerText);
        assert(displayed.includes('13C Live Test Center')); assert(displayed.includes('13C Hall A')); assert(displayed.includes('Room hall-a-13c')); assert(displayed.includes('15 November 2026'));
        const candidateRow = await page.$$eval('tr', (rows: any[]) => rows.find(row => row.innerText.includes('Candidate a1-13c'))?.innerText || ''); assert(candidateRow.includes('Seat-a1-13c'));
      });
      await check('Teacher UI presents the CLOSED history without an active mark action and API rejects a late mark with 409', async () => {
        await login('TEACHER'); await selectHall('hall-a-13c'); await page.waitForFunction(() => document.body.innerText.includes('CLOSED SESSION') && document.body.innerText.includes('Candidate a5-13c'));
        const rows = await page.$$('tr'); let markButton: any = null;
        for (const row of rows) if ((await row.evaluate(el => el.innerText)).includes('Candidate a5-13c')) markButton = await row.$('button');
        assert(markButton === null || await markButton.evaluate((element: HTMLButtonElement) => element.disabled));
        const tokenValue = token('TEACHER');
        const response = await fetch(`${apiBase}/api/attendance/sessions/${(await db.attendanceSession.findFirst({ where: { examHallId: 'hall-a-13c' } })).id}/mark`, { method: 'POST', headers: { Authorization: `Bearer ${tokenValue}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: 'a5-13c', status: 'PRESENT' }) });
        assert.equal(response.status, 409); assert.equal(await db.attendance.count({ where: { studentId: 'a5-13c' } }), 0);
      });
      await check('real historical Center/Hall/date/status filters retain the frozen closed roster', async () => {
        await page.focus('#attendance-history-status'); await page.keyboard.press('End'); await page.keyboard.press('Tab');
        await page.waitForFunction(() => (document.querySelector('#attendance-history-status') as HTMLSelectElement)?.value === 'CLOSED' && document.body.innerText.includes('Candidate a5-13c'));
        await page.evaluate(() => { const element = document.querySelector('#attendance-history-date') as HTMLInputElement; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, '2026-11-15'); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); });
        await page.waitForFunction(() => document.body.innerText.includes('Candidate a5-13c'));
        assert(attendanceRequests.some(url => url.includes('businessDate=2026-11-15') && url.includes('status=CLOSED') && url.includes('examHallId=hall-a-13c')));
        assert.match(await page.$eval('[aria-label="Attendance session"]', element => (element as HTMLElement).innerText), /15 November 2026/);
        assert.equal(await db.attendanceSessionCandidate.count({ where: { session: { examHallId: 'hall-a-13c' } } }), 5);
      });
      await check('browser remains free of runtime errors and API failures', async () => { assert.deepEqual(pageErrors, []); assert.deepEqual(httpFailures, []); });
      for (const [width, height] of [[1440,900],[768,1024],[390,844]]) {
        await page.setViewport({ width, height }); await page.screenshot({ path: path.join(os.tmpdir(), `azm-13c-live-${width}.png`), fullPage: true });
        await check(`real App layout fits viewport ${width}x${height}`, async () => { const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })); assert(size.width <= size.client + 1, JSON.stringify(size)); });
      }
      console.log(`Examination Attendance 13C live browser acceptance: ${passed} PASS, 0 FAIL.`);
    } finally { await browser?.close(); }
  } finally {
    if (web && web.close) await new Promise<void>(resolve => web.close(() => resolve()));
    if (api) await new Promise<void>(resolve => api.close(() => resolve()));
    if (db) await db.$disconnect();
    const { prisma } = await import('../src/lib/prisma'); await prisma.$disconnect();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [dbName]);
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`); await admin.end();
    console.log('Only the UUID-named disposable local database was removed.');
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
