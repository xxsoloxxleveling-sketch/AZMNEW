import {startDevelopment} from './start';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const puppeteer=require('puppeteer');
const executablePath=process.env.OMR_CHROME_PATH;
if(!executablePath)throw new Error('Set OMR_CHROME_PATH');
const development=await startDevelopment({apiPort:5055});
const browser=await puppeteer.launch({headless:true,executablePath,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const output=path.resolve('tmp/omr-dev/browser');await fs.mkdir(output,{recursive:true});
const failures:string[]=[];
try {
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
  let failUpload=true;
  await page.setRequestInterception(true);page.on('request',(req:any)=>{if(failUpload&&req.method()==='POST'&&/\/api\/omr\/exams\/[^/]+\/batches/.test(req.url())){failUpload=false;void req.abort('failed');return;}if(/^(http:\/\/(127\.0\.0\.1|localhost)(:|\/)|data:|blob:|about:)/.test(req.url()))void req.continue();else void req.abort();});
  page.on('pageerror',(error:Error)=>failures.push(error.message));
  const click=async(text:string)=>{const found=await page.evaluate((text:string)=>{const buttons=[...document.querySelectorAll('.omr-tabs button'),...document.querySelectorAll('button')];const button=buttons.find(value=>value.textContent?.trim()===text);button?.click();return !!button;},text);if(!found)throw new Error(`Missing UI action ${text}`);};
  await page.goto('http://127.0.0.1:5173/#login');await page.waitForSelector('input[type=email]');
  await page.type('input[type=email]','super@omr.test');await page.type('input[type=password]','Synthetic-Omr-Only-2026!');await page.click('button[type=submit]');
  await page.waitForFunction(()=>!document.querySelector('input[type=password]'));
  await page.goto('http://127.0.0.1:5173/#omr');await page.waitForSelector('[aria-label="OMR Evaluation Center"]');
  await page.waitForFunction(()=>document.querySelector('[aria-label="Selected examination"]')?.textContent?.includes('Synthetic'));
  for(const [label,name] of [['Dashboard','dashboard'],['Examinations','exams'],['Answer keys','keys'],['Single scan','single'],['Bulk upload','bulk'],['Processing queue','queue'],['Manual review','review'],['Verified results','results'],['Publication','publication'],['Scan history','history']]){
    await click(label);await new Promise(resolve=>setTimeout(resolve,450));
    const errors=await page.$$eval('[role=alert]',(values:Element[])=>values.map(value=>value.textContent));if(errors.length)throw new Error(`${label}: ${errors.join('; ')}`);
    await page.screenshot({path:path.join(output,`web-${name}.png`),fullPage:true});
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.waitForSelector('[aria-label="OMR Evaluation Center"]');await page.waitForSelector('[aria-label="Selected examination"] option[value="synthetic-omr-exam"]');await click('Single scan');await new Promise(resolve=>setTimeout(resolve,300));await page.screenshot({path:path.join(output,'web-phone.png'),fullPage:true});
  await page.goto('http://127.0.0.1:5174');await page.waitForSelector('input[type=email]');await page.type('input[type=email]','teacher@omr.test');await page.type('input[type=password]','Synthetic-Omr-Only-2026!');await click('Sign in');
  await page.waitForFunction(()=>document.body.textContent?.includes('Ready to scan'));
  await page.screenshot({path:path.join(output,'mobile-home.png'),fullPage:true});await click('Scan sheet');await page.waitForSelector('input[type=file]');
  await click('Open camera');await page.waitForFunction(()=>{const video=document.querySelector('video');return !!video?.videoWidth;});
  await click('Close camera');await page.waitForFunction(()=>{const video=document.querySelector('video');return !video?.srcObject;});
  const upload=await page.$('input[type=file]');await upload.uploadFile(path.resolve('tmp/omr-dev/synthetic-clean.png'));
  await new Promise(resolve=>setTimeout(resolve,300));await click('Retake or choose again');
  if(await page.$eval('input[type=file]',(element:HTMLInputElement)=>element.value)!=='')throw new Error('Retake retained the previous file reference');
  // Exercise the actual capture button with a fabricated sensor result, then carry
  // that captured File through offline refusal, retry, queue and review below.
  const sensorBytes=(await fs.readFile('tmp/omr-dev/synthetic-clean.png')).toString('base64');
  await page.evaluate('globalThis.__name = value => value'); // tsx named-function helper for injected test callbacks
  await page.evaluate(async(encoded:string)=>{
    (globalThis as any).ImageCapture=class {async takePhoto(){return new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:'image/png'});}};
    // Chrome's fake device can disappear after stop on Windows. Supply an explicit
    // fabricated camera stream for this second capture rather than a real device.
    const photo=new Image();photo.src='data:image/png;base64,'+encoded;await photo.decode();
    navigator.mediaDevices.getUserMedia=async()=>{
      const canvas=document.createElement('canvas');canvas.width=photo.width;canvas.height=photo.height;
      const draw=()=>canvas.getContext('2d')!.drawImage(photo,0,0);draw();const timer=setInterval(draw,100);
      const stream=canvas.captureStream(10),track=stream.getVideoTracks()[0],stop=track.stop.bind(track);
      track.stop=()=>{clearInterval(timer);stop();canvas.width=0;canvas.height=0;};return stream;
    };
  },sensorBytes);
  await click('Open camera');await page.waitForFunction(()=>!!document.querySelector('video')?.videoWidth);
  await click('Capture sheet');await page.waitForSelector('img[alt="Captured OMR preview before upload"]');
  if(!await page.$eval('video',(element:HTMLVideoElement)=>!element.srcObject))throw new Error('Captured sensor image retained an active camera stream');
  await new Promise(resolve=>setTimeout(resolve,300));await page.screenshot({path:path.join(output,'mobile-preview.png'),fullPage:true});
  console.log('Visible upload actions:',await page.$$eval('button',(buttons:Element[])=>buttons.map(button=>button.textContent?.trim()).join(' | ')));
  const storage=await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}));if(storage.local||storage.session)throw new Error('Mobile persisted session storage');
  await page.setOfflineMode(true);await new Promise(resolve=>setTimeout(resolve,200));await page.screenshot({path:path.join(output,'mobile-offline.png'),fullPage:true});const disabled=await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Upload for processing')?.disabled);if(!disabled)throw new Error('Offline upload remained enabled');
  await page.setOfflineMode(false);await new Promise(resolve=>setTimeout(resolve,200));await click('Upload for processing');
  await page.waitForSelector('[role=alert]');if(!await page.$('img[alt="Captured OMR preview before upload"]'))throw new Error('Failed upload discarded retry evidence');await click('Upload for processing');
  await page.waitForFunction(()=>document.body.textContent?.includes('1 / 1 pages processed'),{timeout:60000});
  await click('View evaluation evidence');await page.waitForSelector('[aria-label="Scan review"] tbody tr');
  if(await page.$$eval('[aria-label="Scan review"] tbody tr',(rows:Element[])=>rows.length)!==100)throw new Error('Review did not show all 100 responses');
  await page.screenshot({path:path.join(output,'mobile-review.png'),fullPage:true});
  await click('History');await page.waitForFunction(()=>document.body.textContent?.includes('1 scans'));
  await click('Sign out');await page.waitForSelector('input[type=password]');
  if(failures.length)throw new Error(failures.join('\n'));console.log('Web 10 screens and mobile login, fake-camera lifecycle, upload, recognition, review, history, offline and logout passed. Screenshots:',output);
} catch(error) {await pageSafeScreenshot();throw error;} finally {await browser.close();await development.stop();}
async function pageSafeScreenshot(){try{const pages=await browser.pages();await pages.at(-1)?.screenshot({path:path.join(output,'failure.png'),fullPage:true});}catch{}}
