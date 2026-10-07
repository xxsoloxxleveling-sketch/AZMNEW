import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import express from 'express';import puppeteer from 'puppeteer';
async function run(){
 const root=path.resolve(__dirname,'../..');const source=fs.readFileSync(path.join(__dirname,'exam-halls-ui.test.ts'),'utf8').replace(/\r\n/g,'\n');
 let fixture=source.slice(source.indexOf(' const fixture=`')+16,source.indexOf('`;\n const code'));
 fixture=fixture.replace("import {ExamHallsView} from './src/components/admin/halls/ExamHallsView';","import App from './src/App';");
 fixture=fixture.replace("createRoot(document.getElementById('root')).render(<ExamHallsView/>);",`
 const role=new URL(location.href).searchParams.get('role');
 localStorage.clear();const user=role?{id:'qa',name:'QA Administrator',fullName:'QA Administrator',email:'qa@test.invalid',role,status:'ACTIVE',avatarUrl:''}:null;
 if(user){localStorage.setItem('jps_current_user',JSON.stringify(user));localStorage.setItem('jps_access_token','local-http-fixture-only')}
 const hallFetch=window.fetch;window.fetch=async(input,options={})=>{
   const url=new URL(String(input)),route=url.pathname;
   if(route.startsWith('/api/exam-halls')||route==='/api/test-centers')return hallFetch(input,options);
   window.__requests.push({route:route+url.search,method:options.method||'GET'});
   if(route==='/api/auth/me')return response({user});
   if(route.includes('/document/'))return response('No synthetic document.',404);
   if(route==='/api/dashboard/overview')return response({stats:{totalStudents:0,totalPartners:0,activeStaffCount:0,totalBilled:0,totalCollected:0,feeIncome:0,salaryExpenses:0,netCashFlow:0},period:{date:'2027-01-01'},recentActivity:[],demographics:{},attendanceToday:{markedCount:0,totalActiveStudents:0}});
   if(route==='/api/students')return response({students:[{id:'qa-student',fullName:'Synthetic QA Candidate',fatherName:'Synthetic Parent',applicationNo:'QA-ONLY',rollNumber:null,currentClass:'First Year',gender:'MALE',status:'ACTIVE',feeStatus:'UNPAID',assignedHallId:null,assignedHall:null,assignedRoom:null,seatNo:null}],pagination:{page:1,limit:50,total:1,totalPages:1}});
   if(route==='/api/students/roll-number-status')return response({readyCount:0,issuedCount:0,totalPaidCount:0});
   return response([]);
 };
 createRoot(document.getElementById('root')).render(<App/>);
 `);
 const {build}=require(path.join(root,'node_modules/esbuild'));const bundle=await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'import.meta.env':JSON.stringify({VITE_API_URL:'http://fixtures.invalid'})},logLevel:'silent'});
 const assets=path.join(root,'dist/assets'),css=fs.readdirSync(assets).find(f=>f.endsWith('.css'))!;
 const app=express();app.get('/bundle.js',(_q,r)=>r.type('js').send(bundle.outputFiles[0].text));app.get('/style.css',(_q,r)=>r.sendFile(path.join(assets,css)));app.get('/',(_q,r)=>r.send('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));let browser:Awaited<ReturnType<typeof puppeteer.launch>>|undefined;
 try{browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));const url='http://127.0.0.1:'+(server.address() as any).port;
 let passed=0;const check=async(name:string,fn:()=>Promise<void>)=>{await fn();passed++;console.log('PASS: '+name)};
 const wait=(text:string)=>page.waitForFunction(t=>document.body.innerText.includes(t),{},text);
 const click=async(text:string,modal=false)=>{await page.waitForFunction((t,m)=>Array.from(document.querySelectorAll(m?'[role="dialog"] button':'button')).some(b=>b.textContent?.trim()===t),{},text,modal);const buttons=await page.$$(modal?'[role="dialog"] button':'button');for(const b of buttons)if((await b.evaluate(e=>e.textContent))?.trim()===text){await b.click();return}throw Error('Missing action '+text)};
 const open=async(role:string,hash:string)=>{await page.goto(url+'/?role='+role+'#'+hash)};
 for(const role of ['SUPER_ADMIN','ADMIN'])await check(role+' direct Hall route uses Classic shell',async()=>{await open(role,'halls');await wait('Candidate 00');assert(await page.$('aside'));assert((await page.evaluate(()=>document.body.innerText)).includes('Exam Halls'));assert.equal(await page.evaluate(()=>location.hash),'#halls')});
 for(const role of ['ACCOUNTANT','TEACHER',''])await check((role||'Unauthenticated')+' cannot render Hall workspace',async()=>{await open(role,'halls');await page.waitForFunction(()=>!document.body.innerText.includes('Loading'));await page.waitForFunction(()=>document.body.innerText.length>100);if(role==='TEACHER')await wait('Teacher workspace is not enabled in this release.');if(role==='ACCOUNTANT')await wait('Registered Students');if(!role)await page.waitForSelector('input[type="password"]');assert(!(await page.evaluate(()=>document.body.innerText)).includes('Examination Centers & Hall Seating Management'));assert(!(await page.evaluate(()=>(window as any).__requests)).some((r:any)=>r.route.startsWith('/api/exam-halls')));assert(!(await page.$$eval('aside button',buttons=>buttons.some(b=>b.textContent?.includes('Exam Halls')))))});
 for(const tab of ['storage','attendance','fees','payroll','scan'])await check(tab+' remains deferred',async()=>{await open('ADMIN',tab);await wait('Registered Students');assert.equal(await page.evaluate(()=>location.hash),'#dashboard');assert(!await page.$('aside button[aria-current="page"]'))});
 for(const [label,width,height] of [['desktop',1440,900],['tablet',768,1024],['mobile',390,844]] as const){
  await page.setViewport({width,height});
  for(const tab of ['dashboard','students','halls'])await check(label+' integrated '+tab+' has no page overflow',async()=>{await open('ADMIN',tab);await wait(tab==='halls'?'Candidate 00':tab==='students'?'Student Management & Admissions':'Registered Students');if(tab==='students')await wait('Synthetic QA Candidate');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+label+' '+tab);await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:path.join(os.tmpdir(),'azm-classic-12c-'+label+'-'+tab+'.png'),fullPage:true})});
  for(const action of ['Place Candidates','Move','Change Seat','Add Hall','Edit Hall'])await check(label+' integrated '+action+' modal fits viewport',async()=>{await click(action);await page.waitForSelector('[role="dialog"]');if(action==='Place Candidates')await page.waitForSelector('[role="dialog"] input[type="checkbox"]');assert(await page.$eval('[role="dialog"]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(os.tmpdir(),'azm-classic-12c-'+label+'-'+action.replaceAll(' ','-')+'.png')});await page.$eval('[role="dialog"]',panel=>{const buttons=panel.querySelectorAll('button');buttons[buttons.length-1].scrollIntoView({block:'nearest'})});assert(await page.$eval('[role="dialog"]',panel=>{const buttons=panel.querySelectorAll('button'),r=buttons[buttons.length-1].getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0}));await click('Cancel',true)});
 }
 for(const route of ['home','roll-number','register','apply','partner-registration'])await check('public '+route+' makes no unauthenticated TestCenter request',async()=>{await open('',route);await page.waitForFunction(()=>document.body.innerText.length>150);if(route==='roll-number')await wait('Roll Number Slip Desk');if(route==='register')await wait('Session V registration is closed');if(route==='apply')await wait('Registration Closed');if(route==='partner-registration')await wait('Institutional Examination Center Agreement');assert(!(await page.evaluate(()=>(window as any).__requests)).some((r:any)=>r.route.startsWith('/api/test-centers')))});
 assert.deepEqual(errors,[]);console.log('Classic Hall integration: '+passed+' PASS, 0 FAIL.');
 }finally{await browser?.close();await new Promise<void>(r=>server.close(()=>r()))}
}
run().catch(e=>{console.error(e);process.exitCode=1});
