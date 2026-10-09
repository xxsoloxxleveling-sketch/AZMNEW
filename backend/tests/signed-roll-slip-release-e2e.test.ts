import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { extractSignedAttendanceToken } from '../../src/utils/signedAttendanceQr';

const backend = path.resolve(__dirname, '..');
const root = path.dirname(backend);
let checks = 0;
async function check(label: string, work: () => unknown | Promise<unknown>) {
  await work(); checks++; console.log('PASS: ' + label);
}
async function decodePng(bytes: Buffer): Promise<string> {
  const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(pixels.data), pixels.info.width, pixels.info.height,
    { inversionAttempts: 'attemptBoth' });
  assert(result, 'Actual QR pixels must decode');
  return result.data;
}
async function run() {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const source = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname), 'Explicit localhost test database required');
  const name = 'signed_slip_release_' + crypto.randomUUID().replace(/-/g, '');
  const url = new URL(source); url.pathname = '/' + name; url.searchParams.delete('schema');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'azm-signed-slip-pdf-'));
  const admin = new Client({ connectionString: source.toString() }); await admin.connect();
  let created = false, db: any, shared: any, server: any, browser: any;
  try {
    await admin.query('CREATE DATABASE "' + name + '"'); created = true;
    Object.assign(process.env, { DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'synthetic-release-access', JWT_REFRESH_SECRET: 'synthetic-release-refresh', QR_SECRET: 'synthetic-release-qr' });
    for (const key of Object.keys(process.env)) if (key.startsWith('R2_') || key.startsWith('SUPABASE_')) process.env[key] = '';
    execFileSync(process.execPath, [path.join(backend, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      { cwd: backend, env: process.env, stdio: 'pipe', timeout: 90000 });
    const [{ PrismaClient }, students, attendanceModule, qrModule, jwtModule, appModule, prismaModule] = await Promise.all([
      import('@prisma/client'), import('../src/modules/students/students.service'),
      import('../src/modules/attendance/attendance.service'), import('../src/modules/attendance/qr.service'),
      import('../src/lib/jwt'), import('../src/app'), import('../src/lib/prisma'),
    ]);
    db = new PrismaClient(); shared = prismaModule.prisma;
    const attendance = attendanceModule.attendanceService;
    await db.user.create({ data: { id: 'examiner', email: 'examiner@test.invalid', name: 'Synthetic Examiner', role: 'ADMIN', passwordHash: 'unused-fixture' } });
    await db.testCenter.create({ data: { id: 'center', code: 'SYNTHETIC', name: 'Synthetic Center', address: 'Fixture', district: 'Fixture' } });
    for (const id of ['hall', 'other']) await db.examHall.create({ data: { id, name: 'Synthetic ' + id, roomNumber: 'Fixture room', capacity: 20,
      targetClass: 'Class 9th', testCenterId: 'center', examDate: '2026-11-15', reportingTime: '08:00' } });
    await db.systemSetting.create({ data: { key: 'rollNumberReleaseConfig', value: JSON.stringify({ isScheduled: false, releaseDateTime: '', announcementMessage: '' }) } });
    const tokens: Record<string, string> = {};
    for (const [index, id] of ['a', 'b', 'missing', 'foreign', 'forged'].entries()) {
      tokens[id] = id === 'missing' ? 'PENDING-FEE-SYNTHETIC' : id === 'forged'
        ? 'qr_forged.' + '0'.repeat(64) : qrModule.qrService.generateSignedQrToken('synthetic-' + id);
      await db.student.create({ data: { id, applicationNo: 'SYNTHETIC-' + id, qrToken: tokens[id], rollNumber: 'AZMVS-SYNTHETIC-' + id,
        fullName: 'Synthetic ' + id, fatherName: 'Synthetic Parent', gender: 'MALE', dateOfBirth: new Date('2008-01-01'),
        cnicOrBForm: '00000-0000000-' + (index + 1), address: 'Fixture', district: 'Fixture', province: 'Fixture', parentMobile: '0000000000',
        currentClass: 'Class 9th', schoolName: 'Fixture', boardOrUniversity: 'Fixture', scholarshipCategory: 'GENERAL_MERIT',
        emergencyContact: '0000000000', emergencyRelation: 'Fixture', status: 'ACTIVE', assignedHallId: id === 'foreign' ? 'other' : 'hall',
        seatNo: String(index + 1), officeUse: { create: { testRollNo: 'AZMVS-SYNTHETIC-' + id } } } });
    }
    const detail = await attendance.openSession('hall', 'examiner'); const sessionId = detail.session.id;
    const before = await db.student.findMany({ orderBy: { id: 'asc' } });
    const slips: Record<string, any> = {};
    for (const id of ['a', 'b', 'missing']) {
      const result = await students.studentsService.searchPublicSlip('SYNTHETIC-' + id, '00000-0000000-' + (id === 'a' ? '1' : id === 'b' ? '2' : '3'));
      assert(result.success && result.data, 'Synthetic assigned public slip must be available'); slips[id] = result.data;
    }
    await check('Public service returns only a verified existing token, without candidate identity in its payload', () => {
      assert.equal(extractSignedAttendanceToken(slips.a.qrPayload), tokens.a);
      assert(!slips.a.qrPayload.includes('00000')); assert.equal(slips.missing.qrPayload, '');
      for (const qrToken of [tokens.a + '.extra', tokens.a + 'ff', 'qr_forged.' + '0'.repeat(64), 'AZMVS-SYNTHETIC-a', null])
        assert.equal(students.buildIssuedAttendanceQrPayload({ rollNumber: 'issued', qrToken }), '');
      assert.equal(students.buildIssuedAttendanceQrPayload({ qrToken: tokens.a }), '');
    });
    await check('Legacy QR image endpoint generates the verified token and rejects missing issued tokens', async () => {
      const result = await students.studentsService.getStudentQr('a');
      assert.equal(extractSignedAttendanceToken(await decodePng(result.qrBuffer)), tokens.a);
      assert.equal(result.qrImageUrl, 'data:image/png;base64,' + result.qrBuffer.toString('base64'));
      await assert.rejects(() => students.studentsService.getStudentQr('missing'), (error: any) => error.statusCode === 409);
    });
    await check('Server rejects a plausible token with an invalid signature before exposing administrative or public QR metadata', async () => {
      assert.equal((await students.studentsService.getStudentById('forged')).qrToken, '');
      const result = await students.studentsService.searchPublicSlip('SYNTHETIC-forged', '00000-0000000-5');
      assert(result.success && result.data); assert.equal(result.data.qrPayload, '');
      await assert.rejects(() => students.studentsService.getStudentQr('forged'), (error: any) => error.statusCode === 409);
    });
    await check('OMR template and its separate QR identification implementation remain identical to main', () => {
      const body = (text: string, start: string, end: string) => text.slice(text.indexOf(start), text.indexOf(end)).replace(/\r\n/g, '\n');
      for (const [file, start, end] of [
        ['backend/src/modules/documents/pdf.service.ts', '  generateOmrSheetHtml(', '  generateBulkOmrSheetsHtml('],
        ['backend/src/modules/students/students.service.ts', '  async getOmrSheetPdf(', '  async getBulkOmrPdf('],
      ]) {
        const baseline = execFileSync('git', ['show', 'origin/main:' + file], { cwd: root, encoding: 'utf8' });
        assert.equal(body(fs.readFileSync(path.join(root, file), 'utf8'), start, end), body(baseline, start, end));
      }
    });
    const fixture = `import React from 'react'; import { createRoot } from 'react-dom/client'; import QRCode from 'qrcode';
      import { RollNumberSlipView } from './src/components/rollnumber/RollNumberSlipView';
      import { RollSlipPreviewModal } from './src/components/admin/students/RollSlipPreviewModal';
      import { StudentDossierModal } from './src/components/common/StudentDossierModal';
      import { printRollNumberSlip, printStudentDossier } from './src/lib/mockApi';
      const root=createRoot(document.getElementById('root')); const original=QRCode.toDataURL.bind(QRCode);
      window.__blockedPayloads=[]; window.__queuedQr=[]; window.__printCalls=0; window.print=()=>{window.__printCalls++};
      QRCode.toDataURL=async (...args)=>{const image=await original(...args); if(window.__blockedPayloads.includes(args[0]))
        await new Promise(resolve=>window.__queuedQr.push(resolve)); return image;};
      window.__render=(view,student)=>root.render(view==='public'?React.createElement(RollNumberSlipView,{onSelectTab:()=>{}}):
        view==='admin'?React.createElement(RollSlipPreviewModal,{student,isOpen:true,onClose:()=>{}}):
        React.createElement(StudentDossierModal,{student,isOpen:true,onClose:()=>{}}));
      window.__fallback=async (kind,student)=>{window.__printedHtml=''; window.open=()=>({document:{open(){},write(html){window.__printedHtml=html},close(){}}});
        await (kind==='roll'?printRollNumberSlip(student):printStudentDossier(student)); return window.__printedHtml;};
      const native=window.fetch.bind(window); window.fetch=(input,options={})=>native(input,{...options,headers:{...options.headers,Authorization:'Bearer '+${JSON.stringify(jwtModule.signAccessToken({ userId: 'examiner', email: 'examiner@test.invalid', role: 'ADMIN', name: 'Synthetic Examiner', tokenVersion: 0 }))}}});
      window.__render('public');`;
    const bundle = await build({ stdin: { contents: fixture, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife',
      platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_API_URL': 'window.location.origin' } });
    const express = (await import('express')).default; const app = express();
    const stylesheet = fs.readdirSync(path.join(root, 'dist/assets')).find(file => /^index-.*\.css$/.test(file));
    assert(stylesheet, 'Build the frontend before visual browser QA');
    app.get('/', (_req, res) => res.type('html').send('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/' + stylesheet + '"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'));
    app.get('/fixture.js', (_req, res) => res.type('js').send(bundle.outputFiles[0].text));
    app.use('/assets', express.static(path.join(root, 'dist/assets')));
    app.use(express.static(path.join(root, 'public'))); app.use(appModule.default);
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
    const base = 'http://127.0.0.1:' + server.address().port;
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox'] });
    const page = await browser.newPage(); const outside: string[] = []; const identityUrls: string[] = [];
    page.on('request', (req: any) => { if (!req.url().startsWith(base) && !/^(blob:|data:)/.test(req.url())) outside.push(req.url());
      if (req.url().includes('00000')) identityUrls.push(req.url()); });
    await page.setViewport({ width: 1365, height: 900 }); await page.goto(base);
    const decodeVisible = async (selector: string) => { await page.waitForSelector(selector);
      const src = await page.$eval(selector, (el: any) => el.src); return decodePng(Buffer.from(src.split(',')[1], 'base64')); };
    await page.evaluate((payload: string) => { (window as any).__blockedPayloads = [payload]; }, slips.a.qrPayload);
    await page.type('#input-slip-cnic', '00000-0000000-1'); await page.click('#btn-search-slip');
    await page.waitForFunction(() => document.body.innerText.includes('Preparing attendance QR'));
    await check('Public printing remains disabled after portrait completion while signed QR generation is pending', async () => {
      await page.waitForFunction(() => document.body.innerText.includes('Photo unavailable'));
      assert(await page.$eval('#btn-print-slip', (el: any) => el.disabled));
      await page.evaluate(() => { (window as any).__blockedPayloads=[]; for(const resolve of (window as any).__queuedQr.splice(0)) resolve(); });
    });
    let decodedPublic = '';
    await check('Public slip actual PNG decodes and extracts the existing server-issued scanner token', async () => {
      decodedPublic = await decodeVisible('img[alt="Candidate Biometric QR Code"]'); assert.equal(extractSignedAttendanceToken(decodedPublic), tokens.a);
      await page.waitForFunction(() => !(document.querySelector('#btn-print-slip') as HTMLButtonElement).disabled);
    });
    if (process.env.QR_RELEASE_QA_DIR) await page.screenshot({ path: path.join(process.env.QR_RELEASE_QA_DIR, 'synthetic-public-slip.png'), fullPage: true });
    await check('Dossier opened from the public slip retains that same issued signed token', async () => {
      await page.evaluate(() => { [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Full Profile Dossier'))?.click(); });
      assert.equal(extractSignedAttendanceToken(await decodeVisible('img[alt="QR"]')), tokens.a);
    });
    const studentA = await students.studentsService.getStudentById('a'); const studentB = await students.studentsService.getStudentById('b');
    const noToken = await students.studentsService.getStudentById('missing');
    for (const view of ['admin', 'dossier']) {
      const selector = view === 'admin' ? 'img[alt="Candidate QR"]' : 'img[alt="QR"]';
      await page.evaluate(({view,student,payload}: any) => { (window as any).__blockedPayloads=[payload]; (window as any).__render(view,student); },
        {view,student:studentA,payload:slips.a.qrPayload});
      await page.waitForFunction(() => (window as any).__queuedQr.length > 0);
      await page.evaluate(({view,student}: any) => (window as any).__render(view,student), {view,student:studentB});
      await check(view + ' preview decodes the current candidate and ignores late previous-candidate QR completions', async () => {
        assert.equal(extractSignedAttendanceToken(await decodeVisible(selector)), tokens.b);
        await page.evaluate(() => { (window as any).__blockedPayloads=[]; for(const resolve of (window as any).__queuedQr.splice(0)) resolve(); });
        assert.equal(extractSignedAttendanceToken(await decodeVisible(selector)), tokens.b);
      });
      if (process.env.QR_RELEASE_QA_DIR) await page.screenshot({ path: path.join(process.env.QR_RELEASE_QA_DIR, 'synthetic-' + view + '-preview.png'), fullPage: true });
      await page.evaluate(({view,student}: any) => (window as any).__render(view,student), {view,student:noToken});
      await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('qr unavailable'));
      await check(view + ' missing-token preview truthfully displays unavailable without a substitute QR', async () => assert.equal(await page.$(selector), null));
    }
    const staleImage = await QRCode.toDataURL('UNSIGNED-OLD-ROLL');
    for (const kind of ['roll', 'dossier']) {
      await check(kind + ' browser print helper discards a legacy unsigned image and generates the current signed token', async () => {
        const html = await page.evaluate(({kind,student}: any) => (window as any).__fallback(kind,student), {kind,student:{...studentA,qrImageUrl:staleImage}});
        const src = /<img src="(data:image\/png;base64,[^"]+)" alt="Signed/.exec(html)?.[1]; assert(src);
        assert.equal(extractSignedAttendanceToken(await decodePng(Buffer.from(src.split(',')[1],'base64'))), tokens.a);
        assert(!html.includes('api.qrserver.com'));
      });
    }
    await check('QR PNGs and previews never send identity or token to third-party QR services', () => {
      assert.deepEqual(outside, []); assert.deepEqual(identityUrls, []);
    });
    const access = jwtModule.signAccessToken({ userId: 'examiner', email: 'examiner@test.invalid', role: 'ADMIN', name: 'Synthetic Examiner', tokenVersion: 0 });
    const scan = async (qrToken: string, authorization = access) => { const res = await fetch(base+'/api/attendance/scan', {method:'POST',
      headers:{'Content-Type':'application/json',...(authorization?{Authorization:'Bearer '+authorization}:{})},
      body:JSON.stringify({sessionId,qrToken,status:'PRESENT'})}); return {status:res.status,body:await res.json() as any}; };
    let original: any;
    await check('Decoded public QR passes real authenticated API verification for the correct OPEN frozen Hall candidate', async () => {
      const result=await scan(extractSignedAttendanceToken(decodedPublic)!);assert.equal(result.status,201);original=result.body.data.attendance;
      assert.equal(original.studentId,'a');assert.equal(original.sessionId,sessionId);assert.equal(detail.session.examHallId,'hall');
    });
    await check('Duplicate decoded QR preserves the exact original attendance record',async()=>{
      const result=await scan(tokens.a);assert.equal(result.status,200);assert.equal(result.body.data.alreadyMarked,true);
      assert.deepEqual(result.body.data.attendance,original);assert.equal(await db.attendance.count(),1);
    });
    await check('Forged, unsigned, wrong-Hall and unauthenticated scans cause no attendance writes',async()=>{
      assert.equal((await scan('qr_forged.'+'0'.repeat(64))).status,400);assert.equal((await scan('AZMVS-SYNTHETIC-a')).status,400);
      assert.equal((await scan(tokens.foreign)).status,409);assert.equal((await scan(tokens.b,'')).status,401);assert.equal(await db.attendance.count(),1);
    });
    const python=process.env.QR_PDF_TEST_PYTHON;
    assert(python,'QR_PDF_TEST_PYTHON must provide pypdfium2 for actual PDF pixel decoding');
    for(const [label,generate,expected] of [
      ['single',()=>students.studentsService.getRollSlipPdf('b'),tokens.b],
      ['bulk',()=>students.studentsService.getBulkRollSlipsPdf(['b','a']),tokens.b],
    ] as const){
      await check(label+' backend-generated PDF renders a QR that decodes to the existing signed token',async()=>{
        const {buffer}=await generate();const pdf=path.join(temporary,label+'.pdf'),png=path.join(temporary,label+'.png');fs.writeFileSync(pdf,buffer);
        execFileSync(python,['-c','import pypdfium2 as p,sys; d=p.PdfDocument(sys.argv[1]); d[0].render(scale=3.5).to_pil().save(sys.argv[2])',pdf,png],{timeout:30000,stdio:'pipe'});
        const decoded=await decodePng(fs.readFileSync(png));assert.equal(extractSignedAttendanceToken(decoded),expected);
      });
    }
    await check('Missing issued token produces no attendance QR in the actual backend PDF',async()=>{
      const {buffer}=await students.studentsService.getRollSlipPdf('missing');const pdf=path.join(temporary,'missing.pdf'),png=path.join(temporary,'missing.png');fs.writeFileSync(pdf,buffer);
      execFileSync(python,['-c','import pypdfium2 as p,sys; d=p.PdfDocument(sys.argv[1]); d[0].render(scale=2).to_pil().save(sys.argv[2])',pdf,png],{timeout:30000,stdio:'pipe'});
      const pixels=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(jsQR(new Uint8ClampedArray(pixels.data),pixels.info.width,pixels.info.height),null);
    });
    await check('Printing does not mutate candidate records or reissue their tokens',async()=>assert.deepEqual(await db.student.findMany({orderBy:{id:'asc'}}),before));
    await check('Revoked stored token rejects without modifying existing attendance',async()=>{
      await db.student.update({where:{id:'a'},data:{qrToken:qrModule.qrService.generateSignedQrToken('synthetic-revoked')}});
      assert.equal((await scan(tokens.a)).status,404);assert.equal(await db.attendance.count(),1);
    });
    await attendance.closeSession(sessionId,false,'examiner');
    await check('Closed Hall session still rejects a correctly signed decoded candidate QR',async()=>assert.equal((await scan(tokens.b)).status,409));
    console.log('SIGNED_SLIP_RELEASE_E2E_PASS='+checks+' FAIL=0');
  } finally {
    await browser?.close();if(server)await new Promise<void>(r=>server.close(()=>r()));
    await db?.$disconnect();await shared?.$disconnect();
    if(created){await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[name]);await admin.query('DROP DATABASE "'+name+'"');console.log('DISPOSABLE_SIGNED_SLIP_DB_REMOVED');}
    await admin.end();fs.rmSync(temporary,{recursive:true,force:true});
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
