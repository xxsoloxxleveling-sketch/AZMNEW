import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { build } from 'esbuild';
import express from 'express';
import puppeteer from 'puppeteer';
import { normalizeStudentDocuments } from '../src/modules/students/studentDocuments';
import { buildDmcDocuments, isStudentDocumentEntry } from '../../src/utils/studentDocuments';

const root = path.resolve(__dirname, '../..');
const baseBackend = path.join(root, 'backend');
const nodePaths = [path.join(baseBackend, 'node_modules'), path.join(root, 'node_modules')];
let checks = 0;
async function check(name: string, action: () => void | Promise<void>) {
  await action(); checks++; console.log('PASS: ' + name);
}
async function run() {
  const files = [1, 2, 3, 4].map(n => ({name: 'same-name.pdf', size: '1 KB',
    dataUrl: `data:application/pdf;base64,${Buffer.from(`synthetic-${n}`).toString('base64')}`}));
  await check('legacy collections flatten every valid DMC without mutating input', () => {
    const source = {dmc: files[0], dmc_2: files[1], dmcFiles: files, bform: {name:'bform.png'}};
    const before = JSON.stringify(source);
    const result = normalizeStudentDocuments(source);
    assert.deepEqual(Object.keys(result), ['dmc','dmc_2','bform','dmc_3','dmc_4']);
    assert.equal(result.dmc_4, files[3]); assert.equal(JSON.stringify(source), before);
    assert.deepEqual(normalizeStudentDocuments(result), result);
  });
  await check('JSON strings, collection-only records, holes and malformed top-level JSON', () => {
    assert.equal(normalizeStudentDocuments(JSON.stringify({dmcFiles: files})).dmc_4.dataUrl, files[3].dataUrl);
    assert.deepEqual(Object.keys(normalizeStudentDocuments({dmcFiles:[null, false, [], {}, files[2]]})), ['dmc_5']);
    for (const value of ['{', 'null', '[]', 'true', 12, null]) assert.equal(Object.keys(normalizeStudentDocuments(value)).length,0);
  });
  await check('serializer-corrupted collection placeholders and arbitrary arrays are excluded', () => {
    const result = normalizeStudentDocuments({dmcFiles:{name:'dmcFiles document',fileEndpoint:'/wrong'},
      dmc:files[0], bogus:[files[1]], empty:{}, flag:true});
    assert.deepEqual(Object.keys(result), ['dmc']);
  });
  await check('distinct colliding DMCs survive; physical duplicates use existing slots', () => {
    const existing = {name:'different.pdf',supabasePath:'existing.pdf'};
    const result = normalizeStudentDocuments({dmc: existing, dmcFiles: files});
    assert.equal(result.dmc, existing); assert.equal(result.dmc_collection_1, files[0]);
    assert.equal(result.dmc_4, files[3]);
    assert.deepEqual(Object.keys(normalizeStudentDocuments({dmc:existing,dmcFiles:[{...existing}]})),['dmc']);
  });
  await check('future submissions emit all DMC singleton keys with storage references intact', () => {
    const input = files.map((file,n)=>({...file,supabasePath:`fixture/dmc_${n+1}.pdf`,mimeType:'application/pdf',bucket:'student-documents'}));
    const result = buildDmcDocuments(input,'2026-10-12T00:00:00Z');
    assert.deepEqual(Object.keys(result),['dmc','dmc_2','dmc_3','dmc_4']);
    assert.equal(result.dmc_4.supabasePath,input[3].supabasePath);
    assert.equal(result.dmc_4.uploadedAt,'2026-10-12T00:00:00Z');
    assert.deepEqual(buildDmcDocuments([],''),{});
  });
  await check('frontend refuses arrays, booleans and reserved collection entries', () => {
    for (const value of [files, {name:'dmcFiles document'}, null, true, files[0]])
      assert.equal(isStudentDocumentEntry('dmcFiles',value),false);
    assert.equal(isStudentDocumentEntry('random',files),false);
    assert.equal(isStudentDocumentEntry('photoThumbnail',files[0]),false);
    assert.equal(isStudentDocumentEntry('dmc_4',files[3]),true);
  });

  // Bundle the real service with isolated adapters. No database client or live storage is loaded.
  let current: any;
  const downloads: string[] = [];
  const saved: any[] = [];
  (globalThis as any).__documentFixture = {
    prisma: {student:{findFirst:async()=>current},studentDocument:{findFirst:async()=>null,upsert:async(value:any)=>{saved.push(value);return value.create;}}},
    storage:{downloadFile:async(_bucket:string,key:string)=>{downloads.push(key); return Buffer.from('stored:'+key);}},
  };
  const bundle = await build({entryPoints:[path.join(root,'backend/src/modules/students/students.service.ts')],
    bundle:true,write:false,format:'cjs',platform:'node',packages:'external',nodePaths,
    plugins:[{name:'isolated-adapters',setup(builder){
      builder.onResolve({filter:/(?:lib\/(?:prisma|supabaseStorage|logger)|attendance\/qr.service|documents\/pdf.service)$/},args=>({path:args.path,namespace:'fixture'}));
      builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:
        args.path.endsWith('/prisma')?'export const prisma=globalThis.__documentFixture.prisma; export const TransactionType={};':
        args.path.endsWith('/supabaseStorage')?'export const supabaseStorage=globalThis.__documentFixture.storage;':
        args.path.endsWith('/logger')?'export const logger={warn(){},info(){},error(){}};':
        args.path.endsWith('/qr.service')?'export const qrService={};':'export const pdfService={};'}));
    }}]});
  const mod: any = new Module(path.join(baseBackend,'tests/document-fixture.cjs'));
  mod.paths = (Module as any)._nodeModulePaths(baseBackend);
  mod._compile(bundle.outputFiles[0].text,mod.id);
  const service = mod.exports.studentsService;
  await check('real metadata writer persists every DMC reference and excludes collection bookkeeping',async()=>{
    const documents={dmcFiles:files.map((file,n)=>({...file,supabasePath:`fixture/persist-${n}.pdf`,bucket:'student-documents'}))};
    const before=JSON.stringify(documents);
    await service.persistDocumentMetadata('synthetic-document-candidate',documents);
    assert.deepEqual(saved.map(value=>value.create.documentType),['dmc','dmc_2','dmc_3','dmc_4']);
    assert(saved.every(value=>!JSON.stringify(value).includes('base64,')));
    assert.equal(JSON.stringify(documents),before);
  });
  const raw: any = {id:'synthetic-document-candidate',applicationNo:'SYN-DOC',fullName:'Synthetic Candidate',
    fatherName:'Synthetic Parent',currentClass:'SSC-II',gender:'MALE',createdAt:'2026-10-12T00:00:00Z',
    feeStatus:'UNPAID',status:'ACTIVE',uploadedDocsJson:JSON.stringify({dmcFiles:files})};
  let formatted: any;
  await check('real detail serializer emits protected endpoints and no embedded file payloads', () => {
    const before = JSON.stringify(raw); formatted = service.formatStudentWithDocuments(raw);
    assert.deepEqual(Object.keys(formatted.uploadedDocuments),['dmc','dmc_2','dmc_3','dmc_4']);
    for (const key of Object.keys(formatted.uploadedDocuments))
      assert.equal(formatted.uploadedDocuments[key].fileEndpoint,`/api/students/${raw.id}/document/${key}`);
    assert(!JSON.stringify(formatted).includes('base64,')); assert.equal(JSON.stringify(raw), before);
  });
  await check('real protected lookup returns exact bytes for all collection-only DMCs', async () => {
    current = raw;
    for (const [n,key] of ['dmc','dmc_2','dmc_3','dmc_4'].entries()) {
      const response = await service.getStudentDocument(raw.id,key);
      assert.equal(response.buffer.toString(),`synthetic-${n+1}`);
      assert.equal(response.contentType,'application/pdf');
    }
    assert.equal(downloads.length,0);
  });
  await check('protected lookup preserves individual collision and recovers separate collection file', async () => {
    current = {...raw, uploadedDocsJson:JSON.stringify({dmc:{name:'stored.pdf',supabasePath:'fixture/stored.pdf'},dmcFiles:files})};
    assert.equal((await service.getStudentDocument(raw.id,'dmc')).buffer.toString(),'stored:fixture/stored.pdf');
    assert.equal((await service.getStudentDocument(raw.id,'dmc_collection_1')).buffer.toString(),'synthetic-1');
  });
  await check('stored collection paths and authoritative relation metadata remain supported', async () => {
    current = {...raw,uploadedDocsJson:JSON.stringify({dmcFiles:[{name:'cloud.pdf',supabasePath:'fixture/cloud.pdf',mimeType:'application/pdf'}]})};
    assert.equal((await service.getStudentDocument(raw.id,'dmc')).buffer.toString(),'stored:fixture/cloud.pdf');
    const result = service.formatStudentWithDocuments({...raw,studentDocuments:[{documentType:'dmc',originalFileName:'current.pdf',objectPath:'vault/current.pdf',bucket:'student-documents',mimeType:'application/pdf',createdAt:raw.createdAt}]});
    assert.equal(result.uploadedDocuments.dmc.supabasePath,'vault/current.pdf');
    assert.equal(result.uploadedDocuments.dmc_collection_1.name, files[0].name);
    current=raw;
    assert.equal((await service.getStudentDocument(raw.id,'dmc_collection_1')).buffer.toString(),'synthetic-1');
  });
  await check('detail serializer tolerates malformed top-level legacy values with current relations',()=>{
    for(const json of ['null','[]','true','"scalar"','{']) {
      const result=service.formatStudentWithDocuments({...raw,uploadedDocsJson:json,studentDocuments:[{documentType:'dmc',originalFileName:'current.pdf',objectPath:'fixture/current.pdf',bucket:'student-documents',createdAt:raw.createdAt}]});
      assert.deepEqual(Object.keys(result.uploadedDocuments),['dmc']);
    }
  });

  const fixture = `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {StudentDetailView} from './src/components/admin/students/StudentDetailView';
    import {StudentDossierModal} from './src/components/common/StudentDossierModal';
    const student=${JSON.stringify(formatted)};
    student.uploadedDocuments.dmcFiles={name:'dmcFiles document',fileEndpoint:'/bad'};
    student.uploadedDocuments.bogus=[{name:'bogus collection'}];
    window.__requests=[]; window.__alerts=[];window.alert=message=>window.__alerts.push(message);
    window.fetch=async(input)=>{const url=new URL(String(input));
      if(url.pathname.includes('/document/')){window.__requests.push(url.pathname);return new Response('%PDF-1.4 synthetic',{headers:{'Content-Type':'application/pdf'}});}
      return new Response(JSON.stringify({success:true,data:url.pathname==='/api/students/'+student.id?student:[]}),{headers:{'Content-Type':'application/json'}});
    };
    createRoot(document.getElementById('root')).render(location.search.includes('dossier')?
      <StudentDossierModal isOpen={true} student={student} onClose={()=>{}}/>:
      <StudentDetailView student={student} onBack={()=>{}}/>);
  `;
  const ui = await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,
    format:'iife',platform:'browser',nodePaths,define:{'import.meta.env':JSON.stringify({VITE_API_URL:'http://fixture.invalid'})},
    plugins:[{name:'auth-fixture',setup(builder){builder.onResolve({filter:/authContext$/},()=>({path:'auth',namespace:'auth-fixture'}));
      builder.onLoad({filter:/.*/,namespace:'auth-fixture'},()=>({contents:'export const useAuth=()=>({role:"SUPER_ADMIN",isLoading:false});',loader:'js'}));}}]});
  const app=express(); app.get('/bundle.js',(_req,res)=>res.type('js').send(ui.outputFiles[0].text));
  const assets=path.join(root,'dist/assets');const css=fs.readdirSync(assets).find(name=>name.endsWith('.css'))!;
  app.get('/style.css',(_req,res)=>res.sendFile(path.join(assets,css)));
  app.get('/',(_req,res)=>res.send('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root" class="p-4 min-w-0"></div><script src="/bundle.js"></script></body></html>'));
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']}); const page=await browser.newPage();
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    for(const dossier of [false,true]) await check(`${dossier?'dossier':'admin detail'} renders and opens all four DMCs without collection requests`,async()=>{
      await page.goto(`http://127.0.0.1:${(server.address() as any).port}/${dossier?'?dossier':''}`);
      const label=dossier?'View':'Inspect';
      await page.waitForFunction(label=>Array.from(document.querySelectorAll('button')).filter(button=>button.textContent?.trim()===label).length===4,{},label);
      assert(!(await page.evaluate(()=>document.body.innerText)).includes('dmcFiles document'));
      const buttons=await page.$$('button');const viewButtons=[];
      for(const button of buttons)if((await button.evaluate(el=>el.textContent))?.trim()===label)viewButtons.push(button);
      for(let i=0;i<viewButtons.length;i++){
        const previewSelector = dossier ? 'iframe[title="Document Preview"]' : 'a[download]';
        await viewButtons[i].click();await page.waitForSelector(previewSelector);
        assert.equal(await page.$eval(previewSelector,el=>((el as HTMLIFrameElement).src || (el as HTMLAnchorElement).href).startsWith('blob:')),true);
        // Close preview using the button in the iframe's modal container.
        if(dossier) await page.evaluate(()=>{const frame=document.querySelector('iframe');let parent=frame?.parentElement;
          while(parent&&!parent.querySelector('button'))parent=parent.parentElement;
          (parent?.querySelector('button') as HTMLButtonElement)?.click();});
        else await page.evaluate(()=>{(Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.trim()==='✕') as HTMLButtonElement)?.click();});
        await page.waitForFunction(selector=>!document.querySelector(selector),{},previewSelector);
      }
      const requested=await page.evaluate(()=>(window as any).__requests.filter((url:string)=>url.includes('/document/dmc')));
      assert.deepEqual(requested,['dmc','dmc_2','dmc_3','dmc_4'].map(key=>`/api/students/${raw.id}/document/${key}`));
      assert.deepEqual(await page.evaluate(()=>(window as any).__alerts),[]);
      for(const width of [390,768,1280]){
        await page.setViewport({width,height:900});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        if(process.env.DOCUMENT_TEST_SCREENSHOTS_DIR){
          fs.mkdirSync(process.env.DOCUMENT_TEST_SCREENSHOTS_DIR,{recursive:true});
          await page.screenshot({path:path.join(process.env.DOCUMENT_TEST_SCREENSHOTS_DIR,`${dossier?'dossier':'admin'}-${width}.png`),fullPage:true});
        }
      }
    });
  } finally {await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  console.log(`Student document regression checks: ${checks}/${checks} passed. No production DB or storage accessed.`);
}
run().catch(error=>{console.error(error);process.exitCode=1;});
