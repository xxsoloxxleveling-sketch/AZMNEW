import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {captureObserverSource} from './device-diagnostics.mjs';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const executable=[process.env.OMR_CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&fs.existsSync(p));
test('acceptance observer records original upload dimensions and blocks external credentials without reading headers',{skip:!executable?'A local Chrome executable is required':false},async()=>{
 let receivedTransport=null;const transport='a'.repeat(64);
 const server=createServer((req,res)=>{if(req.url==='/api/omr/exams/test/batches'){receivedTransport=req.headers['x-omr-device-session'];res.statusCode=202;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{id:'synthetic-batch'}}));}else{res.setHeader('Content-Type','text/html');res.end('<html><body>Simulated device observer test only<script>window.appFetcher=fetch</script></body></html>');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await require('puppeteer').launch({headless:true,executablePath:executable});
 try{
  const page=await browser.newPage();await page.evaluateOnNewDocument(captureObserverSource(origin,transport));await page.goto(origin);
  const info=await page.evaluate(async()=>{
   let blocked=false;try{await fetch('https://example.invalid/api/auth/login',{method:'POST',body:'DO_NOT_SEND_SYNTHETIC_SECRET'});}catch{blocked=true;}
   const canvas=document.createElement('canvas');canvas.width=800;canvas.height=1200;
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   const response=await globalThis.appFetcher('/api/omr/exams/test/batches',{method:'POST',headers:{Authorization:'SYNTHETIC_HEADER_NOT_TO_LOG'},body:blob});
   return {blocked,status:response.status,events:globalThis.__azmDeviceAcceptance.events};
  });
  assert.equal(info.blocked,true);assert.ok(info.events.some(e=>e.type==='EXTERNAL_API_BLOCKED'));
  const upload=info.events.find(e=>e.type==='UPLOAD_ACCEPTED');assert.equal(upload.width,800);assert.equal(upload.height,1200);assert.match(upload.sha256,/^[a-f0-9]{64}$/);assert.equal(upload.status,202);assert.equal(receivedTransport,transport);
  assert.doesNotMatch(JSON.stringify(info.events),/SYNTHETIC_HEADER_NOT_TO_LOG|DO_NOT_SEND_SYNTHETIC_SECRET/);
  assert.ok(!JSON.stringify(info.events).includes(transport),'Session transport token must not enter diagnostics');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
