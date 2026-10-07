import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import puppeteer from 'puppeteer';

async function run() {
 const root=path.resolve(__dirname,'../..');
 const {build}=require(path.join(root,'node_modules/esbuild'));
 const fixture=`
 import React from 'react';import {createRoot} from 'react-dom/client';
 import {ExamHallsView} from './src/components/admin/halls/ExamHallsView';
 const state=new URL(location.href).searchParams.get('state');
 const centers=[{id:'ca',name:'Fixture Center A',code:'CA',reportingTime:'08:30 AM',testDate:'2027-01-08'},{id:'cb',name:'Fixture Center B',code:'CB',reportingTime:'',testDate:''}];
 let halls=['A','B','Full'].map((name,n)=>({id:'h'+n,name:'Fixture Hall '+name,roomNumber:'Room '+name,targetClass:'Class 9th',wing:'',capacity:n===2?1:3,testCenterId:n===1?'cb':'ca',centerName:n===1?'Fixture Center B':'Fixture Center A',reportingTime:'',examDate:'',invigilatorName:null,invigilatorPhone:null}));
 const candidates=Array.from({length:55},(_,n)=>({id:'s'+n,fullName:'Candidate '+String(n).padStart(2,'0'),applicationNo:'APP-'+n,rollNumber:n===0?'ROLL-0':null,currentClass:n===54?'First Year':'Class 9th',assignedHallId:n<2?'h0':n===2?'h2':null,assignedRoom:n<2?'Room A':n===2?'Room Full':null,seatNo:n===0?'Seat #09':n===2?'Seat #01':null,legacyAllocationNeedsReview:n===3}));
 const metrics=h=>({...h,assignedCount:candidates.filter(c=>c.assignedHallId===h.id).length,availableSeats:Math.max(h.capacity-candidates.filter(c=>c.assignedHallId===h.id).length,0),isOverCapacity:false,utilizationPercent:null});
 window.__requests=[];window.__fault='';window.__printHtml='';window.__printed=false;
 for(const name of ['alert','prompt','confirm'])window[name]=()=>{throw Error('Native dialog forbidden')};
 window.open=()=>({document:{open(){},write(html){window.__printHtml=html},close(){}},focus(){},print(){window.__printed=true}});
 const response=(data,status=200)=>new Response(JSON.stringify(status===200?{success:true,data}:{success:false,error:{message:data}}),{status,headers:{'Content-Type':'application/json'}});
 window.fetch=async(input,options={})=>{
  const url=new URL(String(input)),route=url.pathname,method=options.method||'GET',body=options.body?JSON.parse(options.body):{};
  window.__requests.push({route:route+url.search,method,body});
  await new Promise(r=>setTimeout(r,state==='loading'?1200:25));
  if(state==='error')return response('Fixture API unavailable',503);
  if(window.__fault&&method!=='GET')return response(window.__fault,409);
  if(route==='/api/test-centers')return response(state==='empty'?[]:centers);
  if(route==='/api/exam-halls/candidates'){
   let list=state==='empty'?[]:candidates;
   const assignment=url.searchParams.get('assignment')||'unassigned',search=url.searchParams.get('search'),klass=url.searchParams.get('class');
   if(assignment!=='all')list=list.filter(c=>assignment==='assigned'?!!c.assignedHallId:!c.assignedHallId);
   if(search)list=list.filter(c=>(c.fullName+' '+c.applicationNo).toLowerCase().includes(search.toLowerCase()));
   if(klass)list=list.filter(c=>klass==='HSSC_1'?c.currentClass==='First Year':klass==='CLASS_9'?c.currentClass==='Class 9th':false);
   const page=+(url.searchParams.get('page')||1),limit=+(url.searchParams.get('limit')||25);
   return response({candidates:list.slice((page-1)*limit,page*limit),pagination:{page,limit,total:list.length,totalPages:Math.ceil(list.length/limit)}});
  }
  if(route==='/api/exam-halls'){
   if(method==='POST'){const h={...body,id:'new',centerName:centers.find(c=>c.id===body.testCenterId)?.name||null};halls.push(h);return response(h)}
   return response(state==='empty'?[]:halls.map(metrics));
  }
  if(route.includes('/students/')){
   const c=candidates.find(c=>c.id===route.split('/')[4]);
   if(method==='DELETE'){c.assignedHallId=null;c.assignedRoom=null;c.seatNo=null}
   else if(body.assignedHallId){c.assignedHallId=body.assignedHallId;c.assignedRoom=halls.find(h=>h.id===body.assignedHallId).roomNumber;c.seatNo='Seat #01'}
   else c.seatNo=body.seatNo;
   return response(c);
  }
  const h=halls.find(h=>h.id===route.split('/')[3]);
  if(route.endsWith('/batch-assign')){
   const c=candidates.find(c=>c.id===body.studentIds[0]);c.assignedHallId=h.id;c.assignedRoom=h.roomNumber;c.seatNo='Seat #03';
   return response({assignedCount:1});
  }
  if(method==='DELETE'){
   if(candidates.some(c=>c.assignedHallId===h.id))return response('Cannot delete an occupied Hall.',409);
   halls=halls.filter(x=>x.id!==h.id);return response({success:true});
  }
  if(method==='PATCH'){Object.assign(h,body);return response(h)}
  return response({...metrics(h),assignedStudents:[...candidates.filter(c=>c.assignedHallId===h.id),...candidates.filter(c=>c.id==='s3'&&!c.assignedHallId)]});
 };
 createRoot(document.getElementById('root')).render(<ExamHallsView/>);
 `;
 const code=await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'import.meta.env':JSON.stringify({VITE_API_URL:'http://fixtures.invalid'})},logLevel:'silent',plugins:[{name:'auth-fixture',setup(b:any){b.onResolve({filter:/authContext$/},()=>({path:'auth',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useAuth=()=>({isLoading:false});',loader:'js'}));}}]});
 const assets=path.join(root,'dist/assets'),css=fs.readdirSync(assets).find(f=>f.endsWith('.css'))!;
 const app=express();app.get('/bundle.js',(_q,r)=>r.type('js').send(code.outputFiles[0].text));app.get('/style.css',(_q,r)=>r.sendFile(path.join(assets,css)));
 app.get('/',(_q,r)=>r.send('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="padding:16px;background:#f8fafc"><div id="root"></div><script src="/bundle.js"></script></body></html>'));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 let browser:Awaited<ReturnType<typeof puppeteer.launch>>|undefined;
 try {
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 const url='http://127.0.0.1:'+(server.address() as any).port;
 let passed=0;const check=async(name:string,fn:()=>Promise<void>)=>{await fn();passed++;console.log('PASS: '+name)};
 const text=()=>page.evaluate(()=>document.body.innerText);
 const wait=(value:string)=>page.waitForFunction(v=>document.body.innerText.includes(v),{},value);
 const click=async(value:string,modal=false)=>{await page.waitForFunction((value,modal)=>Array.from(document.querySelectorAll(modal?'[role="dialog"] button':'button')).some(b=>b.textContent?.trim()===value),{},value,modal);const buttons=await page.$$(modal?'[role="dialog"] button':'button');for(const b of buttons)if((await b.evaluate(e=>e.textContent))?.trim()===value){await b.click();return}throw Error('Missing button '+value)};
 const select=async(label:string,value:string)=>{const id=await page.evaluate(label=>{document.getElementById('test-select')?.removeAttribute('id');document.getElementById('test-input')?.removeAttribute('id');const l=Array.from(document.querySelectorAll('[role="dialog"] label')).find(l=>l.firstChild?.textContent===label);const s=l?.querySelector('select');if(s){s.id='test-select';return s.id}throw Error('Missing select '+label)},label);await page.select('#'+id,value)};
 const input=async(label:string,value:string)=>{await page.evaluate(label=>{document.getElementById('test-input')?.removeAttribute('id');const l=Array.from(document.querySelectorAll('[role="dialog"] label')).find(l=>l.firstChild?.textContent===label);const i=l?.querySelector('input');if(i)i.id='test-input';else throw Error('Missing input '+label)},label);await page.click('#test-input',{count:3});await page.type('#test-input',value)};
 const close=()=>click('Cancel',true);
 const fresh=async()=>{await page.goto(url);await wait('Candidate 00')};
 const fault=(value:string)=>page.evaluate(v=>(window as any).__fault=v,value);
 const noDialog=()=>page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));

 await check('empty results stay truthful; no configured center or Hall',async()=>{await page.goto(url+'/?state=empty');await wait('No examination halls have been configured.');assert((await text()).includes('No examination centers have been configured.'));assert(!/Fixture Hall|Mansehra/.test(await text()))});
 await check('API failure is visible and never appears as an empty result',async()=>{await page.goto(url+'/?state=error');await wait('Fixture API unavailable');assert(!(await text()).includes('No examination halls have been configured.'));assert(await page.$('[role="alert"]'));assert((await text()).includes('Retry'))});
 await check('initial loading panel is visible',async()=>{await page.goto(url+'/?state=loading');await wait('Loading Hall workspace...')});
 await check('explicit roster, API seats, missing seats and privacy',async()=>{await fresh();const t=await text();assert(t.includes('Seat #09'));assert(t.includes('Unassigned'));assert(!t.includes('Candidate 03'));assert(!/Attendance|Fee Status|CNIC|Present|Absent/.test(t));assert.equal(await page.$$eval('tbody tr',rows=>rows.length),2);assert(!(await page.evaluate(()=>(window as any).__requests)).some((r:any)=>r.route.startsWith('/api/students')))});
 await check('summary counts and center Hall counts use backend records',async()=>{const values=await page.$$eval('#root > div > div.grid > div p',els=>els.map(e=>e.textContent));assert.deepEqual(values,['2','3','3','52','4']);const labels=await page.$$eval('#hall-center-filter option',els=>els.map(e=>e.textContent));assert(labels.some(s=>s?.includes('Fixture Center A · CA · 2 halls')))});
 await check('center selection limits Hall tiles',async()=>{await page.select('#hall-center-filter','cb');await wait('Fixture Hall B · Room B');assert(!(await text()).includes('Fixture Hall A'));await page.select('#hall-center-filter','all');await page.waitForSelector('button[aria-pressed]');await page.evaluate(()=>{(Array.from(document.querySelectorAll('button[aria-pressed]')).find(b=>b.textContent?.includes('Fixture Hall A')) as HTMLElement).click()});await wait('Candidate 00')});
 await check('batch success uses server count even when fewer than selected',async()=>{await page.evaluate(()=>{(Array.from(document.querySelectorAll('button[aria-pressed]')).find(b=>b.textContent?.includes('Fixture Hall B')) as HTMLElement).click()});await wait('Fixture Hall B · Room B');await click('Place Candidates');await wait('Legacy allocation needs review');await page.click('[aria-label="Select Candidate 03"]');await page.click('[aria-label="Select Candidate 04"]');await click('Assign Candidates',true);await wait('Assigned 1 candidate(s).');assert(!(await text()).includes('Assigned 2 candidate(s).'));await close();await fresh()});
 await check('print contains explicit rows, real seats, escaped values and no fees/attendance',async()=>{await click('Print Roster');const html=await page.evaluate(()=>(window as any).__printHtml);assert(html.includes('Official Examination Seating Roster'));assert(html.includes('Seat #09'));assert(html.includes('Unassigned'));assert(!html.includes('Candidate 03'));assert(!/Fee|Attendance|Seat #02/.test(html));assert(await page.evaluate(()=>(window as any).__printed))});
 await check('placement is unassigned, paginated, and shows legacy review',async()=>{await click('Place Candidates');await wait('Legacy allocation needs review');await wait('Page 1 of 3');assert(await page.$('[role="dialog"] [aria-label="Select Candidate 03"]'));await click('Next',true);await wait('Page 2 of 3');const requests=await page.evaluate(()=>(window as any).__requests);assert(requests.some((r:any)=>r.route.includes('page=2')&&r.route.includes('limit=25')&&r.route.includes('assignment=unassigned')))});
 await check('class filter sends canonical HSSC_1 and search to the minimal endpoint',async()=>{await select('Class','HSSC_1');await wait('1 candidates');await wait('Candidate 54');await input('Search','APP-54');await page.waitForFunction(()=>(window as any).__requests.some((r:any)=>r.route.includes('class=HSSC_1')&&r.route.includes('search=APP-54')));await close()});
 await check('UI capacity guard disables oversized selection',async()=>{await click('Place Candidates');await wait('Legacy allocation needs review');await page.click('[aria-label="Select Candidate 03"]');await page.click('[aria-label="Select Candidate 04"]');await wait('Only 1 seats are available in this hall.');assert(await page.$$eval('[role="dialog"] button',buttons=>buttons.find(b=>b.textContent==='Assign Candidates')?.disabled));await close()});
 await check('backend capacity conflict is shown without fake success',async()=>{await click('Place Candidates');await wait('Legacy allocation needs review');await page.click('[aria-label="Select Candidate 03"]');await fault('Capacity changed: no seats available.');await click('Assign Candidates',true);await wait('Capacity changed: no seats available.');assert(!(await text()).includes('Assigned 1 candidate(s).'));await fault('');await close()});
 await check('batch placement displays returned assignedCount and refreshes roster',async()=>{await click('Place Candidates');await wait('Legacy allocation needs review');await page.click('[aria-label="Select Candidate 03"]');await click('Assign Candidates',true);await wait('Assigned 1 candidate(s).');await page.waitForFunction(()=>Array.from(document.querySelectorAll('[role="dialog"] button')).some(b=>b.textContent==='Assign Candidates'));await close();await wait('Candidate 03');assert.equal(await page.$$eval('tbody tr',r=>r.length),3)});
 await check('move dialog labels context and disables full targets',async()=>{await click('Move');await wait('Move Candidate');assert((await text()).includes('Current Seat: Seat #09'));const full=await page.$$eval('[role="dialog"] option',o=>o.find(e=>e.value==='h2')?.disabled);assert(full);await select('Target Hall','h1');await click('Move Candidate',true);await noDialog();await wait('Candidate moved.');await wait('Candidate 01');await page.waitForFunction(()=>!document.querySelector('tbody')?.textContent?.includes('Candidate 00'))});
 await check('duplicate seat conflict remains in seat modal',async()=>{await click('Change Seat');await wait('New Seat');await input('New Seat','Seat #03');await fault('Duplicate seat in this Hall.');await click('Save Seat',true);await wait('Duplicate seat in this Hall.');assert(await page.$('[role="dialog"]'));await fault('');await input('New Seat','Desk A-7');await click('Save Seat',true);await noDialog();await wait('Desk A-7')});
 await check('unassign requires explicit modal confirmation and refreshes',async()=>{await click('Unassign');await wait('Unassign candidate from this Hall?');assert((await text()).includes('This removes the current Hall, room, and seat allocation.'));await close();assert((await text()).includes('Candidate 01'));await click('Unassign');await click('Unassign Candidate',true);await noDialog();await wait('Candidate unassigned.');await wait('Candidate 03');await page.waitForFunction(()=>!document.querySelector('tbody')?.textContent?.includes('Candidate 01'))});
 await check('occupied Hall deletion surfaces conflict without auto-unassign',async()=>{await click('Delete Hall');await click('Delete Hall',true);await wait('Cannot delete an occupied Hall.');assert((await text()).includes('Candidate 03'));await close()});
 await check('create has blank defaults and inherits only real center schedule',async()=>{await click('Add Hall');const fields=await page.$$eval('[role="dialog"] input',inputs=>inputs.map(i=>i.value));assert(fields.every(v=>v===''));await select('Test Center','ca');assert.equal(await page.$eval('input[name="examDate"]',(i:any)=>i.value),'2027-01-08');await input('Hall Name','New Hall');await input('Room Number','New Room');await input('Target Class','First Year');await input('Capacity','8');await fault('Fixture creation rejected');await click('Create Hall',true);await wait('Fixture creation rejected');await fault('');await click('Create Hall',true);await noDialog();await wait('Hall created.');await wait('New Hall')});
 await check('empty Hall deletion succeeds without changing candidate allocation',async()=>{await page.evaluate(()=>{(Array.from(document.querySelectorAll('button[aria-pressed]')).find(b=>b.textContent?.includes('New Hall')) as HTMLElement).click()});await wait('New Hall · New Room');await click('Delete Hall');await click('Delete Hall',true);await noDialog();await wait('Hall deleted.');await wait('Fixture Hall A · Room A')});
 await check('edit conflict and successful real metadata update',async()=>{await click('Edit Hall');await input('Capacity','1');await fault('Capacity cannot be below occupancy.');await click('Save Hall',true);await wait('Capacity cannot be below occupancy.');await fault('');await input('Capacity','4');await input('Wing','North');await click('Save Hall',true);await noDialog();await wait('Hall updated.');await wait('North')});
 await check('dialog semantic labels, focus trap, Escape and focus restoration',async()=>{await click('Add Hall');assert(await page.$('[role="dialog"][aria-modal="true"][aria-labelledby]'));assert(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]')));await page.evaluate(()=>{const b=document.querySelectorAll('[role="dialog"] button');(b[b.length-1] as HTMLElement).focus()});await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Close dialog');await page.keyboard.press('Escape');await noDialog();assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Add Hall')});
 for(const [name,width,height] of [['desktop',1440,900],['tablet',768,1024],['mobile',390,844]] as const)await check(name+' layout and modal have no page overflow',async()=>{await page.setViewport({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(os.tmpdir(),'azm-halls-12b-'+name+'.png'),fullPage:true});await click('Place Candidates');await page.waitForSelector('[role="dialog"] input[type="checkbox"]');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.$eval('[role="dialog"]',e=>e.getBoundingClientRect().right<=innerWidth));await page.screenshot({path:path.join(os.tmpdir(),'azm-halls-12b-'+name+'-modal.png'),fullPage:true});await close()});
 assert.deepEqual(errors,[]);console.log('Hall browser: '+passed+' PASS, 0 FAIL. Screenshots saved in OS temp directory.');
 } finally {await browser?.close();await new Promise<void>(r=>server.close(()=>r()))}
}
run().catch(error=>{console.error(error);process.exitCode=1});
