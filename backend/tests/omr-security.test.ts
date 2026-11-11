import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash,createHmac } from 'node:crypto';
import { decodeIdentity,reconcileIdentity,candidateGroup,manualQrAgrees } from '../src/modules/omr/identity';
import { Prisma,PrismaClient } from '@prisma/client';
import { serial,evaluateDraft } from '../src/modules/omr/omr.service';
import { examInput } from '../src/modules/omr/omr.schema';
import { officialActivation,recognitionHashes } from '../src/modules/omr/activation';
import { recognitionEnvironment } from '../src/modules/omr/runner';
import { invalidCaptureCode } from '../src/modules/omr/capture-diagnostics';
import { fileType,storePrivate,readPrivate,MAX_UPLOAD } from '../src/modules/omr/storage';
const qr={type:'AZM_OMR',session:'2026-V',sheetVersion:2,rollType:'OFFICIAL',studentId:'synthetic-student',applicationNo:'SYNTHETIC-APP',rollNumber:'SYNTHETIC-ROLL'};
const student={id:qr.studentId,applicationNo:qr.applicationNo,rollNumber:qr.rollNumber,status:'ACTIVE',currentClass:'Class 6th',hsscGroup:null};
const exam={session:'2026-V',candidateGroup:candidateGroup(student)!};
test('physical rejection guidance distinguishes cropped pages from unsupported timing and ambiguous rows',()=>{
  assert.equal(invalidCaptureCode({reason:'timing_track_mismatch',layoutDiagnostics:{attempts:[{reason:'physical_page_cropped'},{reason:'physical_missing_or_ambiguous_markers'}]}}),'PAGE_CROPPED');
  assert.equal(invalidCaptureCode({reason:'registration_failed',layoutDiagnostics:{attempts:[{reason:'physical_row_ruler_mismatch'},{reason:'physical_four_headers_required'}]}}),'GRID_ALIGNMENT_FAILED');
  assert.equal(invalidCaptureCode({reason:'timing_track_mismatch'}),'PRINT_LAYOUT_MISMATCH');
  assert.equal(invalidCaptureCode({reason:'registration_failed'}),'PAGE_ALIGNMENT_FAILED');
  assert.equal(invalidCaptureCode({reason:'malformed_image',layoutDiagnostics:{attempts:'untrusted shape'}}),'INVALID_CAPTURE');
});
test('legacy identity requires every database identity field and eligibility to agree',()=>{
  assert.equal(reconcileIdentity(qr,student,exam),true);
  for(const change of [{studentId:'other'},{applicationNo:'other'},{rollNumber:'other'},{rollType:'PROVISIONAL'},{session:'other'},{sheetVersion:3}]) assert.equal(reconcileIdentity({...qr,...change},student,exam),false);
  assert.equal(reconcileIdentity(qr,{...student,status:'INACTIVE'},exam),false);
  assert.equal(reconcileIdentity(qr,{...student,currentClass:'Class 10th'},exam),false);
  assert.equal(reconcileIdentity(qr,null,exam),false);
  assert.equal(reconcileIdentity({...qr,examId:'other'},student,{...exam,id:'selected'}),false);
  assert.equal(reconcileIdentity({...qr,examId:'selected'},student,{...exam,id:'selected'}),true);
});
test('future signed QR envelope validates its signature and retains strict legacy reconciliation',()=>{
  const secret='synthetic-qr-signing-key-for-unit-tests-only';
  const payload=Buffer.from(JSON.stringify(qr)).toString('base64url');
  const signature=createHmac('sha256',secret).update(payload).digest('hex');
  assert.deepEqual(decodeIdentity({type:'AZM_OMR_SIGNED',payload,signature},secret),qr);
  assert.equal(decodeIdentity({type:'AZM_OMR_SIGNED',payload,signature:'0'.repeat(64)},secret),null);
  assert.equal(decodeIdentity({type:'AZM_OMR_SIGNED',payload,signature},'short'),null);
});
test('CV child environment excludes database, signing and storage credentials',()=>{
  const env=recognitionEnvironment();
  for(const name of ['DATABASE_URL','DIRECT_URL','JWT_ACCESS_SECRET','R2_SECRET_ACCESS_KEY','OMR_VALIDATION_SIGNING_KEY','OMR_TRUSTED_PDF_FIXTURE']) assert.equal(name in env,false);
  assert.equal(env.OMP_NUM_THREADS,'1');
});

test('conflicting QR recovery cannot become a missing-QR manual review bypass',()=>{
  assert.equal(manualQrAgrees({identity:null,qrDiagnostics:{reason:'CONFLICTING_QR'}},student,exam),false);
  assert.equal(manualQrAgrees({identity:null,qrDiagnostics:{reason:'QR_UNREADABLE'}},student,exam),true);
});
test('file signature, size and private scan reference checks reject spoofing and traversal',async()=>{
  assert.throws(()=>fileType(Buffer.from('fake image')),/PNG/);
  assert.throws(()=>fileType(Buffer.alloc(MAX_UPLOAD+1)),/20 MB/);
  await assert.rejects(()=>readPrivate('../outside.key'),/Invalid private/);
});
test('private development storage round trips only generated references',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'azm-omr-storage-test-'));
  const previous=process.env.OMR_PRIVATE_DIR; process.env.OMR_PRIVATE_DIR=root;
  try {
    const bytes=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
    const key=await storePrivate(bytes); assert.match(key,/^omr\/[a-f0-9-]{36}\.png$/);
    assert.deepEqual(await readPrivate(key),bytes);
  } finally {
    if(previous===undefined) delete process.env.OMR_PRIVATE_DIR; else process.env.OMR_PRIVATE_DIR=previous;
    if(path.dirname(root)===path.resolve(os.tmpdir()) && path.basename(root).startsWith('azm-omr-storage-test-')) await fs.rm(root,{recursive:true,force:true});
  }
});
test('official activation fails closed and detects changed physical evidence',async()=>{
  const names=['OMR_VALIDATION_MANIFEST','OMR_VALIDATION_SIGNING_KEY','OMR_PHYSICAL_REPORT','OMR_WORKER_ROOT'];
  const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'azm-omr-activation-test-'));
  try {
    for(const name of names) delete process.env[name];
    assert.equal(officialActivation().approved,false);
    const report=path.join(root,'synthetic-report.json'),manifest=path.join(root,'manifest.json');
    const reportBytes=Buffer.from(JSON.stringify({fixture:'TEST_ONLY_NOT_PHYSICAL_APPROVAL'}));
    await fs.writeFile(report,reportBytes);
    const payload=Buffer.from(JSON.stringify({status:'PHYSICAL_VALIDATED',template:'AZM_OMR_V2_2026_V',...recognitionHashes(),reportSha256:createHash('sha256').update(reportBytes).digest('hex'),expiresAt:new Date(Date.now()+60000).toISOString(),approvedBy:'synthetic-release-actor'})).toString('base64url');
    const secret='synthetic-release-signing-key-for-unit-tests-only';
    await fs.writeFile(manifest,JSON.stringify({payload,signature:createHmac('sha256',secret).update(payload).digest('hex')}));
    Object.assign(process.env,{OMR_VALIDATION_MANIFEST:manifest,OMR_VALIDATION_SIGNING_KEY:secret,OMR_PHYSICAL_REPORT:report});
    assert.equal(officialActivation().approved,true);
    const scan={id:'synthetic-provisional-scan',studentId:student.id,identityVerified:true,paperVersion:'A',rawDetection:{identity:qr,physicalValidationRequired:true},responses:Array.from({length:100},(_,index)=>({question:index+1,detectedAnswer:'A',reviewedAnswer:null})),exam:{id:'synthetic-exam',...exam,questionCount:100}};
    const tx={$queryRaw:async()=>[],omrScan:{findUnique:async()=>scan},student:{findUnique:async()=>student},omrAnswerKeyRevision:{findFirst:async()=>({isSynthetic:false})}} as unknown as Prisma.TransactionClient;
    await assert.rejects(()=>evaluateDraft(tx,scan.id),/Official scanning remains disabled/,'A global approval for the original template must not activate the provisional physical layout');
    const worker=path.resolve('workers/omr'),copy=path.join(root,'worker');await fs.mkdir(copy);
    await Promise.all(['template-v2.json','template-framed-legacy-v1.json','engine.py','bubble_evidence.py','responses.py','pdf_input.py','worker_cli.py','printed_identity.py','registration.py','physical_layout.py','qr_decode.py','identity_detail.py','requirements.txt','requirements-ocr.txt'].map(name=>fs.copyFile(path.join(worker,name),path.join(copy,name))));
    process.env.OMR_WORKER_ROOT=copy;assert.equal(officialActivation().approved,true);
    await fs.appendFile(path.join(copy,'bubble_evidence.py'),'\n# tampered second-pass recognition logic');
    assert.equal(officialActivation().approved,false,'Changing the second-pass optical evidence checker must invalidate approval');
    await fs.copyFile(path.join(worker,'bubble_evidence.py'),path.join(copy,'bubble_evidence.py'));
    assert.equal(officialActivation().approved,true,'Restoring identical optical evidence logic restores the signed hash');
    await fs.appendFile(path.join(copy,'template-framed-legacy-v1.json'),'\n');assert.equal(officialActivation().approved,false,'Changing the new physical profile must invalidate approval');
    if(previous.OMR_WORKER_ROOT===undefined)delete process.env.OMR_WORKER_ROOT;else process.env.OMR_WORKER_ROOT=previous.OMR_WORKER_ROOT;
    await fs.writeFile(report,'tampered'); assert.equal(officialActivation().approved,false);
  } finally {
    for(const name of names) {if(previous[name]===undefined) delete process.env[name];else process.env[name]=previous[name];}
    if(path.dirname(root)===path.resolve(os.tmpdir()) && path.basename(root).startsWith('azm-omr-activation-test-')) await fs.rm(root,{recursive:true,force:true});
  }
});

test('examination configuration rejects hidden decimal rounding and an impossible score floor',()=>{
  const exam={code:'SYNTHETIC',title:'Synthetic exam',session:'2026-V',candidateGroup:'CLASS 6TH',examDate:'2026-11-15T09:00:00Z',allowedVersions:['A']};
  assert.equal(examInput.safeParse({...exam,correctMarks:1.125,incorrectPenalty:.25,minimumScore:0}).success,true);
  assert.equal(examInput.safeParse({...exam,correctMarks:.0003,minimumScore:.03}).success,true);
  assert.equal(examInput.safeParse({...exam,correctMarks:1.123456}).success,false);
  assert.equal(examInput.safeParse({...exam,incorrectPenalty:.123456}).success,false);
  assert.equal(examInput.safeParse({...exam,minimumScore:101}).success,false);
});

test('manual printed identity cannot override a conflicting QR student or session',()=>{
  assert.equal(manualQrAgrees({identity:qr},student,exam),true);
  assert.equal(manualQrAgrees({identity:{...qr,studentId:'other-student'}},student,exam),false);
  assert.equal(manualQrAgrees({identity:{...qr,session:'other-session'}},student,exam),false);
});
test('missing QR can enter authorized printed review, but an invalid signed QR cannot become a missing-QR bypass',()=>{
  assert.equal(manualQrAgrees({identity:null},student,exam),true);
  assert.equal(manualQrAgrees({qrEnvelope:{type:'AZM_OMR_SIGNED',payload:'invalid',signature:'0'.repeat(64)}},student,exam),false);
});

test('serializable OMR transactions retry native raw-query serialization and deadlock errors only',async()=>{
  for(const code of ['40001','40P01']) {
    let attempts=0;
    const db={$transaction:async(action:(tx:unknown)=>unknown)=>{if(++attempts<3)throw new Prisma.PrismaClientKnownRequestError('Synthetic concurrency conflict',{code:'P2010',clientVersion:'5.22.0',meta:{code}});return action({});}} as unknown as PrismaClient;
    assert.equal(await serial(db,async()=>42),42);assert.equal(attempts,3);
  }
  let attempts=0;
  const db={$transaction:async()=>{attempts++;throw new Error('Synthetic non-retryable failure');}} as unknown as PrismaClient;
  await assert.rejects(serial(db,async()=>42),/non-retryable/);assert.equal(attempts,1);
});
