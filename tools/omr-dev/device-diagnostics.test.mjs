import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {localAcceptanceOrigin,attestSession,signDeviceEvent,verifiedDeviceEvents,joinDeviceEvidence,captureObserverSource,validateRetakeNote,privateSessionDirectory} from './device-diagnostics.mjs';
import path from 'node:path';
test('device diagnostics refuse production, LAN and credential-bearing API origins',()=>{
 assert.equal(localAcceptanceOrigin('http://127.0.0.1:5055'),'http://127.0.0.1:5055');
 for(const url of ['https://azmaio.com','http://192.168.1.1:5055','http://u:p@127.0.0.1:5055','http://127.0.0.1:5055/api','http://localhost:5055'])assert.throws(()=>localAcceptanceOrigin(url));
});
test('a different process/session cannot impersonate the disposable backend',async()=>{
 const server=createServer((_,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'different',pid:1,scope:'DISPOSABLE_SYNTHETIC_ONLY',officialScoringAllowed:false,publicationAllowed:false}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await assert.rejects(()=>attestSession({apiOrigin:`http://127.0.0.1:${server.address().port}`,scope:'DISPOSABLE_SYNTHETIC_ONLY',id:'expected',pid:1,nonce:'a'.repeat(64)}),/does not match/);}
 finally{await new Promise(resolve=>server.close(resolve));}
});
test('signed device evidence rejects tampering and cross-session reuse',()=>{
 const nonce='a'.repeat(64),event={sessionId:'one',type:'CAPTURE',sha256:'b'.repeat(64)};
 const signed=signDeviceEvent(event,nonce);assert.deepEqual(verifiedDeviceEvents([signed],nonce,'one'),[event]);
 assert.throws(()=>verifiedDeviceEvents([{...signed,event:{...event,type:'DEVICE_ATTESTED'}}],nonce,'one'));
 assert.throws(()=>verifiedDeviceEvents([signed],nonce,'two'));
});
test('API uploads and simulated camera tests never become physical device acceptance',()=>{
 const samples=[{sourceSha256:'one',status:'REVIEW_REQUIRED',mapped:true,qrDecoded:true}];
 const events=[{sessionId:'s',type:'DEVICE_ATTESTED',physicalAndroid:false},{sessionId:'s',type:'UPLOAD_ACCEPTED',sha256:'one',status:202}];
 const result=joinDeviceEvidence(samples,events);assert.equal(result.deviceObserved,false);assert.equal(result.uniqueMatchedScans,0);assert.equal(result.questionAccuracy,null);assert.equal(result.scanSuccessRate,null);
});
test('hardware metrics count only matched terminal scans and independent labels',()=>{
 const samples=[{sourceSha256:'one',status:'REVIEW_REQUIRED',mapped:true,qrDecoded:false,independentAccuracy:{judged:100,correct:99,acceptedJudged:70,falseAccepted:1}},{sourceSha256:'two',status:'FAILED',mapped:false},{sourceSha256:'unrelated',status:'REVIEW_REQUIRED',mapped:true}];
 const events=[{sessionId:'s',type:'DEVICE_ATTESTED',physicalAndroid:true},{sessionId:'s',type:'UPLOAD_ACCEPTED',sha256:'one',status:202},{sessionId:'s',type:'UPLOAD_ACCEPTED',sha256:'two',status:202}];
 const result=joinDeviceEvidence(samples,events);assert.equal(result.uniqueMatchedScans,2);assert.equal(result.scanSuccessRate,.5);assert.equal(result.questionAccuracy,.99);assert.equal(result.falseAcceptanceRate,1/70);
});
test('observer is parseable and contains no key, identity or credential collection',()=>{
 const script=captureObserverSource('http://127.0.0.1:5055');new Function(script);
 assert.doesNotMatch(script,/accessToken|refreshToken|Authorization|document\.body\.innerText|localStorage|sessionStorage/);
});
test('retakes require a new source hash and never become independent answer labels',()=>{
 const sha='a'.repeat(64),note={sample:'D001',retakeOf:'S10',sourceSha256:sha};
 assert.throws(()=>validateRetakeNote(note,sha,{S10:sha}),/old rejected/);
 assert.throws(()=>validateRetakeNote({...note,retakeOf:'S01'},sha));
 assert.throws(()=>validateRetakeNote(note,'b'.repeat(64)));
 const value=validateRetakeNote(note,sha,{S10:'b'.repeat(64)});assert.equal(value.newSourceHashConfirmed,true);assert.equal(value.independentAnswerValidation,false);
});
test('a private manifest cannot redirect device evidence outside its session folder',()=>{
 const root=path.resolve('tmp/omr-reference/device-acceptance'),id='12345678-1234-1234-1234-123456789abc';
 assert.equal(privateSessionDirectory({id,folder:path.join(root,id)},root),path.join(root,id));
 assert.throws(()=>privateSessionDirectory({id,folder:path.resolve('outside')},root));
 assert.throws(()=>privateSessionDirectory({id:'../../outside',folder:path.resolve('outside')},root));
});
