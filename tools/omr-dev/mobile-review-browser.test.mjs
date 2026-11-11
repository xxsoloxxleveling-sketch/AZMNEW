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
 let polls=0,failPolling=true;const scanId='synthetic-review',roll='SYNTHETIC-OMR-0001';
 const scan={id:scanId,status:'REVIEW_REQUIRED',identityVerified:false,student:null,paperVersion:'A',printedRollNumber:roll,printedRollStatus:'READ_UNVERIFIED',hasAnnotation:false,corrections:[],results:[],responses:Array.from({length:100},(_,i)=>({question:i+1,detectedAnswer:'A',reviewedAnswer:null,evidence:{darkness:[1,0,0,0]}}))};
 const batch={id:'synthetic-batch',status:'COMPLETE',progress:{processed:1,total:1},items:[{id:'synthetic-item',pageIndex:1,scan:{id:scanId,status:'REVIEW_REQUIRED'}}]};
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   res.setHeader('Content-Type','application/json');let data;
   if(url.pathname.endsWith('/auth/login'))data={accessToken:'synthetic-browser-token',user:{id:'synthetic-admin',name:'Synthetic staff',email:'staff@omr.test',role:'ADMIN'}};
   else if(url.pathname==='/api/omr/exams')data=[{id:'synthetic-exam',title:'Synthetic test',candidateGroup:'CLASS 6TH',permissions:[{canScan:true,canReview:true}]}];
   else if(url.pathname.includes('/batches')&&req.method==='POST')data=batch;
   else if(url.pathname.includes('/batches/')){polls++;if(failPolling){res.destroy();return;}data=batch;}
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
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
