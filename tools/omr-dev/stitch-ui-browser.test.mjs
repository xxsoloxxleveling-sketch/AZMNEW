/** Google Stitch design integration. Synthetic API fixture only; never production data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const app=path.resolve('apps/omr-mobile/dist');
const chrome=[process.env.OMR_CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));
const exam={id:'synthetic-exam',code:'BIO-007',title:'Synthetic Biology Examination',session:'SYNTHETIC-ONLY',candidateGroup:'Synthetic cohort',examDate:'2026-11-11',questionCount:100,allowedVersions:['A','B'],status:'ACTIVE',publicationStatus:'UNPUBLISHED',releaseAt:null,permissions:[{canScan:true,canReview:true,canManage:false}]};
const scan={id:'synthetic-review',status:'REVIEW_REQUIRED',paperVersion:null,templateVersion:'AZM_FRAMED_100_LEGACY_V1',identityVerified:false,errorCode:null,createdAt:'2026-11-11T07:00:00Z',student:null};
test('Stitch login, dashboard, exam selection, mobile quality and role-aware review use real API contracts',
 {skip:!chrome||!fs.existsSync(path.join(app,'index.html'))?'Build the mobile frontend and install Chrome first':false,timeout:45000},async()=>{
  let requestedFilter=false,uploaded=0;
  const server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
      let data={};
      if(url.pathname==='/api/auth/login')data={accessToken:'synthetic-token-only',refreshToken:'synthetic-refresh',user:{id:'fake-invigilator',name:'Test Invigilator',email:'test@example.invalid',role:'TEACHER'}};
      else if(url.pathname==='/api/omr/exams')data=[exam];
      else if(url.pathname.endsWith('/stats'))data={scans:[{status:'REVIEW_REQUIRED',_count:3},{status:'RECOGNIZED',_count:41},{status:'INVALID',_count:2}],results:[],batches:6,officialRecognitionEnabled:false,offlineCaptureEnabled:false};
      else if(url.pathname.endsWith('/scans')){requestedFilter=url.searchParams.get('status')==='REVIEW_REQUIRED';data={items:[scan],total:1,page:1,pageSize:25};}
      else if(url.pathname.endsWith('/batches'))data={items:[],total:0,page:1,pageSize:25};
      else if(url.pathname.includes('/batches')&&req.method==='POST'){uploaded++;res.statusCode=500;res.end(JSON.stringify({success:false,error:{message:'Upload not part of this UI fixture'}}));return;}
      res.end(JSON.stringify({success:true,data}));return;
    }
    const file=path.resolve(app,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(app+path.sep)||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await require('puppeteer').launch({headless:true,executablePath:chrome});
  try{
    const page=await browser.newPage();page.setDefaultTimeout(9000);await page.setViewport({width:402,height:900});await page.goto(origin);
    assert.equal(await page.evaluate(()=>document.querySelectorAll('.azm-role-selector button').length),0,'Decorative role labels must not impersonate permissions');
    await page.click('input[type=url]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.type('input[type=url]',origin);
    await page.type('input[type=email]','test@example.invalid');await page.type('input[type=password]','synthetic-only');await page.click('form button[type=submit]');
    await page.waitForFunction(()=>document.body.innerText.includes('Synthetic Biology Examination')&&document.body.innerText.includes('46'));
    assert.ok(await page.evaluate(()=>document.body.innerText.includes('Needs review')&&document.body.innerText.includes('3')));
    assert.equal(await page.evaluate(()=>document.body.innerText.includes('99.8%')||document.body.innerText.includes('Face Authentication')),false,'Static Stitch claims must not survive');
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.getAttribute('aria-label')==='Choose examination').click());
    await page.waitForFunction(()=>document.body.innerText.includes('BIO-007')&&document.body.innerText.includes('Synthetic Biology Examination'));
    assert.ok(await page.evaluate(()=>document.body.innerText.includes('A · B')));
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes('Select & scan')).click());
    await page.waitForSelector('section[aria-label="Single OMR upload"]');
    const choose=async(width,height)=>page.evaluate(async(w,h)=>{
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));
      const dt=new DataTransfer();dt.items.add(new File([blob],'synthetic-omr.jpg',{type:'image/jpeg'}));
      const input=document.querySelector('section[aria-label="Single OMR upload"] input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    },width,height);
    await choose(720,1280);
    await page.waitForFunction(()=>document.body.innerText.includes('Photo is only 720 × 1280 pixels'));
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.textContent==='Upload for processing')?.disabled),true);
    await choose(2880,3840);
    await page.waitForFunction(()=>document.body.innerText.includes('Image dimensions verified'));
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.textContent==='Upload for processing')?.disabled),false);
    assert.equal(uploaded,0,'Never upload a fabricated image during a UI regression');
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.getAttribute('aria-label')==='Exit scanner').click());
    await page.evaluate(()=>[...document.querySelectorAll('nav[aria-label="Scanner screens"] button')].find(el=>el.getAttribute('aria-label')==='Review').click());
    await page.waitForFunction(()=>document.body.innerText.includes('Review queue'));
    assert.ok(requestedFilter,'Review queue must use backend status filter');
    assert.equal(await page.evaluate(()=>document.body.innerText.includes('Official scoring allowed')),false);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
