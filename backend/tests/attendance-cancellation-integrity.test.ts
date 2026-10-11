import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

async function run() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Production environment is forbidden.');
  const raw = process.env.ATTENDANCE_TEST_DATABASE_URL;
  if (!raw) throw new Error('Explicit ATTENDANCE_TEST_DATABASE_URL pointing at localhost is mandatory.');
  const local = new URL(raw);
  if (!['localhost','127.0.0.1','[::1]'].includes(local.hostname))
    throw new Error('Only a dedicated local PostgreSQL instance is allowed.');
  if (!/^postgres(ql)?:$/.test(local.protocol))
    throw new Error('Unexpected database connection protocol.');
  const adminUrl = new URL(local);
  adminUrl.pathname = '/postgres';
  adminUrl.searchParams.delete('schema');
  const name = 'lifecycle_synthetic_' + randomUUID().replace(/-/g, '');
  const fixtureUrl = new URL(adminUrl);
  fixtureUrl.pathname = '/' + name;
  const admin = new Client({ connectionString: adminUrl.toString() });
  let pg: Client | null = null, db: any = null, shared: any = null, server: any = null, created = false, passed = 0;
  const check = async (description: string, runCheck: () => Promise<void>) => {
    await runCheck();
    passed++;
    console.log('PASS: ' + description);
  };
  const expectStatus = async (work: () => Promise<any>, statusCode: number) => {
    await assert.rejects(work, (error: any) => error?.statusCode === statusCode,
      'Expected HTTP error ' + statusCode);
  };
  try {
    await admin.connect();
    await admin.query('CREATE DATABASE "' + name + '"');
    created = true;
    pg = new Client({ connectionString: fixtureUrl.toString() });
    await pg.connect();
    const migrations = path.resolve(__dirname, '../prisma/migrations');
    for (const folder of fs.readdirSync(migrations).sort()) {
      const migration = path.join(migrations, folder, 'migration.sql');
      if (fs.existsSync(migration)) await pg.query(fs.readFileSync(migration, 'utf8'));
    }
    console.log('All migrations applied in a disposable database.');
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = fixtureUrl.toString();
    process.env.DIRECT_URL = fixtureUrl.toString();
    for (const key of Object.keys(process.env))
      if (key.startsWith('R2_') || key.startsWith('SUPABASE_')) delete process.env[key];
    const { PrismaClient } = await import('@prisma/client');
    db = new PrismaClient();
    const { AttendanceService } = await import('../src/modules/attendance/attendance.service');
    const { AttendanceResetService } = await import('../src/modules/attendance/attendanceReset.service');
    const { AttendanceCancellationService } = await import('../src/modules/attendance/attendanceCancellation.service');
    const { qrService } = await import('../src/modules/attendance/qr.service');
    const attendance = new AttendanceService(db);
    const cancellation = new AttendanceCancellationService(db);
    const reset = new AttendanceResetService(db);
    const actorName = 'Synthetic Super Admin';
    for (const [id, role] of [['SA','SUPER_ADMIN'],['ADMIN','ADMIN'],['TEACHER','TEACHER'],['OTHER','SUPER_ADMIN']])
      await db.user.create({ data: {
        id, role, name: id === 'SA' ? actorName : id, email: id.toLowerCase() + '@example.invalid', passwordHash:'fixture',
      } });
    for (const id of ['ha','hb','hc','hd','he','hf'])
      await db.examHall.create({ data: {
        id, name: 'Test Hall '+id, roomNumber:id, targetClass:'Class 9th',
        examDate:'2026-10-10', reportingTime:'08:00',
      }});
    function candidate(id: string, hall: string) {
      return {
        id, applicationNo: 'APP-'+id, qrToken: qrService.generateSignedQrToken(id),
        fullName: 'Synthetic '+id, fatherName:'Synthetic parent', gender:'MALE',
        dateOfBirth:new Date('2008-01-01'), cnicOrBForm:'synthetic-'+id,
        address:'Synthetic', district:'Synthetic', province:'Synthetic', parentMobile:'000',
        currentClass:'Class 9th', schoolName:'Synthetic', boardOrUniversity:'Synthetic',
        scholarshipCategory:'GENERAL_MERIT', emergencyContact:'000', emergencyRelation:'Synthetic',
        assignedHallId:hall,
      };
    }
    for (const [id,hall] of [
      ['ha-1','ha'],['ha-2','ha'],['hb-1','hb'],
      ['hc-1','hc'],['hd-1','hd'],['he-1','he'],['hf-1','hf'],
    ]) await db.student.create({ data: candidate(id,hall) });
    const sessions: Record<string,string> = {};
    for (const hall of ['ha','hb','hc','hd','he','hf'])
      sessions[hall] = (await attendance.openSession(hall, 'ADMIN')).session.id;
    await attendance.mark(sessions.ha, {studentId:'ha-1',status:'LATE'},'TEACHER');
    await attendance.mark(sessions.hb, {studentId:'hb-1',status:'PRESENT'},'TEACHER');
    await attendance.closeSession(sessions.hc, true,'ADMIN');
    await attendance.mark(sessions.he, {studentId:'he-1',status:'PRESENT'},'TEACHER');
    await attendance.mark(sessions.hf, {studentId:'hf-1',status:'PRESENT'},'TEACHER');
    await db.student.update({where:{id:'hd-1'},data:{testScore:85}});

    const preserve = (challenge: string) => ({
      challenge, reason:'Synthetic cancellation for examination scheduling error',
      confirmationText:'CANCEL SESSION' as const,
    });
    const purge = (challenge: string, closed = false) => ({
      challenge, reason:'Approved synthetic examination cancellation and attendance removal',
      confirmationText:'CANCEL SESSION AND DELETE ATTENDANCE' as const,
      approvalReference:'SYNTHETIC-RETENTION-APPROVAL-001',
      retentionApproved:true, externalDispositionAttested:true,
      irreversibleDeletionAcknowledged:true, closedEvidenceApproved:closed,
    });
    await check('non-Super Admin denied by service', async () => {
      await expectStatus(() => cancellation.preview(sessions.ha,{purgeAttendance:true},'ADMIN'),403);
      await expectStatus(() => cancellation.history('TEACHER',1,10),403);
    });
    await check('preview reports exact Hall and does not change records', async () => {
      const before = await db.attendance.count();
      const p = await cancellation.preview(sessions.ha,{purgeAttendance:true},'SA',0);
      assert.equal(p.impact.expectedCount,2);
      assert.equal(p.impact.markedCount,1);
      assert.equal(p.impact.lateCount,1);
      assert.equal(p.session.id,sessions.ha);
      assert.equal(p.impact.externalOmrOrResults,'UNKNOWN');
      assert.equal(await db.attendance.count(),before);
    });
    await check('wrong-session challenge and missing retention clearance rejected', async () => {
      const p = await cancellation.preview(sessions.ha,{purgeAttendance:true},'SA',0);
      await expectStatus(() => cancellation.confirm(sessions.hb,purge(p.challenge),'SA',randomUUID(),0),403);
      await expectStatus(() => cancellation.confirm(sessions.ha,{
        ...purge(p.challenge), retentionApproved:false,
      },'SA',randomUUID(),0),400);
      assert.equal(await db.attendanceSessionCancellation.count(),0);
    });
    await check('stale preview after a new mark fails closed', async () => {
      const p = await cancellation.preview(sessions.ha,{purgeAttendance:true},'SA',0);
      await attendance.mark(sessions.ha,{studentId:'ha-2',status:'PRESENT'},'TEACHER');
      await expectStatus(()=>cancellation.confirm(sessions.ha,purge(p.challenge),'SA',randomUUID(),0),409);
      assert.equal(await db.attendance.count({where:{sessionId:sessions.ha}}),2);
    });
    let openResult: any;
    await check('OPEN purge is exact, atomic, audited, preserves unrelated records', async () => {
      const p = await cancellation.preview(sessions.ha,{purgeAttendance:true},'SA',0);
      const key = randomUUID(), request = purge(p.challenge);
      openResult = await cancellation.confirm(sessions.ha,request,'SA',key,0);
      assert.equal(openResult.deletedCount,2);
      assert.equal(openResult.retainedCount,0);
      assert.equal(openResult.status,'CANCELLED');
      assert.equal((await db.attendanceSession.findUnique({where:{id:sessions.ha}})).isCurrent,false);
      assert.equal(await db.attendance.count({where:{sessionId:sessions.ha}}),0);
      assert.equal(await db.attendanceSessionCandidate.count({where:{sessionId:sessions.ha}}),2);
      assert.equal(await db.attendance.count({where:{sessionId:sessions.hb}}),1);
      assert.equal(await db.student.count(),7);
      assert.deepEqual(await cancellation.confirm(sessions.ha,request,'SA',key,0),openResult);
      await expectStatus(()=>cancellation.confirm(sessions.ha,{...request,reason:'Different synthetic reason'},'SA',key,0),409);
      await expectStatus(()=>cancellation.confirm(sessions.ha,request,'SA',randomUUID(),0),409);
    });
    await check('cancelled attempt rejects old QR/manual marks and closure', async () => {
      const qr = (await db.student.findUnique({where:{id:'ha-1'}})).qrToken;
      await expectStatus(()=>attendance.mark(sessions.ha,{qrToken:qr,status:'PRESENT'},'TEACHER'),409);
      await expectStatus(()=>attendance.mark(sessions.ha,{studentId:'ha-2',status:'PRESENT'},'TEACHER'),409);
      await expectStatus(()=>attendance.closeSession(sessions.ha,false,'ADMIN'),409);
    });
    await check('Super Admin can explicitly reopen only after cancellation, next attempt', async () => {
      await expectStatus(()=>attendance.openSession('ha','ADMIN'),403);
      const reopened = (await attendance.openSession('ha','SA')).session;
      assert.equal(reopened.attemptNumber,2);
      assert.equal(reopened.status,'OPEN');
      assert.equal(reopened.isCurrent,true);
      assert.notEqual(reopened.id,sessions.ha);
      assert.equal((await attendance.getSession(reopened.id)).stats.markedCount,0);
      assert.equal(await db.attendanceSessionCandidate.count({where:{sessionId:sessions.ha}}),2);
    });
    await check('CLOSED purge requires special finalized-evidence acknowledgement', async () => {
      const p = await cancellation.preview(sessions.hc,{purgeAttendance:true},'SA',0);
      assert.equal(p.session.status,'CLOSED');
      assert.equal(p.impact.absentCount,1);
      await expectStatus(()=>cancellation.confirm(sessions.hc,purge(p.challenge,false),'SA',randomUUID(),0),400);
      const result = await cancellation.confirm(sessions.hc,purge(p.challenge,true),'SA',randomUUID(),0);
      assert.equal(result.deletedCount,1);
      assert.equal(await db.attendance.count({where:{sessionId:sessions.hc}}),0);
      const closed = await db.attendanceSession.findUnique({where:{id:sessions.hc}});
      assert.equal(closed.status,'CANCELLED');
      assert.equal(closed.isCurrent,false);
      assert.equal(closed.closedByUserId,'ADMIN');
      assert(closed.closedAt);
    });
    await check('cancellation without purge preserves individual marks', async () => {
      const before = await db.attendance.findMany({where:{sessionId:sessions.he}});
      const p = await cancellation.preview(sessions.he,{purgeAttendance:false},'SA',0);
      const result = await cancellation.confirm(sessions.he,preserve(p.challenge),'SA',randomUUID(),0);
      assert.equal(result.deletedCount,0);
      assert.equal(result.retainedCount,1);
      assert.deepEqual(await db.attendance.findMany({where:{sessionId:sessions.he}}),before);
      assert.equal((await db.attendanceSession.findUnique({where:{id:sessions.he}})).status,'CANCELLED');
    });
    await check('score dependency prevents permanent purge', async () => {
      const p = await cancellation.preview(sessions.hd,{purgeAttendance:true},'SA',0);
      assert.equal(p.impact.scoredOrRankedCandidates,1);
      assert.equal(p.blockers.length,1);
      await expectStatus(()=>cancellation.confirm(sessions.hd,purge(p.challenge),'SA',randomUUID(),0),409);
      assert.equal((await db.attendanceSession.findUnique({where:{id:sessions.hd}})).status,'OPEN');
    });
    await check('database triggers reject direct mark deletion and audit modification', async () => {
      await assert.rejects(()=>pg!.query('DELETE FROM "Attendance" WHERE "sessionId"=$1',[sessions.hb]),/authorized.*audit/i);
      await assert.rejects(()=>pg!.query('UPDATE "AttendanceSessionCancellation" SET reason=$1 WHERE "sessionId"=$2',
        ['Tampered',sessions.ha]),/immutable/i);
      await assert.rejects(()=>pg!.query('DELETE FROM "AttendanceSessionCandidate" WHERE "sessionId"=$1',[sessions.hc]),/immutable/i);
      await assert.rejects(()=>pg!.query('UPDATE "AttendanceSession" SET status=$1 WHERE id=$2',['OPEN',sessions.hc]),/immutable/i);
    });
    await check('cancellation history records exact counts and no individual mark data', async () => {
      const history = await cancellation.history('SA',1,10,0);
      assert.equal(history.operations.length,3);
      const purged = history.operations.find((x:any) => x.sessionId===sessions.ha);
      assert.equal(purged.deletedCount,2);
      assert.equal(purged.previousStatus,'OPEN');
      assert.equal(purged.actorName,actorName);
      assert(!JSON.stringify(purged).includes('ha-1'));
      const active = await attendance.listSessions({page:1,limit:25});
      assert(!active.sessions.some((x:any)=>[sessions.ha,sessions.hc,sessions.he].includes(x.id)));
      const all = await attendance.listSessions({page:1,limit:25,includeHistory:true});
      assert(all.sessions.some((x:any)=>x.id===sessions.ha && x.status==='CANCELLED'));
    });
    await check('PR14 reset engine remains compatible on an unrelated OPEN Hall', async () => {
      const p = await reset.preview({
        mode:'HALL', businessDate:'2026-10-10', sessionIds:[sessions.hf],
      },'SA',0);
      assert.equal(p.totals.markedCount,1);
      const result = await reset.confirm({
        challenge:p.challenge, reason:'Synthetic control-group attendance reset',
        confirmationText:'RESET ATTENDANCE',
      },'SA',randomUUID(),0);
      assert.equal(result.attempts.length,1);
      assert.equal((await db.attendanceSession.findUnique({where:{id:sessions.hf}})).status,'OPEN');
      assert.equal((await attendance.getSession(result.attempts[0].newSessionId)).stats.markedCount,0);
      assert.equal(await db.attendance.count({where:{sessionId:sessions.hf}}),1);
    });

    await check('simultaneous attendance scan and cancellation cannot both succeed', async () => {
      await db.examHall.create({data:{
        id:'hg',name:'Race test',roomNumber:'hg',targetClass:'Class 9th',examDate:'2026-10-10',reportingTime:'08:00',
      }});
      await db.student.create({data:candidate('hg-1','hg')});
      const running = (await attendance.openSession('hg','ADMIN')).session;
      const p = await cancellation.preview(running.id,{purgeAttendance:true},'SA',0);
      const concurrent = await Promise.allSettled([
        cancellation.confirm(running.id,purge(p.challenge),'SA',randomUUID(),0),
        attendance.mark(running.id,{studentId:'hg-1',status:'PRESENT'},'TEACHER'),
      ]);
      assert.equal(concurrent.filter(row=>row.status==='fulfilled').length,1);
      const row = await db.attendanceSession.findUnique({where:{id:running.id}});
      if(row.status==='CANCELLED') {
        assert.equal(await db.attendance.count({where:{sessionId:running.id}}),0);
      } else {
        assert.equal(row.status,'OPEN');
        assert.equal(await db.attendance.count({where:{sessionId:running.id}}),1);
      }
    });
    await check('simultaneous duplicate requests produce exactly one audit operation', async () => {
      await db.examHall.create({data:{
        id:'hh',name:'Idempotence test',roomNumber:'hh',targetClass:'Class 9th',examDate:'2026-10-10',reportingTime:'08:00',
      }});
      await db.student.create({data:candidate('hh-1','hh')});
      const session = (await attendance.openSession('hh','ADMIN')).session;
      const p = await cancellation.preview(session.id,{purgeAttendance:false},'SA',0);
      const key = randomUUID();
      const req = preserve(p.challenge);
      const outcomes = await Promise.all([
        cancellation.confirm(session.id,req,'SA',key,0),
        cancellation.confirm(session.id,req,'SA',key,0),
      ]);
      assert.deepEqual(outcomes[0],outcomes[1]);
      assert.equal(await db.attendanceSessionCancellation.count({where:{sessionId:session.id}}),1);
    });
    await check('late transaction failure rolls back mark deletion and cancellation audit', async () => {
      await db.examHall.create({data:{
        id:'hi',name:'Rollback test',roomNumber:'hi',targetClass:'Class 9th',examDate:'2026-10-10',reportingTime:'08:00',
      }});
      await db.student.create({data:candidate('hi-1','hi')});
      const session = (await attendance.openSession('hi','ADMIN')).session;
      await attendance.mark(session.id,{studentId:'hi-1',status:'PRESENT'},'TEACHER');
      const p = await cancellation.preview(session.id,{purgeAttendance:true},'SA',0);
      await pg!.query("CREATE FUNCTION fixture_reject_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture rollback'; END $$");
      await pg!.query('CREATE TRIGGER fixture_fail_cancel BEFORE UPDATE ON "AttendanceSession" FOR EACH ROW WHEN (NEW.status=\'CANCELLED\') EXECUTE FUNCTION fixture_reject_cancellation()');
      try {
        await assert.rejects(()=>cancellation.confirm(session.id,purge(p.challenge),'SA',randomUUID(),0));
      } finally {
        await pg!.query('DROP TRIGGER fixture_fail_cancel ON "AttendanceSession"');
        await pg!.query('DROP FUNCTION fixture_reject_cancellation()');
      }
      assert.equal((await db.attendanceSession.findUnique({where:{id:session.id}})).status,'OPEN');
      assert.equal(await db.attendance.count({where:{sessionId:session.id}}),1);
      assert.equal(await db.attendanceSessionCancellation.count({where:{sessionId:session.id}}),0);
    });
    await check('Super Admin auth-token invalidation fails even before preview', async () => {
      await expectStatus(()=>cancellation.preview(sessions.hd,{purgeAttendance:false},'SA',1),401);
    });

    const express = (await import('express')).default;
    const { default: router } = await import('../src/modules/attendance/attendance.routes');
    const { errorHandler } = await import('../src/middleware/error.middleware');
    const { signAccessToken } = await import('../src/lib/jwt');
    shared = (await import('../src/lib/prisma')).prisma;
    const app = express();
    app.use(express.json());
    app.use('/api/attendance', router);
    app.use(errorHandler);
    server = app.listen(0,'127.0.0.1');
    await new Promise<void>(resolve=>server.once('listening',resolve));
    const addr = server.address();
    const base = 'http://127.0.0.1:'+addr.port+'/api/attendance';
    const bearer = (id: string, role: string) => ({
      Authorization:'Bearer '+signAccessToken({
        userId:id,email:id.toLowerCase()+'@example.invalid',role,name:id,tokenVersion:0,
      }),
      'Content-Type':'application/json',
    });
    await check('HTTP endpoints enforce authentication and Super Admin role', async () => {
      const cases = [
        {url:base+'/sessions/'+sessions.hb+'/cancel/preview',method:'POST'},
        {url:base+'/sessions/'+sessions.hb+'/cancel/confirm',method:'POST'},
        {url:base+'/cancellations/history',method:'GET'},
      ];
      for(const entry of cases) {
        const options:any = {method:entry.method,headers:{'Content-Type':'application/json'}};
        if(entry.method==='POST') options.body='{}';
        const guest = await fetch(entry.url,options);
        assert.equal(guest.status,401);
        for(const role of ['ADMIN','TEACHER']) {
          options.headers = bearer(role,role);
          const unauthorized = await fetch(entry.url,options);
          assert.equal(unauthorized.status,403);
        }
      }
    });
    await check('HTTP signed impact preview, cancellation, retry, history and record view', async () => {
      const headers = bearer('SA','SUPER_ADMIN');
      const url = base+'/sessions/'+sessions.hb+'/cancel';
      const pResponse = await fetch(url+'/preview',{
        method:'POST',headers,body:JSON.stringify({purgeAttendance:false}),
      });
      assert.equal(pResponse.status,200);
      const p = (await pResponse.json() as any).data;
      assert.equal(p.session.id,sessions.hb);
      assert.equal(p.impact.markedCount,1);
      const key = randomUUID();
      const opts:any = {
        method:'POST',headers:{...headers,'Idempotency-Key':key},
        body:JSON.stringify(preserve(p.challenge)),
      };
      const resultHttp = await fetch(url+'/confirm',opts);
      assert.equal(resultHttp.status,200);
      const result = (await resultHttp.json() as any).data;
      assert.equal(result.status,'CANCELLED');
      assert.equal(result.retainedCount,1);
      assert.equal(result.deletedCount,0);
      const retry = await fetch(url+'/confirm',opts);
      assert.equal(retry.status,200);
      assert.deepEqual((await retry.json() as any).data,result);
      const detail = await fetch(base+'/sessions/'+sessions.hb,{headers});
      assert.equal(detail.status,200);
      assert.equal((await detail.json() as any).data.session.status,'CANCELLED');
      const history = await fetch(base+'/cancellations/history?page=1&limit=10',{headers});
      assert.equal(history.status,200);
      assert((await history.json() as any).data.operations.some((row:any)=>row.sessionId===sessions.hb));
      const filter = await fetch(base+'/sessions?includeHistory=true&status=CANCELLED',{headers});
      assert.equal(filter.status,200);
      assert((await filter.json() as any).data.sessions.some((row:any)=>row.id===sessions.hb));
    });

    await check('HTTP exceptional CLOSED purge removes only the target ABSENT mark', async () => {
      await db.examHall.create({data:{
        id:'hj',name:'HTTP CLOSED test',roomNumber:'hj',
        targetClass:'Class 9th',examDate:'2026-10-10',reportingTime:'08:00',
      }});
      await db.student.create({data:candidate('hj-1','hj')});
      const closed = (await attendance.openSession('hj','ADMIN')).session;
      await attendance.closeSession(closed.id,true,'ADMIN');
      const headers = bearer('SA','SUPER_ADMIN');
      const url = base+'/sessions/'+closed.id+'/cancel';
      const request = await fetch(url+'/preview',{
        method:'POST',headers,body:JSON.stringify({purgeAttendance:true}),
      });
      assert.equal(request.status,200);
      const p = (await request.json() as any).data;
      assert.equal(p.session.status,'CLOSED');
      assert.equal(p.impact.absentCount,1);
      const denied = await fetch(url+'/confirm',{
        method:'POST',headers:{...headers,'Idempotency-Key':randomUUID()},
        body:JSON.stringify(purge(p.challenge,false)),
      });
      assert.equal(denied.status,400);
      const done = await fetch(url+'/confirm',{
        method:'POST',headers:{...headers,'Idempotency-Key':randomUUID()},
        body:JSON.stringify(purge(p.challenge,true)),
      });
      assert.equal(done.status,200);
      const result = (await done.json() as any).data;
      assert.equal(result.deletedCount,1);
      assert.equal(result.previousStatus,'CLOSED');
      assert.equal(await db.attendance.count({where:{sessionId:closed.id}}),0);
      assert.equal(await db.attendanceSessionCandidate.count({where:{sessionId:closed.id}}),1);
      assert.equal((await db.attendanceSession.findUnique({where:{id:closed.id}})).status,'CANCELLED');
    });

    console.log('Synthetic cancellation integrity PASS: '+passed+' checks.');
  } finally {
    if (server) await new Promise<void>(resolve=>server.close(resolve));
    await shared?.$disconnect();
    await db?.$disconnect();
    await pg?.end();
    if(created) {
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',[name]);
      await admin.query('DROP DATABASE "'+name+'"');
    }
    await admin.end();
  }
}
run().catch(error => {console.error(error);process.exitCode=1;});
