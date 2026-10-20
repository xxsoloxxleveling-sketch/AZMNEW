import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { studyGroupReadiness } from '../src/modules/students/hsscContract';
import { PUBLIC_REGISTRATION_OPEN } from '../../src/config/registration';

async function run() {
  assert.equal(PUBLIC_REGISTRATION_OPEN, false);
  const root = path.resolve(__dirname, '../..'), output = path.join(root, 'tmp/hssc-flow-20261020');
  const css = fs.readdirSync(path.join(root, 'dist/assets')).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(path.join(root, 'dist/assets', f), 'utf8')).join('\n');
  const bundle = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';
    import{AuthProvider}from'./src/lib/authContext';import{setUser}from'./src/lib/auth';
    import{StudentOmrModal}from'./src/components/admin/students/StudentOmrModal';
    import{BulkPrintModal}from'./src/components/admin/students/BulkPrintModal';
    import{PublicCandidateRegistrationWizard}from'./src/components/public/register/PublicCandidateRegistrationWizard';
    import{ApplicationPortal}from'./src/components/apply/ApplicationPortal';
    setUser({id:'staff',name:'Synthetic Staff',email:'staff@test.invalid',role:location.pathname==='/unauthorized'?'TEACHER':'ADMIN'});
    fetch('/fixture').then(r=>r.json()).then(students=>createRoot(document.getElementById('root')).render(<AuthProvider>{
      location.pathname==='/bulk'?<BulkPrintModal students={students} isOpen type="OMR" onClose={()=>{}}/>:
      location.pathname==='/public'?<PublicCandidateRegistrationWizard onNavigateHome={()=>{}} onNavigateLogin={()=>{}}/>:
      location.pathname==='/portal'?<ApplicationPortal initialClass="HSSC-II" onSelectTab={()=>{}}/>:
      <StudentOmrModal student={students[1]} isOpen onClose={()=>{}}/>}</AuthProvider>));`, resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_API_URL': 'window.location.origin' },
    // Mount retained public forms at their education stage. Capture and validation code is unchanged.
    plugins: [{ name: 'education-stage-fixture', setup(builder) { builder.onLoad({ filter: /(?:PublicCandidateRegistrationWizard|ApplicationPortal)\.tsx$/ }, args => ({ contents: fs.readFileSync(args.path, 'utf8').replace(/(\[currentStage, setCurrentStage\] = useState(?:<number>)?\()1(\))/, '$13$2'), loader: 'tsx' })); } }],
  });
  const make = (id: string, hsscGroup: string | null) => ({ id, applicationNo: 'SYNTHETIC-' + id, fullName: 'Synthetic ' + id, fatherName: 'Synthetic Guardian', currentClass: '2nd Year', hsscGroup, updatedAt: '2026-10-20T00:00:00.000Z', rollNumber: null, qrToken: '' });
  const students = [make('ready-a', 'Pre-Engineering'), make('review-b', null), make('ready-c', 'ICS')];
  let failOnce = true, saves = 0, detailGets = 0, printIds: string[] = [];
  const photo = await sharp({ create: { width: 80, height: 110, channels: 3, background: '#185b9d' } }).png().toBuffer();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const json = (body: unknown) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
    if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle.outputFiles[0].text); }
    if (url.pathname === '/fixture') return json(students);
    if (url.pathname === '/api/auth/me') return json({ success: true, data: { id: 'staff', role: req.headers.referer?.includes('/unauthorized') ? 'TEACHER' : 'ADMIN', name: 'Synthetic Staff', email: 'staff@test.invalid' } });
    if (url.pathname.includes('/document/')) { res.setHeader('Content-Type', 'image/png'); return res.end(photo); }
    if (url.pathname === '/api/students/print-readiness') return json({ success: true, data: studyGroupReadiness(students) });
    if (url.pathname === '/api/students/bulk-omr-pdf') {
      let raw = ''; for await (const chunk of req) raw += chunk; printIds = JSON.parse(raw).studentIds;
      res.setHeader('Content-Type', 'application/pdf'); return res.end(fs.readFileSync(path.join(output, 'ready-subset-omr.pdf')));
    }
    if (url.pathname.startsWith('/api/students/review-b')) {
      if (req.method === 'PATCH') {
        let raw = ''; for await (const chunk of req) raw += chunk; const body = JSON.parse(raw);
        if (failOnce) { failOnce = false; res.statusCode = 400; return json({ success: false, error: { message: 'Confirm the source and retry.', details: { correctionBasis: ['Confirm the source and retry.'] } } }); }
        assert.equal(body.expectedUpdatedAt, students[1].updatedAt); assert(body.correctionBasis.length > 2);
        Object.assign(students[1], { hsscGroup: body.hsscGroup, updatedAt: '2026-10-20T00:00:01.000Z' }); saves++; return json({ success: true, data: students[1] });
      }
      detailGets++; return json({ success: true, data: students[1] });
    }
    if (url.pathname.startsWith('/api/')) return json({ success: true, data: {} });
    res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address(); assert(address && typeof address !== 'string');
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error instanceof Error ? error.message : String(error)));
    await page.evaluateOnNewDocument(() => localStorage.clear());
    const open = async (mode: string) => page.goto('http://127.0.0.1:' + address.port + mode, { waitUntil: 'networkidle0' });
    const clickText = async (text: string) => page.evaluate(text => { const button = [...document.querySelectorAll('button')].find(el => el.textContent?.trim() === text); if (!button || button.disabled) throw new Error('Button unavailable: ' + text); button.click(); }, text);
    for (const width of [1280, 390]) {
      await page.setViewport({ width, height: 960 }); await open('/bulk');
      await page.waitForFunction(() => document.body.textContent?.includes('2 ready to print. 1 students need a study group.'));
      assert(await page.$$eval('button', nodes => nodes.find(el => el.textContent?.includes('Download PDF'))?.disabled));
      await clickText('Review groups'); assert(await page.$$eval('button', nodes => nodes.some(el => el.textContent === 'Update study group')));
      await clickText('Print 2 ready students'); assert(await page.evaluate(() => document.body.textContent?.includes('Excluded: SYNTHETIC-review-b')));
      await page.screenshot({ path: path.join(output, 'bulk-review-' + width + '.png'), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.$$eval('button', nodes => nodes.find(el => el.textContent?.includes('Download PDF'))!.click());
      await page.waitForResponse(response => response.url().endsWith('/bulk-omr-pdf')); assert.deepEqual(printIds, ['ready-a', 'ready-c']);
    }
    await open('/unauthorized'); await page.waitForFunction(() => document.body.textContent?.includes('Study group needs verification'));
    assert(!(await page.$$eval('button', nodes => nodes.some(el => el.textContent === 'Update study group'))));
    await open('/correction'); await clickText('Update study group'); await page.waitForSelector('#correction-group:not(:disabled)');
    await clickText('Save and recheck'); assert(await page.$eval('#correction-group', el => el.getAttribute('aria-invalid') === 'true'));
    await page.select('#correction-group', 'ICS'); await page.type('#correction-basis', 'Verified from synthetic current admission form');
    await clickText('Save and recheck'); await page.waitForFunction(() => document.body.textContent?.includes('Confirm the source and retry.'));
    assert.equal(await page.$eval('#correction-group', el => (el as HTMLSelectElement).value), 'ICS');
    await page.screenshot({ path: path.join(output, 'correction-error.png'), fullPage: true });
    await clickText('Save and recheck'); await page.waitForFunction(() => !document.querySelector('#correction-group'));
    assert.equal(saves, 1); assert(detailGets >= 3); await page.waitForFunction(() => document.body.textContent?.includes('HSSC Group: Computer Science (ICS)'));
    await page.reload({ waitUntil: 'networkidle0' }); assert(await page.evaluate(() => document.body.textContent?.includes('HSSC Group: Computer Science (ICS)')));
    await page.screenshot({ path: path.join(output, 'correction-rechecked.png'), fullPage: true });
    for (const mode of ['/public', '/portal']) {
      await open(mode); await page.waitForSelector('#field-currentClass');
      if (mode === '/public') await page.select('#field-currentClass', 'HSSC-II (Class 12th)');
      await page.waitForSelector('#field-study-group');
      assert.equal(await page.$eval('#field-study-group', el => (el as HTMLSelectElement).value), '');
      assert.equal(await page.$$eval('#field-study-group option', nodes => nodes.length), 7);
      assert(await page.$eval('#field-study-group', el => (el as HTMLSelectElement).required));
      await page.screenshot({ path: path.join(output, mode.slice(1) + '-study-group.png'), fullPage: true });
      await page.select('#field-study-group', 'ICS'); assert.equal(await page.$eval('#field-study-group', el => (el as HTMLSelectElement).value), 'ICS');
    }
    assert.deepEqual(errors, []);
    console.log('PASS: correction errors retain selection, save/refetch/reload updates preview; roles; explicit bulk exclusions and exact ID submission at desktop/mobile; both retained public selectors start empty; registration stays closed');
  } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
