/** Scanner-only tester. Browser fallback is preview-only; native camera runs on Android. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const dist=path.resolve('apps/omr-mobile/dist');
const chrome=[process.env.OMR_CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));
const exam={id:'synthetic-exam',code:'OMR-DEMO',title:'Synthetic OMR Examination',session:'TEST',candidateGroup:'Synthetic staff',examDate:'2026-11-11',questionCount:100,correctMarks:1,incorrectPenalty:0,allowedVersions:['A'],status:'ACTIVE',publicationStatus:'UNPUBLISHED',releaseAt:null,permissions:[{canScan:true,canReview:true,canManage:false}]};
const recognition={id:'synthetic-scan',status:'REVIEW_REQUIRED',paperVersion:'A',templateVersion:'SYNTHETIC_OMR_100',identityVerified:true,errorCode:null,createdAt:'2026-11-11T12:00:00Z',student:null,responses:Array.from({length:100},(_,i)=>({question:i+1,detectedAnswer:i===0?'UNCERTAIN':i===1?'MULTIPLE':'A',reviewedAnswer:null,evidence:{reviewRequired:i<2}})),corrections:[],hasAnnotation:false,quality:{focus:41,registration:.98},results:[{id:'draft-synthetic',status:'DRAFT',score:'82',maximumScore:'100'}]};
test('scanner-only app previews without login; optional authenticated testing never publishes scores',
 {skip:!chrome||!fs.existsSync(path.join(dist,'index.html'))?'Build mobile app and install Chrome to test':false,timeout:45000},async()=>{
 let accepted=0,unsafeRequest=false;
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/')){
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   if(url.pathname.includes('publish')||url.pathname.includes('approve'))unsafeRequest=true;
   if(req.method==='POST'&&url.pathname.endsWith('/batches')){
    accepted++;req.resume();req.on('end',()=>res.end(JSON.stringify({success:true,data:{id:'synthetic-batch',status:'QUEUED',progress:{processed:0,total:1,duplicates:0},items:[]}})));return;
   }
   let data={};
   if(url.pathname==='/api/auth/login')data={accessToken:'synthetic-token',refreshToken:'synthetic-refresh',user:{id:'staff',name:'Test Examiner',email:'test@example.invalid',role:'ADMIN'}};
   else if(url.pathname==='/api/omr/exams')data=[exam];
   else if(url.pathname==='/api/omr/batches/synthetic-batch')data={id:'synthetic-batch',status:'COMPLETE',progress:{processed:1,total:1,duplicates:0},items:[{id:'page-1',pageIndex:1,status:'COMPLETE',scan:{id:'synthetic-scan',status:'REVIEW_REQUIRED',errorCode:null}}]};
   else if(url.pathname==='/api/omr/scans/synthetic-scan')data=recognition;
   res.end(JSON.stringify({success:true,data}));return;
  }
  const full=path.resolve(dist,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!full.startsWith(dist+path.sep)||!fs.existsSync(full)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',full.endsWith('.js')?'text/javascript':full.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(full));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await require('puppeteer').launch({headless:true,executablePath:chrome});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(10000);await page.setViewport({width:425,height:940});await page.goto(origin);
  await page.waitForSelector('.st-app');
  assert.ok(await page.evaluate(()=>document.body.innerText.includes('SCANNER TESTER')));
  assert.equal(await page.evaluate(()=>document.querySelectorAll('nav[aria-label="Scanner screens"]').length),0,'Remove dashboards and bottom nav');
  assert.equal(await page.evaluate(()=>document.body.innerText.includes('Needs review')||document.body.innerText.includes('Scans recorded')),false,'No dashboard metrics');
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Start automatic scanner'))));
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Start automatic scanner'))?.disabled),true,'Native capture unavailable in browser');
  await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=1800;c.height=2400;const ctx=c.getContext('2d');
   ctx.fillStyle='white';ctx.fillRect(0,0,1800,2400);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.83));
   const file=new File([blob],'fixture.jpg',{type:'image/jpeg'});
   const dt=new DataTransfer();dt.items.add(file);
   const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>document.body.innerText.includes('Saved scanner image'));
  assert.ok(await page.evaluate(()=>document.querySelector('img[alt="Selected OMR scan"]')?.complete));
  assert.equal(accepted,0,'Preview never silently uploads an image');
  assert.ok(await page.evaluate(()=>document.body.innerText.includes('View MCQs & marks')));
  await page.evaluate(()=>[...document.querySelectorAll('.st-preview-actions button')].find(b=>b.textContent.includes('View MCQs'))?.click());
  await page.waitForSelector('.st-api-panel input[type=email]');
  await page.click('.st-api-panel input[type=url]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.type('.st-api-panel input[type=url]',origin);
  await page.type('.st-api-panel input[type=email]','test@example.invalid');await page.type('.st-api-panel input[type=password]','synthetic-only');
  await page.click('.st-api-panel button[type=submit]');
  await page.waitForFunction(()=>document.body.innerText.includes('Test Examiner')&&document.body.innerText.includes('OMR-DEMO'));
  await page.evaluate(()=>[...document.querySelectorAll('.st-api-panel button')].find(b=>b.textContent.includes('Recognize this page'))?.click());
  await page.waitForFunction(()=>document.body.innerText.includes('Detected MCQs & marks')&&document.body.innerText.includes('Backend draft marks'),{timeout:12000});
  assert.equal(accepted,1);
  assert.equal(unsafeRequest,false);
  assert.equal(await page.evaluate(()=>document.body.innerText.includes('82 / 100')),true,'Admin sees actual draft score from server');
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.st-answers-row[role=row]').length),101,'All 100 MCQs returned from server');
  assert.ok(await page.evaluate(()=>document.body.innerText.includes('UNCERTAIN')&&document.body.innerText.includes('MULTIPLE')));
  await page.evaluate(()=>[...document.querySelectorAll('.st-practice-toggle')].find(b=>b.textContent.includes('Optional local practice marks'))?.click());
  await page.type('textarea[aria-label="100-question practice key"]','A'.repeat(100));
  await page.waitForFunction(()=>document.body.innerText.includes('LOCAL PRACTICE ONLY'));
  assert.ok(await page.evaluate(()=>document.body.innerText.includes('98.00 / 100.00')),'Manual practice key uses real detected answers');
  assert.ok(await page.evaluate(()=>document.body.innerText.includes('Saved scanner image')),'Recognition does not discard saved photo');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
