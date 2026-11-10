import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {generateSheet} from './generate-sheet';
import {startDeviceAcceptance} from './device-acceptance';
import {attestSession} from './device-diagnostics.mjs';
const require=createRequire(import.meta.url);
test('device acceptance starts a nonce-attested disposable API and preserves original evidence separately from predictions',{timeout:180000,skip:!existsSync('tmp/omr-dev/release/azm-omr-reliability-965c4ff.apk')?'Requires the privately retained verified APK; run locally after artifact verification':false},async()=>{
 const image=await generateSheet('synthetic-device-acceptance.png',{missingQr:true,uncertainVersion:true});
 const session=await startDeviceAcceptance({apiPort:0,workerEnabled:false});
 try{
  assert.equal(await attestSession(session.state),session.state.apiOrigin);
  assert.equal((await fetch(session.state.apiOrigin+'/__omr-device-session')).status,403);
  assert.equal((await fetch(session.state.apiOrigin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@omr.test',password:'Synthetic-Omr-Only-2026!'})})).status,403,'Fixture credentials alone must not expose private scans');
  const preflight=await fetch(session.state.apiOrigin+'/api/auth/login',{method:'OPTIONS',headers:{Origin:'https://localhost','Access-Control-Request-Headers':'content-type,x-omr-device-session'}});assert.equal(preflight.status,204);assert.match(preflight.headers.get('access-control-allow-headers')||'',/X-OMR-Device-Session/);
  const request=async(route:string,token:string,method='GET',body?:unknown,raw=false)=>{
   const response=await fetch(session.state.apiOrigin+route,{method,headers:{'X-OMR-Device-Session':session.state.nonce,...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':raw?'image/png':'application/json'}:{})},body:body?(raw?body as BodyInit:JSON.stringify(body)):undefined});return {status:response.status,data:(await response.json()).data};
  };
  const admin=(await request('/api/auth/login','','POST',{email:'admin@omr.test',password:'Synthetic-Omr-Only-2026!'})).data.accessToken;
  const superAdmin=(await request('/api/auth/login','','POST',{email:'super@omr.test',password:'Synthetic-Omr-Only-2026!'})).data.accessToken;
  const upload=await request('/api/omr/exams/synthetic-omr-exam/batches?source=mobile',admin,'POST',await fs.readFile(image),true);assert.equal(upload.status,202);
  await session.dev.tick();await session.dev.tick();await session.dev.tick();
  const batch=(await request('/api/omr/batches/'+upload.data.id,admin)).data,id=batch.items[0].scan.id;
  const report=await session.snapshot();assert.equal(report.counts.mapped,1);assert.equal(report.device.scanSuccessRate,null);assert.equal(report.device.deviceObserved,false);assert.equal(report.device.independentlyLabeledSheets,0);
  const sample=report.samples[0];assert.equal(sample.diagnostics.width>600,true);assert.equal(sample.diagnostics.qrCropAvailable,true);assert.equal(sample.diagnostics.qrPayloadDecoded,false);assert.equal(sample.independentAccuracy,null);
  const original=path.join(session.state.folder,'originals/D001.png'),blind=path.join(session.state.folder,'blind-originals/D001.png');
  assert.deepEqual(await fs.readFile(original),await fs.readFile(image));assert.deepEqual(await fs.readFile(blind),await fs.readFile(image));
  assert.equal((await fs.readdir(path.join(session.state.folder,'independent-labels'))).length,0);
  const review=await request('/api/omr/scans/'+id+'/review',admin,'PATCH',{reason:'Automated synthetic acceptance fixture, not human validation',identityLookup:'SYNTHETIC-APP-0001',printedRollNumber:'SYNTHETIC-OMR-0001',identityConfirmed:true,examConfirmed:true,paperVersion:'A',answers:[]});assert.equal(review.status,200);
  const reviewed=(await request('/api/omr/scans/'+id,admin)).data;assert.equal(reviewed.results[0].status,'DRAFT');assert.equal(Number(reviewed.results[0].score),100);
  await session.snapshot();assert.ok((await fs.readdir(path.join(session.state.folder,'revisions'))).length>=2);
  assert.equal((await request('/api/omr/exams/synthetic-omr-exam/publish',superAdmin,'POST',{reason:'Acceptance fixture publication must remain locked',resultIds:[reviewed.results[0].id]})).status,409);
  const {prisma}=require('../../backend/src/lib/prisma.ts');const stored=await prisma.omrScan.findUniqueOrThrow({where:{id}});assert.equal(stored.rawDetection.officialScoringAllowed,false);
 }finally{await session.stop();}
 assert.equal(JSON.parse(await fs.readFile(path.join(session.state.folder,'closed.json'),'utf8')).databaseDestroyed,true);
});
