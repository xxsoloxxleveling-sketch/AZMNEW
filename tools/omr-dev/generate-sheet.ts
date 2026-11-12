import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pdfService } from '../../backend/src/modules/documents/pdf.service';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(path.join(root,'backend/package.json'));
export async function generateSheet(filename=`synthetic-${randomUUID()}.png`,options:{pdfPages?:number;missingQr?:boolean;uncertainVersion?:boolean}={}) {
  if(options.pdfPages!==undefined&&(!Number.isInteger(options.pdfPages)||options.pdfPages<1||options.pdfPages>25))throw new Error('Use 1–25 fabricated PDF pages');
  const puppeteer=require('puppeteer'),qr=require('qrcode');
  let bundled:string|undefined;try{bundled=await puppeteer.executablePath();}catch{}
  const candidates=[process.env.OMR_CHROME_PATH,process.env.PUPPETEER_EXECUTABLE_PATH,
    path.join(process.env.ProgramFiles||'C:/Program Files','Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Google/Chrome/Application/chrome.exe'),
    bundled].filter(Boolean) as string[];
  let executablePath:string|undefined;for(const candidate of candidates)if(await fs.stat(candidate).then(()=>true,()=>false)){executablePath=candidate;break;}
  if(!executablePath)throw new Error('Set OMR_CHROME_PATH to an installed Chrome/Chromium executable for synthetic sheet rendering');
  const identity={type:'AZM_OMR',session:'2026-V',studentId:'synthetic-omr-candidate',applicationNo:'SYNTHETIC-APP-0001',rollNumber:'SYNTHETIC-OMR-0001',rollType:'OFFICIAL',sheetVersion:2};
  const student={id:identity.studentId,applicationNo:identity.applicationNo,rollNumber:identity.rollNumber,fullName:'SYNTHETIC OMR CANDIDATE',fatherName:'SYNTHETIC GUARDIAN',cnicOrBForm:'SYNTHETIC-IDENTITY',currentClass:'Class 6th',placementStatus:'ASSIGNED',assignedHallId:'synthetic-hall',assignedHall:'Synthetic examination hall',testCenterName:'Synthetic test center',assignedRoom:'Synthetic room',seatNo:'SYNTHETIC-1',testDate:'15 November 2026',reportingTime:'09:00 AM'};
  const html=pdfService.generateOmrSheetHtml(student,await qr.toDataURL(JSON.stringify(identity),{errorCorrectionLevel:'M',margin:1,width:384}));
  const browser=await puppeteer.launch({headless:true,executablePath});
  try {
    const page=await browser.newPage();await page.setViewport({width:794,height:1124,deviceScaleFactor:2.5});
    await page.setRequestInterception(true);page.on('request',(request:any)=>{if(/^(data:|about:)/.test(request.url()))void request.continue();else void request.abort();});
    await page.setContent(html,{waitUntil:'load'});
    await page.evaluate((options:{missingQr?:boolean;uncertainVersion?:boolean})=>{document.querySelectorAll('.omr-row').forEach(row=>{const bubble=row.querySelector<HTMLElement>('.bubble');if(bubble){bubble.style.background='#000';bubble.style.color='#000';}});const version=document.querySelector<HTMLElement>('.v-bubble');if(version)version.style.background=options.uncertainVersion?'#888':'#000';if(options.missingQr)document.querySelector('.qr-box img')?.remove();},options);
    const target=path.join(root,'tmp/omr-dev',filename);await fs.mkdir(path.dirname(target),{recursive:true});
    if(options.pdfPages) {
      await page.evaluate((count:number)=>{const sheet=document.querySelector<HTMLElement>('.omr-page')!;sheet.style.breakAfter='page';for(let number=1;number<count;number++)sheet.parentElement!.appendChild(sheet.cloneNode(true));},options.pdfPages);
      await page.pdf({path:target,format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:0,bottom:0,left:0,right:0}});
    } else await (await page.$('.omr-page'))!.screenshot({path:target});
    return target;
  } finally {await browser.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(await generateSheet('synthetic-clean.png'));
