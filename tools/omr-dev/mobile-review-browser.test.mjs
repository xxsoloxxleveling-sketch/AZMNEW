/** Synthetic desktop browser regression only; never Android hardware evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const root=path.resolve('apps/omr-mobile/dist');
const chrome=[process.env.OMR_CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));

test('mobile clears a recovered polling error and treats an OCR roll as an unconfirmed candidate',{skip:!chrome||!fs.existsSync(path.join(root,'index.html'))?'Build the mobile web bundle and provide Chrome first':false,timeout:30000},async()=>{
 let polls=0,failPolling=true,detailRequests=0,releaseLateDetail,releaseLateReview;const scanId='synthetic-review',roll='SYNTHETIC-OMR-0001';
 const scan={id:scanId,status:'REVIEW_REQUIRED',identityVerified:false,student:null,paperVersion:'A',printedRollNumber:roll,printedRollStatus:'READ_UNVERIFIED',sourceSha256:'a'.repeat(64),hasAnnotation:false,corrections:[],results:[],responses:Array.from({length:100},(_,i)=>({question:i+1,detectedAnswer:i===1?'UNCERTAIN':i===2?'MULTIPLE':'A',reviewedAnswer:null,evidence:{darkness:[1,0,0,0]}}))};
 const batch={id:'synthetic-batch',status:'COMPLETE',progress:{processed:1,total:1},items:[{id:'synthetic-item',pageIndex:1,scan:{id:scanId,status:'REVIEW_REQUIRED'}}]};
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   res.setHeader('Content-Type','application/json');let data;
   if(url.pathname.endsWith('/auth/login'))data={accessToken:'synthetic-browser-token',user:{id:'synthetic-admin',name:'Synthetic staff',email:'staff@omr.test',role:'ADMIN'}};
   else if(url.pathname==='/api/omr/exams')data=[{id:'synthetic-exam',title:'Synthetic test',candidateGroup:'CLASS 6TH',permissions:[{canScan:true,canReview:true}]}];
   else if(url.pathname.endsWith('/review')){releaseLateReview=()=>res.end(JSON.stringify({success:true,data:{}}));return;}
   else if(url.pathname.endsWith('/identity-captures')){assert.equal(url.searchParams.get('originalSha256'),'a'.repeat(64));res.statusCode=201;data={id:'synthetic-detail',status:'DETAIL_REVIEW_REQUIRED',qrDecoded:false,rollCandidate:'SYNTHETIC-OMR-0002',canPrefill:false,identityVerified:false};if(++detailRequests===2){releaseLateDetail=()=>res.end(JSON.stringify({success:true,data:{...data,rollCandidate:roll,canPrefill:true}}));return;}}
   else if(url.pathname.includes('/batches')&&req.method==='POST')data=batch;
   else if(url.pathname.includes('/batches/')){polls++;if(failPolling){res.destroy();return;}data=batch;}
   else if(url.pathname.endsWith('/scans'))data={items:[scan,{...scan,id:'synthetic-other',printedRollNumber:'SYNTHETIC-OMR-0002',sourceSha256:'b'.repeat(64),responses:scan.responses.map((r,i)=>i===0?{...r,detectedAnswer:'B'}:r)}],total:2,page:1,pageSize:25};
   else if(url.pathname.endsWith('/scans/synthetic-other'))data={...scan,id:'synthetic-other',printedRollNumber:'SYNTHETIC-OMR-0002',sourceSha256:'b'.repeat(64),responses:scan.responses.map((r,i)=>i===0?{...r,detectedAnswer:'B'}:r)};
   else if(url.pathname.includes('/image')){res.setHeader('Content-Type','image/png');res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1sAAAAASUVORK5CYII=','base64'));return;}
   else data=scan;
   res.end(JSON.stringify({success:true,data}));return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await require('puppeteer').launch({headless:true,executablePath:chrome});
 try{
  const page=await browser.newPage();page.setDefaultTimeout(7000);if(process.env.OMR_BROWSER_DEBUG){page.on('request',r=>{if(r.url().includes('/api/'))console.log('fixture request',r.url());});page.on('pageerror',e=>console.log('fixture page error',e.message));}await page.goto(origin);
  await page.click('input[type=url]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.type('input[type=url]',origin);
  await page.type('input[type=email]','staff@omr.test');await page.type('input[type=password]','fabricated-browser-fixture');await page.click('form button');if(process.env.OMR_BROWSER_DEBUG)console.log(await page.evaluate(()=>({text:document.body.innerText,fields:[...document.querySelectorAll('input')].map(x=>({type:x.type,value:x.type==='password'?'redacted':x.value,valid:x.checkValidity()}))})));
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Scan OMR sheet'&&!b.disabled));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Scan OMR sheet').click());
  await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=800;canvas.height=1200;const blob=await new Promise(resolve=>canvas.toBlob(resolve));const data=new DataTransfer();data.items.add(new File([blob],'fabricated.png',{type:'image/png'}));const input=document.querySelector('input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Upload for processing'&&!b.disabled));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Upload for processing').click());
  await page.waitForFunction(()=>document.body.innerText.includes('Cannot reach the local test server'));failPolling=false;
  await page.waitForFunction(()=>!document.body.innerText.includes('Cannot reach the local test server'),{timeout:10000});assert.ok(polls>=2);
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='View evaluation evidence').click());
  await page.waitForFunction(()=>document.body.innerText.includes('Printed roll read automatically'));
  const fields=await page.$$eval('[aria-label="Scan review"] fieldset input',els=>els.map(el=>({value:el.value,checked:el.checked})));
  assert.equal(fields[0].value,roll);assert.equal(fields[1].value,roll);assert.equal(fields[2].checked,false);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Save and recalculate draft').disabled),true);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Verify scan').disabled),true);
  await page.select('select[aria-label="Question 1 reviewed response"]','D');
  await page.type('[aria-label="Scan review"] textarea','Synthetic pending answer review');
  await page.evaluate(()=>[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Show only flagged answers')).querySelector('input').click());
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Scan review"] tbody tr').length===2);
  await page.evaluate(()=>[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Show only flagged answers')).querySelector('input').click());
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Scan review"] tbody tr').length===100);
  await page.evaluate(()=>[...document.querySelectorAll('summary')].find(s=>s.textContent==='Add a clearer QR / printed-roll close-up').click());
  await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=600;canvas.height=600;const blob=await new Promise(resolve=>canvas.toBlob(resolve));const data=new DataTransfer();data.items.add(new File([blob],'fabricated-detail.png',{type:'image/png'}));const input=document.querySelector('[aria-label="Scan review"] input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Read close-up for this scan'&&!b.disabled));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Read close-up for this scan').click());
  await page.waitForFunction(()=>document.body.innerText.includes('Detail retained for authorized review'));
  assert.equal(await page.$eval('select[aria-label="Question 1 reviewed response"]',el=>el.value),'D');
  assert.equal(await page.$eval('[aria-label="Scan review"] textarea',el=>el.value),'Synthetic pending answer review');
  assert.equal(await page.$eval('[aria-label="Scan review"] fieldset input',el=>el.value),roll,'Unmatched supplemental OCR must not replace the original candidate');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='History').click());
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Open').length===2);
  await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Open')[0].click());
  await page.waitForSelector('select[aria-label="Question 1 reviewed response"]');
  await page.select('select[aria-label="Question 1 reviewed response"]','D');
  await page.evaluate(()=>[...document.querySelectorAll('summary')].find(s=>s.textContent==='Add a clearer QR / printed-roll close-up').click());
  await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=600;canvas.height=600;const blob=await new Promise(resolve=>canvas.toBlob(resolve));const data=new DataTransfer();data.items.add(new File([blob],'late-detail.png',{type:'image/png'}));const input=document.querySelector('[aria-label="Scan review"] input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Read close-up for this scan'&&!b.disabled));
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Read close-up for this scan').click());
  for(let i=0;i<100&&!releaseLateDetail;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(releaseLateDetail);
  await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Open')[1].click());
  await page.waitForFunction(()=>document.querySelector('[aria-label="Scan review"] fieldset input')?.value==='SYNTHETIC-OMR-0002');
  assert.equal(await page.$eval('select[aria-label="Question 1 reviewed response"]',el=>el.value),'B','Unsaved corrections must never cross into another scan');
  releaseLateDetail();await page.waitForNetworkIdle({idleTime:100});
  assert.equal(await page.$eval('[aria-label="Scan review"] fieldset input',el=>el.value),'SYNTHETIC-OMR-0002','A late old-scan close-up cannot overwrite a different candidate');
  await page.type('[aria-label="Scan review"] textarea','Synthetic late review request');
  await page.click('[aria-label="Scan review"] fieldset input[type=checkbox]');
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Save and recalculate draft').click());
  for(let i=0;i<100&&!releaseLateReview;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(releaseLateReview);
  await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Open')[0].click());
  await page.waitForFunction(()=>document.querySelector('[aria-label="Scan review"] fieldset input')?.value==='SYNTHETIC-OMR-0001');
  releaseLateReview();await page.waitForNetworkIdle({idleTime:100});
  assert.equal(await page.$eval('select[aria-label="Question 1 reviewed response"]',el=>el.value),'A','A late old review cannot replace the new scan response list');


 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
