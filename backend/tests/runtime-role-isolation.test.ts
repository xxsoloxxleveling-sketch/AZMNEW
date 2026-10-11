import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { AttendanceCancellationService } from '../src/modules/attendance/attendanceCancellation.service';
import { qrService } from '../src/modules/attendance/qr.service';

const { Client } = pg;
const stamp = () => randomUUID().replaceAll('-', '').slice(0, 18);
const escapeName = (name: string) => {
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(name)) throw new Error('Unexpected synthetic identifier');
  return '"' + name + '"';
};

async function run() {
  if (process.env.NODE_ENV !== 'test')
    throw new Error('Use an explicitly disposable NODE_ENV=test environment.');
  const connectionString = process.env.ATTENDANCE_TEST_DATABASE_URL;
  const serviceContainer = process.env.AZM_SYNTHETIC_PG_CONTAINER;
  if (!connectionString || !serviceContainer ||
      !/^[a-z0-9_-]{12,128}$/i.test(serviceContainer))
    throw new Error('Dedicated localhost database and GitHub PostgreSQL service container required.');
  const url = new URL(connectionString);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !['postgresql:', 'postgres:'].includes(url.protocol))
    throw new Error('Refusing all non-local PostgreSQL targets.');
  const root = new URL(url.toString());
  root.pathname = '/postgres'; root.searchParams.delete('schema');
  const tag = stamp();
  const database = 'azm_role_fixture_' + tag;
  const login = 'azm_fixture_login_' + tag;
  const group = 'azm_fixture_dml_' + tag;
  const pass = randomBytes(32).toString('hex');
  const dbUrl = new URL(root.toString());
  dbUrl.pathname = '/' + database;
  const runtimeUrl = new URL(dbUrl.toString());
  runtimeUrl.username = login;
  runtimeUrl.password = pass;
  const admin = new Client({connectionString:root.toString()});
  let fixture: pg.Client|null=null, runtime: pg.Client|null=null, app: PrismaClient|null=null;
  let madeDatabase=false, madeLogin=false, checks=0;
  async function check(name:string, runCheck:()=>Promise<void>) {
    await runCheck();checks++;console.log('PASS: '+name);
  }
  const reject = async (act:()=>Promise<unknown>, code:string) => {
    await assert.rejects(act, (error:any) => error?.code===code,
      'Expected PostgreSQL SQLSTATE '+code);
  };

  try {
    await admin.connect();
    await admin.query('CREATE DATABASE '+escapeName(database));
    madeDatabase=true;
    fixture = new Client({connectionString:dbUrl.toString()});
    await fixture.connect();
    const migrations=path.resolve(__dirname,'../prisma/migrations');
    for (const folder of fs.readdirSync(migrations).sort()) {
      const file=path.join(migrations,folder,'migration.sql');
      if (fs.existsSync(file)) await fixture.query(fs.readFileSync(file,'utf8'));
    }
    // Prisma's raw migration SQL fixtures intentionally don't create the ledger.
    // Add it explicitly to test that runtime role cannot alter migration history.
    await fixture.query('CREATE TABLE "_prisma_migrations" (id TEXT PRIMARY KEY)');
    await admin.query('CREATE ROLE '+escapeName(login)+
      " LOGIN INHERIT PASSWORD '"+pass+"'");
    madeLogin=true;

    await check('grant operator rejects wrong target database before any privileges change',async()=>{
      const sql=fs.readFileSync(
        path.resolve(__dirname,'../ops/postgres/runtime-grants.sql'),'utf8');
      const result=spawnSync('docker',[
        'exec','-i','-u','postgres',serviceContainer,'psql','-X',
        '-v','ON_ERROR_STOP=1','-U','postgres','-d',database,
        '-v','target_db=incorrect_fixture_database',
        '-v','login_role='+login,'-v','grant_role='+group,
        '-v','approved_ticket=SYNTHETIC-TEST',
        '-v','accept_action=APPLY-AZM-RUNTIME-ROLE-GRANTS'
      ],{input:sql,encoding:'utf8',timeout:30000});
      assert.notEqual(result.status,0,'Incorrect database was accepted');
      assert.equal((await admin.query(
        'SELECT COUNT(*)::integer AS count FROM pg_roles WHERE rolname=$1',
        [group])).rows[0].count,0);
    });
    const sql=fs.readFileSync(
      path.resolve(__dirname,'../ops/postgres/runtime-grants.sql'),'utf8');
    const result=spawnSync('docker',[
      'exec','-i','-u','postgres',serviceContainer,'psql','-X',
      '-v','ON_ERROR_STOP=1','-U','postgres','-d',database,
      '-v','target_db='+database,
      '-v','login_role='+login,'-v','grant_role='+group,
      '-v','approved_ticket=SYNTHETIC-TEST',
      '-v','accept_action=APPLY-AZM-RUNTIME-ROLE-GRANTS'
    ],{input:sql,encoding:'utf8',timeout:30000});
    if(result.status!==0)
      throw new Error('Runtime grant provisioning failed: '+
        (result.stderr||result.stdout).slice(-1800));
    console.log('Isolated least-privilege grants applied in disposable PostgreSQL 17.');

    runtime=new Client({connectionString:runtimeUrl.toString()});
    await runtime.connect();
    app=new PrismaClient({
      datasources:{db:{url:runtimeUrl.toString()}},
      log:['error'],
    });

    await check('app login cannot change public schema or database DDL',async()=>{
      const {rows:[role]}=await runtime!.query(
        "SELECT current_user AS login, has_schema_privilege(current_user,'public','CREATE') AS schema_ddl,"+
        " has_database_privilege(current_user,current_database(),'CREATE') AS database_ddl");
      assert.equal(role.login,login);
      assert.equal(role.schema_ddl,false);
      assert.equal(role.database_ddl,false);
      await reject(()=>runtime!.query('CREATE TABLE public.attempt_privilege_bypass (id integer)'), '42501');
      await reject(()=>runtime!.query('ALTER TABLE public."Attendance" DISABLE TRIGGER ALL'), '42501');
    });
    await check('app login cannot own tables or inherit owner membership',async()=>{
      const {rows:[count]}=await runtime!.query(
        "SELECT COUNT(*)::integer AS ct FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace"+
        " WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')"+
        " AND pg_has_role((SELECT oid FROM pg_roles WHERE rolname=current_user),c.relowner,'MEMBER')");
      assert.equal(count.ct,0);
      const {rows:[role]}=await runtime!.query(
        'SELECT rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user');
      assert(Object.values(role).every(value=>value===false));
    });
    await check('runtime cannot alter the Prisma migration ledger',async()=>{
      await reject(()=>runtime!.query(
        'INSERT INTO "_prisma_migrations"(id) VALUES($1)',['forbidden']), '42501');
      await reject(()=>runtime!.query('DELETE FROM "_prisma_migrations"'), '42501');
    });
    await check('runtime cannot update or delete immutable cancellation/reset audits',async()=>{
      await reject(()=>runtime!.query('DELETE FROM "AttendanceResetOperation"'),'42501');
      await reject(()=>runtime!.query('UPDATE "AttendanceSessionCancellation" SET reason=$1',
        ['forbidden']),'42501');
    });
    const id='sa_'+tag;
    const teacher='teacher_'+tag;
    const hall='hall_'+tag;
    const student='student_'+tag;
    await app.user.create({data:{
      id,name:'Synthetic Super Admin',email:id+'@test.invalid',passwordHash:'synthetic',role:'SUPER_ADMIN',
    }});
    await app.user.create({data:{
      id:teacher,name:'Synthetic Teacher',email:teacher+'@test.invalid',passwordHash:'synthetic',role:'TEACHER',
    }});
    await app.examHall.create({data:{
      id:hall,name:'Synthetic Hall',roomNumber:'1',targetClass:'Class 9th',
      examDate:'2026-10-10',reportingTime:'08:00',
    }});
    const qrToken=qrService.generateSignedQrToken(student);
    await app.student.create({data:{
      id:student,applicationNo:'SYNTHETIC-'+tag,qrToken,fullName:'Synthetic Candidate',
      fatherName:'Synthetic Parent',gender:'MALE',dateOfBirth:new Date('2008-01-01'),
      cnicOrBForm:'SYNTHETIC-'+tag,address:'Test',district:'Test',province:'Test',
      parentMobile:'0',currentClass:'Class 9th',schoolName:'Test',
      boardOrUniversity:'Test',scholarshipCategory:'GENERAL_MERIT',
      emergencyContact:'0',emergencyRelation:'Test',assignedHallId:hall,
    }});
    const service=new AttendanceService(app);
    const cancellation=new AttendanceCancellationService(app);
    const session=(await service.openSession(hall,id)).session;
    await service.mark(session.id,{qrToken,status:'PRESENT'},teacher);

    await check('restricted runtime can open Hall, mark QR and read frozen roster',async()=>{
      assert.equal((await service.getSession(session.id)).stats.markedCount,1);
      assert.equal(await app!.attendanceSessionCandidate.count({
        where:{sessionId:session.id}}),1);
    });
    await check('restricted runtime cannot bypass attendance deletion trigger',async()=>{
      await reject(()=>runtime!.query(
        'DELETE FROM "Attendance" WHERE "sessionId"=$1',[session.id]),'23514');
      assert.equal(await app!.attendance.count({where:{sessionId:session.id}}),1);
    });
    await check('restricted runtime can execute authorized exact-session cancellation and purge',async()=>{
      const impact=await cancellation.preview(session.id,{purgeAttendance:true},id,0);
      assert.equal(impact.impact.markedCount,1);
      const receipt=await cancellation.confirm(session.id,{
        challenge:impact.challenge,
        reason:'Approved synthetic test cancellation for role isolation',
        confirmationText:'CANCEL SESSION AND DELETE ATTENDANCE',
        approvalReference:'SYNTHETIC-APPROVAL-ONLY',
        retentionApproved:true,
        externalDispositionAttested:true,
        irreversibleDeletionAcknowledged:true,
      },id,randomUUID(),0);
      assert.equal(receipt.status,'CANCELLED');
      assert.equal(receipt.deletedCount,1);
      assert.equal(await app!.attendance.count({where:{sessionId:session.id}}),0);
      assert.equal(await app!.attendanceSessionCandidate.count({where:{sessionId:session.id}}),1);
      assert.equal(await app!.attendanceSessionCancellation.count({where:{sessionId:session.id}}),1);
    });
    await check('runtime cannot disable triggers after authorized cancellation',async()=>{
      await reject(()=>runtime!.query(
        'ALTER TABLE "AttendanceSessionCancellation" DISABLE TRIGGER ALL'),'42501');
    });
    console.log('PostgreSQL runtime role separation: '+checks+' focused checks PASS.');
  } finally {
    await app?.$disconnect();
    await runtime?.end();
    await fixture?.end();
    if(madeDatabase){
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',[database]);
      await admin.query('DROP DATABASE IF EXISTS '+escapeName(database));
    }
    if(madeLogin){
      await admin.query('DROP ROLE IF EXISTS '+escapeName(login));
      await admin.query('DROP ROLE IF EXISTS '+escapeName(group));
    }
    await admin.end();
  }
}
run().catch(error=>{console.error('Synthetic role isolation FAILED:',error);process.exitCode=1;});
