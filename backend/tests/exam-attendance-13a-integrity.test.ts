import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import express from 'express';

async function run() {
  if (process.env.NODE_ENV === 'production') throw new Error('Production tests prohibited.');
  const sourceUrl = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(sourceUrl.hostname)) throw new Error('Only a local test database is permitted.');
  const root = path.resolve(__dirname, '../..'), backend = path.join(root, 'backend');
  const name = 'attendance13a_' + randomUUID().replace(/-/g, '');
  const shadow = name + '_shadow';
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'azm-attendance13a-'));
  const admin = new Client({ connectionString: sourceUrl.toString() }); await admin.connect();
  let db: any, sharedDb: any, server: any, sql: any;
  let passed = 0;
  const check = async (label: string, work: () => any) => { await work(); passed++; console.log('PASS: ' + label); };
  try {
    await admin.query(`CREATE DATABASE "${name}"`); await admin.query(`CREATE DATABASE "${shadow}"`);
    const url = new URL(sourceUrl); url.pathname = '/' + name; url.searchParams.delete('schema');
    const shadowUrl = new URL(url); shadowUrl.pathname = '/' + shadow;
    process.env.DATABASE_URL = url.toString(); process.env.DIRECT_URL = url.toString(); process.env.NODE_ENV = 'test';
    const prismaCli = path.join(backend, 'node_modules/prisma/build/index.js');
    const baselineSchema = execFileSync('git', ['show', '9fef4f57f948be833d6113d8052d5b92cadb6a7a:backend/prisma/schema.prisma'], { cwd: root, encoding: 'utf8' });
    fs.mkdirSync(path.join(fixture, 'prisma/migrations'), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'prisma/schema.prisma'), baselineSchema.replace('directUrl = env("DIRECT_URL")', 'directUrl = env("DIRECT_URL")\n  shadowDatabaseUrl = env("ATTENDANCE_SHADOW_DATABASE_URL")'));
    for (const dir of fs.readdirSync(path.join(backend, 'prisma/migrations'), { withFileTypes: true })) {
      if ((dir.name.includes('exam_attendance_sessions') || dir.name.includes('attendance_reset_attempts'))) continue;
      fs.cpSync(path.join(backend, 'prisma/migrations', dir.name), path.join(fixture, 'prisma/migrations', dir.name), { recursive: true });
    }
    const migrationEnv = { ...process.env, ATTENDANCE_SHADOW_DATABASE_URL: shadowUrl.toString() };
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', path.join(fixture, 'prisma/schema.prisma')], { cwd: backend, env: migrationEnv, stdio: 'pipe' });
    const { PrismaClient } = await import('@prisma/client'); db = new PrismaClient();
    const studentData = (id: string, hall?: string) => ({ id, applicationNo: 'APP-' + id, qrToken: 'fixture-' + id, fullName: 'Candidate ' + id, fatherName: 'Private parent', gender: 'MALE' as const, dateOfBirth: new Date('2008-01-01'), cnicOrBForm: 'private-' + id, address: 'Private address', district: 'Fixture', province: 'Fixture', parentMobile: 'private-phone', currentClass: 'Class 9th', schoolName: 'Fixture', boardOrUniversity: 'Fixture', scholarshipCategory: 'GENERAL_MERIT' as const, emergencyContact: 'private-emergency', emergencyRelation: 'Private parent', assignedHallId: hall });
    await db.student.create({ data: studentData('legacy-attendance') });
    sql = new Client({ connectionString: url.toString() }); await sql.connect();
    await sql.query(`INSERT INTO "Attendance" (id,"studentId",date,status,"markedByUserId",method,"createdAt") VALUES ('old-mark','legacy-attendance','2026-01-02','PRESENT','old-operator','MANUAL','2026-01-02 08:00:00')`);
    const before = (await sql.query('SELECT * FROM "Attendance" WHERE id=\'old-mark\'')).rows[0];
    const schemaFile = path.join(fixture, 'prisma/schema.prisma');
    const newSchema = fs.readFileSync(path.join(backend, 'prisma/schema.prisma'), 'utf8').replace('directUrl = env("DIRECT_URL")', 'directUrl = env("DIRECT_URL")\n  shadowDatabaseUrl = env("ATTENDANCE_SHADOW_DATABASE_URL")');
    fs.writeFileSync(schemaFile, newSchema);
    const migrationName = fs.readdirSync(path.join(backend, 'prisma/migrations')).find(name => name.endsWith('_exam_attendance_sessions'))!;
    fs.cpSync(path.join(backend, 'prisma/migrations', migrationName), path.join(fixture, 'prisma/migrations', migrationName), { recursive: true });
    fs.cpSync(path.join(backend, 'prisma/migrations/20261010120000_attendance_reset_attempts'), path.join(fixture, 'prisma/migrations/20261010120000_attendance_reset_attempts'), { recursive: true });
    const migrationSql = fs.readFileSync(path.join(backend, 'prisma/migrations', migrationName, 'migration.sql'), 'utf8');
    await check('migration SQL contains no data rewriting or deletion', () => { assert(!/^(INSERT|UPDATE|DELETE|TRUNCATE|DROP TABLE)\s/im.test(migrationSql)); });
    const migrateOutput = execFileSync(process.execPath, [prismaCli, 'migrate', 'dev', '--schema', schemaFile, '--skip-generate', '--skip-seed'], { cwd: backend, env: migrationEnv, stdio: 'pipe', encoding: 'utf8' });
    console.log('Local Prisma migrate dev completed against dedicated disposable databases.');
    await check('existing Attendance survives migration unchanged with null session', async () => { const after = (await sql.query('SELECT * FROM "Attendance" WHERE id=\'old-mark\'')).rows[0]; assert.equal(after.sessionId, null); delete after.sessionId; assert.deepEqual(after, before); assert.equal(await db.attendanceSession.count(), 0); });
    await check('migration schema has no drift or extra generated migration', () => { assert(!/The following migration\(s\) have been created/.test(migrateOutput)); });
    sharedDb = (await import('../src/lib/prisma')).prisma;
    const { AttendanceService, attendanceService: attendance, karachiBusinessDate } = await import('../src/modules/attendance/attendance.service');
    const { examHallsService: halls } = await import('../src/modules/exam-halls/examHalls.service');
    const { qrService } = await import('../src/modules/attendance/qr.service');
    const { default: router } = await import('../src/modules/attendance/attendance.routes');
    const { errorHandler } = await import('../src/middleware/error.middleware');
    const { signAccessToken } = await import('../src/lib/jwt');
    const { attendanceController } = await import('../src/modules/attendance/attendance.controller');
    const center = await db.testCenter.create({ data: { name: 'Fixture Center', code: 'FIX', address: '', district: '', province: '' } });
    const hallData = (id: string, examDate = '2026-11-15') => ({ id, name: 'Hall ' + id, roomNumber: 'Room ' + id, targetClass: 'Class 9th', examDate, reportingTime: '08:00', capacity: 20, testCenterId: center.id });
    for (const id of ['a','b','empty','race','close-yes','history','date-race','move-race']) await db.examHall.create({ data: hallData(id) });
    await db.examHall.create({ data: hallData('bad-date', '31 February 2026') });
    for (const [id, hall] of [['a1','a'],['a2','a'],['a3','a'],['inactive','a'],['b1','b'],['r1','race'],['r2','race'],['c1','close-yes'],['c2','close-yes'],['h1','history'],['d1','date-race'],['m1','move-race']] as const) await db.student.create({ data: { ...studentData(id,hall), seatNo: 'Seat-' + id, rollNumber: 'ROLL-' + id, status: 'ACTIVE', currentClass: id === 'inactive' ? 'Other informational class' : 'Class 9th' } });
    await db.student.create({ data: { ...studentData('legacy-text'), assignedHall: 'Hall empty', assignedRoom: 'Room empty', seatNo: 'Old seat' } });
    await db.student.create({ data: studentData('class-only') });
    const ownQr = qrService.generateSignedQrToken('a3'), wrongQr = qrService.generateSignedQrToken('b1');
    await db.student.update({ where: { id:'a3' }, data: { qrToken:ownQr } }); await db.student.update({ where: { id:'b1' }, data: { qrToken:wrongQr } });
    for (const role of ['ADMIN','SUPER_ADMIN','TEACHER','ACCOUNTANT']) await db.user.create({ data: { id:role, name:'Fixture ' + role, email:role+'@test.invalid', passwordHash:'fixture-only', role } });
    const app = express(); app.use(express.json()); app.use('/api/attendance', router); app.use(errorHandler); server = app.listen(0,'127.0.0.1'); await new Promise<void>(resolve => server.once('listening',resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/attendance`;
    const token = (role: string) => signAccessToken({ userId:role, email:role+'@test.invalid', role, name:'Fixture', tokenVersion:0 });
    async function request(route: string, body?: any, role: string | null = 'ADMIN') { const response = await fetch(base+route,{ method:body ? 'POST':'GET', headers:{'Content-Type':'application/json', ...(role ? {Authorization:'Bearer '+token(role)} : {})}, ...(body ? {body:JSON.stringify(body)} : {}) }); return {status:response.status, body:await response.json()}; }
    async function conflict(work:()=>Promise<any>, status=409) { await assert.rejects(work,(error:any)=>error.statusCode===status); }
    await check('unavailable database reads reject instead of returning synthetic zero',async()=>{
      const unavailable = new AttendanceService({$transaction: async()=>undefined} as any);
      await conflict(()=>unavailable.getTodayAttendance(),503);
    });
    await check('unknown session reads and marks reject',async()=>{
      assert.equal((await request('/sessions/missing')).status,404);
      assert.equal((await request('/sessions/missing/mark',{studentId:'a1'})).status,404);
    });
    await check('authentication required', async()=>assert.equal((await request('/sessions',{},null)).status,401));
    await check('TEACHER cannot open and ACCOUNTANT has no operational access',async()=>{assert.equal((await request('/sessions',{examHallId:'a'},'TEACHER')).status,403);assert.equal((await request('/today',undefined,'ACCOUNTANT')).status,403);});
    await check('Hall is required and class scope rejected',async()=>{assert.equal((await request('/sessions',{})).status,400);assert.equal((await request('/sessions',{examHallId:'a',classLevel:'Class 9th'})).status,400);assert.equal((await request('/today?classLevel=Class%209th')).status,400);});
    await check('invalid Hall and invalid configured exam date rejected',async()=>{assert.equal((await request('/sessions',{examHallId:'missing'})).status,404);assert.equal((await request('/sessions',{examHallId:'bad-date'})).status,409);});
    await check('empty explicit roster rejects legacy/class/targetClass matches',async()=>assert.equal((await request('/sessions',{examHallId:'empty'})).status,409));

    const opened=await request('/sessions',{examHallId:'a'});const a=opened.body.data.session.id;
    await db.student.update({ where: { id: 'inactive' }, data: { status: 'INACTIVE' } });
    await check('ADMIN opens snapshot of every explicit candidate only',()=>{assert.equal(opened.status,201);assert.equal(opened.body.data.stats.expectedCount,4);assert.deepEqual(opened.body.data.roster.map((row:any)=>row.studentId).sort(),['a1','a2','a3','inactive']);});
    await check('snapshots retain seat/name/roll/application/class and exclude private fields',()=>{const row=opened.body.data.roster.find((r:any)=>r.studentId==='a1');assert.equal(row.seatNoSnapshot,'Seat-a1');assert.equal(row.rollNumberSnapshot,'ROLL-a1');assert.equal(row.applicationNoSnapshot,'APP-a1');assert.equal(row.currentClassSnapshot,'Class 9th');assert.equal(row.fullNameSnapshot,'Candidate a1');assert(!/cnic|mobile|email|document|father|fee|parent/i.test(JSON.stringify(opened.body.data)));});
    await check('business date derives Hall date, not server date; Karachi midnight boundary',()=>{assert.equal(opened.body.data.session.businessDate.slice(0,10),'2026-11-15');assert.equal(karachiBusinessDate(new Date('2026-10-07T20:01:00Z')).toISOString().slice(0,10),'2026-10-08');});
    await check('duplicate Hall/business date conflicts',async()=>assert.equal((await request('/sessions',{examHallId:'a'})).status,409));
    const superOpen=await request('/sessions',{examHallId:'b'},'SUPER_ADMIN');const b=superOpen.body.data.session.id;
    await check('SUPER_ADMIN opens; TEACHER views but cannot close',async()=>{assert.equal(superOpen.status,201);assert.equal((await request('/sessions/'+a,undefined,'TEACHER')).status,200);assert.equal((await request('/sessions/'+a+'/close',{},'TEACHER')).status,403);});
    await check('OPEN session blocks Hall move, batch move and unassign',async()=>{await conflict(()=>halls.updateStudentAllocation('a1',{assignedHallId:'b'}));await conflict(()=>halls.batchAssign('b',{studentIds:['a2']}));await conflict(()=>halls.unassignStudent('a1'));});
    await check('session Hall and candidate snapshots remain stable after edits',async()=>{await db.examHall.update({where:{id:'a'},data:{name:'Renamed Hall',roomNumber:'Changed Room'}});await db.student.update({where:{id:'a1'},data:{fullName:'Changed name',rollNumber:'CHANGED-ROLL',currentClass:'Other class'}});const detail=await attendance.getSession(a);assert.equal(detail.session.hallNameSnapshot,'Hall a');assert.equal(detail.roster.find((row:any)=>row.studentId==='a1')?.fullNameSnapshot,'Candidate a1');});
    await check('compatibility manual mark requires session and no fabricated operator',async()=>{assert.equal((await request('/scan',{studentId:'a1'})).status,400);await conflict(()=>attendance.mark(a,{studentId:'a1',status:'PRESENT'},''),401);let error:any;await attendanceController.mark({params:{sessionId:a},body:{studentId:'a1'}} as any,{} as any,e=>{error=e});assert.equal(error.statusCode,401);});
    await check('outside roster and inactive candidate rejected',async()=>{assert.equal((await request('/sessions/'+a+'/mark',{studentId:'b1'})).status,409);assert.equal((await request('/sessions/'+a+'/mark',{studentId:'inactive'})).status,409);});
    await check('invalid QR, valid QR wrong Hall and QR ABSENT rejected',async()=>{assert.equal((await request('/sessions/'+a+'/mark',{qrToken:'qr_forged.bad'})).status,400);assert.equal((await request('/sessions/'+a+'/mark',{qrToken:wrongQr})).status,409);assert.equal((await request('/sessions/'+a+'/mark',{qrToken:ownQr,status:'ABSENT'})).status,400);});
    await check('manual frozen roll identifier succeeds and authenticated operator stored',async()=>{const result=await request('/sessions/'+a+'/mark',{rollNumber:'ROLL-a1',status:'LATE'},'TEACHER');assert.equal(result.status,201);assert.equal(result.body.data.attendance.markedByUserId,'TEACHER');assert.equal(result.body.data.attendance.method,'MANUAL');});
    await check('valid QR defaults PRESENT; duplicate returns 409',async()=>{const result=await request('/sessions/'+a+'/mark',{qrToken:ownQr});assert.equal(result.status,201);assert.equal(result.body.data.attendance.status,'PRESENT');assert.equal(result.body.data.attendance.method,'QR_SCAN');assert.equal((await request('/sessions/'+a+'/mark',{studentId:'a3'})).status,409);});
    await check('marks expose no edit or delete routes',async()=>{
      for(const method of ['PATCH','DELETE']) {
        const response=await fetch(base+'/sessions/'+a+'/mark',{method,headers:{Authorization:'Bearer '+token('ADMIN'),'Content-Type':'application/json'},body:JSON.stringify({studentId:'a3',status:'ABSENT'})});
        assert.equal(response.status,404);
      }
      assert.equal((await attendance.getSession(a)).stats.presentCount,1);
    });
    await check('close rejects nonboolean absence conversion',async()=>assert.equal((await request('/sessions/'+a+'/close',{markRemainingAbsent:'true'})).status,400));
    await check('metrics use frozen expected roster and unmarked stays NOT_MARKED',async()=>{const detail=await attendance.getSession(a);assert.deepEqual(detail.stats,{expectedCount:4,markedCount:2,presentCount:1,lateCount:1,absentCount:0,unmarkedCount:2,manualCount:1,qrCount:1,completionPercentage:50,attendancePercentage:50});assert.equal(detail.roster.find((row:any)=>row.studentId==='a2')?.status,'NOT_MARKED');});
    await check('session search is paginated and scoped to frozen safe fields',async()=>{const result=await request('/sessions/'+a+'/candidates?search=Seat-a2&limit=1');assert.equal(result.body.data.pagination.total,1);assert.equal(result.body.data.candidates[0].studentId,'a2');assert.equal((await request('/sessions/'+a+'/candidates?classLevel=Class%209th')).status,400);});
    await check('no session date yields null; session date uses frozen denominator',async()=>{assert.equal((await attendance.getTodayAttendance(new Date('2026-10-07T10:00:00Z'))).attendancePercentage,null);const today=await attendance.getTodayAttendance(new Date('2026-11-15T10:00:00Z'));assert.equal(today.expectedCount,5);assert.equal(today.attendancePercentage,40);});
    await check('close default false preserves NOT_MARKED and records closing operator',async()=>{const result=await request('/sessions/'+a+'/close',{});assert.equal(result.status,200);assert.equal(result.body.data.stats.absentCount,0);assert.equal(result.body.data.stats.unmarkedCount,2);assert.equal(result.body.data.session.closedByUserId,'ADMIN');assert.equal(result.body.data.session.status,'CLOSED');});
    await check('CLOSED session rejects further marking and does not block later Hall changes',async()=>{assert.equal((await request('/sessions/'+a+'/mark',{studentId:'a2'})).status,409);await halls.updateStudentAllocation('a1',{assignedHallId:'b'});await halls.unassignStudent('a2');assert.equal((await attendance.getSession(a)).stats.expectedCount,4);});
    const c=(await attendance.openSession('close-yes','ADMIN')).session.id;
    await attendance.mark(c,{studentId:'c1',status:'PRESENT'},'ADMIN');
    await check('explicit absence conversion only marks remaining roster candidates',async()=>{const result=await attendance.closeSession(c,true,'ADMIN');assert.equal(result.stats.presentCount,1);assert.equal(result.stats.absentCount,1);assert.equal(result.stats.unmarkedCount,0);assert.equal(result.roster.find((r:any)=>r.studentId==='c2')?.status,'ABSENT');});
    const race=(await attendance.openSession('race','ADMIN')).session.id;
    await check('concurrent duplicate marking creates exactly one attendance',async()=>{const results=await Promise.allSettled([attendance.mark(race,{studentId:'r1',status:'PRESENT'},'ADMIN'),attendance.mark(race,{studentId:'r1',status:'LATE'},'ADMIN')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await db.attendance.count({where:{sessionId:race,studentId:'r1'}}),1);});
    await check('mark versus close race is serialized without contradictory state',async()=>{const results=await Promise.allSettled([attendance.mark(race,{studentId:'r2',status:'PRESENT'},'ADMIN'),attendance.closeSession(race,true,'ADMIN')]);assert.equal(results[1].status,'fulfilled');const detail=await attendance.getSession(race);assert.equal(detail.session.status,'CLOSED');assert.equal(detail.stats.markedCount,2);assert.equal(await db.attendance.count({where:{sessionId:race,studentId:'r2'}}),1);await conflict(()=>attendance.mark(race,{studentId:'r2',status:'PRESENT'},'ADMIN'));});
    await check('concurrent Hall/date opens yield one immutable session',async()=>{const results=await Promise.allSettled([attendance.openSession('date-race','ADMIN'),attendance.openSession('date-race','SUPER_ADMIN')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await db.attendanceSession.count({where:{examHallId:'date-race'}}),1);});
    await check('opening versus Hall movement race cannot invalidate an OPEN frozen roster',async()=>{
      const results=await Promise.allSettled([attendance.openSession('move-race','ADMIN'),halls.updateStudentAllocation('m1',{assignedHallId:'empty'})]);
      assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
      const session=await db.attendanceSession.findFirst({where:{examHallId:'move-race'}});
      const candidate=await db.student.findUnique({where:{id:'m1'}});
      if(session) {assert.equal(candidate.assignedHallId,'move-race');assert.equal((await attendance.getSession(session.id)).stats.expectedCount,1);}
      else assert.equal(candidate.assignedHallId,'empty');
    });
    await check('student history percentage includes marked and unmarked expected sessions',async()=>{
      const first=(await attendance.openSession('history','ADMIN')).session.id;
      await attendance.mark(first,{studentId:'h1',status:'PRESENT'},'ADMIN');await attendance.closeSession(first,false,'ADMIN');
      await db.examHall.update({where:{id:'history'},data:{examDate:'2026-11-16'}});
      const second=(await attendance.openSession('history','ADMIN')).session.id;await attendance.closeSession(second,false,'ADMIN');
      await halls.updateStudentAllocation('h1',{assignedHallId:'empty'});
      const history=await attendance.getStudentAttendanceHistory('h1');assert.equal(history.stats.expectedCount,2);assert.equal(history.stats.markedCount,1);assert.equal(history.stats.attendancePercentage,50);assert.equal(history.history.length,2);
    });
    await check('exceptional stored empty session reports null percentage',async()=>{
      const empty=await db.attendanceSession.create({data:{examHallId:'bad-date',businessDate:new Date('2026-11-15'),openedByUserId:'ADMIN',hallNameSnapshot:'Historical empty',roomNumberSnapshot:'Empty',examDateSnapshot:'Historical',reportingTimeSnapshot:''}});
      const detail=await attendance.getSession(empty.id);assert.equal(detail.stats.expectedCount,0);assert.equal(detail.stats.attendancePercentage,null);
    });
    await check('student history includes expected sessions without marks and labels legacy separately',async()=>{const history=await attendance.getStudentAttendanceHistory('a2');assert.equal(history.stats.expectedCount,1);assert.equal(history.stats.attendancePercentage,0);assert.equal(history.history[0].status,'NOT_MARKED');assert.equal(history.history[0].seatNoSnapshot,'Seat-a2');const old=await attendance.getStudentAttendanceHistory('legacy-attendance');assert.equal(old.stats.attendancePercentage,null);assert.equal(old.legacyHistory[0].label,'Legacy attendance record');assert.equal(old.legacyHistory[0].id,'old-mark');});
    await check('session history paginates by Hall/date/status without class scope',async()=>{const result=await request('/sessions?examHallId=a&status=CLOSED&limit=1');assert.equal(result.body.data.pagination.total,1);assert.equal(result.body.data.sessions[0].stats.expectedCount,4);assert.equal((await request('/sessions?classLevel=Class%209th')).status,400);});
    await check('historical session prevents accidental Hall deletion',async()=>assert.rejects(()=>db.examHall.delete({where:{id:'a'}})));
    await check('database rejects attendance outside frozen roster',async()=>assert.rejects(()=>db.attendance.create({data:{sessionId:b,studentId:'class-only',status:'PRESENT',method:'MANUAL',markedByUserId:'ADMIN'}})));
    await check('authenticated attendance limiter allows rapid requests then protects operator',async()=>{let limited=false;for(let i=0;i<305;i++){const result=await request('/sessions/'+a+'/mark',{studentId:'a2',status:'INVALID'});if(result.status===429){limited=true;break;}assert.equal(result.status,400);}assert(limited);});
    if (process.env.ATTENDANCE_RUN_REGRESSIONS === '1') {
      const tests = ['user-management.test.ts', 'student-class-filtering.test.ts', 'roll-number-decoupling.test.ts'];
      const output = execFileSync(process.execPath, ['--import', 'tsx', '--test', ...tests.map(test => path.join(backend, 'tests', test))], { cwd: backend, env: process.env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      console.log(output);
    }
    console.log(`Examination Attendance 13A integrity: ${passed} PASS, 0 FAIL.`);
  } finally {
    if(server) await new Promise<void>(resolve=>server.close(resolve));
    if(sharedDb) await sharedDb.$disconnect(); if(db) await db.$disconnect(); if(sql) await sql.end();
    // Only UUID-named disposable databases created above are removed.
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ($1,$2) AND pid<>pg_backend_pid()',[name,shadow]);
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`); await admin.query(`DROP DATABASE IF EXISTS "${shadow}"`);await admin.end();
    console.log('Dedicated local attendance databases cleaned; application and production databases untouched.');
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
