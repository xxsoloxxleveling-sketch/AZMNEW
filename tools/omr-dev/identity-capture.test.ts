import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {startDevelopment} from './start';
import {generateSheet} from './generate-sheet';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));

test('real close-up decoder binds private evidence to its source without assigning identity or changing answers',{timeout:180000},async()=>{
 const file=await generateSheet('synthetic-identity-detail-source.png',{missingQr:true});
 const dev=await startDevelopment({apiPort:0,workerEnabled:false});
 try{
  const request=async(route:string,token='',method='GET',body?:unknown,raw=false)=>{
   const response=await fetch(dev.url+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':raw?'image/png':'application/json'}:{})},body:body?(raw?body as BodyInit:JSON.stringify(body)):undefined});return {status:response.status,payload:await response.json()};
  };
  const login=async(email:string)=>(await request('/api/auth/login','','POST',{email,password:'Synthetic-Omr-Only-2026!'})).payload.data.accessToken;
  const admin=await login('admin@omr.test'),teacher=await login('teacher@omr.test');
  const upload=await request('/api/omr/exams/synthetic-omr-exam/batches',admin,'POST',await fs.readFile(file),true);assert.equal(upload.status,202);
  await dev.tick();await dev.tick();await dev.tick();
  const id=(await request('/api/omr/batches/'+upload.payload.data.id,admin)).payload.data.items[0].scan.id;
  const original=(await request('/api/omr/scans/'+id,admin)).payload.data;
  const {prisma}=require('./src/lib/prisma.ts');const before=await prisma.omrScan.findUniqueOrThrow({where:{id},include:{responses:true}});
  const candidate=await prisma.student.findUniqueOrThrow({where:{id:'synthetic-omr-candidate'}});
  const qr={type:'AZM_OMR',session:'2026-V',sheetVersion:2,rollType:'OFFICIAL',studentId:candidate.id,applicationNo:candidate.applicationNo,rollNumber:candidate.rollNumber};
  const bytes=await require('qrcode').toBuffer(JSON.stringify(qr),{width:600,margin:4});
  const route=`/api/omr/scans/${id}/identity-captures?originalSha256=${original.sourceSha256}`;
  assert.equal((await request(route,'','POST',bytes,true)).status,401);
  assert.equal((await request(route,teacher,'POST',bytes,true)).status,403);
  assert.equal((await request(route.replace(original.sourceSha256,'a'.repeat(64)),admin,'POST',bytes,true)).status,409);
  const detail=await request(route,admin,'POST',bytes,true);assert.equal(detail.status,201,JSON.stringify(detail.payload));
  assert.equal(detail.payload.data.qrDecoded,true);assert.equal(detail.payload.data.rosterMatched,true);assert.equal(detail.payload.data.identityVerified,false);
  assert.equal(detail.payload.data.canPrefill,!!original.printedRollNumber);
  const other={...candidate,id:'synthetic-other-candidate',applicationNo:'SYNTHETIC-APP-0002',rollNumber:'SYNTHETIC-OMR-0002',qrToken:'synthetic-other-qr-token',cnicOrBForm:'SYNTHETIC-OTHER-IDENTITY'};
  await prisma.student.create({data:other});
  const wrongBytes=await require('qrcode').toBuffer(JSON.stringify({...qr,studentId:other.id,applicationNo:other.applicationNo,rollNumber:other.rollNumber}),{width:600,margin:4});
  const wrong=await request(route,admin,'POST',wrongBytes,true);assert.equal(wrong.status,201);assert.equal(wrong.payload.data.canPrefill,false);assert.equal(wrong.payload.data.identityVerified,false);assert.equal(wrong.payload.data.status,'ORIGINAL_CONFIRMATION_REQUIRED');
  const after=await prisma.omrScan.findUniqueOrThrow({where:{id},include:{responses:true,corrections:true}});
  assert.equal(after.studentId,null);assert.equal(after.identityVerified,false);assert.deepEqual(after.rawDetection,before.rawDetection);assert.deepEqual(after.responses,before.responses);assert.equal(await prisma.omrExamResult.count(),0);
  const evidence=after.corrections.find((c:any)=>c.id===detail.payload.data.id);assert.equal(evidence.next.originalSha256,original.sourceSha256);assert.equal(evidence.next.pageIndex,before.pageIndex);
  const {readPrivate}=await import('../../backend/src/modules/omr/storage');assert.deepEqual(await readPrivate(evidence.next.objectKey),bytes);
  const imageUrl=dev.url+`/api/omr/scans/${id}/identity-captures/${detail.payload.data.id}/image`;
  assert.equal((await fetch(imageUrl)).status,401);
  assert.equal((await fetch(imageUrl,{headers:{Authorization:'Bearer '+teacher}})).status,403);
  const imageResponse=await fetch(imageUrl,{headers:{Authorization:'Bearer '+admin}});assert.equal(imageResponse.status,200);assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()),bytes);
  const {IdentityCaptureService}=await import('../../backend/src/modules/omr/identity-capture');let analyzed=0;
  let ready:()=>void=()=>{},release:()=>void=()=>{};const started=new Promise<void>(resolve=>ready=resolve),held=new Promise<void>(resolve=>release=resolve);
  const captures=new IdentityCaptureService(prisma,async()=>{analyzed++;
   if(analyzed===1){ready();await held;throw new Error('Synthetic decode timeout');}
   if(analyzed===2)return {qrDecoded:true,qrPayload:qr,printedRollNumber:other.rollNumber,rollStatus:'READ_UNVERIFIED',width:600,height:600};
   return {qrDecoded:true,qrPayload:{type:'AZM_OMR_SIGNED',payload:'invalid',signature:'0'.repeat(64)},printedRollNumber:null,rollStatus:'ROLL_UNREADABLE',width:600,height:600};
  });
  const pending=captures.capture({id:'synthetic-admin',role:'ADMIN'},id,original.sourceSha256,bytes);await started;
  await assert.rejects(captures.capture({id:'synthetic-admin',role:'ADMIN'},id,original.sourceSha256,bytes),/already being read/);release();assert.equal((await pending).status,'DETAIL_PROCESSING_FAILED');
  for(const expected of ['CONFLICTING_DETAIL','UNSUPPORTED_QR']){
   const receipt=await captures.capture({id:'synthetic-admin',role:'ADMIN'},id,original.sourceSha256,bytes);assert.equal(receipt.status,expected);assert.equal(receipt.canPrefill,false);assert.equal(receipt.identityVerified,false);
  }
  await assert.rejects(captures.capture({id:'synthetic-admin',role:'ADMIN'},id,original.sourceSha256,bytes),/Five close-ups/);assert.equal(analyzed,3);
  assert.equal((await request('/api/omr/scans/'+id+'/approve',admin,'POST',{reason:'Synthetic detail evidence cannot authorize verification'})).status,409);
  await prisma.omrScan.update({where:{id},data:{status:'INVALID'}});
  assert.equal((await request(route,admin,'POST',bytes,true)).status,409,'An invalid full-sheet photograph must remain rejected');
 }finally{await dev.stop();}
});
