import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {startDevelopment} from './start';
import {generateSheet} from './generate-sheet';
const require=createRequire(import.meta.url);

test('missing QR and ambiguous version require authorized roster/version review before private draft grading',{timeout:180000},async()=>{
  const image=await generateSheet('synthetic-reliability-review.png',{missingQr:true,uncertainVersion:true});
  const dev=await startDevelopment({apiPort:0,workerEnabled:false});
  try{
    const request=async(path:string,token:string,method='GET',body?:unknown,raw=false)=>{
      const response=await fetch(dev.url+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':raw?'image/png':'application/json'}:{})},body:body?(raw?body as BodyInit:JSON.stringify(body)):undefined});
      const value=await response.json();return {status:response.status,data:value.data,error:value.error};
    };
    const login=async(email:string)=>(await request('/api/auth/login','','POST',{email,password:'Synthetic-Omr-Only-2026!'})).data.accessToken;
    const teacher=await login('teacher@omr.test'),admin=await login('admin@omr.test'),superAdmin=await login('super@omr.test');
    const exam='synthetic-omr-exam';
    const upload=await request(`/api/omr/exams/${exam}/batches?source=mobile`,teacher,'POST',await fs.readFile(image),true);assert.equal(upload.status,202);
    await dev.tick();await dev.tick();await dev.tick();
    const batch=(await request(`/api/omr/batches/${upload.data.id}`,teacher)).data,id=batch.items[0].scan.id;
    const initial=(await request(`/api/omr/scans/${id}`,admin)).data;
    assert.equal(initial.status,'REVIEW_REQUIRED');assert.equal(initial.paperVersion,null);assert.equal(initial.identityVerified,false);assert.equal(initial.studentId,null);assert.equal(initial.responses.length,100);assert.equal(initial.results.length,0);
    assert.equal((await request(`/api/omr/scans/${id}/approve`,admin,'POST',{reason:'Synthetic unresolved version and identity must block verification'})).status,409);
    const review={reason:'Fabricated test only: authorized printed roster and version confirmation',identityLookup:'SYNTHETIC-APP-0001',printedRollNumber:'SYNTHETIC-OMR-0001',identityConfirmed:true,examConfirmed:true,paperVersion:'A',answers:[]};
    assert.equal((await request(`/api/omr/scans/${id}/review`,teacher,'PATCH',review)).status,403);
    assert.equal((await request(`/api/omr/scans/${id}/review`,admin,'PATCH',{...review,printedRollNumber:'WRONG-SYNTHETIC-ROLL'})).status,409);
    assert.equal((await request(`/api/omr/scans/${id}/review`,admin,'PATCH',review)).status,200);
    const detail=(await request(`/api/omr/scans/${id}`,admin)).data;
    assert.equal(detail.paperVersion,'A');assert.equal(detail.identityVerified,true);assert.equal(detail.results[0].status,'DRAFT');assert.equal(Number(detail.results[0].score),100);
    assert.ok(detail.corrections.some((x:any)=>x.next?.paperVersion==='A'));assert.ok(detail.corrections.some((x:any)=>x.next?.studentId==='synthetic-omr-candidate'));
    assert.equal((await request(`/api/omr/scans/${id}`,teacher)).data.results[0].score,undefined);
    const {prisma}=require('../../backend/src/lib/prisma.ts');const stored=await prisma.omrScan.findUniqueOrThrow({where:{id}});
    assert.equal((stored.rawDetection as any).paperVersion.answer,'UNCERTAIN','Review must not rewrite original version evidence');assert.equal((stored.rawDetection as any).officialScoringAllowed,false);
    assert.equal((await request(`/api/omr/exams/${exam}/publish`,superAdmin,'POST',{resultIds:[detail.results[0].id],reason:'Fabricated missing-QR fixture must never publish'})).status,409);
    assert.equal((await request('/api/results/search?query=SYNTHETIC-OMR-0001','')).status,404);
  }finally{await dev.stop();}
});
