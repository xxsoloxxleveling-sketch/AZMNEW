import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import express from 'express';
import puppeteer from 'puppeteer';

// Real production components/client in Chrome; synthetic fetch transport, no database.
async function run() {
  const root = path.resolve(__dirname, '../..');
  const { build } = require(path.join(root, 'node_modules/esbuild'));
  const fixture = `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {StudentsListView} from './src/components/admin/students/StudentsListView';
    import {StudentDetailView} from './src/components/admin/students/StudentDetailView';
    const student={id:'candidate',fullName:'Synthetic Candidate',fatherName:'Synthetic Parent',applicationNo:'SYN-2026-1',rollNumber:'SYN-1',currentClass:'SSC-II',gender:'MALE',status:'ACTIVE',feeStatus:'UNPAID',createdAt:'2026-10-10T00:00:00.000Z',phone:'',cnic:'',officeUse:{},uploadedDocuments:{}};
    const flags=new URL(location.href).searchParams;window.__writes=[];window.__fault='';window.__release=null;
    window.fetch=async(input,options={})=>{const url=new URL(String(input));const response=(data,status=200)=>new Response(JSON.stringify(status===200?{success:true,data}:{success:false,error:{message:data}}),{status,headers:{'Content-Type':'application/json'}});
      if(url.pathname.endsWith('/deletion-protection')){if(window.__fault==='wait')await new Promise(resolve=>window.__release=resolve);if(flags.has('failure'))return response('Protected records check unavailable',503);const safe=flags.has('safe');return response({studentId:student.id,canPermanentlyDelete:safe,canDeactivate:student.status==='ACTIVE',blockers:safe?[]:[{kind:'frozenRoster',label:'Frozen examination rosters',count:2},{kind:'finance',label:'Financial and audit history',count:1}]});}
      if(url.pathname==='/api/students/candidate'&&(options.method==='DELETE'||options.method==='PATCH')){window.__writes.push({method:options.method,body:options.body});if(window.__fault==='write')return response('History was added. Permanent deletion is blocked.',409);if(options.method==='PATCH')student.status='INACTIVE';return response(student);}
      if(url.pathname==='/api/students/candidate')return response(student);
      if(url.pathname==='/api/students')return response({students:[student],pagination:{page:1,limit:10,total:1,totalPages:1}});
      if(url.pathname==='/api/students/roll-number-status')return response({readyCount:0,issuedCount:0,totalPaidCount:0});
      if(url.pathname==='/api/test-centers')return response([]);
      if(url.pathname.includes('/document/'))return response('No synthetic document',404);
      return response([]);
    };
    createRoot(document.getElementById('root')).render(flags.has('detail')?<StudentDetailView student={student} onBack={()=>window.__back=true}/>:<StudentsListView/>);
  `;
  const bundle = await build({ stdin: { contents: fixture, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://fixture.invalid' }) }, plugins: [{ name: 'auth-fixture', setup(builder: any) { builder.onResolve({ filter: /authContext$/ }, () => ({ path: 'auth', namespace: 'fixture' })); builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useAuth=()=>({role:new URL(location.href).searchParams.get("role")||"SUPER_ADMIN",isLoading:false});', loader: 'js' })); } }] });
  const app=express(),assets=path.join(root,'dist/assets'),css=fs.readdirSync(assets).find(name=>name.endsWith('.css'))!;
  app.get('/style.css',(_req,res)=>res.sendFile(path.join(assets,css)));
  app.get('/bundle.js',(_req,res)=>res.type('js').send(bundle.outputFiles[0].text));
  app.get('/',(_req,res)=>res.send('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root" class="p-4 min-w-0"></div><script src="/bundle.js"></script></body></html>'));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage();let passed=0;
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const click=async(text:string)=>{await page.waitForFunction(text=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent?.trim()===text&&!button.disabled),{},text);for(const button of await page.$$('button'))if((await button.evaluate(el=>el.textContent))?.trim()===text&&await button.isVisible()){await button.click();return;}throw Error('Missing '+text);};
  const visit=async(query='')=>{await page.goto(base+query);await page.waitForFunction(()=>document.body.innerText.includes('Synthetic Candidate'));};
  const open=async(detail=false)=>{if(!detail){const buttons=await page.$$('[aria-label="More actions"]');for(const button of buttons)if(await button.isVisible()){await button.click();break;}}await click('Delete Candidate');await page.waitForSelector('[role="dialog"]');};
  const check=async(name:string,action:()=>Promise<void>)=>{await action();passed++;console.log('PASS: '+name);};
  try{
    for(const detail of [false,true]){
      const prefix=detail?'detail':'list',query=detail?'?detail=1':'?';
      await check(prefix+' protected dependency summary blocks deletion and supports deactivation',async()=>{
        await visit(query);await open(detail);await page.waitForFunction(()=>document.body.innerText.includes('Frozen examination rosters'));
        assert(await page.$$eval('button',nodes=>nodes.find(node=>node.textContent?.trim()==='Permanently Delete')?.disabled));assert.equal(await page.evaluate(()=>(window as any).__writes.length),0);
        await click('Deactivate Candidate');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
        const writes=await page.evaluate(()=>(window as any).__writes);assert.equal(writes.length,1);assert.equal(writes[0].method,'PATCH');assert.deepEqual(JSON.parse(writes[0].body),{status:'INACTIVE'});
      });
      await check(prefix+' safe registration can be permanently deleted',async()=>{
        await visit(query+'&safe=1');await open(detail);await click('Permanently Delete');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
        assert.equal(await page.evaluate(()=>(window as any).__writes[0].method),'DELETE');
      });
      await check(prefix+' stale deletion conflict remains visible inside dialog',async()=>{
        await visit(query+'&safe=1');await open(detail);await page.evaluate(()=>(window as any).__fault='write');await click('Permanently Delete');
        await page.waitForFunction(()=>document.body.innerText.includes('History was added'));assert(await page.$('[role="dialog"]'));await click('Cancel');
      });
      await check(prefix+' protection lookup failure fails closed',async()=>{
        await visit(query+'&failure=1');await open(detail);await page.waitForFunction(()=>document.body.innerText.includes('Protected records check unavailable'));
        assert(await page.$$eval('button',nodes=>nodes.find(node=>node.textContent?.trim()==='Permanently Delete')?.disabled));assert.equal(await page.evaluate(()=>(window as any).__writes.length),0);await click('Cancel');
      });
    }
    await check('protected record dialog fits desktop tablet and mobile with keyboard containment',async()=>{
      for(const width of [390,768,1280]){await page.setViewport({width,height:900});await visit();await open();await page.waitForFunction(()=>document.body.innerText.includes('Frozen examination rosters'));
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.$eval('[role="dialog"]',el=>el.getBoundingClientRect().bottom<=innerHeight));
        for(let index=0;index<6;index++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.querySelector('[role="dialog"]')?.contains(document.activeElement)));}
        await page.screenshot({path:path.join(os.tmpdir(),'azm-candidate-deletion-'+width+'.png'),fullPage:true});await page.keyboard.press('Escape');
        await page.waitForFunction(()=>document.activeElement?.id==='student-directory-search');
      }
    });
    await check('candidate detail dialog restores keyboard focus to its delete trigger',async()=>{
      await visit('?detail=1');await open(true);await click('Cancel');
      await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Delete Candidate');
    });
    await check('restricted roles cannot see candidate deletion actions',async()=>{
      for(const role of ['ADMIN','TEACHER','ACCOUNTANT']){await visit('?role='+role+'&detail=1');assert(await page.$$eval('button',nodes=>!nodes.some(node=>node.textContent?.trim()==='Delete Candidate')));}
    });
    console.log(`Candidate deletion browser: ${passed} PASS, 0 FAIL.`);
  }finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
