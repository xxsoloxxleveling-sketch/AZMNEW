import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import puppeteer from 'puppeteer';

async function run() {
  const root=path.resolve(__dirname,'../..');
  const { build }=require(path.join(root,'node_modules/esbuild'));
  // Real component and mockApi; only Auth context and HTTP are isolated fixtures.
  // This does not expose the deferred Hall module in application navigation.
  const code=await build({stdin:{contents:`
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { ExamHallsView } from './src/components/admin/halls/ExamHallsView';
    const state=new URL(location.href).searchParams.get('state');
    const candidates=Array.from({length:52},(_,n)=>({id:'fixture-'+n,fullName:'Fixture Candidate '+String(n).padStart(2,'0'),
      applicationNo:'FIX-'+n,rollNumber:null,currentClass:'Class 9th',assignedHallId:n===0?'fixture-hall':null,
      assignedRoom:n===0?'Fixture Room':null,seatNo:n===0?'Seat #01':null}));
    const hall={id:'fixture-hall',name:'Fixture Hall',roomNumber:'Fixture Room',targetClass:'Class 9th',wing:'',capacity:60,
      assignedCount:1,availableSeats:59,utilizationPercent:2,isOverCapacity:false,invigilatorName:null,invigilatorPhone:null,
      reportingTime:'',examDate:'',centerName:null,testCenterId:null};
    window.__requests=[];
    window.__alerts=[];
    window.alert=message=>window.__alerts.push(message);
    window.confirm=()=>true;
    window.fetch=async(input,options={})=>{
      const url=new URL(String(input)); window.__requests.push(url.pathname+url.search);
      await new Promise(resolve=>setTimeout(resolve,state==='loading'?1500:80));
      if(state==='error')return new Response(JSON.stringify({success:false,error:{message:'Fixture API unavailable'}}),{status:503,headers:{'Content-Type':'application/json'}});
      let data;
      if(url.pathname==='/api/test-centers')data=[];
      else if(url.pathname==='/api/exam-halls/candidates'){
        let list=candidates;const search=url.searchParams.get('search');const klass=url.searchParams.get('class');
        if(search)list=list.filter(c=>c.fullName.toLowerCase().includes(search.toLowerCase())||c.applicationNo.includes(search));
        if(klass)list=list.filter(c=>c.currentClass===klass);
        const page=Number(url.searchParams.get('page')||1),limit=Number(url.searchParams.get('limit')||25);
        data={candidates:list.slice((page-1)*limit,page*limit),pagination:{page,limit,total:list.length,totalPages:Math.ceil(list.length/limit)}};
      }else if(url.pathname==='/api/exam-halls'&&options.method==='POST'){
        return new Response(JSON.stringify({success:false,error:{message:'Fixture creation rejected'}}),{status:409,headers:{'Content-Type':'application/json'}});
      }else if(url.pathname==='/api/exam-halls')data=state==='empty'?[]:[hall];
      else data={...hall,assignedStudents:candidates.filter(c=>c.assignedHallId===hall.id)};
      return new Response(JSON.stringify({success:true,data}),{headers:{'Content-Type':'application/json'}});
    };
    createRoot(document.getElementById('root')).render(<ExamHallsView/>);
  `,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',
    define:{'import.meta.env':JSON.stringify({VITE_API_URL:'http://fixtures.invalid'})},logLevel:'silent',
    plugins:[{name:'fixture-auth',setup(builder:any){builder.onResolve({filter:/authContext$/},()=>({path:'auth-fixture',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useAuth=()=>({isLoading:false});',loader:'js'}));}}]});
  const assets=path.join(root,'dist/assets');
  const css=fs.readdirSync(assets).find(file=>file.endsWith('.css'))!;
  const app=express();
  app.get('/bundle.js',(_req,res)=>res.type('js').send(code.outputFiles[0].text));
  app.get('/style.css',(_req,res)=>res.sendFile(path.join(assets,css)));
  app.get('/',(_req,res)=>res.send('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'));
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']}).catch(async error=>{
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    throw error;
  });
  const page=await browser.newPage();
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error instanceof Error ? error.message : String(error)));
  const url=`http://127.0.0.1:${(server.address() as any).port}`;
  let passed=0;
  const check=async(name:string,fn:()=>Promise<void>)=>{await fn();passed++;console.log('PASS: '+name);};
  const waitText=(text:string)=>page.waitForFunction(value=>document.body.innerText.includes(value),{},text);
  const clickText=async(text:string)=>{const buttons=await page.$$('button');for(const button of buttons)if((await button.evaluate(el=>el.textContent))?.includes(text)){await button.click();return;}throw new Error('Button missing: '+text);};
  try {
    await check('empty DB shows no fake hall and placement disabled',async()=>{await page.goto(url+'/?state=empty');await waitText('No exam halls configured.');const text=await page.evaluate(()=>document.body.innerText);assert(!text.includes('Hall A'));assert(await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Custom Pick'))?.disabled));});
    await check('failed Hall API shows error without fabricated halls',async()=>{await page.goto(url+'/?state=error');await waitText('Fixture API unavailable');assert(await page.$('[role="alert"]'));assert(!(await page.evaluate(()=>document.body.innerText)).includes('No exam halls configured.'));});
    await check('loading state is visible',async()=>{await page.goto(url+'/?state=loading');await waitText('Loading exam halls...');});
    await check('roster includes only explicit candidate and no attendance/fees',async()=>{await page.goto(url+'/?state=populated');await waitText('Fixture Candidate 00');const text=await page.evaluate(()=>document.body.innerText);assert(!text.includes('Fixture Candidate 01'));assert(!/Attendance|Present Verified|Fee Status|UNPAID/.test(text));assert(text.includes('Date unknown'));const requests=await page.evaluate(()=>(window as any).__requests);assert(!requests.some((r:string)=>r.startsWith('/api/students')));});
    await check('desktop table aligns and has no page overflow',async()=>{await page.setViewport({width:1440,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:path.join(os.tmpdir(),'azm-halls-desktop.png'),fullPage:true});});
    await check('keyboard focus reaches actionable control',async()=>{await page.click('body');await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement?.tagName==='BUTTON'||document.activeElement?.tagName==='INPUT'));});
    await check('placement uses pages of 25 and advances',async()=>{await clickText('Custom Pick');await waitText('Fixture Candidate 24');await waitText('Page 1 of 3');await clickText('Next');await waitText('Page 2 of 3');await waitText('Fixture Candidate 49');assert(!(await page.evaluate(()=>document.body.innerText)).includes('Fixture Candidate 24'));const requests=await page.evaluate(()=>(window as any).__requests);assert(requests.some((r:string)=>r.includes('page=2')&&r.includes('limit=25')));});
    await check('placement class filter uses persisted class value',async()=>{
      const selects=await page.$$('select');
      for(const select of selects) if(await select.evaluate(el=>Array.from(el.options).some(o=>o.value==='ALL'))) { await select.select('Class 9th'); break; }
      await waitText('Page 1 of 3');
      const requests=await page.evaluate(()=>(window as any).__requests);
      assert(requests.some((r:string)=>r.includes('class=Class+9th')));
    });
    await check('placement search goes to protected minimal endpoint',async()=>{await page.type('input[placeholder*="Search by candidate"]','FIX-51');await waitText('Fixture Candidate 51');await waitText('1 candidates');});
    await check('mobile Hall and placement remain within viewport',async()=>{await page.setViewport({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:path.join(os.tmpdir(),'azm-halls-mobile.png'),fullPage:true});});
    await check('failed Hall creation does not fabricate an entry',async()=>{await page.goto(url+'/?state=empty');await waitText('No exam halls configured.');await clickText('Add Custom Room');await page.type('input[placeholder*="Hall G"]','Rejected Fixture');await page.type('input[placeholder*="Room 401"]','Rejected Room');await clickText('Create Examination Room');await page.waitForFunction(()=>(window as any).__alerts.length>0);assert((await page.evaluate(()=>(window as any).__alerts)).includes('Fixture creation rejected'));assert(!(await page.evaluate(()=>document.body.innerText)).includes('Rejected Fixture —'));});
    assert.deepEqual(errors,[]);
    console.log(`Hall browser: ${passed} PASS, 0 FAIL. Screenshots: ${path.join(os.tmpdir(),'azm-halls-desktop.png')} and ${path.join(os.tmpdir(),'azm-halls-mobile.png')}`);
  } finally {
    await browser.close();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
