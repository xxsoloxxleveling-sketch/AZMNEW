import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { prisma } from '../src/lib/prisma';
import { studentsService } from '../src/modules/students/students.service';
import { getPrintableHsscGroup as pdfGroup } from '../src/modules/documents/pdf.service';
import { getPrintableHsscGroup, HSSC_GROUP_OPTIONS, STUDY_GROUP_REVIEW } from '../../src/utils/hsscGroup';

const repo = path.resolve(__dirname, '../..');
const cnic = '12345-1234567-1';
const qr = 'https://azmaio.com/attend?token=qr_SYNTHETIC-TEST_1790000000000.' + 'a'.repeat(64);
const groups = ['Pre-Medical', 'Pre-Engineering', 'ICS', 'FA', 'I.Com', 'General Science'];
const placement = {
  placementStatus: 'ASSIGNED', assignedHallId: 'synthetic-hall', assignedHall: 'Synthetic Hall',
  testCenterName: 'Synthetic Examination Centre', testCenterAddress: 'Synthetic City',
  testDate: 'Sunday, 15 November 2026', reportingTime: '07:30 AM', testTimeLabel: 'To be announced',
  assignedRoom: 'Room 01', seatNo: 'Seat #01',
};
let student: any = {};
const makeStudent = (currentClass: string, hsscGroup: string | null) => ({
  id: 'synthetic-hssc', applicationNo: 'APP-SYNTHETIC-1', rollNumber: 'AZMVS-2026-0100',
  fullName: 'Synthetic Candidate', fatherName: 'Synthetic Guardian', cnicOrBForm: cnic,
  currentClass, hsscGroup, status: 'ACTIVE', feeRecords: [{ status: 'PAID' }],
  qrToken: '', updatedAt: new Date('2026-10-15T00:00:00Z'), ...placement,
});

async function run() {
  const originalFind = prisma.student.findFirst;
  const originalQuery = prisma.$queryRaw;
  const originalRelease = studentsService.getReleaseConfig;
  const service = studentsService as any;
  const originalPlacement = service.resolveExamPlacement;
  // Stub the development availability probe as well as the model query: this test uses no database.
  (prisma as any).$queryRaw = async () => [{ result: 1 }];
  (prisma.student as any).findFirst = async () => student;
  service.getReleaseConfig = async () => ({ isScheduled: false });
  service.resolveExamPlacement = async () => placement;
  let server: ReturnType<typeof createServer> | undefined;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    const aliases = ['HSSC-I (Class 11th)', 'HSSC-II (Class 12th)', 'First Year', 'Second Year',
      'HSSC-I', 'HSSC-II', 'HSSC1', 'HSSC2', '1st Year', '2nd Year', 'Class 11th (HSSC-I)',
      'Class 12th (HSSC-II)', 'Class 11', 'Class 12', 'Class 11th', 'Class 12th', '11th', '12th', '11', '12'];
    for (const currentClass of aliases) for (const hsscGroup of groups) {
      assert.equal(getPrintableHsscGroup({ currentClass, hsscGroup }), HSSC_GROUP_OPTIONS.find(o => o.value === hsscGroup)!.label);
      assert.equal(getPrintableHsscGroup({ currentClass, hsscGroup }), pdfGroup({ currentClass, hsscGroup }));
    }
    for (const hsscGroup of [...groups, null]) {
      student = makeStudent('HSSC-II (Class 12th)', hsscGroup);
      const result = await studentsService.searchPublicSlip(undefined, cnic);
      assert(result.success && result.data);
      assert.equal(result.data.hsscGroup, hsscGroup, 'Public response must carry the saved group');
    }
    console.log('PASS: 120 frontend/PDF class-group combinations and public API group/null propagation');

    const css = fs.readdirSync(path.join(repo, 'dist/assets')).filter(name => name.endsWith('.css'))
      .map(name => fs.readFileSync(path.join(repo, 'dist/assets', name), 'utf8')).join('\n');
    const bundle = await build({
      stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {RollNumberSlipView} from './src/components/rollnumber/RollNumberSlipView';
        import {RollSlipPreviewModal} from './src/components/admin/students/RollSlipPreviewModal';
        import {StudentOmrModal} from './src/components/admin/students/StudentOmrModal';
        import {AuthProvider} from './src/lib/authContext';
        import {setUser} from './src/lib/auth';
        setUser({id:'fixture-admin',name:'Synthetic Staff',email:'staff@test.invalid',role:'ADMIN'});
        const mode=location.pathname.slice(1);
        fetch('/fixture-student').then(r=>r.json()).then(student=>createRoot(document.getElementById('root')).render(
          React.createElement(AuthProvider,{},mode==='public'?React.createElement(RollNumberSlipView,{onSelectTab:()=>{}}):
          React.createElement(mode==='omr'?StudentOmrModal:RollSlipPreviewModal,{student,isOpen:true,onClose:()=>{}}))));`,
        resolveDir: repo, loader: 'tsx' },
      bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
      define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_API_URL': 'window.location.origin' },
    });
    const photo = await sharp({ create: { width: 100, height: 120, channels: 3, background: '#6e99b2' } }).png().toBuffer();
    server = createServer(async (req, res) => {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      const json = (value: unknown) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
      if (['/public', '/roll', '/omr'].includes(pathname)) {
        res.setHeader('Content-Type', 'text/html');
        return res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main><div id="root"></div></main><script src="/fixture.js"></script></body></html>`);
      }
      if (pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle.outputFiles[0].text); }
      if (pathname.startsWith('/pictures/')) { res.setHeader('Content-Type', 'image/png'); return res.end(fs.readFileSync(path.join(repo, 'public/pictures/logo_cropped.png'))); }
      if (pathname.includes('photo')) { res.setHeader('Content-Type', 'image/png'); return res.end(photo); }
      if (pathname.endsWith('/search-slip')) {
        const response = await studentsService.searchPublicSlip(undefined, cnic);
        return json({ ...response, data: { ...response.data, qrPayload: qr } });
      }
      if (pathname === '/api/auth/me') return json({success:true,data:{id:'fixture-admin',role:'ADMIN',name:'Synthetic Staff',email:'staff@test.invalid'}});
      if (pathname === '/fixture-student' || pathname.startsWith('/api/students/')) return json({ success: true, data: student, ...student });
      return json({ success: true, status: 'ok' });
    });
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert(address && typeof address !== 'string');
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors: string[] = []; page.on('pageerror', error => errors.push(error instanceof Error ? error.message : String(error)));
    const output = process.env.HSSC_PREVIEW_QA_DIR;
    if (output) fs.mkdirSync(output, { recursive: true });
    let previews = 0;
    for (const mode of ['public', 'roll', 'omr']) {
      for (const [label, grade, group, expected] of [
        ['saved', 'HSSC-II (Class 12th)', 'Pre-Medical', 'Pre-Medical'],
        ['missing', 'First Year', null, STUDY_GROUP_REVIEW],
        ['non-hssc', 'Class 10th', 'Pre-Medical', null],
      ] as const) {
        student = makeStudent(grade, group);
        for (const width of [1280, 390]) {
          await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
          await page.emulateMediaType('screen');
          await page.goto('http://127.0.0.1:' + address.port + '/' + mode, { waitUntil: 'networkidle0' });
          if (mode === 'public') {
            await page.type('#input-slip-cnic', cnic);
            await page.click('#btn-search-slip');
            await page.waitForSelector('.roll-number-slip');
            if (label !== 'missing') await page.waitForFunction(() => !(document.querySelector('#btn-print-slip') as HTMLButtonElement)?.disabled);
            else assert(await page.$eval('#btn-print-slip', el => (el as HTMLButtonElement).disabled));
          } else {
            await page.waitForFunction(() => document.body.textContent?.includes('Synthetic Candidate'));
          }
          const selector = mode === 'public' ? '.roll-number-slip' : mode === 'omr' ? '#azm-printable-omr-sheet' : '#azm-printable-roll-slip';
          const sheet = await page.$(selector); assert(sheet, mode + ' preview exists');
          const text = await sheet.evaluate(el => el.textContent || '');
          assert.equal(text.includes('HSSC Group:'), expected !== null, mode + ' HSSC field visibility');
          if (expected) assert(text.includes('HSSC Group: ' + expected), mode + ' displays saved group/fallback');
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), mode + ' page overflow');
          if (output && label === 'saved') await sheet.screenshot({ path: path.join(output, mode + '-' + width + '-screen.png') });
          if (mode === 'public' && expected && label !== 'missing') {
            await page.emulateMediaType('print');
            assert(await sheet.evaluate((el, value) => (el as HTMLElement).innerText.includes('HSSC Group: ' + value), expected), 'Group stays visible when printing');
            const pdf = Buffer.from(await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true }));
            assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1, 'HSSC slip stays on one A4 page');
            if (output && label === 'saved') fs.writeFileSync(path.join(output, 'public-' + width + '-print.pdf'), pdf);
          }
          previews++;
        }
      }
      console.log('PASS: ' + mode + ' preview, desktop/mobile, saved/missing/non-HSSC, no page overflow');
    }
    assert.deepEqual(errors, []);
    console.log('HSSC_PREVIEW_PASS=' + previews + ' FAIL=0');
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    (prisma.student as any).findFirst = originalFind;
    (prisma as any).$queryRaw = originalQuery;
    service.getReleaseConfig = originalRelease;
    service.resolveExamPlacement = originalPlacement;
    await prisma.$disconnect();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
