import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import puppeteer from 'puppeteer';

async function run() {
  const root = path.resolve(__dirname, '../..');
  const hallTest = fs.readFileSync(path.join(__dirname, 'exam-halls-ui.test.ts'), 'utf8').replace(/\r\n/g, '\n');
  let fixture = hallTest.slice(hallTest.indexOf(' const fixture=`') + 16, hallTest.indexOf('`;\n const code'));
  fixture = fixture.replace(
    "import {ExamHallsView} from './src/components/admin/halls/ExamHallsView';",
    "import App from './src/App';",
  );
  fixture = fixture.replace(
    ' createRoot(document.getElementById(\'root\')).render(<ExamHallsView/>);',
    `
 const role=new URL(location.href).searchParams.get('role');
 const user=role?{id:'qa-user',name:'QA User',fullName:'QA User',email:'qa@example.invalid',role,status:'ACTIVE',avatarUrl:''}:null;
 if(user){localStorage.setItem('jps_current_user',JSON.stringify(user));localStorage.setItem('jps_access_token','local-http-fixture-only')}
 window.__scannerRequests=0;
 navigator.mediaDevices.getUserMedia=async()=>{window.__scannerRequests++;throw new Error('Camera access must not be requested by deferred routes')};
 const hallFetch=window.fetch;
 window.fetch=async(input,options={})=>{
   const url=new URL(String(input)),route=url.pathname;
   if(route.startsWith('/api/exam-halls')||route==='/api/test-centers')return hallFetch(input,options);
   window.__requests.push({route:route+url.search,method:options.method||'GET'});
   if(route==='/api/auth/login'){
     window.__loginBody=options.body?JSON.parse(options.body):{};
     return response({accessToken:'fixture-access-token',refreshToken:'fixture-refresh-token',user:{id:'fixture-teacher',email:'teacher@example.invalid',name:'Fixture Teacher',role:'TEACHER'}});
   }
   if(route==='/api/auth/me')return response({user});
   if(route==='/api/attendance/sessions')return response({sessions:[],pagination:{page:1,limit:25,total:0,totalPages:0}});
   if(route==='/api/dashboard/overview'){
     const mode=new URL(location.href).searchParams.get('dashboardMode')||'no-session';
     if(mode==='error')return response('Fixture overview unavailable',503);
     const attendanceToday=mode==='populated'?{sessionCount:1,expectedCount:2,markedCount:1,presentCount:1,lateCount:0,absentCount:0,unmarkedCount:1,attendancePercentage:50}:mode==='empty'?{sessionCount:1,expectedCount:0,markedCount:0,presentCount:0,lateCount:0,absentCount:0,unmarkedCount:0,attendancePercentage:null}:{sessionCount:0,expectedCount:0,markedCount:0,presentCount:0,lateCount:0,absentCount:0,unmarkedCount:0,attendancePercentage:null};
     return response({stats:{totalStudents:19,totalPartners:0,activeStaffCount:0,totalBilled:0,totalCollected:0,feeIncome:0,salaryExpenses:0,netCashFlow:0},period:{date:'2026-10-07'},recentActivity:[],demographics:{},attendanceToday});
   }
   if(route==='/api/students')return response({students:[],pagination:{page:1,limit:50,total:0,totalPages:0}});
   if(route==='/api/students/roll-number-status')return response({readyCount:0,issuedCount:0,totalPaidCount:0});
   return response([]);
 };
 createRoot(document.getElementById('root')).render(<App/>);
 `,
  );

  const { build } = require(path.join(root, 'node_modules/esbuild'));
  const bundle = await build({
    stdin: { contents: fixture, resolveDir: root, loader: 'tsx' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://fixtures.invalid' }) },
    logLevel: 'silent',
  });
  const assets = path.join(root, 'dist/assets');
  const css = fs.readdirSync(assets).find(file => file.endsWith('.css'))!;
  const app = express();
  app.get('/bundle.js', (_req, res) => res.type('js').send(bundle.outputFiles[0].text));
  app.get('/style.css', (_req, res) => res.sendFile(path.join(assets, css)));
  app.get('/', (_req, res) => res.send('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'));

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  let passed = 0;
  try {
    browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(String(error)));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const check = async (name: string, action: () => Promise<void>) => { await action(); passed++; console.log('PASS: ' + name); };
    const open = async (role: string, hash: string) => page.goto(`${base}/?role=${role}#${hash}`);
    const wait = (value: string) => page.waitForFunction(text => document.body.innerText.includes(text), {}, value);
    const body = () => page.evaluate(() => document.body.innerText);
    const requests = () => page.evaluate(() => (window as any).__requests as { route: string; method: string }[]);

    for (const role of ['SUPER_ADMIN', 'ADMIN', 'TEACHER']) {
      await check(`${role} opens real App #attendance into the fixture-backed Attendance Hub`, async () => {
        await open(role, 'attendance');
        await wait(role === 'TEACHER' ? 'Examination Attendance Hub' : 'No attendance session has been opened');
        if (role === 'TEACHER') await page.waitForFunction(() => (window as any).__requests?.some((request: any) => request.route.startsWith('/api/attendance/sessions')));
        assert((await body()).includes('Examination Attendance Hub'));
        assert.equal(await page.evaluate(() => location.hash), '#attendance');
        assert(await page.$('aside'));
        assert((await requests()).some(request => request.route.startsWith('/api/attendance/sessions')));
        if (role === 'TEACHER') {
          assert(!(await requests()).some(request => request.route === '/api/exam-halls' || request.route === '/api/test-centers'));
          assert.equal(await page.$$eval('button', buttons => buttons.filter(button => /Open Attendance Session|Close Attendance Session/.test(button.textContent || '')).length), 0);
        }
        assert.equal(await page.evaluate(() => (window as any).__scannerRequests), 0);
      });
    }

    await check('TEACHER retains self-service settings and returns to attendance', async () => {
      await open('TEACHER', 'settings');
      await wait('Teacher Account Settings');
      assert.equal(await page.evaluate(() => location.hash), '#settings');
      const buttons = await page.$$('button');
      let clicked = false;
      for (const button of buttons) if ((await button.evaluate(element => element.textContent))?.includes('Back to Attendance')) { await button.click(); clicked = true; break; }
      assert(clicked, 'Teacher settings return action is missing');
      await wait('Examination Attendance Hub');
      await page.waitForFunction(() => (window as any).__requests?.some((request: any) => request.route.startsWith('/api/attendance/sessions')));
      assert.equal(await page.evaluate(() => location.hash), '#attendance');
    });

    await check('real LoginPage login callback routes a fixture-authenticated TEACHER to attendance', async () => {
      await page.goto(base);
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${base}/#login`);
      await page.waitForSelector('input[name="email"]');
      await page.type('input[name="email"]', 'teacher@example.invalid');
      await page.type('input[name="password"]', 'FixturePassword123');
      const submit = await page.$('form button[type="submit"]');
      assert(submit, 'Login form submit button missing');
      await submit.click();
      await wait('Examination Attendance Hub');
      await page.waitForFunction(() => (window as any).__requests?.some((request: any) => request.route === '/api/attendance/sessions?page=1&limit=100'));
      assert.equal(await page.evaluate(() => location.hash), '#attendance');
      assert.deepEqual(await page.evaluate(() => (window as any).__loginBody), { email: 'teacher@example.invalid', password: 'FixturePassword123' });
      assert(!(await requests()).some(request => request.route === '/api/exam-halls' || request.route === '/api/test-centers'));
    });

    await check('ACCOUNTANT attendance deep link resolves to permitted dashboard, with no attendance API request', async () => {
      await open('ACCOUNTANT', 'attendance');
      await wait('Registered Students');
      assert.equal(await page.evaluate(() => location.hash), '#dashboard');
      assert(!(await body()).includes('Examination Attendance Hub'));
      assert(!(await requests()).some(request => request.route.startsWith('/api/attendance/')));
      assert.equal(await page.evaluate(() => (window as any).__scannerRequests), 0);
    });

    const attendanceCard = () => page.evaluate(() => {
      const label = Array.from(document.querySelectorAll('span')).find(element => element.textContent?.trim() === "Today's Attendance");
      return (label?.closest('.bg-white') as HTMLElement | null)?.innerText || '';
    });
    for (const [mode, value, subtitle] of [['no-session', '—', 'No Session'], ['empty', '—', 'No Candidates Assigned'], ['populated', '50%', '1 Marked · 1 Present']] as const) {
      await check(`actual DashboardView renders truthful ${mode} attendance fixture`, async () => {
        await page.goto(`${base}/?role=ADMIN&dashboardMode=${mode}#dashboard`);
        await wait('Welcome to AZMAIO Administration Desk');
        await page.waitForFunction(() => (window as any).__requests?.some((request: any) => request.route.startsWith('/api/dashboard/overview')));
        await page.waitForFunction(expected => Array.from(document.querySelectorAll('span')).some(element => element.textContent?.trim() === "Today's Attendance" && (element.closest('.bg-white') as HTMLElement | null)?.innerText.includes(expected)), {}, subtitle);
        const card = await attendanceCard();
        assert(card.includes(value), card);
        assert(card.includes(subtitle), card);
        assert(!card.includes('19'), 'attendance card must not use the unrelated registered student count');
      });
    }
    await check('dashboard overview failure remains an unavailable state instead of zero attendance', async () => {
      await page.goto(`${base}/?role=ADMIN&dashboardMode=error#dashboard`);
      await wait('Unable to Load Dashboard Data');
      assert((await body()).includes('Fixture overview unavailable'));
      assert(!(await body()).includes("Today's Attendance"));
    });

    for (const hash of ['storage', 'fees', 'payroll', 'scan']) {
      await check(`#${hash} remains deferred and never opens a camera`, async () => {
        await open('ADMIN', hash);
        await wait('Registered Students');
        assert.equal(await page.evaluate(() => location.hash), '#dashboard');
        assert.equal(await page.evaluate(() => (window as any).__scannerRequests), 0);
        assert(!(await body()).includes('AZM Examiner Attendance'));
      });
    }

    for (const role of ['SUPER_ADMIN', 'ADMIN']) {
      await check(`${role} retains its existing #halls route`, async () => {
        await open(role, 'halls');
        await wait('Candidate 00');
        assert.equal(await page.evaluate(() => location.hash), '#halls');
        assert((await body()).includes('Exam Halls'));
      });
    }

    for (const [hash, heading] of [
      ['dashboard', 'Executive Overview Dashboard'],
      ['students', 'Student Management & Admissions'],
      ['partners', 'Partner Institutions Directory'],
      ['transactions', 'Financial Ledger'],
      ['staff', 'Staff & Faculty Directory'],
      ['settings', 'System Settings & User RBAC'],
    ] as const) {
      await check(`ADMIN retains existing #${hash} route`, async () => {
        await open('ADMIN', hash);
        await wait(heading);
        assert.equal(await page.evaluate(() => location.hash), `#${hash}`);
      });
    }

    for (const [label, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]] as const) {
      await page.setViewport({ width, height });
      for (const role of ['ADMIN', 'TEACHER']) await check(`${label} actual App ${role} Attendance Hub loads without page overflow`, async () => {
          await open(role, 'attendance');
          await wait('Examination Attendance Hub');
          await page.waitForFunction(() => (window as any).__requests?.some((request: any) => request.route.startsWith('/api/attendance/sessions')));
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `page overflow at ${label}`);
          assert.equal(await page.evaluate(() => location.hash), '#attendance');
          await page.screenshot({ path: path.join(os.tmpdir(), `azm-att13c-${role.toLowerCase()}-${width}.png`), fullPage: true });
        });
    }

    assert.deepEqual(errors, []);
    console.log(`13C App routing browser acceptance: ${passed} PASS, 0 FAIL. API data came from in-test fixtures; App and AuthProvider were bundled from source.`);
  } finally {
    await browser?.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
