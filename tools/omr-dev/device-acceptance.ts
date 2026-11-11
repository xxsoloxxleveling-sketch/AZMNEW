/** Private device acceptance harness. No production URL or external database input. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startDevelopment} from './start';
import {verifiedDeviceEvents,joinDeviceEvidence,validateRetakeNote} from './device-diagnostics.mjs';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const ACCEPTANCE_APK_SHA='639ddfddb9e65b3596745091b85054b1cac1a3f85f83a60c7a257ddfd62f2182';
export const acceptanceRoot=path.join(root,'tmp/omr-reference/device-acceptance');
const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
async function privateJson(filename:string,value:unknown){await fs.writeFile(filename,JSON.stringify(value,null,2)+'\n',{mode:0o600});}
async function privateRevision(filename:string,value:unknown){const data=JSON.stringify(value,null,2)+'\n',old=await fs.readFile(filename,'utf8').catch(()=>null);if(old!==null){if(old!==data)throw Error('A preserved evidence revision was changed');return;}await fs.writeFile(filename,data,{flag:'wx',mode:0o600});}

export function acceptanceCounts(records:Array<{status:string;rawDetection?:any;responses?:any[];paperVersion?:string|null;identityVerified?:boolean}>) {
  const terminal=records.filter(r=>!['QUEUED','PROCESSING'].includes(r.status));
  const mapped=terminal.filter(r=>r.responses?.length===100);
  return {uniqueScans:records.length,terminal:terminal.length,mapped:mapped.length,mappingSuccessRate:terminal.length?mapped.length/terminal.length:null,rejected:terminal.filter(r=>r.status==='INVALID').length,workerFailed:terminal.filter(r=>r.status==='FAILED').length,qrPayloadsDecoded:mapped.filter(r=>!!r.rawDetection?.identity||!!r.rawDetection?.qrEnvelope).length,qrDenominator:mapped.length,uncertainAnswers:mapped.reduce((sum,r)=>sum+r.responses!.filter(x=>x.detectedAnswer==='UNCERTAIN').length,0),unresolvedVersions:mapped.filter(r=>!r.paperVersion).length,identityVerified:mapped.filter(r=>r.identityVerified).length,independentAccuracy:null,physicalDeviceSuccessRate:null};
}

export async function assertAcceptanceIsolation(prisma:any){
  if(process.env.OMR_SYNTHETIC_ENVIRONMENT!=='1'||process.env.NODE_ENV==='production')throw Error('Disposable synthetic environment required');
  const url=new URL(process.env.DATABASE_URL||'');if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('Database must be disposable loopback');
  const role=await prisma.$queryRawUnsafe('SELECT current_user');if(role[0]?.current_user!=='azm_app_dml')throw Error('Restricted role required');
  if(await prisma.student.count({where:{NOT:{id:{startsWith:'synthetic-'}}}}))throw Error('Non-synthetic student detected; acceptance stopped');
  if(await prisma.omrAnswerKeyRevision.count({where:{isSynthetic:false}}))throw Error('Non-synthetic key detected; acceptance stopped');
  const {officialActivation}=require('../../backend/src/modules/omr/activation.ts');if(officialActivation().approved)throw Error('Official activation must remain disabled');
  const {r2Storage}=require('../../backend/src/lib/r2Storage.ts');if(r2Storage.configured)throw Error('Acceptance evidence must not use cloud storage');
  if(await prisma.omrExamResult.count({where:{status:'PUBLISHED'}}))throw Error('Published result detected; acceptance stopped');
}

export async function startDeviceAcceptance(options:{apiPort?:number;workerEnabled?:boolean;publishCurrent?:boolean}={}){
  if(process.env.NODE_ENV==='production')throw Error('Device acceptance cannot run in production');
  const apk=path.join(root,'tmp/omr-dev/release/azm-omr-confidence-3dc8522.apk');
  if(hash(await fs.readFile(apk))!==ACCEPTANCE_APK_SHA)throw Error('Verified current APK missing or checksum mismatch; do not install another build');
  const id=randomUUID(),folder=path.join(acceptanceRoot,id),nonce=randomBytes(32).toString('hex');
  for(const child of ['private','observations','originals','uploads','blind-originals','independent-labels','diagnostics','revisions'])await fs.mkdir(path.join(folder,child),{recursive:true,mode:0o700});
  const dev=await startDevelopment({...options,privateDirectory:path.join(folder,'private'),deviceSession:{id,nonce}});
  const {prisma}=require('../../backend/src/lib/prisma.ts');let closed=false,snapshotBusy=false,snapshotJob:Promise<unknown>=Promise.resolve();
  const state={id,pid:process.pid,apiOrigin:dev.url,nonce,apk,apkSha256:ACCEPTANCE_APK_SHA,folder,scope:'DISPOSABLE_SYNTHETIC_ONLY',purpose:options.publishCurrent?'OPERATOR_DEVICE_ACCEPTANCE':'AUTOMATED_API_CHECK',createdAt:new Date().toISOString()};
  const aliases=new Map<string,string>(),batchAliases=new Map<string,string>();
  const snapshot=async()=>{
    await assertAcceptanceIsolation(prisma);
    const scans=await prisma.omrScan.findMany({orderBy:[{createdAt:'asc'},{id:'asc'}],include:{responses:{orderBy:{question:'asc'}},corrections:{orderBy:{createdAt:'asc'}},results:true}});
    const {readPrivate}=require('../../backend/src/modules/omr/storage.ts');const evidence=[];
    const batches=await prisma.omrScanBatch.findMany({orderBy:[{createdAt:'asc'},{id:'asc'}],include:{items:true}});
    for(const batch of batches){
      if(!batchAliases.has(batch.id))batchAliases.set(batch.id,'B'+String(batchAliases.size+1).padStart(3,'0'));
      const alias=batchAliases.get(batch.id),bytes=await readPrivate(batch.originalObjectKey),sha=hash(bytes);
      if(sha!==batch.fileHash)throw Error('Uploaded original source hash mismatch');
      const extension=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes.subarray(0,4).toString()==='%PDF'?'pdf':'jpg';
      const target=path.join(folder,'uploads',alias+'.'+extension),old=await fs.readFile(target).catch(()=>null);
      if(old&&hash(old)!==sha)throw Error('Preserved upload cannot be replaced');if(!old)await fs.writeFile(target,bytes,{flag:'wx',mode:0o600});
      const revision=hash(JSON.stringify(batch));await privateRevision(path.join(folder,'revisions',alias+'-'+revision+'.json'),batch);
    }
    const notes=await fs.readFile(path.join(folder,'retake-notes.json'),'utf8').then(JSON.parse,()=>[]);
    const frozen=await fs.readFile(path.join(root,'tmp/omr-reference/physical-validation/frozen-validation.json'),'utf8').then(JSON.parse,()=>null);
    const baselineHashes=Object.fromEntries(['S10','S11','S14','S16','S17','S18','S24'].map(sample=>[sample,frozen?.sourceHashes?.[Number(sample.slice(1))-1]]));
    for(let i=0;i<scans.length;i++){
      const scan=scans[i];if(!aliases.has(scan.id))aliases.set(scan.id,'D'+String(aliases.size+1).padStart(3,'0'));const sample=aliases.get(scan.id)!;
      const raw=scan.rawDetection||{status:scan.status,officialScoringAllowed:false};
      const observation=path.join(folder,'observations',sample+'.json');await privateJson(observation,raw);
      const bytes=await readPrivate(scan.originalObjectKey),sha=hash(bytes);
      if(sha!==scan.fileHash)throw Error('Original source hash mismatch');
      const extension=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes.subarray(0,4).toString()==='%PDF'?'pdf':'jpg';
      const original=path.join(folder,'originals',sample+'.'+extension),blind=path.join(folder,'blind-originals',sample+'.'+extension);
      for(const target of [original,blind]){
        const old=await fs.readFile(target).catch(()=>null);if(old&&hash(old)!==sha)throw Error('Preserved original cannot be replaced');
        if(!old)await fs.writeFile(target,bytes,{flag:'wx',mode:0o600});
      }
      const record={sample,sourceSha256:sha,scan,original:path.relative(folder,original),blindOriginal:path.relative(folder,blind)};
      const revision=hash(JSON.stringify(record));const revisionFile=path.join(folder,'revisions',sample+'-'+revision+'.json');
      await privateRevision(revisionFile,record);
      const diagnosticsPath=path.join(folder,'diagnostics',sample+'.json');let diagnostic:any=null;
      if(extension!=='pdf'){
        const labels=(await fs.readdir(path.join(folder,'independent-labels'))).filter(n=>n.endsWith('.json'));
        let matched:string|undefined;
        for(const label of labels){const file=path.join(folder,'independent-labels',label),value=JSON.parse(await fs.readFile(file,'utf8'));if(value.sourceSha256===sha){if(matched)throw Error('Duplicate independent labels for one source');matched=file;}}
        // Recompute only if the observation or label evidence changes.
        const labelHash=matched?hash(await fs.readFile(matched)):null;
        const previous=await fs.readFile(diagnosticsPath,'utf8').then(JSON.parse,()=>null);
        if(previous?.revision===revision&&previous?.labelHash===labelHash)diagnostic=previous;
        else{
          try{
            const args=[path.join(root,'tools/omr-dev/device-evidence.py'),original,observation,'--crop',path.join(folder,'diagnostics',sample+'-qr.png'),...(matched?['--labels',matched]:[])];
            const output=await promisify(execFile)(process.env.OMR_PYTHON!,args,{timeout:20000,windowsHide:true,maxBuffer:512*1024});
            diagnostic={...JSON.parse(output.stdout),revision,labelHash};
          }catch{diagnostic={revision,labelHash,diagnosticsFailed:true,independentAccuracy:null};}
          await privateJson(diagnosticsPath,diagnostic);
        }
      }
      const note=notes.find((value:any)=>value.sample===sample),retake=note?validateRetakeNote(note,sha,baselineHashes):null;
      evidence.push({sample,scanId:scan.id,sourceSha256:sha,imageSource:extension!=='pdf',status:scan.status,errorCode:scan.errorCode,mapped:scan.responses.length===100,qrDecoded:!!raw.identity||!!raw.qrEnvelope,version:scan.paperVersion,identityVerified:scan.identityVerified,privateDrafts:scan.results.filter((r:any)=>r.status==='DRAFT').length,corrections:scan.corrections.length,uploadToProcessedMs:scan.processedAt?new Date(scan.processedAt).getTime()-new Date(scan.createdAt).getTime():null,independentAccuracy:diagnostic?.independentAccuracy||null,diagnostics:diagnostic,retake,physicalDeviceCaptureObserved:false});
    }
    const deviceLines=await fs.readFile(path.join(folder,'device-events.jsonl'),'utf8').catch(()=>'');
    const deviceEvents=verifiedDeviceEvents(deviceLines.split('\n').filter(Boolean),nonce,id);
    const device=joinDeviceEvidence(evidence,deviceEvents);
    for(const sample of evidence){
      const upload=device.deviceObserved&&deviceEvents.some((e:any)=>e.type==='UPLOAD_ACCEPTED'&&e.status===202&&e.sha256===sample.sourceSha256);
      (sample as any).physicalDeviceUploadObserved=upload;
      sample.physicalDeviceCaptureObserved=!!upload&&deviceEvents.some((e:any)=>e.type==='CAPTURE'&&['sensor-still','video-frame'].includes(e.captureSource)&&e.sha256===sample.sourceSha256);
      (sample as any).reviewDisplayed=!!upload&&deviceEvents.some((e:any)=>e.type==='REVIEW_DISPLAYED'&&e.scanId===sample.scanId&&e.responseRows===100);
      const accepted=deviceEvents.find((e:any)=>e.type==='UPLOAD_ACCEPTED'&&e.sha256===sample.sourceSha256&&e.status===202);
      const terminal=accepted&&deviceEvents.find((e:any)=>e.type==='PROCESSING_STATUS'&&e.batchId===accepted.batchId&&['COMPLETE','FAILED'].includes(e.status)&&e.contextId===accepted.contextId&&e.monotonicMs>=accepted.monotonicMs);
      (sample as any).observedUploadToTerminalMs=terminal?accepted.durationMs+terminal.monotonicMs-accepted.monotonicMs:null;
    }
    const report={sessionId:id,scope:state.scope,updatedAt:new Date().toISOString(),apkSha256:ACCEPTANCE_APK_SHA,counts:{...acceptanceCounts(scans),uploadBatches:batches.length,duplicateItems:batches.reduce((n:number,b:any)=>n+b.items.filter((v:any)=>v.status==='DUPLICATE').length,0)},batches:batches.map((b:any)=>({sample:batchAliases.get(b.id),status:b.status,errorCode:b.errorCode,items:b.items.map((v:any)=>({status:v.status,errorCode:v.errorCode,scanSample:aliases.get(v.scanId)||null}))})),samples:evidence,device,deviceAcceptance:device.deviceObserved?'IN_PROGRESS_REQUIRES_CHECKLIST_REVIEW':'NOT_RUN_NO_ATTESTED_DEVICE',officialScoringAllowed:false,publicationAllowed:false};
    await privateJson(path.join(folder,'private-report.json'),report);
    await privateJson(path.join(folder,'sample-index.json'),[...aliases].map(([scanId,sample])=>({scanId,sample})));
    await privateJson(path.join(folder,'blind-originals','source-map.json'),evidence.filter(e=>e.imageSource).sort((a,b)=>a.sample.localeCompare(b.sample)).map((e,i)=>({blindSample:'S'+String(i+1).padStart(2,'0'),sample:e.sample,sourceSha256:e.sourceSha256})));
    return report;
  };
  try{await assertAcceptanceIsolation(prisma);await privateJson(path.join(folder,'session.json'),state);if(options.publishCurrent)await privateJson(path.join(acceptanceRoot,'current-session.json'),state);await snapshot();}
  catch(error){await dev.stop();throw error;}
  const stop=async()=>{if(closed)return;closed=true;await snapshotJob.catch(()=>{});let finalSnapshotSaved=false;try{await snapshot();finalSnapshotSaved=true;}finally{await dev.stop();await privateJson(path.join(folder,'closed.json'),{closedAt:new Date().toISOString(),databaseDestroyed:true,finalSnapshotSaved});}};
  return {state,snapshot,stop,dev,periodicSnapshot:()=>{if(snapshotBusy)return snapshotJob;snapshotBusy=true;snapshotJob=snapshot().finally(()=>{snapshotBusy=false;});return snapshotJob;}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const session=await startDeviceAcceptance({publishCurrent:true});
  console.log('Disposable Android acceptance API:',session.state.apiOrigin);console.log('Private evidence folder:',session.state.folder);console.log('APK checksum verified; official scoring/publication locked. Device tests are NOT RUN.');
  let stopping=false;const timer=setInterval(()=>{void session.periodicSnapshot().catch(async(error)=>{await privateJson(path.join(session.state.folder,'guard-failure.json'),{at:new Date().toISOString(),phase:'acceptanceSnapshot',errorName:error?.name||'Error',code:typeof error?.code==='string'?error.code:null,message:String(error?.message||'Snapshot failed')}).catch(()=>{});console.error('Acceptance evidence or isolation check failed; stopping test API. Private cause recorded in guard-failure.json.');void close();});},5000);
  async function close(){if(stopping)return;stopping=true;clearInterval(timer);try{await session.stop();console.log('Final evidence snapshot saved; disposable database destroyed.');process.exit(0);}catch{console.error('Final snapshot incomplete; previously archived originals/revisions remain private. Check closed.json before treating the session as complete.');process.exit(1);}}
  process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
}
