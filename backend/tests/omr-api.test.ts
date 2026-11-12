import test from 'node:test';
import assert from 'node:assert/strict';
import express,{RequestHandler} from 'express';
import { AddressInfo } from 'node:net';
import { PrismaClient } from '@prisma/client';
import { createOmrRouter } from '../src/modules/omr/omr.routes';
import { OmrService } from '../src/modules/omr/omr.service';
import { OmrQueue } from '../src/modules/omr/queue';
import { signAccessToken,verifyAccessToken } from '../src/lib/jwt';
const endpoints:Array<[string,string]>=[['GET','/legacy'],['POST','/legacy/review'],['GET','/exams/exam/batches'],['POST','/exams/exam/results/approve'],['POST','/exams/exam/results/result/withdraw'],['POST','/exams/exam/results/result/reevaluate'],['GET','/groups'],['GET','/exams'],['POST','/exams'],['PUT','/exams/exam'],['POST','/exams/exam/approve'],['PUT','/exams/exam/permissions'],['GET','/exams/exam/keys'],['POST','/exams/exam/keys'],['POST','/exams/exam/keys/key/approve'],['GET','/exams/exam/stats'],['GET','/exams/exam/scans'],['GET','/exams/exam/results'],['POST','/exams/exam/batches'],['GET','/batches/batch'],['GET','/scans/scan'],['GET','/scans/scan/image'],['POST','/scans/scan/retry'],['PATCH','/scans/scan/review'],['POST','/scans/scan/approve'],['POST','/scans/scan/reject'],['POST','/exams/exam/publish']];
const token=(id:string,role:string)=>signAccessToken({userId:id,role,email:`${id}@test.invalid`,name:'Synthetic Staff',tokenVersion:1});
endpoints.push(['POST','/scans/scan/identity-captures?originalSha256='+ 'a'.repeat(64)],['GET','/scans/scan/identity-captures/capture/image']);
test('all OMR endpoints require existing authentication middleware',async()=>{
  const app=express(); app.use(express.json()); app.use('/api/omr',createOmrRouter());
  const server=app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/omr`;
    for(const [method,endpoint] of endpoints) assert.equal((await fetch(base+endpoint,{method})).status,401,`${method} ${endpoint}`);
  } finally { await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())); }
});
test('JWT-authenticated fixture staff cannot obtain confidential keys or bypass exam permissions',async()=>{
  const exam={id:'exam',status:'APPROVED',candidateGroup:'CLASS 6TH',allowedVersions:['A'],session:'2026-V'};
  const db={
    omrExam:{findUnique:async()=>exam,findMany:async()=>[exam]},
    omrExamPermission:{findUnique:async({where}:{where:{examId_userId:{userId:string}}})=>where.examId_userId.userId==='assigned-admin'?{canManage:true,canScan:true,canReview:true}:null},
    omrAnswerKeyRevision:{findMany:async()=>[{id:'synthetic-key',answers:Array(100).fill('A')}]},
    omrScanBatch:{count:async()=>0},
  } as unknown as PrismaClient;
  const auth:RequestHandler=(req,res,next)=>{
    try {const value=verifyAccessToken((req.get('Authorization')||'').replace(/^Bearer /,'')); req.user={id:value.userId,email:value.email,name:value.name,role:value.role,status:'ACTIVE'};next();}
    catch {res.status(401).json({success:false});}
  };
  const app=express(); app.use(express.json()); app.use('/api/omr',createOmrRouter(new OmrService(db),new OmrQueue(db),auth));
  const server=app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/omr`;
    const get=(endpoint:string,user:string,role:string)=>fetch(base+endpoint,{headers:{Authorization:`Bearer ${token(user,role)}`}});
    assert.equal((await get('/exams/exam/keys','teacher','TEACHER')).status,403);
    assert.equal((await get('/exams/exam/results','teacher','TEACHER')).status,403);
    assert.equal((await get('/exams/exam/scans','teacher','TEACHER')).status,403);
    assert.equal((await get('/exams/exam/keys','admin','ADMIN')).status,403);
    assert.equal((await get('/exams/exam/keys','assigned-admin','ADMIN')).status,200);
    assert.equal((await get('/exams/exam/keys','super','SUPER_ADMIN')).status,200);
    assert.equal((await get('/exams','accountant','ACCOUNTANT')).status,403);
    const publish=await fetch(base+'/exams/exam/publish',{method:'POST',headers:{Authorization:`Bearer ${token('super','SUPER_ADMIN')}`,'Content-Type':'application/json'},body:JSON.stringify({resultIds:['result'],reason:'Synthetic release request'})});
    assert.equal(publish.status,409);
    const create=await fetch(base+'/exams',{method:'POST',headers:{Authorization:`Bearer ${token('teacher','TEACHER')}`,'Content-Type':'application/json'},body:'{}'});
    assert.equal(create.status,403);
    assert.equal((await fetch(base+'/exams',{headers:{Authorization:'Bearer invalid'}})).status,401);
  } finally { await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())); }
});
