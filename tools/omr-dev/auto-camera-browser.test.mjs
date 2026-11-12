/** Synthetic camera/browser integration: no real sheet, student, key, or production API. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const dist=path.resolve('apps/omr-mobile/dist');
const chrome=[process.env.OMR_CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));
const exam={id:'synthetic-exam',code:'AUTO-TEST',title:'Synthetic Camera Exam',session:'SYNTHETIC',candidateGroup:'Synthetic',examDate:'2026-11-11',questionCount:100,allowedVersions:['A'],status:'ACTIVE',publicationStatus:'UNPUBLISHED',releaseAt:null,permissions:[{canScan:true,canReview:true,canManage:false}]};
test('stable 4-corner sheet auto-captures and uploads once through authenticated API',
 {skip:!chrome||!fs.existsSync(path.join(dist,'index.html'))?'Build mobile app and install Chrome':false,timeout:45000},async()=>{
 let uploadCount=0,uploadBytes=0;
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   if(url.pathname.includes('/batches')&&req.method==='POST'){
    uploadCount++;req.on('data',chunk=>{uploadBytes+=chunk.length;});req.on('end',()=>res.end(JSON.stringify({success:true,data:{id:'synthetic-auto-batch',status:'QUEUED',progress:{processed:0,total:1,duplicates:0},items:[]}})));return;
   }
   let data={};
   if(url.pathname==='/api/auth/login')data={accessToken:'synthetic-test-token',refreshToken:'synthetic-refresh',user:{id:'test',name:'Synthetic Observer',email:'test@example.invalid',role:'ADMIN'}};
   else if(url.pathname==='/api/omr/exams')data=[exam];
   else if(url.pathname.endsWith('/stats'))data={scans:[],results:[],batches:0,officialRecognitionEnabled:false,offlineCaptureEnabled:false};
   else if(url.pathname.endsWith('/scans')||url.pathname.endsWith('/batches'))data={items:[],total:0,page:1,pageSize:25};
   else if(url.pathname==='/api/omr/batches/synthetic-auto-batch')data={id:'synthetic-auto-batch',status:'COMPLETE',progress:{processed:1,total:1,duplicates:0},items:[]};
   res.end(JSON.stringify({success:true,data}));return;
  }
  const file=path.resolve(dist,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await require('puppeteer').launch({headless:true,executablePath:chrome,args:['--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 try {
  const page=await browser.newPage();page.setDefaultTimeout(10000);
  await page.setViewport({width:412,height:915});
  await page.goto(origin);
  await page.click('input[type=url]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.type('input[type=url]',origin);
  await page.type('input[type=email]','test@example.invalid');
  await page.type('input[type=password]','synthetic-only');
  await page.click('form button[type=submit]');
  await page.waitForFunction(()=>document.body.innerText.includes('Synthetic Camera Exam'));
  await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=2400;
   const ctx=canvas.getContext('2d');
   ctx.fillStyle='#182236';ctx.fillRect(0,0,1800,2400);
   ctx.fillStyle='#fafafa';ctx.fillRect(300,220,1200,1950);
   ctx.fillStyle='#121827';
   for(const [x,y] of [[320,240],[1465,240],[320,2135],[1465,2135]])ctx.fillRect(x,y,30,30);
   for(let row=0;row<25;row++)for(let col=0;col<4;col++)for(let answer=0;answer<4;answer++){
    const x=370+col*275+answer*48,y=400+row*66;
    ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.lineWidth=2;ctx.strokeStyle='#444';ctx.stroke();
   }
   const original=document.createElement('canvas');original.width=1800;original.height=2400;original.getContext('2d').drawImage(canvas,0,0);
   window.__autoTestContext=ctx;window.__autoTestOriginal=original;
   const stream=canvas.captureStream(10);
   Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>stream});
   window.__autoTestStream=stream;
   window.__autoTestTicker=setInterval(()=>{ctx.fillStyle='#182236';ctx.fillRect(0,0,1,1);},100);
  });
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Scan OMR sheet').click());
  await page.waitForSelector('section[aria-label="Single OMR upload"]');
  assert.ok(await page.evaluate(()=>document.body.innerText.includes('Upload automatically after')));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Open camera').click());
  await page.waitForFunction(()=>document.body.innerText.includes('Auto-detect & capture'));
  await page.waitForFunction(()=>!!document.querySelector('[data-testid="detected-page-corners"]'),{timeout:10000});
  await page.waitForFunction(()=>document.body.innerText.includes('Sheet uploaded'),{timeout:22000});
  assert.equal(uploadCount,1,'Exactly one upload on stable automatic capture');
  assert.ok(uploadBytes>1000,'An actual synthetic camera image must be transmitted');
  await new Promise(resolve=>setTimeout(resolve,1500));
  assert.equal(uploadCount,1,'Camera must disarm until the previous sheet leaves the frame');
  await page.evaluate(()=>{window.__autoTestContext.fillStyle='#182236';window.__autoTestContext.fillRect(0,0,1800,2400);});
  await new Promise(resolve=>setTimeout(resolve,1600));
  await page.evaluate(()=>{window.__autoTestContext.drawImage(window.__autoTestOriginal,0,0);});
  for(let attempt=0;attempt<48&&uploadCount<2;attempt++)await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(uploadCount,2,'Second page should capture automatically after prior page leaves the frame');
  const claim=await page.evaluate(()=>document.body.innerText.includes('100% QR verified')||document.body.innerText.includes('99.8%'));
  assert.equal(claim,false,'Mockup cannot make unverified accuracy/identity claims');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
