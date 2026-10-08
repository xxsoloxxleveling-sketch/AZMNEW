import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import puppeteer from 'puppeteer';

async function run() {
  const root = path.resolve(__dirname, '../..');
  const { build } = require(path.join(root, 'node_modules/esbuild'));
  const fixture = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { AttendanceHubView } from './src/components/admin/attendance/AttendanceHubView';
    const params = new URL(location.href).searchParams;
    const mode = params.get('mode') || 'open';
    const role = params.get('role') || 'ADMIN';
    const roster = [
      { studentId:'student-1', fullNameSnapshot:'Amina Snapshot', rollNumberSnapshot:'ROLL-001', applicationNoSnapshot:'APP-001', currentClassSnapshot:'Class 9th', seatNoSnapshot:'Seat #01', status:'PRESENT', method:'MANUAL', markedAt:'2026-10-07T10:00:00.000Z' },
      { studentId:'student-2', fullNameSnapshot:'Bilal Unmarked', rollNumberSnapshot:'ROLL-002', applicationNoSnapshot:'APP-002', currentClassSnapshot:'First Year', seatNoSnapshot:'Seat #02', status:'NOT_MARKED', method:null, markedAt:null },
      { studentId:'student-3', fullNameSnapshot:'Celia Absent', rollNumberSnapshot:'ROLL-003', applicationNoSnapshot:'APP-003', currentClassSnapshot:'Class 10th', seatNoSnapshot:'Seat #03', status:'ABSENT', method:'MANUAL', markedAt:'2026-10-07T10:02:00.000Z' },
    ];
    const stats = { expectedCount:3, markedCount:2, presentCount:1, lateCount:0, absentCount:1, unmarkedCount:1, attendancePercentage:mode==='null-percent'?null:33.3 };
    const session = { id:'session-1', examHallId:'hall-a', status:mode==='closed'?'CLOSED':'OPEN', testCenterNameSnapshot:'Snapshot Center', hallNameSnapshot:'Snapshot Hall A', roomNumberSnapshot:'Snapshot Room 101', examDateSnapshot:'15 November 2026', reportingTimeSnapshot:'08:30 AM', businessDate:'2026-11-15T00:00:00.000Z' };
    const detail = () => ({ session:{...session}, stats:{...stats}, roster:roster.map(row=>({...row})) });
    const halls = [
      { id:'hall-a', name:'Current Hall A', roomNumber:'Current Room 101', testCenterId:'center-a', centerName:'Current Center', examDate:'20 November 2026', reportingTime:'09:00 AM', assignedCount:mode==='zero'?0:3, targetClass:'Class 9th' },
      { id:'hall-b', name:'Empty Hall B', roomNumber:'Room 202', testCenterId:'center-b', centerName:'Second Center', examDate:'21 November 2026', reportingTime:'10:00 AM', assignedCount:0, targetClass:'First Year' },
    ];
    window.__fault=''; window.__requests=[]; window.__alerts=[]; window.__opened=false; window.__closedPayloads=[]; window.__marks=[];
    window.alert = message => window.__alerts.push(String(message));
    window.confirm = () => { throw new Error('Native confirm is forbidden'); };
    window.fetch = async (input, options={}) => {
      const url=new URL(String(input)); const route=url.pathname; const method=options.method||'GET';
      const body=options.body?JSON.parse(options.body):{};
      window.__requests.push({route:route+url.search,method,body});
      await new Promise(resolve=>setTimeout(resolve, mode==='loading'?600:15));
      const response=(data,status=200)=>new Response(JSON.stringify(status===200?{success:true,data}:{success:false,error:{message:data}}),{status,headers:{'Content-Type':'application/json'}});
      if((mode==='error' || window.__fault==='reads') && route.startsWith('/api/attendance/')) return response('Fixture attendance API unavailable',503);
      if(window.__fault==='write' && method==='POST') return response('Fixture write rejected',409);
      if(window.__fault==='roster' && route.endsWith('/candidates')) return response('Fixture roster unavailable',503);
      if(route==='/api/test-centers') return response([
        {id:'center-a',name:'Current Center',code:'CA',campus:'North Campus',address:'',district:'',province:'',capacity:20,reportingTime:'09:00 AM',testDate:'2026-11-20',contactPerson:'',contactPhone:'',status:'ACTIVE',createdAt:'2026-01-01'},
        {id:'center-b',name:'Second Center',code:'CB',campus:'South Campus',address:'',district:'',province:'',capacity:20,reportingTime:'10:00 AM',testDate:'2026-11-21',contactPerson:'',contactPhone:'',status:'ACTIVE',createdAt:'2026-01-01'}
      ]);
      if(route==='/api/exam-halls') return response(halls);
      if(route==='/api/attendance/sessions' && method==='GET') {
        const selected=url.searchParams.get('examHallId');
        if((mode==='no-session' && !window.__opened) || mode==='zero') return response({sessions:[],pagination:{page:1,limit:25,total:0,totalPages:0}});
        if(selected==='hall-b') return response({sessions:[],pagination:{page:1,limit:25,total:0,totalPages:0}});
        return response({sessions:[{...session,stats:{...stats}}],pagination:{page:1,limit:25,total:1,totalPages:1}});
      }
      if(route==='/api/attendance/sessions' && method==='POST') {
        if(mode==='zero') return response({message:'No explicitly assigned candidates are available for this examination Hall.'},409);
        window.__opened=true; session.status='OPEN'; session.hallNameSnapshot=halls[0].name; session.roomNumberSnapshot=halls[0].roomNumber; session.testCenterNameSnapshot=halls[0].centerName; session.examDateSnapshot=halls[0].examDate; session.reportingTimeSnapshot=halls[0].reportingTime;
        for(const row of roster){row.status='NOT_MARKED';row.method=null;row.markedAt=null;}
        Object.assign(stats,{markedCount:0,presentCount:0,lateCount:0,absentCount:0,unmarkedCount:3,attendancePercentage:0});return response(detail());
      }
      if(route==='/api/attendance/sessions/session-1/candidates') {
        const search=url.searchParams.get('search')||'';
        const rows=roster.filter(r=>[r.fullNameSnapshot,r.rollNumberSnapshot,r.applicationNoSnapshot,r.seatNoSnapshot].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase())));
        return response({candidates:rows,pagination:{page:Number(url.searchParams.get('page')||1),limit:Number(url.searchParams.get('limit')||25),total:rows.length,totalPages:Math.ceil(rows.length/25)}});
      }
      if(route==='/api/attendance/sessions/session-1' && method==='GET') return response(detail());
      if(route==='/api/attendance/sessions/session-1/mark' && method==='POST') {
        window.__marks.push(body);
        const row=roster.find(r=>r.studentId===body.studentId || r.rollNumberSnapshot===body.rollNumber);
        if(row){row.status=body.status;row.method='MANUAL';row.markedAt='2026-10-07T11:00:00.000Z';row.markedByName=undefined;}
        stats.markedCount=roster.filter(r=>r.status!=='NOT_MARKED').length; stats.presentCount=roster.filter(r=>r.status==='PRESENT').length;
        stats.lateCount=roster.filter(r=>r.status==='LATE').length;stats.absentCount=roster.filter(r=>r.status==='ABSENT').length;stats.unmarkedCount=roster.filter(r=>r.status==='NOT_MARKED').length;
        stats.attendancePercentage=Math.round((stats.presentCount+stats.lateCount)/stats.expectedCount*1000)/10;
        return response({attendance:{id:'attendance-1',status:body.status},student:{id:body.studentId||'student-2'}});
      }
      if(route==='/api/attendance/sessions/session-1/close' && method==='POST') {
        window.__closedPayloads.push(body);session.status='CLOSED';
        if(body.markRemainingAbsent){for(const row of roster)if(row.status==='NOT_MARKED')row.status='ABSENT';}
        stats.markedCount=roster.filter(r=>r.status!=='NOT_MARKED').length; stats.absentCount=roster.filter(r=>r.status==='ABSENT').length; stats.unmarkedCount=roster.filter(r=>r.status==='NOT_MARKED').length;
        return response(detail());
      }
      return response({message:'Unexpected fixture route: '+method+' '+route},404);
    };
    createRoot(document.getElementById('root')).render(<AttendanceHubView role={role}/>);
  `;
  const bundle = await build({
    stdin: { contents: fixture, resolveDir: root, loader: 'tsx' }, bundle: true, write: false,
    format: 'iife', platform: 'browser', define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://fixtures.invalid' }) },
    logLevel: 'silent', plugins: [{ name:'fixture-auth', setup(builder:any) {
      builder.onResolve({filter:/authContext$/},()=>({path:'auth-fixture',namespace:'fixture'}));
      builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useAuth=()=>({isLoading:false,user:{role:"ADMIN"}});',loader:'js'}));
    }}],
  });
  const app=express();
  const assets=path.join(root,'dist/assets'); const css=fs.readdirSync(assets).find(name=>name.endsWith('.css'))!;
  app.get('/style.css',(_req,res)=>res.sendFile(path.join(assets,css)));
  app.get('/bundle.js',(_req,res)=>res.type('js').send(bundle.outputFiles[0].text));
  app.get('/',(_req,res)=>res.send('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-slate-50"><div id="root" class="p-4 sm:p-6 min-w-0"></div><script src="/bundle.js"></script></body></html>'));
  const server=app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve));
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']}).catch(async error=>{await new Promise<void>(resolve=>server.close(()=>resolve()));throw error;});
  const page=await browser.newPage(); const errors:string[]=[];page.on('pageerror',error=>errors.push(String(error)));
  const base=`http://127.0.0.1:${(server.address() as any).port}`; let passed=0;
  const check=async(name:string,fn:()=>Promise<void>)=>{await fn();passed++;console.log('PASS: '+name);};
  const visit=async(query='')=>{await page.goto(base+'/'+query);};
  const body=()=>page.evaluate(()=>document.body.innerText);
  const waitText=(value:string)=>page.waitForFunction(text=>document.body.innerText.includes(text),{},value);
  const buttonCount=(name:string)=>page.$$eval('button',(buttons,name)=>buttons.filter(button=>button.textContent?.trim()===name).length,name);
  const buttonDisabled=(name:string)=>page.$$eval('button',(buttons,name)=>buttons.filter(button=>button.textContent?.trim()===name).every(button=>button.disabled),name);
  const click=async(name:string)=>{
    await page.waitForFunction(name=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent?.trim()===name&&!button.disabled),{},name);
    for(const button of await page.$$('button')) if((await button.evaluate(el=>el.textContent))?.trim()===name) { await button.click(); return; }
    throw new Error('Missing button '+name);
  };
  const ready=()=>waitText('Amina Snapshot');
  const dialogReady=()=>page.waitForSelector('[role="dialog"]');
  const screenshot=(name:string)=>page.screenshot({path:path.join(os.tmpdir(),'azm-att13b-'+name+'.png'),fullPage:!name.includes('mobile-')});
  const choose=async(id:string,value:string)=>page.select('#'+id,value);
  const requests=()=>page.evaluate(()=>(window as any).__requests);
  try {
    await check('hub identifies examination attendance',async()=>{await visit('?mode=open&role=ADMIN');await ready();assert.match(await body(),/Examination Attendance Hub/);});
    await check('class is never the session scope',async()=>{assert(!await page.$('#class-filter'));assert(!(await requests()).some((x:any)=>String(x.route).includes('class=')));});
    await check('no global student picker is present',async()=>{assert(!(await page.evaluate(()=>Array.from(document.querySelectorAll('select')).some(el=>/student/i.test(el.getAttribute('aria-label')||el.textContent||'')))));assert(!(await body()).includes('Select student'));});
    await check('scanner is not the first workspace',async()=>{const text=await body();assert(!/QR Scanner|Biometric QR|camera feed/i.test(text));});
    await check('center selector has real options',async()=>{assert(await page.$('#attendance-center'));assert((await page.$eval('#attendance-center',(el:any)=>el.options.length))>=2);});
    await check('hall selector has real options',async()=>{assert(await page.$('#attendance-hall'));assert((await page.$eval('#attendance-hall',(el:any)=>el.options.length))>=2);});
    await check('Hall selection loads that hall session',async()=>{await choose('attendance-hall','hall-b');await page.waitForFunction(()=>(window as any).__requests.some((r:any)=>r.route.includes('examHallId=hall-b')));});
    await check('no-session state is explicit and truthful',async()=>{await visit('?mode=no-session&role=ADMIN');await waitText('No attendance session has been opened for this Hall.');});
    await check('no-session is not represented as zero attendance',async()=>{assert(!/0%/.test(await body()));});
    await check('zero explicit roster is explained',async()=>{await visit('?mode=zero&role=ADMIN');await waitText('No explicitly assigned candidates are available for this Hall.');});
    await check('open is disabled for a zero-candidate Hall',async()=>{assert(await buttonDisabled('Open Attendance Session'));});
    await check('open action uses confirmation dialog',async()=>{await visit('?mode=no-session&role=ADMIN');await waitText('Open Attendance Session');await click('Open Attendance Session');await dialogReady();assert.match(await body(),/Confirm Open Session/);});
    await check('open dialog names the center and Hall',async()=>{const text=await body();assert(text.includes('Current Center'));assert(text.includes('Current Hall A'));});
    await check('open dialog shows explicit candidate count',async()=>{assert.match(await body(),/3/);});
    await check('open dialog explains frozen roster',async()=>{assert.match(await body(),/roster will be frozen/i);});
    await check('session status and backend metrics render',async()=>{await page.keyboard.press('Escape');await visit('?mode=open&role=ADMIN');await ready();const text=await body();for(const item of ['OPEN','Expected Candidates','Marked','Present','Late','Absent','Not Marked','33.3%'])assert(text.includes(item),item);});
    await check('null percentage uses an em dash',async()=>{await visit('?mode=null-percent&role=ADMIN');await ready();assert((await body()).includes('—'));assert(!/(^|\s)0%(\s|$)/.test(await body()));});
    await check('roster displays frozen candidate snapshot',async()=>{assert((await body()).includes('Amina Snapshot'));assert((await page.$eval('[aria-label="Attendance session"]',el=>el.textContent))?.includes('Snapshot Hall A'));});
    await check('unmarked is separate from absent',async()=>{const text=await body();assert(text.includes('NOT MARKED')||text.includes('Not Marked'));assert(text.includes('ABSENT'));});
    await check('roster search is scoped to selected session',async()=>{const input=await page.$('#attendance-search');assert(input);await page.type('#attendance-search','APP-002');await page.waitForFunction(()=>(window as any).__requests.some((r:any)=>r.route.includes('/candidates?')&&r.route.includes('search=APP-002')));});
    await check('search matches the frozen roster candidate',async()=>{await waitText('Bilal Unmarked');});
    await check('search does not call global Students API',async()=>{assert(!(await requests()).some((r:any)=>r.route.includes('/api/students')));});
    await check('unmarked row exposes Mark Attendance',async()=>{assert(await buttonCount('Mark Attendance'));});
    await check('manual marking opens a semantic dialog',async()=>{await click('Mark Attendance');await dialogReady();assert.match(await body(),/Record Attendance/);});
    await check('manual dialog shows candidate, roll, seat and Hall',async()=>{const text=await body();for(const item of ['Bilal Unmarked','ROLL-002','Seat #02','Snapshot Hall A'])assert(text.includes(item),item);});
    await check('Present is an available manual status',async()=>{assert(await page.$eval('#attendance-mark-status', (el:any)=>Array.from(el.options).some((option:any)=>option.textContent==='Present')));});
    await check('Late is an available manual status',async()=>{assert(await page.$eval('#attendance-mark-status', (el:any)=>Array.from(el.options).some((option:any)=>option.textContent==='Late')));});
    await check('Absent is an available manual status',async()=>{assert(await page.$eval('#attendance-mark-status', (el:any)=>Array.from(el.options).some((option:any)=>option.textContent==='Absent')));});
    await check('marking sends a session-scoped Present request',async()=>{await page.select('#attendance-mark-status','PRESENT');await click('Record Attendance');await page.waitForFunction(()=>(window as any).__marks.length>0);const mark=(await page.evaluate(()=>(window as any).__marks))[0];assert.equal(mark.status,'PRESENT');assert(mark.studentId||mark.rollNumber);});
    await check('marked rows offer no edit or delete action',async()=>{await waitText('Amina Snapshot');const text=await body();assert(!/Edit Attendance|Delete Attendance/.test(text));});
    await check('backend failure remains an error',async()=>{await visit('?mode=error&role=ADMIN');await waitText('Fixture attendance API unavailable');assert(await page.$('[role="alert"]'));});
    await check('manual Late mark is recorded by the session API',async()=>{await visit('?mode=open&role=ADMIN');await ready();await click('Mark Attendance');await page.select('#attendance-mark-status','LATE');await click('Record Attendance');await page.waitForFunction(()=>(window as any).__marks.length>0);assert.equal((await page.evaluate(()=>(window as any).__marks))[0].status,'LATE');});
    await check('manual Absent mark is recorded by the session API',async()=>{await visit('?mode=open&role=ADMIN');await ready();await click('Mark Attendance');await page.select('#attendance-mark-status','ABSENT');await click('Record Attendance');await page.waitForFunction(()=>(window as any).__marks.length>0);assert.equal((await page.evaluate(()=>(window as any).__marks))[0].status,'ABSENT');});
    await check('ADMIN sees session open/close workflow',async()=>{await visit('?mode=open&role=ADMIN');await ready();assert(await buttonCount('Close Attendance Session'));});
    await check('TEACHER does not see open or close controls',async()=>{await visit('?mode=open&role=TEACHER');await ready();assert.equal(await buttonCount('Open Attendance Session'),0);assert.equal(await buttonCount('Close Attendance Session'),0);});
    await check('TEACHER session choices avoid admin configuration endpoints',async()=>{await visit('?mode=open&role=TEACHER');await ready();const calls=await requests();assert(!calls.some((r:any)=>r.route==='/api/test-centers'||r.route==='/api/exam-halls'));});
    await check('ACCOUNTANT has no usable attendance workspace',async()=>{await visit('?mode=open&role=ACCOUNTANT');await waitText('do not have access');assert.equal(await buttonCount('Mark Attendance'),0);});
    await check('close dialog defaults conversion checkbox off',async()=>{await visit('?mode=open&role=ADMIN');await ready();await click('Close Attendance Session');await dialogReady();const checkbox=await page.$('[role="dialog"] input[type="checkbox"]');assert(checkbox);assert.equal(await checkbox.evaluate((el:any)=>el.checked),false);});
    await check('close without conversion sends false and preserves unmarked',async()=>{await click('Close Session');await page.waitForFunction(()=>(window as any).__closedPayloads.length>0);const payload=(await page.evaluate(()=>(window as any).__closedPayloads))[0];assert.equal(payload.markRemainingAbsent,false);await ready();assert((await page.$eval('[aria-label="Frozen Hall roster table"]',el=>el.textContent))?.includes('NOT MARKED'));});
    await check('close with conversion sends true and records ABSENT',async()=>{await visit('?mode=open&role=ADMIN');await ready();await click('Close Attendance Session');await dialogReady();await page.$eval('[role="dialog"] input[type="checkbox"]',(el:any)=>el.click());await click('Close Session');await page.waitForFunction(()=>(window as any).__closedPayloads.length>0);assert.equal((await page.evaluate(()=>(window as any).__closedPayloads))[0].markRemainingAbsent,true);await ready();assert(!((await page.$eval('[aria-label="Frozen Hall roster table"]',el=>el.textContent))?.includes('NOT MARKED')));});
    await check('closed session cannot mark candidates',async()=>{await visit('?mode=closed&role=ADMIN');await ready();assert(await buttonDisabled('Mark Attendance'));});
    await check('historical session context uses snapshots',async()=>{const text=await body();assert(text.includes('Snapshot Center'));assert(text.includes('Snapshot Hall A'));assert(text.includes('Snapshot Room 101'));assert(text.includes('15 November 2026'));assert(!((await page.$eval('[aria-label="Attendance session"]',el=>el.textContent))?.includes('Current Room 101')));});
    await check('class is shown as candidate metadata only',async()=>{assert((await body()).includes('Class 9th'));assert(!(await requests()).some((r:any)=>String(r.route).includes('class=')));});
    await check('sensitive student and fee fields are absent',async()=>{assert(!/CNIC|Guardian|Phone|Email|Fee Status|Challan/i.test(await body()));});
    await check('desktop workspace has no horizontal overflow',async()=>{await page.setViewport({width:1440,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await screenshot(String(await page.evaluate(()=>innerWidth))+'-workspace');});
    await check('tablet workspace has no page overflow',async()=>{await page.setViewport({width:768,height:1024});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await screenshot(String(await page.evaluate(()=>innerWidth))+'-workspace');});
    await check('mobile marking dialog actions remain reachable',async()=>{await page.setViewport({width:390,height:844});await visit('?mode=open&role=ADMIN');await ready();await click('Mark Attendance');await dialogReady();const dialog=await page.$('[role="dialog"]');assert(dialog);assert(await dialog.evaluate((el:any)=>{const rect=el.getBoundingClientRect();return rect.width<=innerWidth && rect.height>0;}));assert(await page.$$eval('[role="dialog"] button',buttons=>buttons.filter(button=>button.textContent?.trim()==='Record Attendance').every(button=>{const r=button.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})));await screenshot('mobile-manual');});
    await check('#attendance is locally enabled in the 13C candidate',async()=>{const appSource=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');assert(!/const deferredTabs = \[([^\]]*'attendance'[^\]]*)\]/.test(appSource));assert(appSource.includes('adminTab === \'attendance\''));});
    await check('#scan remains deferred and unavailable',async()=>{const appSource=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');assert(/const deferredTabs = \[([^\]]*'scan'[^\]]*)\]/.test(appSource));assert(!/camera feed/i.test(await body()));});
    await page.keyboard.press('Escape');
    await check('mobile workspace has no page overflow',async()=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await screenshot('390-workspace');});
    await check('mobile open confirmation footer fits viewport',async()=>{await visit('?mode=no-session&role=ADMIN');await waitText('No attendance session has been opened');await click('Open Attendance Session');await dialogReady();assert(await page.$$eval('[role="dialog"] button',buttons=>buttons.every(button=>{const r=button.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})));await screenshot('mobile-open');await page.keyboard.press('Escape');});
    await check('opening records a real session response and refreshes the frozen roster',async()=>{await click('Open Attendance Session');await click('Open Session');await ready();assert.equal(await page.evaluate(()=>(window as any).__opened),true);assert(await buttonDisabled('Open Attendance Session'));assert.match(await body(),/0%/);assert.match(await body(),/Attendance session opened/);});
    await check('mobile close confirmation footer fits viewport',async()=>{await click('Close Attendance Session');await dialogReady();assert(await page.$$eval('[role="dialog"] button',buttons=>buttons.every(button=>{const r=button.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})));await screenshot('mobile-close');await page.keyboard.press('Escape');});
    await check('a rejected opening stays inline and creates no fake session',async()=>{await visit('?mode=no-session&role=ADMIN');await waitText('No attendance session has been opened');await page.evaluate(()=>(window as any).__fault='write');await click('Open Attendance Session');await click('Open Session');await waitText('Fixture write rejected');assert(await page.$('[role="dialog"] [role="alert"]'));assert.equal(await page.evaluate(()=>(window as any).__opened),false);assert(!(await body()).includes('Attendance session opened.'));await page.keyboard.press('Escape');});
    await check('a rejected manual mark leaves the candidate unmarked',async()=>{await visit('?mode=open&role=ADMIN');await ready();await page.evaluate(()=>(window as any).__fault='write');await click('Mark Attendance');await click('Record Attendance');await waitText('Fixture write rejected');assert.equal(await page.evaluate(()=>(window as any).__marks.length),0);assert(await page.$('[role="dialog"]'));assert(!(await body()).includes('Attendance recorded successfully.'));await page.keyboard.press('Escape');});
    await check('a rejected close stays OPEN with explicit error',async()=>{await click('Close Attendance Session');await click('Close Session');await waitText('Fixture write rejected');assert.match(await body(),/OPEN SESSION/);assert.equal(await page.evaluate(()=>(window as any).__closedPayloads.length),0);await page.keyboard.press('Escape');});
    await check('roster failure is not a successful empty roster',async()=>{await page.evaluate(()=>(window as any).__fault='roster');await page.type('#attendance-search','APP-002');await waitText('Fixture roster unavailable');assert(!(await body()).includes('No candidates match'));assert(await buttonCount('Retry roster'));});
    await check('Retry roster recovers the real scoped row',async()=>{await page.evaluate(()=>(window as any).__fault='');await click('Retry roster');await waitText('Bilal Unmarked');assert(!(await body()).includes('Amina Snapshot'));});
    await check('manual dialog focuses the status and contains keyboard focus',async()=>{await click('Mark Attendance');await dialogReady();assert.equal(await page.evaluate(()=>document.activeElement?.id),'attendance-mark-status');for(let n=0;n<8;n++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.querySelector('[role="dialog"]')?.contains(document.activeElement)));}await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Mark Attendance');});
    await check('operator names are never invented for unavailable backend labels',async()=>{const cells=await page.$$eval('[aria-label="Frozen Hall roster table"] tbody tr td:nth-child(9)',nodes=>nodes.map(node=>node.textContent?.trim()));assert(cells.length>0);assert(cells.every(value=>value==='—'));});
    await check('loading is distinct from an empty successful workspace',async()=>{await visit('?mode=loading&role=ADMIN');await waitText('Loading examination attendance workspace');assert(!(await body()).includes('No attendance session has been opened'));await ready();});
    await check('history filters use Hall/date/status without class scope',async()=>{await page.select('#attendance-history-status','OPEN');await page.waitForFunction(()=>(window as any).__requests.some((request:any)=>request.route.includes('examHallId=hall-a')&&request.route.includes('status=OPEN')));assert(!(await requests()).some((request:any)=>request.route.includes('class=')));});
    for(const recorded of ['PRESENT','LATE','ABSENT']) await check('recorded '+recorded+' updates the actual roster and metrics',async()=>{
      await visit('?mode=open&role=ADMIN');await ready();await click('Mark Attendance');await page.select('#attendance-mark-status',recorded);await click('Record Attendance');await waitText('Attendance recorded successfully.');
      await page.waitForFunction(status=>Array.from(document.querySelectorAll('[aria-label="Frozen Hall roster table"] tbody tr')).some(row=>row.children[1]?.textContent?.includes('Bilal Unmarked')&&row.children[5]?.textContent?.trim()===status),{},recorded);
      const marked=await page.$$eval('[aria-label="Attendance session"] dl div',nodes=>nodes.find(node=>node.querySelector('dt')?.textContent==='Marked')?.querySelector('dd')?.textContent);
      assert.equal(marked,'3');
    });
    assert.deepEqual(errors,[]);
    console.log(`Attendance 13B browser: ${passed} PASS, 0 FAIL.`);
  } finally { await browser.close(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
