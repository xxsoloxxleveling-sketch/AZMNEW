import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

async function run() {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const url = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || 'postgresql://fixture@127.0.0.1:55432/postgres');
  assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname), 'Synthetic localhost database required');
  url.pathname='/postgres';
  const root = new Client({ connectionString: url.toString() });
  await root.connect();
  const suffix=randomUUID().replaceAll('-',''), dbname='history_role_'+suffix, role='hist_mig_'+suffix, cap='hist_cap_'+suffix;
  const password=randomUUID().replaceAll('-','');
  let db:Client|undefined, migrator:Client|undefined;
  try {
    await root.query(`CREATE DATABASE "${dbname}"`);
    url.pathname='/'+dbname;
    db=new Client({connectionString:url.toString()}); await db.connect();
    const migrations=path.resolve(__dirname,'../prisma/migrations');
    const applied:{name:string;checksum:string}[]=[];
    for(const folder of fs.readdirSync(migrations).sort()) {
      if(folder==='20261114010000_preserve_exam_history') break;
      const file=path.join(migrations,folder,'migration.sql');
      if(fs.existsSync(file)) {
        const contents=fs.readFileSync(file,'utf8'); await db.query(contents);
        applied.push({name:folder,checksum:createHash('sha256').update(contents).digest('hex')});
      }
    }
    await db.query(`CREATE TABLE "_prisma_migrations" (id VARCHAR(36) PRIMARY KEY,checksum VARCHAR(64) NOT NULL,finished_at TIMESTAMPTZ,migration_name VARCHAR(255) NOT NULL,logs TEXT,rolled_back_at TIMESTAMPTZ,started_at TIMESTAMPTZ NOT NULL DEFAULT now(),applied_steps_count INTEGER NOT NULL DEFAULT 0)`);
    for(const migration of applied) await db.query('INSERT INTO "_prisma_migrations"(id,checksum,finished_at,migration_name,applied_steps_count) VALUES($1,$2,now(),$3,1)',[randomUUID(),migration.checksum,migration.name]);
    await db.query("SELECT set_config('azm.control_owner_role',$1,false)",[cap]);
    // Current capability provisioning predates the new archive table.
    const ops=fs.readFileSync(path.resolve(__dirname,'../ops/postgres/exam-control-capability.sql'),'utf8')
      .replace(/ EXECUTE format\('GRANT SELECT,INSERT ON public\."ExamLegacyResultHistory" TO %I',owner_role\);\r?\n/,'')
      .replace(/ EXECUTE format\('GRANT SELECT \(id,"studentId","attendanceSessionId"\), UPDATE \("attendanceSessionId"\) ON public\."ExaminationResult" TO %I',owner_role\);\r?\n/,'')
      .replace(/ EXECUTE format\('GRANT SELECT,INSERT ON public\."OfficialResultAttemptBinding" TO %I',owner_role\);\r?\n/,'')
      .replace("'public.azm_bind_official_result_attempt(text,text)',",'');
    await db.query(ops);
    await db.query(`INSERT INTO "TestCenter"(id,name,code,address,district,"updatedAt") VALUES('fixture-center','Synthetic','FIXTURE','Synthetic','Synthetic',CURRENT_TIMESTAMP);
      INSERT INTO "ExamHall"(id,name,"roomNumber","targetClass","testCenterId","updatedAt") VALUES('fixture-hall','Synthetic','Synthetic','Class 9th','fixture-center',CURRENT_TIMESTAMP);
      ALTER TABLE "AttendanceSession" DISABLE TRIGGER USER;
      INSERT INTO "AttendanceSession"(id,"examHallId","businessDate","attemptNumber","isCurrent","archivedAt",status,"hallNameSnapshot","roomNumberSnapshot","examDateSnapshot","reportingTimeSnapshot","updatedAt") VALUES('fixture-old','fixture-hall','2026-11-14',1,false,CURRENT_TIMESTAMP,'PRE_OPEN','Synthetic','Synthetic','2026-11-14','09:00',CURRENT_TIMESTAMP);
      ALTER TABLE "AttendanceSession" ENABLE TRIGGER USER;
      ALTER TABLE "Student" DISABLE TRIGGER USER;
      INSERT INTO "Student"(id,"applicationNo","qrToken","fullName","fatherName",gender,"dateOfBirth","cnicOrBForm",address,district,province,"parentMobile","currentClass","schoolName","boardOrUniversity","scholarshipCategory","emergencyContact","emergencyRelation","testScore","resultSessionId","updatedAt") VALUES('fixture-student','FIXTURE','FIXTURE','Synthetic','Synthetic','MALE','2008-01-01','FIXTURE','Synthetic','Synthetic','Synthetic','0','Class 9th','Synthetic','Synthetic','GENERAL_MERIT','0','Synthetic',77,'fixture-old',CURRENT_TIMESTAMP);
      ALTER TABLE "Student" ENABLE TRIGGER USER;`);
    // Populate real pre-upgrade tables, then compare the complete synthetic
    // records after both history migrations rather than only checking counts.
    await db.query(`
      ALTER TABLE "AttendanceSessionCandidate" DISABLE TRIGGER USER;
      INSERT INTO "AttendanceSessionCandidate"(id,"sessionId","studentId","fullNameSnapshot","applicationNoSnapshot","currentClassSnapshot") VALUES('fixture-roster','fixture-old','fixture-student','Synthetic','FIXTURE','Class 9th');
      ALTER TABLE "AttendanceSessionCandidate" ENABLE TRIGGER USER;
      ALTER TABLE "Attendance" DISABLE TRIGGER USER;
      INSERT INTO "Attendance"(id,"sessionId","studentId",status,"markedByUserId",method) VALUES('fixture-attendance','fixture-old','fixture-student','PRESENT','fixture-actor','MANUAL');
      ALTER TABLE "Attendance" ENABLE TRIGGER USER;
      ALTER TABLE "ExamControlOperation" DISABLE TRIGGER USER;
      INSERT INTO "ExamControlOperation"(id,"actorId","actorName","idempotencyKey","requestHash",nonce,action,reason,scope,result) VALUES('fixture-audit','fixture-actor','Synthetic','fixture-key','fixture-hash','fixture-nonce','RESET','Synthetic evidence','{}','{}');
      ALTER TABLE "ExamControlOperation" ENABLE TRIGGER USER;
      INSERT INTO "Transaction"(id,type,amount,description) VALUES('fixture-finance','OTHER_INCOME',123.45,'Synthetic financial record');`);
    const preservedTables=['AttendanceSession','AttendanceSessionCandidate','Attendance','ExamControlOperation','Transaction'];
    const snapshot=async()=>Promise.all(preservedTables.map(async table=>JSON.stringify((await db!.query(`SELECT to_jsonb(t) AS value FROM "${table}" t ORDER BY id`)).rows)));
    const beforeUpgrade=await snapshot();
    const sql=fs.readFileSync(path.join(migrations,'20261114010000_preserve_exam_history','migration.sql'),'utf8');
    await db.query(`ALTER TABLE "Student" DISABLE TRIGGER USER; UPDATE "Student" SET "resultSessionId"='fixture-missing' WHERE id='fixture-student'; ALTER TABLE "Student" ENABLE TRIGGER USER`);
    await assert.rejects(()=>db!.query(sql),/references a missing attempt/);
    await db.query('ROLLBACK');
    assert.equal((await db.query(`SELECT "testScore" FROM "Student" WHERE id='fixture-student'`)).rows[0].testScore,77);
    assert.equal((await db.query(`SELECT to_regclass('public."ExamLegacyResultHistory"') AS t`)).rows[0].t,null);
    await db.query(`ALTER TABLE "Student" DISABLE TRIGGER USER; UPDATE "Student" SET "resultSessionId"='fixture-old' WHERE id='fixture-student'; ALTER TABLE "Student" ENABLE TRIGGER USER`);
    console.log('PASS missing historical attempt blocks migration without changing the synthetic score');
    const owners=(await db.query(`SELECT p.proname,pg_get_userbyid(p.proowner) AS owner FROM pg_proc p WHERE p.oid IN ('public.azm_execute_exam_control(text,text)'::regprocedure,'public.require_closed_attendance_reset()'::regprocedure)`)).rows;
    const originalControl=owners.find(r=>r.proname==='azm_execute_exam_control')!.owner;
    const originalValidator=owners.find(r=>r.proname==='require_closed_attendance_reset')!.owner;
    const originalResultsOwner=(await db.query(`SELECT pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid='public."ExaminationResult"'::regclass`)).rows[0].owner;
    assert.equal(originalControl,cap);
    await root.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
    await db.query(`GRANT CONNECT ON DATABASE "${dbname}" TO "${role}"; GRANT USAGE,CREATE ON SCHEMA public TO "${role}"; GRANT SELECT ON "Student","AttendanceSession" TO "${role}"; GRANT UPDATE ("testScore","overallRank","resultSessionId") ON "Student" TO "${role}"; GRANT REFERENCES ON "Student","AttendanceSession","ExamControlOperation","User" TO "${role}"; GRANT SELECT,INSERT,UPDATE ON "_prisma_migrations" TO "${role}";`);
    const roleUrl=new URL(url);roleUrl.username=role;roleUrl.password=password;
    migrator=new Client({connectionString:roleUrl.toString()});await migrator.connect();
    await assert.rejects(()=>migrator!.query(sql),/must be owner of table ExaminationResult/i);
    await migrator.query('ROLLBACK');
    assert.equal((await db.query(`SELECT to_regclass('public."ExamLegacyResultHistory"') AS t`)).rows[0].t,null);
    await db.query(`ALTER TABLE public."ExaminationResult" OWNER TO "${role}"`);
    await assert.rejects(()=>migrator!.query(sql),/must be owner of function/i);
    await migrator.query('ROLLBACK');
    assert.equal((await db.query(`SELECT to_regclass('public."ExamLegacyResultHistory"') AS t`)).rows[0].t,null);
    console.log('PASS restricted migrator cannot alter existing table policy or functions; no partial table');
    await db.query(`ALTER FUNCTION public.azm_execute_exam_control(text,text) OWNER TO "${role}"; ALTER FUNCTION public.require_closed_attendance_reset() OWNER TO "${role}"`);
    execFileSync(process.execPath,[path.resolve(__dirname,'../node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.resolve(__dirname,'../prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:roleUrl.toString(),DIRECT_URL:roleUrl.toString()},stdio:'pipe'});
    assert.equal((await db.query('SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name=ANY($1) AND finished_at IS NOT NULL',[['20261114010000_preserve_exam_history','20261114020000_official_result_attempt_binding']])).rows[0].n,2);
    const moved=(await db.query(`SELECT h."testScore",h."sessionId",s."testScore" AS current_score FROM "ExamLegacyResultHistory" h JOIN "Student" s ON s.id=h."studentId" WHERE h."studentId"='fixture-student'`)).rows;
    assert.equal(moved.length,1); assert.equal(moved[0].testScore,77); assert.equal(moved[0].sessionId,'fixture-old'); assert.equal(moved[0].current_score,null);
    assert.deepEqual(await snapshot(),beforeUpgrade,'Attendance, roster, session, audit and financial records must survive unchanged');
    console.log('PASS pre-upgrade attendance, roster, session, audit and financial records remain unchanged');
    await db.query(`GRANT CREATE ON SCHEMA public TO "${originalControl}"; ALTER FUNCTION public.azm_execute_exam_control(text,text) OWNER TO "${originalControl}"; ALTER FUNCTION public.azm_bind_official_result_attempt(text,text) OWNER TO "${originalControl}"; REVOKE CREATE ON SCHEMA public FROM "${originalControl}"; ALTER FUNCTION public.require_closed_attendance_reset() OWNER TO "${originalValidator}"; ALTER TABLE public."ExaminationResult" OWNER TO "${originalResultsOwner}"; GRANT SELECT,INSERT ON public."ExamLegacyResultHistory",public."OfficialResultAttemptBinding" TO "${originalControl}"; GRANT SELECT (id,"studentId","attendanceSessionId"), UPDATE ("attendanceSessionId") ON public."ExaminationResult" TO "${originalControl}"; REVOKE CREATE ON SCHEMA public FROM "${role}"; REVOKE UPDATE ("testScore","overallRank","resultSessionId") ON "Student" FROM "${role}"; REVOKE REFERENCES ON "Student","AttendanceSession","ExamControlOperation","User" FROM "${role}"; REVOKE SELECT,INSERT,UPDATE ON "_prisma_migrations" FROM "${role}"`);
    await root.query(`ALTER ROLE "${role}" NOLOGIN`);
    const after=(await db.query(`SELECT p.proname,pg_get_userbyid(p.proowner) AS owner FROM pg_proc p WHERE p.oid IN ('public.azm_execute_exam_control(text,text)'::regprocedure,'public.require_closed_attendance_reset()'::regprocedure)`)).rows;
    assert.equal(after.find(r=>r.proname==='azm_execute_exam_control')!.owner,originalControl);
    assert.equal(after.find(r=>r.proname==='require_closed_attendance_reset')!.owner,originalValidator);
    assert.equal((await db.query(`SELECT pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid='public."ExaminationResult"'::regclass`)).rows[0].owner,originalResultsOwner);
    assert.equal((await db.query('SELECT has_schema_privilege($1,\'public\',\'CREATE\') AS allowed',[role])).rows[0].allowed,false);
    assert.equal((await db.query('SELECT has_any_column_privilege($1,\'public."Student"\',\'UPDATE\') AS allowed',[role])).rows[0].allowed,false);
    assert.equal((await db.query('SELECT has_table_privilege($1,\'public."_prisma_migrations"\',\'INSERT,UPDATE\') AS allowed',[role])).rows[0].allowed,false);
    assert.equal((await root.query('SELECT rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0].rolcanlogin,false);
    console.log('PASS synthetic DBA ownership transfer, exact Prisma migrate deploy, ownership restoration and CREATE revocation');
  } finally {
    await migrator?.end().catch(()=>{});
    await db?.end().catch(()=>{});
    await root.query(`DROP DATABASE IF EXISTS "${dbname}" WITH (FORCE)`).catch(()=>{});
    await root.query(`DROP ROLE IF EXISTS "${role}"`).catch(()=>{});
    await root.query(`DROP ROLE IF EXISTS "${cap}"`).catch(()=>{});
    await root.end();
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
