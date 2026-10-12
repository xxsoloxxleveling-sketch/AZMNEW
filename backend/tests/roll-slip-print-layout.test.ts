import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const repo = path.resolve(__dirname, '../..');
const instruction = 'Wear your school uniform. If your school registered you, attend with your institute’s instructor.';
const output = process.env.ROLL_SLIP_QA_DIR;
const cnic = '12345-1234567-1';
const qr = 'https://azmaio.com/attend?token=qr_SYNTHETIC-TEST_1790000000000.' + 'a'.repeat(64);

async function run() {
  const assets = path.join(repo, 'dist/assets');
  const css = fs.readdirSync(assets).filter(name => name.endsWith('.css')).map(name => fs.readFileSync(path.join(assets, name), 'utf8')).join('\n');
  const bundle = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {RollNumberSlipView} from './src/components/rollnumber/RollNumberSlipView';
      createRoot(document.getElementById('root')).render(React.createElement(RollNumberSlipView,{onSelectTab:()=>{}}));`, resolveDir: repo, loader: 'tsx' },
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'import.meta.env.PROD': 'true', 'import.meta.env.VITE_API_URL': 'window.location.origin' },
  });
  const photo = await sharp({create:{width:100,height:120,channels:3,background:'#6e99b2'}}).png().toBuffer();
  let long = false;
  let duplicateInstruction = false;
  const server = createServer((req, res) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    const json = (data: unknown) => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); };
    if (pathname === '/') { res.setHeader('Content-Type','text/html'); return res.end(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><header style="height:300px">Application header</header><main style="min-height:100vh"><div id="root"></div></main><footer style="height:900px">Application footer</footer><script src="/fixture.js"></script></body></html>`); }
    if (pathname === '/fixture.js') {res.setHeader('Content-Type','text/javascript'); return res.end(bundle.outputFiles[0].text);}
    if (pathname.startsWith('/pictures/')) {res.setHeader('Content-Type','image/png'); return res.end(fs.readFileSync(path.join(repo, 'public/pictures/logo_cropped.png')));}
    if (pathname.endsWith('/photo-thumbnail')) {res.setHeader('Content-Type','image/png'); return res.end(photo);}
    if (pathname.endsWith('/search-slip')) return json({success:true,data:{
      applicationId:'APP-SYNTHETIC-1', rollNo:'AZMVS-2026-0100', candidateName:long?'Synthetic Candidate With A Very Long Family Name':'Synthetic Candidate',
      fatherName:long?'Synthetic Guardian With A Very Long Family Name':'Synthetic Guardian', cnicBForm:cnic, classLevel:'Class 11th (HSSC-I)',
      testCenter:long?'AZM Examination Centre - Dubai International School and College Boys Campus (Mansehra)':'Synthetic Examination Centre',
      centerAddress:long?'Near NHA Office Daara Bypass Mansehra, Main Campus Examination Building':'Synthetic City',
      examDate:'Sunday, 15 November 2026', reportingTime:'07:30 AM', examStartTime:'To be announced',
      roomNo:'04-Girls',seatIndex:'Seat #03',placementStatus:'ASSIGNED',assignedHallId:'H1',hallName:'AZM HALL-C-Girls',
      qrPayload:qr,barcode:'AZMVS-2026-0100',securityHash:'SYNTHETIC-TEST',
      ...(duplicateInstruction?{specialInstructions:['Custom candidate instruction',instruction]}:{}),
    }});
    return json({success:true,status:'ok'});
  });
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const browser = await puppeteer.launch({headless:true,executablePath:process.env.PUPPETEER_EXECUTABLE_PATH,args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const errors: string[] = []; page.on('pageerror',e=>errors.push(e.message));
    let count = 0;
    for (const [name,width,isLong,duplicate] of [['desktop',1280,false,false],['long-details',1280,true,false],['mobile',390,true,false],['custom-instructions',1280,false,true]] as const) {
      long=isLong; duplicateInstruction=duplicate;
      await page.setViewport({width,height:1000,deviceScaleFactor:1});
      await page.emulateMediaType('screen');
      await page.goto('http://127.0.0.1:'+address.port,{waitUntil:'networkidle0'});
      await page.type('#input-slip-cnic',cnic); await page.click('#btn-search-slip');
      await page.waitForFunction(()=>!!document.querySelector('img[alt="Candidate Biometric QR Code"]') && !(document.querySelector('#btn-print-slip') as HTMLButtonElement)?.disabled);
      assert.equal(await page.$$eval('.roll-slip-instructions li', (els,text)=>els.filter(el=>el.textContent?.includes(text)).length,instruction),1);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
      if(output) {fs.mkdirSync(output,{recursive:true}); await (await page.$('.roll-number-slip'))!.screenshot({path:path.join(output,name+'-screen.png')});}
      await page.emulateMediaType('print');
      const layout = await page.evaluate(()=>{
        return {photo:document.querySelector('.roll-slip-photo')!.getBoundingClientRect().toJSON(),details:document.querySelector('.roll-slip-particulars')!.getBoundingClientRect().toJSON(),qr:document.querySelector('.roll-slip-qr')!.getBoundingClientRect().toJSON(),slip:document.querySelector('.roll-number-slip')!.getBoundingClientRect().toJSON(),footer:document.querySelector('.roll-slip-footer')!.getBoundingClientRect().toJSON(),header: getComputedStyle(document.querySelector('body > header')!).display};
      });
      assert.equal(layout.header,'none');
      assert(Math.abs(layout.photo.top-layout.details.top)<2 && Math.abs(layout.qr.top-layout.details.top)<2,'Print keeps all three columns aligned');
      assert(layout.footer.bottom<=layout.slip.bottom,'Footer stays inside slip');
      for(const background of [true,false]) {
        const pdf=Buffer.from(await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:background,displayHeaderFooter:true,headerTemplate:'<span style="font-size:8px">Print preview</span>',footerTemplate:'<span style="font-size:8px" class="pageNumber"></span>'}));
        assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1,name+' has one A4 page');
        if(output) fs.writeFileSync(path.join(output,name+(background?'':'-no-background')+'.pdf'),pdf);
        count++;
      }
      console.log('PASS '+name+': single A4 page with browser headers, three-column print layout, instruction once, no screen overflow');
    }
    assert.deepEqual(errors,[]);
    console.log('ROLL_SLIP_PRINT_LAYOUT_PASS=4 PDF_PAGE_CHECKS='+count+' FAIL=0');
  } finally {await browser.close(); await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
