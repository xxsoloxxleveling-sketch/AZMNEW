import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import express from 'express';

async function run() {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const source = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || '');
  assert(['localhost','127.0.0.1','[::1]'].includes(source.hostname), 'Dedicated local PostgreSQL only');
  source.pathname = '/postgres'; source.searchParams.delete('schema');
  const admin = new Client({ connectionString: source.toString() }); await admin.connect();
  const name = 'attendance_reset_' + randomUUID().replace(/-/g, '');
  let sql: Client | undefined, db: any, shared: any, server: any, passed = 0;
  const check = async (label: string, work: () => any) => { await work(); passed++; console.log('PASS: ' + label); };
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    source.pathname = '/' + name;
    sql = new Client({ connectionString: source.toString() }); await sql.connect();
    const migrations = path.resolve(__dirname, '../prisma/migrations');
    for (const folder of fs.readdirSync(migrations).sort()) {
      const file = path.join(migrations, folder, 'migration.sql');
      if (fs.existsSync(file)) await sql.query(fs.readFileSync(file, 'utf8'));
    }
    process.env.DATABASE_URL = source.toString(); process.env.DIRECT_URL = source.toString(); process.env.NODE_ENV = 'test';
    const { PrismaClient } = await import('@prisma/client'); db = new PrismaClient();
    const { AttendanceService } = await import('../src/modules/attendance/attendance.service');
    const { AttendanceResetService } = await import('../src/modules/attendance/attendanceReset.service');
    const { qrService } = await import('../src/modules/attendance/qr.service');
    const attendance = new AttendanceService(db), reset = new AttendanceResetService(db);
    for (const role of ['SUPER_ADMIN','ADMIN','TEACHER','ACCOUNTANT']) await db.user.create({ data: {id:role, name:role, email:role+'@test.invalid',passwordHash:'fixture',role} });
    for (const id of ['a','b','closed','inactive']) await db.examHall.create({ data:{id,name:'Hall '+id,roomNumber:id,targetClass:'Class 9th',examDate:'2026-10-10',reportingTime:'08:00'} });
    const candidate = (id: string, hall: string, status = 'ACTIVE') => ({id,applicationNo:'APP-'+id,qrToken:qrService.generateSignedQrToken(id),fullName:'Fixture '+id,fatherName:'Fixture parent',gender:'MALE',dateOfBirth:new Date('2008-01-01'),cnicOrBForm:'fixture-'+id,address:'Fixture',district:'Fixture',province:'Fixture',parentMobile:'fixture',currentClass:'Class 9th',schoolName:'Fixture',boardOrUniversity:'Fixture',scholarshipCategory:'GENERAL_MERIT',emergencyContact:'fixture',emergencyRelation:'Fixture',assignedHallId:hall,status});
    for (const [id,hall,status] of [['a1','a','ACTIVE'],['a2','a','ACTIVE'],['b1','b','ACTIVE'],['c1','closed','ACTIVE'],['i1','inactive','INACTIVE']]) await db.student.create({data:candidate(id,hall,status)});
    const a = (await attendance.openSession('a','ADMIN')).session, b = (await attendance.openSession('b','ADMIN')).session, closed = (await attendance.openSession('closed','ADMIN')).session;
    await attendance.closeSession(closed.id,false,'ADMIN');
    const scope = (ids: string[], mode: 'HALL'|'EXAM_DATE'|'CURRENT'='HALL') => ({mode,businessDate:'2026-10-10',sessionIds:ids});
    const confirm = (challenge: string) => ({challenge,reason:'Synthetic fixture reset',confirmationText:'RESET ATTENDANCE' as const});
    const rejects = (work: () => any, status: number) => assert.rejects(work, (error: any) => error.statusCode === status);
    await check('inactive candidates excluded from new rosters',()=>rejects(()=>attendance.openSession('inactive','ADMIN'),409));
    await attendance.mark(a.id,{studentId:'a1',status:'LATE'},'TEACHER');
    const qr = (await db.student.findUnique({where:{id:'a2'}})).qrToken;
    await attendance.mark(a.id,{qrToken:qr,status:'PRESENT'},'TEACHER');
    const oldRows = await db.attendance.findMany({where:{sessionId:a.id},orderBy:{id:'asc'}});
    const oldRoster = await db.attendanceSessionCandidate.findMany({where:{sessionId:a.id},orderBy:{studentId:'asc'}});
    const studentsBefore = await db.student.findMany({orderBy:{id:'asc'}});
    await check('preview reports exact marks and does not mutate database',async()=>{const before=await db.attendanceSession.count();const p=await reset.preview(scope([a.id]),'SUPER_ADMIN');assert.equal(p.totals.manualCount,1);assert.equal(p.totals.qrCount,1);assert.equal(p.totals.markedCount,2);assert.equal(p.halls[0].staffActivity,'UNKNOWN');assert.equal(await db.attendanceSession.count(),before);assert.equal(await db.attendanceResetOperation.count(),0);});
    const p = await reset.preview(scope([a.id]),'SUPER_ADMIN'), idem=randomUUID();
    const result:any=await reset.confirm(confirm(p.challenge),'SUPER_ADMIN',idem), next=result.attempts[0].newSessionId;
    await check('single Hall reset starts zero and preserves frozen roster',async()=>{const detail=await attendance.getSession(next);assert.equal(detail.stats.markedCount,0);assert.equal(detail.stats.completionPercentage,0);assert.equal(detail.stats.expectedCount,2);assert.equal(detail.session.attemptNumber,2);const roster=await db.attendanceSessionCandidate.findMany({where:{sessionId:next},orderBy:{studentId:'asc'}});const strip=(rows:any[])=>rows.map(({id,createdAt,sessionId,...row})=>row);assert.deepEqual(strip(roster),strip(oldRoster));});
    await check('historical marks and all candidate data remain unchanged',async()=>{assert.deepEqual(await db.attendance.findMany({where:{sessionId:a.id},orderBy:{id:'asc'}}),oldRows);assert.deepEqual(await db.student.findMany({orderBy:{id:'asc'}}),studentsBefore);assert.equal((await db.attendanceSession.findUnique({where:{id:a.id}})).status,'OPEN');assert.equal((await db.attendanceSession.findUnique({where:{id:b.id}})).isCurrent,true);});
    await check('idempotent replay produces no extra attempt or audit',async()=>{assert.deepEqual(await reset.confirm(confirm(p.challenge),'SUPER_ADMIN',idem),result);assert.equal(await db.attendanceResetOperation.count(),1);await rejects(()=>reset.confirm({...confirm(p.challenge),reason:'Different reason'},'SUPER_ADMIN',idem),409);await rejects(()=>reset.confirm(confirm(p.challenge),'SUPER_ADMIN',randomUUID()),409);});
    await check('old attempt rejects mark and close',async()=>{await rejects(()=>attendance.mark(a.id,{studentId:'a1',status:'PRESENT'},'TEACHER'),409);await rejects(()=>attendance.closeSession(a.id,false,'ADMIN'),409);});
    await check('new QR and manual attendance work and wrong Hall fails',async()=>{await attendance.mark(next,{qrToken:qr,status:'PRESENT'},'TEACHER');await attendance.mark(next,{studentId:'a1',status:'ABSENT'},'TEACHER');await rejects(()=>attendance.mark(next,{studentId:'a1',status:'PRESENT'},'TEACHER'),409);const wrong=(await db.student.findUnique({where:{id:'b1'}})).qrToken;await rejects(()=>attendance.mark(next,{qrToken:wrong,status:'PRESENT'},'TEACHER'),409);});
    await check('active list and daily totals exclude archived attempts',async()=>{const list=await attendance.listSessions({page:1,limit:25});assert(!list.sessions.some(s=>s.id===a.id));const today=await attendance.getTodayAttendance(new Date('2026-10-10T07:00:00Z'));assert.equal(today.expectedCount,4);assert.equal(today.markedCount,2);const history=await attendance.listSessions({page:1,limit:25,includeHistory:true});assert(history.sessions.some(s=>s.id===a.id));});
    await check('CLOSED sessions and invalid date scopes reject',async()=>{await rejects(()=>reset.preview(scope([closed.id]),'SUPER_ADMIN'),409);await rejects(()=>reset.preview({...scope([b.id]),businessDate:'2026-10-11'},'SUPER_ADMIN'),400);await rejects(()=>reset.preview(scope([b.id],'EXAM_DATE'),'SUPER_ADMIN'),409);});
    await check('all other roles denied inside reset transaction',async()=>{for(const role of ['ADMIN','TEACHER','ACCOUNTANT']) await rejects(()=>reset.preview(scope([b.id]),role),403);});
    await check('invalid, actor-bound and expired challenges reject',async()=>{await rejects(()=>reset.confirm(confirm('bad.challenge'),'SUPER_ADMIN',randomUUID()),400);const clock=new AttendanceResetService(db,()=>new Date(Date.now()+3600000));const pb=await reset.preview(scope([b.id]),'SUPER_ADMIN');await rejects(()=>clock.confirm(confirm(pb.challenge),'SUPER_ADMIN',randomUUID()),410);await db.user.update({where:{id:'SUPER_ADMIN'},data:{tokenVersion:1}});await rejects(()=>reset.confirm(confirm(pb.challenge),'SUPER_ADMIN',randomUUID()),403);});
    await check('stale preview rejects after concurrent staff marking',async()=>{const pb=await reset.preview(scope([b.id]),'SUPER_ADMIN');await attendance.mark(b.id,{studentId:'b1',status:'PRESENT'},'TEACHER');await rejects(()=>reset.confirm(confirm(pb.challenge),'SUPER_ADMIN',randomUUID()),409);assert.equal((await db.attendanceSession.findUnique({where:{id:b.id}})).isCurrent,true);});
    await check('database prevents archived mark mutations, late writes and audit edits',async()=>{await assert.rejects(()=>sql!.query('UPDATE "Attendance" SET status=\'ABSENT\' WHERE "sessionId"=$1',[a.id]),/immutable/);await assert.rejects(()=>sql!.query('DELETE FROM "AttendanceSessionCandidate" WHERE "sessionId"=$1',[a.id]),/immutable/);await assert.rejects(()=>sql!.query('UPDATE "AttendanceResetOperation" SET reason=\'tampered\''),/immutable/);await assert.rejects(()=>sql!.query('UPDATE "AttendanceSession" SET "isCurrent"=true,"archivedAt"=NULL WHERE id=$1',[a.id]),/immutable/);});
    await check('duplicate current attempt rejected by PostgreSQL',async()=>{await assert.rejects(()=>db.attendanceSession.create({data:{examHallId:'a',businessDate:new Date('2026-10-10'),attemptNumber:99,openedByUserId:'SUPER_ADMIN',hallNameSnapshot:'x',roomNumberSnapshot:'x',examDateSnapshot:'x',reportingTimeSnapshot:'x'}}));});
    await check('batch reset is atomic and audit contains prior/new identities',async()=>{const pb=await reset.preview(scope([next,b.id],'EXAM_DATE'),'SUPER_ADMIN');const batch:any=await reset.confirm(confirm(pb.challenge),'SUPER_ADMIN',randomUUID());assert.equal(batch.attempts.length,2);assert.equal(batch.affectedCandidates,3);for(const attempt of batch.attempts) assert.equal((await attendance.getSession(attempt.newSessionId)).stats.markedCount,0);const hist=await reset.history('SUPER_ADMIN',{page:1,limit:25});assert.equal(hist.operations.length,2);});
        await check('failed audit insertion rolls back the complete multi-Hall reset',async()=>{const currents=await db.attendanceSession.findMany({where:{isCurrent:true,status:'OPEN'},select:{id:true},orderBy:{id:'asc'}});const before=await db.attendanceSession.findMany({orderBy:{id:'asc'}});const preview=await reset.preview(scope(currents.map((row:any)=>row.id),'CURRENT'),'SUPER_ADMIN');await sql!.query(`ALTER TABLE "AttendanceResetOperation" ADD CONSTRAINT fixture_reject_reset CHECK (reason <> 'Synthetic fixture reset') NOT VALID`);try{await assert.rejects(()=>reset.confirm(confirm(preview.challenge),'SUPER_ADMIN',randomUUID()));}finally{await sql!.query('ALTER TABLE "AttendanceResetOperation" DROP CONSTRAINT fixture_reject_reset');}assert.deepEqual(await db.attendanceSession.findMany({orderBy:{id:'asc'}}),before);});
    await check('scan racing reset cannot silently mark the wrong attempt',async()=>{const current=await db.attendanceSession.findFirst({where:{examHallId:'a',isCurrent:true}});const preview=await reset.preview(scope([current.id]),'SUPER_ADMIN');const results=await Promise.allSettled([reset.confirm(confirm(preview.challenge),'SUPER_ADMIN',randomUUID()),attendance.mark(current.id,{studentId:'a1',status:'PRESENT'},'TEACHER')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const active=await db.attendanceSession.findFirst({where:{examHallId:'a',isCurrent:true}});assert.equal((await attendance.getSession(active.id)).stats.markedCount,results[0].status==='fulfilled'?0:1);});
    await check('concurrent identical reset requests commit once',async()=>{const current=await db.attendanceSession.findFirst({where:{examHallId:'a',isCurrent:true}});const preview=await reset.preview(scope([current.id]),'SUPER_ADMIN'), key=randomUUID();const before=await db.attendanceResetOperation.count();const responses=await Promise.all([reset.confirm(confirm(preview.challenge),'SUPER_ADMIN',key),reset.confirm(confirm(preview.challenge),'SUPER_ADMIN',key)]);assert.deepEqual(responses[0],responses[1]);assert.equal(await db.attendanceResetOperation.count(),before+1);});
    await check('finalized evidence and authorization invalidation are protected',async()=>{await assert.rejects(()=>sql!.query('DELETE FROM "AttendanceSessionCandidate" WHERE "sessionId"=$1',[closed.id]),/immutable/);const current=await db.attendanceSession.findFirst({where:{examHallId:'b',isCurrent:true}});await rejects(()=>reset.preview(scope([current.id]),'SUPER_ADMIN',0),401);});
    // Real route authentication tests share this isolated fixture database.
    const {default:router}=await import('../src/modules/attendance/attendance.routes');
    const {errorHandler}=await import('../src/middleware/error.middleware');
    const {signAccessToken}=await import('../src/lib/jwt');
    shared=(await import('../src/lib/prisma')).prisma;
    const app=express();app.use(express.json());app.use('/api/attendance',router);app.use(errorHandler);server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api/attendance/reset`;
    await check('reset routes reject unauthenticated and all non-Super Admin roles',async()=>{for(const role of [null,'ADMIN','TEACHER','ACCOUNTANT']) for(const [route,method] of [['/preview','POST'],['/confirm','POST'],['/history','GET']]){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(role?{Authorization:'Bearer '+signAccessToken({userId:role,email:role+'@test.invalid',role,name:role,tokenVersion:0})}:{})},...(method==='POST'?{body:'{}'}:{})});assert.equal(response.status,role?403:401);}});
    await check('authorized HTTP preview, confirmation, replay and history preserve exact scope', async () => {
      const authorization = 'Bearer ' + signAccessToken({ userId: 'SUPER_ADMIN', email: 'SUPER_ADMIN@test.invalid', role: 'SUPER_ADMIN', name: 'Fixture', tokenVersion: 1 });
      const current = await db.attendanceSession.findFirst({ where: { examHallId: 'b', isCurrent: true } });
      const headers = { Authorization: authorization, 'Content-Type': 'application/json' };
      const previewResponse = await fetch(base + '/preview', { method: 'POST', headers, body: JSON.stringify(scope([current.id])) });
      assert.equal(previewResponse.status, 200);
      const preview = (await previewResponse.json() as any).data;
      assert.equal(preview.halls[0].sessionId, current.id);
      const request = { method: 'POST', headers: { ...headers, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(confirm(preview.challenge)) };
      const response = await fetch(base + '/confirm', request);
      assert.equal(response.status, 200);
      const result = (await response.json() as any).data;
      assert.equal(result.attempts[0].previousSessionId, current.id);
      assert.equal((await attendance.getSession(result.attempts[0].newSessionId)).stats.markedCount, 0);
      const replay = await fetch(base + '/confirm', request);
      assert.equal(replay.status, 200);
      assert.deepEqual((await replay.json() as any).data, result);
      const historyResponse = await fetch(base + '/history', { headers });
      assert.equal(historyResponse.status, 200);
      assert((await historyResponse.json() as any).data.operations.some((event: any) => event.id === result.resetReference));
      const listResponse = await fetch(base.replace('/reset', '') + '/sessions?includeHistory=true', { headers });
      assert.equal(listResponse.status, 200);
      assert((await listResponse.json() as any).data.sessions.some((session: any) => session.id === current.id && !session.isCurrent));
    });
    console.log(`Attendance reset integrity: ${passed} passed, 0 failed`);
  } finally {
    if(server) await new Promise<void>(resolve=>server.close(resolve));
    await db?.$disconnect();await shared?.$disconnect();await sql?.end();
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',[name]);
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);await admin.end();
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
