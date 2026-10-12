import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { Client } from 'pg';

async function run() {
  if (process.env.NODE_ENV === 'production') throw Error('No production tests.');
  const raw=process.env.ATTENDANCE_TEST_DATABASE_URL;
  if (!raw) throw Error('Explicit disposable localhost PostgreSQL connection required.');
  const url=new URL(raw);
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) ||
      !['postgresql:','postgres:'].includes(url.protocol)) throw Error('Only localhost allowed.');
  const adminUrl=new URL(url);adminUrl.pathname='/postgres';adminUrl.searchParams.delete('schema');
  const name='stage1_attendance_'+randomUUID().replaceAll('-','');
  const fixtureUrl=new URL(adminUrl);fixtureUrl.pathname='/'+name;
  const admin=new Client({connectionString:adminUrl.toString()});
  let pg:Client|null=null,db:any=null,shared:any=null,server:any=null,created=false,passed=0;
  const check=async(label:string,fn:()=>Promise<void>)=>{
    await fn();passed++;console.log('PASS: '+label);
  };
  const expectStatus=async(fn:()=>Promise<any>,code:number)=>{
    await assert.rejects(fn,(e:any)=>e?.statusCode===code);
  };
  const expectZod=async(fn:()=>Promise<any>)=>{
    await assert.rejects(fn,(e:any)=>e?.name==='ZodError');
  };
  try {
    await admin.connect();
    await admin.query('CREATE DATABASE "'+name+'"');created=true;
    pg=new Client({connectionString:fixtureUrl.toString()});await pg.connect();
    const migrations=path.resolve(__dirname,'../prisma/migrations');
    for(const folder of fs.readdirSync(migrations).sort()){
      const file=path.join(migrations,folder,'migration.sql');
      if(fs.existsSync(file)) await pg.query(fs.readFileSync(file,'utf8'));
    }
    process.env.NODE_ENV='test';process.env.DATABASE_URL=fixtureUrl.toString();
    process.env.DIRECT_URL=fixtureUrl.toString();
    for(const key of Object.keys(process.env))
      if(key.startsWith('R2_')||key.startsWith('SUPABASE_')) delete process.env[key];
    const {PrismaClient}=await import('@prisma/client');
    const {AttendanceService}=await import('../src/modules/attendance/attendance.service');
    const {AttendanceResetService}=await import('../src/modules/attendance/attendanceReset.service');
    const {AttendanceCancellationService}=await import('../src/modules/attendance/attendanceCancellation.service');
    const {cancelPreviewSchema,cancelConfirmSchema}=await import('../src/modules/attendance/attendance.schema');
    const {qrService}=await import('../src/modules/attendance/qr.service');
    const {env}=await import('../src/config/env');
    db=new PrismaClient();
    const attendance=new AttendanceService(db);
    const cancel=new AttendanceCancellationService(db);
    const reset=new AttendanceResetService(db);
    for(const [id,role] of [['SA','SUPER_ADMIN'],['ADMIN','ADMIN'],['TEACHER','TEACHER']])
      await db.user.create({data:{id,role,name:id,email:id.toLowerCase()+'@example.invalid',passwordHash:'fixture'}});
    for(const hall of ['ha','hb','hc','hd']){
      await db.examHall.create({data:{id:hall,name:'Synthetic '+hall,roomNumber:hall,
        targetClass:'Class 9th',examDate:'2026-10-10',reportingTime:'08:00'}});
      const ids=hall==='ha'?['ha-1','ha-2']:[hall+'-1'];
      for(const id of ids) await db.student.create({data:{
        id,applicationNo:'SYNTH-'+id,qrToken:qrService.generateSignedQrToken(id),
        fullName:'Synthetic '+id,fatherName:'Synthetic',gender:'MALE',
        dateOfBirth:new Date('2008-01-01'),cnicOrBForm:'SYNTH-'+id,
        address:'Synthetic',district:'Synthetic',province:'Synthetic',parentMobile:'0',
        currentClass:'Class 9th',schoolName:'Synthetic',boardOrUniversity:'Synthetic',
        scholarshipCategory:'GENERAL_MERIT',emergencyContact:'0',emergencyRelation:'Synthetic',
        assignedHallId:hall
      }});
    }
    const sessions:Record<string,string>={};
    for(const hall of ['ha','hb','hc','hd'])
      sessions[hall]=(await attendance.openSession(hall,'ADMIN')).session.id;
    await attendance.mark(sessions.ha,{studentId:'ha-1',status:'PRESENT'},'TEACHER');
    await attendance.mark(sessions.hd,{studentId:'hd-1',status:'LATE'},'TEACHER');
    await attendance.closeSession(sessions.hb,true,'ADMIN');
    await db.student.update({where:{id:'hc-1'},data:{testScore:90}});
    const preserve=(challenge:string)=>({
      challenge,reason:'Synthetic cancelled examination session; preserve all attendance',
      confirmationText:'CANCEL SESSION' as const,
    });

    await check('additive SQL migration installs unconditional deletion trigger and CHECK',async()=>{
      const a=await pg!.query("SELECT convalidated FROM pg_constraint WHERE conname='AttendanceSessionCancellation_staged_no_purge'");
      const b=await pg!.query("SELECT tgenabled FROM pg_trigger WHERE tgname='Attendance_staged_no_delete'");
      assert.equal(a.rows[0]?.convalidated,true);
      assert(['O','A'].includes(b.rows[0]?.tgenabled));
    });
    await check('strict API schemas reject permanent-deletion requests',async()=>{
      assert(cancelPreviewSchema.safeParse({purgeAttendance:false}).success);
      assert(!cancelPreviewSchema.safeParse({purgeAttendance:true}).success);
      assert(cancelConfirmSchema.safeParse(preserve('synthetic_challenge_placeholder')).success);
      assert(!cancelConfirmSchema.safeParse({...preserve('synthetic_challenge_placeholder'),
        confirmationText:'CANCEL SESSION AND DELETE ATTENDANCE'}).success);
      assert(!cancelConfirmSchema.safeParse({...preserve('synthetic_challenge_placeholder'),
        closedEvidenceApproved:true,retentionApproved:true}).success);
    });
    await check('admin/teacher cannot perform Super Admin cancellation',async()=>{
      await expectStatus(()=>cancel.preview(sessions.ha,{purgeAttendance:false},'ADMIN'),403);
      await expectStatus(()=>cancel.history('TEACHER',1,10),403);
    });
    await check('OPEN and CLOSED permanent-deletion previews are rejected',async()=>{
      for(const id of [sessions.ha,sessions.hb])
        await expectZod(()=>cancel.preview(id,{purgeAttendance:true},'SA',0));
      assert.equal(await db.attendance.count({where:{sessionId:sessions.ha}}),1);
      assert.equal(await db.attendance.count({where:{sessionId:sessions.hb}}),1);
    });
    await check('old signed purge challenges cannot bypass staged confirmation',async()=>{
      const p=await cancel.preview(sessions.ha,{purgeAttendance:false},'SA',0);
      const parts=p.challenge.split('.');
      const parsed=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
      parsed.purgeAttendance=true;
      const encoded=Buffer.from(JSON.stringify(parsed)).toString('base64url');
      const secret=createHmac('sha256',env.JWT_ACCESS_SECRET)
        .update('azm:attendance-cancellation:challenge:v1').digest();
      const legacy=encoded+'.'+createHmac('sha256',secret).update(encoded).digest('base64url');
      await expectStatus(()=>cancel.confirm(sessions.ha,preserve(legacy),'SA',randomUUID(),0),403);
      assert.equal(await db.attendanceSessionCancellation.count(),0);
    });
    await check('database refuses actual attendance deletion with forged transaction context',async()=>{
      await pg!.query('BEGIN');
      try{
        await pg!.query("SELECT set_config('azm.cancel_audit_id',$1,true)",[randomUUID()]);
        await assert.rejects(()=>pg!.query('DELETE FROM "Attendance" WHERE "sessionId"=$1',[sessions.ha]),
          (e:any)=>e?.code==='23514');
      } finally {await pg!.query('ROLLBACK');}
      assert.equal(await db.attendance.count({where:{sessionId:sessions.ha}}),1);
    });
    await check('database CHECK rejects fabricated deletion audit rows',async()=>{
      const sql=[
        'INSERT INTO "AttendanceSessionCancellation"',
        '("id","sessionId","actorId","actorName","idempotencyKey","challengeNonce",',
        '"requestHash","snapshotFingerprint","reason","approvalReference",',
        '"retentionApproved","externalDispositionAttested","closedEvidenceApproved",',
        '"previousStatus","businessDate","purgeAttendance","markedCount",',
        '"deletedCount","retainedCount","expectedCount","cancelledAt")',
        "SELECT $1,id,'SA','SA',$2,$3,repeat('a',64),repeat('b',64),",
        "'Synthetic forged purge attempt','SYNTH-APPROVAL',true,true,true,",
        'status,"businessDate",true,1,1,0,2,now() FROM "AttendanceSession" WHERE id=$4',
      ].join(' ');
      await assert.rejects(()=>pg!.query(sql,[randomUUID(),randomUUID(),randomUUID(),sessions.ha]),
        (e:any)=>e?.code==='23514');
      assert.equal(await db.attendanceSessionCancellation.count(),0);
    });
    await check('stale preview fails without changing attendance',async()=>{
      const p=await cancel.preview(sessions.ha,{purgeAttendance:false},'SA',0);
      await attendance.mark(sessions.ha,{studentId:'ha-2',status:'LATE'},'TEACHER');
      await expectStatus(()=>cancel.confirm(sessions.ha,preserve(p.challenge),'SA',randomUUID(),0),409);
      assert.equal(await db.attendance.count({where:{sessionId:sessions.ha}}),2);
    });
    await check('OPEN cancellation preserves all marks/roster and writes immutable audit',async()=>{
      const before=await db.attendance.findMany({where:{sessionId:sessions.ha}});
      const p=await cancel.preview(sessions.ha,{purgeAttendance:false},'SA',0);
      const key=randomUUID(),req=preserve(p.challenge);
      const result=await cancel.confirm(sessions.ha,req,'SA',key,0);
      assert.equal(result.deletedCount,0);assert.equal(result.retainedCount,2);
      assert.equal(result.purgeAttendance,false);
      assert.deepEqual(await db.attendance.findMany({where:{sessionId:sessions.ha}}),before);
      assert.equal(await db.attendanceSessionCandidate.count({where:{sessionId:sessions.ha}}),2);
      assert.equal((await db.attendanceSession.findUnique({where:{id:sessions.ha}})).isCurrent,false);
      assert.deepEqual(await cancel.confirm(sessions.ha,req,'SA',key,0),result);
      await expectStatus(()=>cancel.confirm(sessions.ha,{...req,reason:'Modified reason'},
        'SA',key,0),409);
    });
    await check('CLOSED cancellation preserves auto-ABSENT and closing metadata',async()=>{
      const before=await db.attendance.findMany({where:{sessionId:sessions.hb}});
      assert.equal(before[0].status,'ABSENT');
      const original=await db.attendanceSession.findUnique({where:{id:sessions.hb}});
      const p=await cancel.preview(sessions.hb,{purgeAttendance:false},'SA',0);
      const done=await cancel.confirm(sessions.hb,preserve(p.challenge),'SA',randomUUID(),0);
      assert.equal(done.deletedCount,0);assert.equal(done.retainedCount,1);
      assert.deepEqual(await db.attendance.findMany({where:{sessionId:sessions.hb}}),before);
      const session=await db.attendanceSession.findUnique({where:{id:sessions.hb}});
      assert.equal(session.status,'CANCELLED');
      assert.equal(session.closedAt.getTime(),original.closedAt.getTime());
      await assert.rejects(()=>pg!.query('DELETE FROM "Attendance" WHERE "sessionId"=$1',[sessions.hb]),
        (e:any)=>e?.code==='23514');
    });
    await check('CANCEL without deletion preserves candidate score and result field',async()=>{
      const p=await cancel.preview(sessions.hc,{purgeAttendance:false},'SA',0);
      assert.equal(p.impact.scoredOrRankedCandidates,1);
      assert.equal(p.blockers.length,0);
      const done=await cancel.confirm(sessions.hc,preserve(p.challenge),'SA',randomUUID(),0);
      assert.equal(done.deletedCount,0);
      assert.equal((await db.student.findUnique({where:{id:'hc-1'}})).testScore,90);
    });
    await check('cancelled session cannot accept marks or closure',async()=>{
      await expectStatus(()=>attendance.mark(sessions.ha,{studentId:'ha-1',status:'PRESENT'},'TEACHER'),409);
      await expectStatus(()=>attendance.closeSession(sessions.ha,false,'ADMIN'),409);
    });
    await check('explicit reopen requires Super Admin and creates a fresh attempt',async()=>{
      await expectStatus(()=>attendance.openSession('ha','ADMIN'),403);
      const next=(await attendance.openSession('ha','SA')).session;
      assert.equal(next.attemptNumber,2);
      assert.equal(await db.attendance.count({where:{sessionId:next.id}}),0);
      assert.equal(await db.attendance.count({where:{sessionId:sessions.ha}}),2);
    });
    await check('PR14 reset preserves original marks while creating a new attempt',async()=>{
      const p=await reset.preview({mode:'HALL',businessDate:'2026-10-10',
        sessionIds:[sessions.hd]},'SA',0);
      const done=await reset.confirm({challenge:p.challenge,
        reason:'Synthetic regression reset preserving historic evidence',
        confirmationText:'RESET ATTENDANCE'},'SA',randomUUID(),0);
      assert.equal(done.attempts.length,1);
      assert.equal(await db.attendance.count({where:{sessionId:sessions.hd}}),1);
      assert.equal(await db.attendance.count({where:{sessionId:done.attempts[0].newSessionId}}),0);
      sessions.hd = done.attempts[0].newSessionId; // current attempt for HTTP tests
    });
    await check('all staged cancellation audits report zero deletion and are immutable',async()=>{
      const h=await cancel.history('SA',1,10,0);
      assert.equal(h.operations.length,3);
      assert(h.operations.every((x:any)=>x.deletedCount===0 && x.purgeAttendance===false));
      await assert.rejects(()=>pg!.query(
        'UPDATE "AttendanceSessionCancellation" SET "deletedCount"=1'),
        (e:any)=>e?.code==='23514');
    });
    const express=(await import('express')).default;
    const {default:router}=await import('../src/modules/attendance/attendance.routes');
    const {errorHandler}=await import('../src/middleware/error.middleware');
    const {signAccessToken}=await import('../src/lib/jwt');
    shared=(await import('../src/lib/prisma')).prisma;
    const app=express();app.use(express.json());app.use('/api/attendance',router);app.use(errorHandler);
    server=app.listen(0,'127.0.0.1');
    await new Promise<void>(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+(server.address() as any).port+'/api/attendance';
    const bearer=(id:string,role:string)=>({
      Authorization:'Bearer '+signAccessToken({
        userId:id,email:id.toLowerCase()+'@example.invalid',role,name:id,tokenVersion:0,
      }),
      'Content-Type':'application/json',
    });
    await check('HTTP routes reject unauthorized and destructive previews',async()=>{
      const target=base+'/sessions/'+sessions.hd+'/cancel/preview';
      const guest=await fetch(target,{method:'POST',
        headers:{'Content-Type':'application/json'},body:'{}'});
      assert.equal(guest.status,401);
      const teacher=await fetch(target,{method:'POST',
        headers:bearer('TEACHER','TEACHER'),body:'{}'});
      assert.equal(teacher.status,403);
      const admin=await fetch(target,{method:'POST',headers:bearer('SA','SUPER_ADMIN'),
        body:JSON.stringify({purgeAttendance:true})});
      assert.equal(admin.status,400);
    });
    await check('HTTP confirm rejects legacy delete phrase and approval fields',async()=>{
      const headers=bearer('SA','SUPER_ADMIN');
      const url=base+'/sessions/'+sessions.hd+'/cancel';
      const p=await fetch(url+'/preview',{method:'POST',headers,
        body:JSON.stringify({purgeAttendance:false})});
      assert.equal(p.status,200);
      const preview=(await p.json() as any).data;
      for (const body of [
        {...preserve(preview.challenge),confirmationText:'CANCEL SESSION AND DELETE ATTENDANCE'},
        {...preserve(preview.challenge),retentionApproved:true},
      ]) {
        const attempt=await fetch(url+'/confirm',{method:'POST',
          headers:{...headers,'Idempotency-Key':randomUUID()},body:JSON.stringify(body)});
        assert.equal(attempt.status,400);
      }
      assert.equal((await db.attendanceSession.findUnique({where:{id:sessions.hd}})).status,'OPEN');
    });
    await check('HTTP approved cancellation preserves QR/manual marks with idempotent replay',async()=>{
      await attendance.mark(sessions.hd,{studentId:'hd-1',status:'PRESENT'},'TEACHER');
      const before=await db.attendance.findMany({where:{sessionId:sessions.hd}});
      const headers=bearer('SA','SUPER_ADMIN');
      const url=base+'/sessions/'+sessions.hd+'/cancel';
      const previewResponse=await fetch(url+'/preview',{method:'POST',headers,
        body:JSON.stringify({purgeAttendance:false})});
      assert.equal(previewResponse.status,200);
      const preview=(await previewResponse.json() as any).data;
      assert.equal(preview.impact.markedCount,1);
      const opts={method:'POST',headers:{...headers,'Idempotency-Key':randomUUID()},
        body:JSON.stringify(preserve(preview.challenge))};
      const response=await fetch(url+'/confirm',opts);
      assert.equal(response.status,200);
      const result=(await response.json() as any).data;
      assert.equal(result.status,'CANCELLED');
      assert.equal(result.purgeAttendance,false);
      assert.equal(result.deletedCount,0);
      assert.equal(result.retainedCount,1);
      const replay=await fetch(url+'/confirm',opts);
      assert.equal(replay.status,200);
      assert.deepEqual((await replay.json() as any).data,result);
      assert.deepEqual(await db.attendance.findMany({where:{sessionId:sessions.hd}}),before);
      const history=await fetch(base+'/cancellations/history?page=1&limit=10',{headers});
      assert.equal(history.status,200);
      assert((await history.json() as any).data.operations.some(
        (op:any)=>op.sessionId===sessions.hd && op.deletedCount===0));
    });
    console.log('Stage 1 preserve-only cancellation: '+passed+' checks PASS.');
  } finally {
    if(server) await new Promise<void>(resolve=>server.close(resolve));
    await shared?.$disconnect();
    await db?.$disconnect();
    await pg?.end();
    if(created){
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',[name]);
      await admin.query('DROP DATABASE "'+name+'"');
    }
    await admin.end();
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
