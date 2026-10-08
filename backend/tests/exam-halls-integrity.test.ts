import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client, types } from 'pg';
import dotenv from 'dotenv';
import express from 'express';

// Real local PostgreSQL, isolated fixture schema only. Never reset/seed the app DB.
async function run() {
  // Prisma interprets timestamp-without-time-zone as UTC; match that in assertions.
  types.setTypeParser(1114, value => new Date(value + 'Z'));
  if (process.env.NODE_ENV === 'production') throw new Error('Production tests prohibited.');
  const localUrl = process.env.HALL_TEST_DATABASE_URL || dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env'))).DATABASE_URL;
  const url = new URL(localUrl);
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) throw new Error('Hall fixtures require a local database.');
  const schema = 'hall_test_' + randomUUID().replace(/-/g, '');
  const setup = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 3000 });
  await setup.connect();
  let db: any;
  let server: any;
  let passed = 0;
  try {
    await setup.query(`CREATE SCHEMA "${schema}"`);
    await setup.query(`SET search_path TO "${schema}"`);
    // Minimal test tables mirror the relevant existing Prisma columns. This is
    // temporary fixture DDL, not a project schema change or migration.
    await setup.query(`
      CREATE TABLE "TestCenter" (
        id text PRIMARY KEY, name text NOT NULL, code text UNIQUE NOT NULL,
        campus text, address text NOT NULL DEFAULT '', district text NOT NULL DEFAULT '',
        province text NOT NULL DEFAULT '', capacity integer NOT NULL DEFAULT 300,
        "reportingTime" text NOT NULL DEFAULT '', "testDate" text NOT NULL DEFAULT '',
        "contactPerson" text, "contactPhone" text, status text NOT NULL DEFAULT 'ACTIVE',
        "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE "ExamHall" (
        id text PRIMARY KEY, name text NOT NULL, "roomNumber" text NOT NULL,
        "targetClass" text NOT NULL, wing text, capacity integer NOT NULL DEFAULT 60,
        "invigilatorName" text, "invigilatorPhone" text, "reportingTime" text NOT NULL DEFAULT '09:00 AM',
        "examDate" text NOT NULL DEFAULT 'Sunday, 15 November 2026',
        "testCenterId" text REFERENCES "TestCenter"(id) ON DELETE SET NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE "Student" (
        id text PRIMARY KEY, "fullName" text NOT NULL, "rollNumber" text, "applicationNo" text,
        "currentClass" text NOT NULL, "assignedHallId" text, "assignedHall" text, "assignedRoom" text,
        "seatNo" text, "feeStatus" text, "updatedAt" timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE "OfficeUseRecord" (
        id text PRIMARY KEY, "studentId" text UNIQUE NOT NULL REFERENCES "Student"(id) ON DELETE CASCADE,
        "documentVerifiedBy" text, "documentVerifiedAt" timestamp, eligibility text,
        "eligibilityRemarks" text, "testRollNo" text, "testCentre" text, "testReportingTime" text,
        "testDate" timestamp, "interviewDate" timestamp, "interviewTime" text, "panelNo" text,
        "finalStatus" text, "officeRemarks" text, "authorizedBy" text
      );
      CREATE TYPE "AttendanceSessionStatus" AS ENUM ('OPEN', 'CLOSED');
      CREATE TABLE "AttendanceSession" (
        id text PRIMARY KEY, status "AttendanceSessionStatus" NOT NULL
      );
      CREATE TABLE "AttendanceSessionCandidate" (
        id text PRIMARY KEY, "sessionId" text NOT NULL REFERENCES "AttendanceSession"(id),
        "studentId" text NOT NULL REFERENCES "Student"(id)
      );
      CREATE TABLE "User" (
        id text PRIMARY KEY, name text NOT NULL, email text NOT NULL, role text NOT NULL,
        status text NOT NULL, "tokenVersion" integer NOT NULL DEFAULT 0
      );
      INSERT INTO "TestCenter" (id,name,code,"reportingTime","testDate") VALUES
        ('center-a','Fixture Center A','A','08:30 AM','2026-11-15'),
        ('center-b','Fixture Center B','B','10:00 AM','2026-11-16');
      INSERT INTO "Student" (id,"fullName","applicationNo","currentClass","feeStatus")
        SELECT 's'||n, 'Fixture '||lpad(n::text,3,'0'), 'APP'||n, 'Class 9th',
        CASE WHEN n%2=0 THEN 'PAID' ELSE 'UNPAID' END FROM generate_series(1,60) n;
      INSERT INTO "User" VALUES
        ('admin','Fixture Admin','admin@test.invalid','ADMIN','ACTIVE',0),
        ('super','Fixture Super','super@test.invalid','SUPER_ADMIN','ACTIVE',0),
        ('teacher','Fixture Teacher','teacher@test.invalid','TEACHER','ACTIVE',0),
        ('accountant','Fixture Accountant','accountant@test.invalid','ACCOUNTANT','ACTIVE',0);
    `);
    url.searchParams.set('schema', schema);
    process.env.DATABASE_URL = url.toString();
    process.env.DIRECT_URL = url.toString();
    process.env.NODE_ENV = 'test';
    const prismaModule = await import('../src/lib/prisma');
    db = prismaModule.prisma;
    const { examHallsService: halls, hallDate } = await import('../src/modules/exam-halls/examHalls.service');
    const { testCentersService: centers } = await import('../src/modules/test-centers/testCenters.service');
    const { createExamHallSchema, candidateQuerySchema } = await import('../src/modules/exam-halls/examHalls.schema');
    const { default: hallRouter } = await import('../src/modules/exam-halls/examHalls.routes');
    const { default: centerRouter } = await import('../src/modules/test-centers/testCenters.routes');
    const { errorHandler } = await import('../src/middleware/error.middleware');
    const { signAccessToken } = await import('../src/lib/jwt');
    const app = express(); app.use(express.json()); app.use('/api/exam-halls', hallRouter); app.use('/api/test-centers', centerRouter); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const token = (id: string, role: string) => signAccessToken({ userId: id, role, email: id+'@test.invalid', name: 'Fixture', tokenVersion: 0 });
    const headers = { Authorization: 'Bearer ' + token('admin', 'ADMIN'), 'Content-Type': 'application/json' };
    const request = async (route: string, options: RequestInit = {}) => {
      const response = await fetch(base + route, { headers, ...options });
      return { status: response.status, body: await response.json() as any };
    };
    const check = async (name: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log('PASS: '+name); };
    const conflict = async (fn: () => Promise<unknown>, status = 409) => assert.rejects(fn, (error: any) => error.statusCode === status);
    const create = (name: string, capacity: number, centerId?: string) => halls.createExamHall(createExamHallSchema.parse({ name, roomNumber: name, targetClass: 'Class 9th', capacity, testCenterId: centerId }));
    let a: any, b: any;
    await check('authenticated admin lists truthful empty halls', async () => { const r = await request('/exam-halls'); assert.equal(r.status,200); assert.deepEqual(r.body.data,[]); });
    await check('unauthenticated Hall reads and placement rejected', async () => { for (const route of ['/exam-halls','/exam-halls/candidates','/exam-halls/missing']) assert.equal((await request(route,{headers:{}})).status,401); });
    await check('teacher and accountant rejected', async () => { for (const role of ['TEACHER','ACCOUNTANT']) assert.equal((await request('/exam-halls',{headers:{Authorization:'Bearer '+token(role.toLowerCase(),role)}})).status,403); });
    await check('super admin permitted', async () => { assert.equal((await request('/exam-halls',{headers:{Authorization:'Bearer '+token('super','SUPER_ADMIN')}})).status,200); });
    await check('Test Center reads require admin', async () => { assert.equal((await request('/test-centers',{headers:{}})).status,401); assert.equal((await request('/test-centers')).status,200); });
    await check('create valid hall inherits selected center', async () => { const r=await request('/exam-halls',{method:'POST',body:JSON.stringify({name:'A',roomNumber:'A',targetClass:'Class 9th',capacity:2,testCenterId:'center-a'})}); assert.equal(r.status,201); a=r.body.data; assert.equal(a.reportingTime,'08:30 AM'); assert.equal(a.examDate,'2026-11-15'); b=await create('B',4,'center-b'); });
    await check('no runtime schedule defaults without center', async () => { const h=await create('Unknown',2); assert.equal(h.examDate,''); assert.equal(h.reportingTime,''); assert.equal(h.centerName,null); await halls.deleteExamHall(h.id); });
    await check('invalid capacities and unknown center rejected', async () => { for (const capacity of [0,-1,1.5,'bad','60abc']) assert.equal((await request('/exam-halls',{method:'POST',body:JSON.stringify({name:'Invalid',roomNumber:'x',targetClass:'x',capacity})})).status,400); await conflict(()=>create('Missing center',2,'missing'),404); });
    await check('class matching and legacy mirrors never allocate', async () => { await setup.query(`UPDATE "Student" SET "assignedHall"='A',"assignedRoom"='A' WHERE id='s60'`); assert.equal((await halls.getExamHallById(a.id)).assignedCount,0); });
    await check('assign candidate derives authoritative mirrors', async () => { await halls.batchAssign(a.id,{studentIds:['s1'],hallName:'spoof',testCenterName:'spoof'}); const row=(await setup.query(`SELECT s.*,o."testCentre",o."testReportingTime",o."testDate" FROM "Student" s LEFT JOIN "OfficeUseRecord" o ON o."studentId"=s.id WHERE s.id='s1'`)).rows[0]; assert.equal(row.assignedHallId,a.id); assert.equal(row.assignedHall,'A'); assert.equal(row.seatNo,'Seat #01'); assert.equal(row.testCentre,'Fixture Center A'); assert.equal(row.testDate.toISOString().slice(0,10),'2026-11-15'); });
    await check('overflow rejected atomically with HTTP 409', async () => { const r=await request(`/exam-halls/${a.id}/batch-assign`,{method:'POST',body:JSON.stringify({studentIds:['s2','s3']})}); assert.equal(r.status,409); assert.match(r.body.error.message,/1 of 2/); assert.equal((await setup.query(`SELECT count(*) FROM "Student" WHERE id IN ('s2','s3') AND "assignedHallId" IS NOT NULL`)).rows[0].count,'0'); });
    await check('every student must exist before batch writes', async () => { await conflict(()=>halls.batchAssign(a.id,{studentIds:['s2','missing']}),404); assert.equal((await setup.query(`SELECT "assignedHallId" FROM "Student" WHERE id='s2'`)).rows[0].assignedHallId,null); });
    await check('mid-batch database failure rolls back every allocation', async () => {
      const hall=await create('Rollback',3);
      await setup.query(`ALTER TABLE "OfficeUseRecord" ADD CONSTRAINT fixture_reject CHECK ("studentId" <> 's14')`);
      try {
        await assert.rejects(()=>halls.batchAssign(hall.id,{studentIds:['s13','s14']}));
        assert.equal((await halls.getExamHallById(hall.id)).assignedCount,0);
        assert.equal((await setup.query(`SELECT count(*) FROM "OfficeUseRecord" WHERE "studentId" IN ('s13','s14')`)).rows[0].count,'0');
      } finally {
        await setup.query(`ALTER TABLE "OfficeUseRecord" DROP CONSTRAINT fixture_reject`);
        await halls.deleteExamHall(hall.id);
      }
    });
    await check('named-month dates convert safely without rewriting Hall display', () => {
      assert.equal(hallDate('Sunday, 15 November 2026')?.toISOString(),'2026-11-15T00:00:00.000Z');
      assert.equal(hallDate('15 Nov 2026')?.toISOString(),'2026-11-15T00:00:00.000Z');
      assert.equal(hallDate('30 February 2026'),null);
    });
    await check('duplicate IDs deduplicate count and writes', async () => { const result=await halls.batchAssign(a.id,{studentIds:['s2','s2']}); assert.equal(result.assignedCount,1); assert.equal((await halls.getExamHallById(a.id)).assignedCount,2); });
    await check('repeat assignment is idempotent at full capacity', async () => { await halls.batchAssign(a.id,{studentIds:['s1','s2','s1']}); assert.deepEqual((await halls.getExamHallById(a.id)).assignedStudents.map((s:any)=>s.seatNo),['Seat #01','Seat #02']); });
    await check('occupied hall delete and capacity reduction return 409', async () => { assert.equal((await request(`/exam-halls/${a.id}`,{method:'DELETE'})).status,409); assert.equal((await request(`/exam-halls/${a.id}`,{method:'PATCH',body:JSON.stringify({capacity:1})})).status,409); });
    await check('move removes old seat and synchronizes OfficeUse', async () => { await halls.batchAssign(b.id,{studentIds:['s3']}); await halls.updateStudentAllocation('s1',{assignedHallId:b.id}); const row=(await setup.query(`SELECT s."seatNo",o."testCentre",o."testReportingTime",o."testDate" FROM "Student" s JOIN "OfficeUseRecord" o ON o."studentId"=s.id WHERE s.id='s1'`)).rows[0]; assert.equal(row.seatNo,'Seat #02'); assert.equal(row.testCentre,'Fixture Center B'); assert.equal(row.testReportingTime,'10:00 AM'); assert.equal(row.testDate.toISOString().slice(0,10),'2026-11-16'); });
    await check('duplicate seat same hall rejected', async () => { await conflict(()=>halls.updateStudentAllocation('s1',{seatNo:'Seat #01'})); assert.equal((await setup.query(`SELECT "seatNo" FROM "Student" WHERE id='s1'`)).rows[0].seatNo,'Seat #02'); });
    await check('same seat in different halls allowed', async () => { await halls.updateStudentAllocation('s2',{seatNo:'Seat #01'}); assert.equal((await halls.getExamHallById(a.id)).assignedStudents[0].seatNo,'Seat #01'); });
    await check('first free seat fills gaps without collision', async () => { await halls.unassignStudent('s3'); await halls.batchAssign(b.id,{studentIds:['s4']}); const rows=(await halls.getExamHallById(b.id)).assignedStudents; assert.equal(rows.find((s:any)=>s.id==='s4').seatNo,'Seat #01'); assert.equal(new Set(rows.map((s:any)=>s.seatNo)).size,rows.length); });
    await check('hall edits synchronize all allocated mirrors and schedule', async () => { await halls.updateExamHall(b.id,{name:'B renamed',roomNumber:'Room B2',testCenterId:'center-a',examDate:'2026-12-01'}); const rows=(await setup.query(`SELECT s."assignedHall",s."assignedRoom",o."testCentre",o."testDate" FROM "Student" s JOIN "OfficeUseRecord" o ON o."studentId"=s.id WHERE s."assignedHallId"=$1`,[b.id])).rows; assert.equal(rows.length,2); for(const row of rows){assert.equal(row.assignedHall,'B renamed');assert.equal(row.assignedRoom,'Room B2');assert.equal(row.testCentre,'Fixture Center A');assert.equal(row.testDate.toISOString().slice(0,10),'2026-12-01');} });
    await check('hall detail minimal and explicit only', async () => { const r=await request(`/exam-halls/${a.id}`); assert.equal(r.body.data.assignedStudents.length,1); assert.deepEqual(Object.keys(r.body.data.assignedStudents[0]).sort(),['id','fullName','rollNumber','applicationNo','currentClass','assignedHallId','assignedRoom','seatNo'].sort()); assert.equal(r.body.data.availableSeats,1); });
    await check('unassign clears allocation and matching OfficeUse', async () => { await halls.unassignStudent('s2'); const row=(await setup.query(`SELECT s."assignedHallId",s."assignedHall",s."assignedRoom",s."seatNo",o."testCentre",o."testReportingTime",o."testDate" FROM "Student" s JOIN "OfficeUseRecord" o ON o."studentId"=s.id WHERE s.id='s2'`)).rows[0]; for(const value of Object.values(row)) assert.equal(value,null); });
    await check('unassign preserves independently edited OfficeUse', async () => { await setup.query(`UPDATE "OfficeUseRecord" SET "testCentre"='Independent location',"officeRemarks"='Retain' WHERE "studentId"='s4'`); await halls.updateStudentAllocation('s4',{assignedHallId:null}); const row=(await setup.query(`SELECT * FROM "OfficeUseRecord" WHERE "studentId"='s4'`)).rows[0]; assert.equal(row.testCentre,'Independent location'); assert.equal(row.officeRemarks,'Retain'); assert.equal(row.testReportingTime,null); });
    await check('delete empty hall works', async () => { assert.equal((await request(`/exam-halls/${a.id}`,{method:'DELETE'})).status,200); });
    await check('placement paginates minimal fields with filters', async () => { const r=await request('/exam-halls/candidates?page=2&limit=25&assignment=all&class=Class%209th'); assert.equal(r.status,200); assert.equal(r.body.data.candidates.length,25); assert.deepEqual(r.body.data.pagination,{page:2,limit:25,total:60,totalPages:3}); assert(!('feeStatus' in r.body.data.candidates[0])); const search=await request('/exam-halls/candidates?search=APP60&assignment=unassigned'); assert.equal(search.body.data.candidates[0].id,'s60'); assert.equal((await request('/exam-halls/candidates?limit=101')).status,400); });
    await check('fee status has no effect on allocation', async () => { const h=await create('Fees',2); await halls.batchAssign(h.id,{studentIds:['s5','s6']}); assert.equal((await halls.getExamHallById(h.id)).assignedCount,2); await halls.unassignStudent('s5'); await halls.unassignStudent('s6'); await halls.deleteExamHall(h.id); });
    await check('center changes follow copied schedules, retain Hall overrides', async () => { await centers.updateTestCenter('center-a',{name:'Center renamed',reportingTime:'07:00 AM',testDate:'2026-12-02'}); const hall=await halls.getExamHallById(b.id); assert.equal(hall.reportingTime,'07:00 AM'); assert.equal(hall.examDate,'2026-12-01'); const row=(await setup.query(`SELECT * FROM "OfficeUseRecord" WHERE "studentId"='s1'`)).rows[0]; assert.equal(row.testCentre,'Center renamed'); assert.equal(row.testReportingTime,'07:00 AM'); });
    await check('center occupancy follows Hall IDs and deletion blocks linked halls', async () => { assert.equal((await centers.getTestCenterById('center-a')).assignedCount,1); await conflict(()=>centers.deleteTestCenter('center-a')); });
    await check('ambiguous or invalid dates become unknown safely', async () => { assert.equal(hallDate('2026-02-30'),null); assert.equal(hallDate('01/02/2026'),null); const h=await create('Date',2); await halls.updateExamHall(h.id,{examDate:'Invalid'}); await halls.batchAssign(h.id,{studentIds:['s7']}); assert.equal((await setup.query(`SELECT "testDate" FROM "OfficeUseRecord" WHERE "studentId"='s7'`)).rows[0].testDate,null); await halls.unassignStudent('s7'); await halls.deleteExamHall(h.id); });
    await check('concurrent assignments cannot overfill hall', async () => { const h=await create('Concurrent capacity',1); const result=await Promise.allSettled([halls.batchAssign(h.id,{studentIds:['s8']}),halls.batchAssign(h.id,{studentIds:['s9']})]); assert.equal(result.filter(r=>r.status==='fulfilled').length,1); const rejected=result.find(r=>r.status==='rejected') as PromiseRejectedResult; assert.equal(rejected.reason.statusCode,409); assert.equal((await halls.getExamHallById(h.id)).assignedCount,1); });
    await check('concurrent assignments allocate distinct seats', async () => { const h=await create('Concurrent seats',2); await Promise.all([halls.batchAssign(h.id,{studentIds:['s10']}),halls.batchAssign(h.id,{studentIds:['s11']})]); const roster=(await halls.getExamHallById(h.id)).assignedStudents; assert.equal(new Set(roster.map((s:any)=>s.seatNo)).size,2); });
    await check('legacy mirror edits cannot silently override an explicit allocation', async () => {
      await conflict(()=>halls.updateStudentAllocation('s1',{assignedHall:'Different text',assignedRoom:'Different room'}));
      assert.equal((await setup.query(`SELECT "assignedHallId","assignedHall" FROM "Student" WHERE id='s1'`)).rows[0].assignedHallId,b.id);
    });
    await check('legacy editor empty-seat payload remains compatible', async () => {
      const response=await request('/exam-halls/students/s15/allocation',{method:'PATCH',body:JSON.stringify({assignedHall:'',assignedRoom:'',seatNo:'',testCenterName:''})});
      assert.equal(response.status,200);
      assert.equal(response.body.data.assignedHallId,null);
    });
    await check('legacy editor contract does not create Hall membership', async () => { await halls.updateStudentAllocation('s12',{testCenterId:'center-b',testCenterName:'Legacy',assignedHall:'Legacy text',assignedRoom:'Legacy room',seatNo:'Legacy seat'}); const row=(await setup.query(`SELECT "assignedHallId","assignedHall" FROM "Student" WHERE id='s12'`)).rows[0]; assert.equal(row.assignedHallId,null); assert.equal(row.assignedHall,'Legacy text'); });
    await check('no fake runtime Hall or attendance source remains', () => { const source=fs.readFileSync(path.resolve(__dirname,'../../src/components/admin/halls/ExamHallsView.tsx'),'utf8'); for(const term of ['DEFAULT_HALLS','attendanceMap','presentCount','absentCount','attendanceRate','toggleAttendance','markAllPresent','feeStatus','mockApi.getStudents(','Main Campus Examination Center, Mansehra']) assert(!source.includes(term),term); assert.equal(candidateQuerySchema.parse({}).limit,25); });
    await check('Hall placement canonical aliases preserve search and assignment filters', async () => {
      const aliases=['First Year','1st Year','HSSC-I (Class 11th)','Class 11th (HSSC-I)','Second Year','2nd Year','HSSC-II (Class 12th)','Class 12th (HSSC-II)'];
      for(let i=0;i<aliases.length;i++) await setup.query('UPDATE "Student" SET "currentClass"=$1 WHERE id=$2',[aliases[i],'s'+(16+i)]);
      for(const [canonical,legacy,ids] of [['HSSC_1','First Year',['s16','s17','s18','s19']],['HSSC_2','Second Year',['s20','s21','s22','s23']]] as const){
        const a=await halls.getCandidates(candidateQuerySchema.parse({class:canonical,assignment:'unassigned'}));
        const b=await halls.getCandidates(candidateQuerySchema.parse({class:legacy,assignment:'unassigned'}));
        assert.deepEqual(a.candidates.map(c=>c.id).sort(),[...ids].sort());
        assert.deepEqual(b.candidates.map(c=>c.id).sort(),[...ids].sort());
        const searched=await halls.getCandidates(candidateQuerySchema.parse({class:canonical,search:'APP'+ids[0].slice(1),assignment:'unassigned'}));
        assert.equal(searched.candidates.length,1);assert.equal(searched.candidates[0].id,ids[0]);
      }
    });
    await check('legacy flag reveals no raw mirror text and never creates membership', async () => {
      const result=await halls.getCandidates(candidateQuerySchema.parse({search:'APP60',assignment:'unassigned'}));
      assert.equal(result.candidates[0].legacyAllocationNeedsReview,true);
      assert(!('assignedHall' in result.candidates[0]));assert.equal(result.candidates[0].assignedHallId,null);
      assert.equal((await setup.query('SELECT "assignedHallId" FROM "Student" WHERE id=$1',['s60'])).rows[0].assignedHallId,null);
    });
    console.log(`Hall integrity: ${passed} PASS, 0 FAIL (real isolated local PostgreSQL).`);
  } finally {
    if (server) await new Promise<void>(resolve=>server.close(()=>resolve()));
    if (db) await db.$disconnect();
    await setup.query('SET search_path TO public');
    await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await setup.end();
    console.log('Isolated Hall fixtures cleaned.');
  }
}
run().catch(error => { console.error(error); process.exitCode=1; });
