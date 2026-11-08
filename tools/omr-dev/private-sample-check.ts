/** Opt-in, local UI intake test. Private inputs/evidence must never enter CI artifacts. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import {startDevelopment} from './start';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
if(process.env.CI)throw new Error('Private sample testing is local-only; never run it in CI');
const folder=process.env.OMR_PRIVATE_SAMPLE_DIR,executablePath=process.env.OMR_CHROME_PATH;
if(!folder||!executablePath)throw new Error('Set OMR_PRIVATE_SAMPLE_DIR and OMR_CHROME_PATH');
const files=(await fs.readdir(folder)).filter(name=>/\.(png|jpe?g)$/i.test(name)).sort().map(name=>path.join(folder,name));
assert.ok(files.length>0&&files.length<=100,'Choose a folder with 1–100 JPEG/PNG samples');
const output=path.resolve('tmp/omr-reference/application-check');await fs.mkdir(output,{recursive:true});
const development=await startDevelopment({apiPort:5055,workerEnabled:false,privateDirectory:path.join(output,'private')});
let browser:any;
try {
  browser=await require('puppeteer').launch({headless:true,executablePath});
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
  await page.setRequestInterception(true);
  page.on('request',(request:any)=>{if(/^(http:\/\/(127\.0\.0\.1|localhost)(:|\/)|data:|blob:|about:)/.test(request.url()))void request.continue();else void request.abort();});
  await page.goto('http://127.0.0.1:5173/#login');await page.waitForSelector('input[type=email]');
  await page.type('input[type=email]','super@omr.test');await page.type('input[type=password]','Synthetic-Omr-Only-2026!');await page.click('button[type=submit]');
  await page.waitForFunction(()=>!document.querySelector('input[type=password]'));
  await page.goto('http://127.0.0.1:5173/#omr');await page.waitForSelector('[aria-label="OMR Evaluation Center"]');
  await page.waitForFunction(()=>document.querySelector('[aria-label="Selected examination"]')?.textContent?.includes('Synthetic'));
  const click=async(label:string)=>{const found=await page.evaluate((label:string)=>{const button=[...document.querySelectorAll('button')].find(element=>element.textContent?.trim()===label);button?.click();return !!button;},label);assert.ok(found,`Missing UI action: ${label}`);};
  await click('Bulk upload');const input=await page.waitForSelector('input[type=file][multiple]');await input.uploadFile(...files);
  await page.waitForFunction((count:number)=>document.body.textContent?.includes(`${count} file${count===1?'':'s'} ready`),{},files.length);
  await click('Upload for processing');
  await page.waitForFunction((count:number)=>document.body.textContent?.includes(`${count} upload${count===1?'':'s'} queued for processing`),{timeout:120000},files.length);
  // The exact production queue/worker is used, with an entirely disposable database.
  const {prisma}=require('./src/lib/prisma.ts');
  const accepted=await prisma.omrScanBatch.findMany({orderBy:{createdAt:'asc'}});
  assert.equal(accepted.length,files.length);
  const batches=await Promise.all(files.map(async file=>{const hash=createHash('sha256').update(await fs.readFile(file)).digest('hex');const batch=accepted.find((value:any)=>value.fileHash===hash);assert.ok(batch,'Uploaded source hash was not retained');return batch.id;}));
  const report:any[]=[];
  for(let index=0;index<batches.length;index++) {
    let batch:any;
    for(let attempt=0;attempt<files.length*4+20;attempt++) {
      await development.tick();
      batch=await prisma.omrScanBatch.findUniqueOrThrow({where:{id:batches[index]},include:{items:{include:{scan:{include:{responses:true}}}}}});
      if(batch.status==='FAILED'||(batch.items.length&&batch.items.every((item:any)=>item.scan&&!['QUEUED','PROCESSING'].includes(item.scan.status))))break;
    }
    assert.ok(batch.items.length&&batch.items.every((item:any)=>item.scan&&!['QUEUED','PROCESSING'].includes(item.scan.status)),'Sample did not finish processing');
    const scan=batch.items[0].scan,bytes=await fs.readFile(files[index]);
    report.push({sample:`S${String(index+1).padStart(2,'0')}`,sha256:createHash('sha256').update(bytes).digest('hex'),status:scan.status,reason:scan.rawDetection?.reason??scan.errorCode,paperVersion:scan.paperVersion,responses:scan.responses.length,uncertain:scan.responses.filter((row:any)=>['UNCERTAIN','MULTIPLE'].includes(row.detectedAnswer)).length,identityAttached:!!scan.studentId,officialScoringAllowed:scan.rawDetection?.officialScoringAllowed===true});
    console.log(`${report.at(-1).sample}: ${scan.status}; ${scan.responses.length} responses`);
  }
  assert.equal(await prisma.omrExamResult.count(),0,'Private sample intake must not create marks');
  assert.ok(report.every(row=>!row.identityAttached&&!row.officialScoringAllowed));
  await click('Scan history');await page.waitForFunction((count:number)=>document.querySelectorAll('tbody tr').length===count,{},Math.min(files.length,25));
  await page.screenshot({path:path.join(output,'history.png'),fullPage:true});
  const first=await page.$('tbody button');assert.ok(first);await first.click();await page.waitForSelector('[aria-label="Scan review"]');
  await page.waitForFunction(()=>{const image=document.querySelector<HTMLImageElement>('[aria-label="Scan review"] img');return !!image?.complete&&image.naturalWidth>0;});
  if(report.every(row=>row.status==='INVALID')) {
    assert.equal(await page.$eval('[aria-label="Scan review"] select',(element:HTMLSelectElement)=>element.value),'original');
    assert.ok(await page.$eval('[aria-label="Scan review"]',(element:Element)=>element.textContent?.includes('No answers or marks were saved.')));
  }
  await page.screenshot({path:path.join(output,'first-evidence.png'),fullPage:true});
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({testedAt:new Date().toISOString(),pipeline:'web bulk upload -> authenticated API -> durable queue -> Python worker -> review history',samples:report,resultsCreated:0,answerKeyComparison:'Not performed until recognition and exact paper/group mapping are validated',productionReady:false},null,2));
  console.log(`Private application test completed: ${report.length} samples. Report retained locally under tmp/omr-reference/application-check.`);
} finally {await browser?.close();await development.stop();}
