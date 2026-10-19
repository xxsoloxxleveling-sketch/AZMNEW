import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

// Real PostgreSQL rehearsal; never accepts a remote or production connection.
const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'backend');
const migration = '20261010120000_attendance_reset_attempts';
const baseline = '6d3f70ca679435ee5b92a29a78e62f2e7bbdded8';
async function run() {
  assert.notEqual(process.env.NODE_ENV, 'production');
  const source = new URL(process.env.ATTENDANCE_TEST_DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname));
  source.pathname = '/postgres'; source.search = '';
  const admin = new Client({ connectionString: source.toString() }); await admin.connect();
  const names = ['clean', 'upgrade', 'interrupted', 'prior_audit', 'restore', 'deploy_recovery'].map(label => 'reset_rehearsal_' + label + '_' + randomUUID().replace(/-/g, ''));
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'azm-reset-migration-'));
  const clients: Client[] = []; let db: any; let passed = 0; let failed = 0;
  const check = async (label: string, fn: () => any) => { try { await fn(); passed++; console.log('PASS: ' + label); } catch (error: any) { failed++; console.error('FAIL: ' + label + ': ' + error.message); } };
  const cli = path.join(backend, 'node_modules/prisma/build/index.js');
  const urlFor = (name: string) => { const url = new URL(source); url.pathname = '/' + name; return url.toString(); };
  const deploy = (name: string, schema: string) => execFileSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', schema], { cwd: backend, env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: urlFor(name), DIRECT_URL: urlFor(name) }, encoding: 'utf8', stdio: 'pipe' });
  const connect = async (name: string) => { const client = new Client({ connectionString: urlFor(name) }); await client.connect(); clients.push(client); return client; };
  const migrationSql = fs.readFileSync(path.join(backend, 'prisma/migrations', migration, 'migration.sql'), 'utf8');
  try {
    for (const name of names) await admin.query(`CREATE DATABASE "${name}"`);
    const prismaDir = path.join(fixture, 'prisma'); const oldMigrations = path.join(prismaDir, 'migrations'); fs.mkdirSync(oldMigrations, { recursive: true });
    for (const folder of fs.readdirSync(path.join(backend, 'prisma/migrations'))) {
      if (folder === migration) continue;
      fs.cpSync(path.join(backend, 'prisma/migrations', folder), path.join(oldMigrations, folder), { recursive: true });
    }
    const oldSchema = path.join(prismaDir, 'schema.prisma');
    fs.writeFileSync(oldSchema, execFileSync('git', ['show', baseline + ':backend/prisma/schema.prisma'], { cwd: root, encoding: 'utf8' }));
    const clean = await connect(names[0]);
    await check('clean Prisma migrate deploy installs every migration', async () => { deploy(names[0], path.join(backend, 'prisma/schema.prisma')); assert((await clean.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')).rows.some(row => row.migration_name === migration)); });
    await check('repeated migrate deploy is a no-op with identical migration ledger', async () => { const before = (await clean.query('SELECT * FROM "_prisma_migrations" ORDER BY id')).rows; deploy(names[0], path.join(backend, 'prisma/schema.prisma')); assert.deepEqual((await clean.query('SELECT * FROM "_prisma_migrations" ORDER BY id')).rows, before); });
    deploy(names[1], oldSchema); deploy(names[2], oldSchema); deploy(names[3], oldSchema); deploy(names[5], oldSchema);
    const upgrade = await connect(names[1]), interrupted = await connect(names[2]);
    await upgrade.query(`INSERT INTO "User" (id,name,email,"passwordHash",role,status,"createdAt","updatedAt") VALUES ('migration-super','Migration Super','migration@test.invalid','fixture','SUPER_ADMIN','ACTIVE',now(),now())`);
    for (const status of ['OPEN', 'CLOSED']) {
      const id = status.toLowerCase();
      await upgrade.query(`INSERT INTO "ExamHall" (id,name,"roomNumber","targetClass",capacity,"reportingTime","examDate","createdAt","updatedAt") VALUES ($1,$1,'Room','Class 9th',20,'08:00','2026-10-10',now(),now())`, [id]);
      await upgrade.query(`INSERT INTO "AttendanceSession" (id,"examHallId","businessDate","openedByUserId",status,"closedByUserId","closedAt","hallNameSnapshot","roomNumberSnapshot","examDateSnapshot","reportingTimeSnapshot") VALUES ($1,$1,'2026-10-10','migration-super',$2::"AttendanceSessionStatus",CASE WHEN $2::text='CLOSED' THEN 'migration-super' END,CASE WHEN $2::text='CLOSED' THEN now() END,$1,'Room','2026-10-10','08:00')`, [id,status]);
      for (const suffix of ['manual','qr','auto-absent']) {
        const student = id + '-' + suffix;
        await upgrade.query(`INSERT INTO "Student" (id,"applicationNo","qrToken","fullName","fatherName",gender,"dateOfBirth","cnicOrBForm",address,district,province,"parentMobile","currentClass","schoolName","boardOrUniversity","scholarshipCategory","emergencyContact","emergencyRelation","createdAt","updatedAt") VALUES ($1,$1,$2,'Synthetic Candidate','Parent','MALE','2008-01-01',$1,'Fixture','Fixture','Fixture','Fixture','Class 9th','Fixture','Fixture','GENERAL_MERIT','Fixture','Parent',now(),now())`, [student,'signed-fixture-'+student]);
        await upgrade.query(`INSERT INTO "AttendanceSessionCandidate" (id,"sessionId","studentId","fullNameSnapshot","applicationNoSnapshot","currentClassSnapshot","seatNoSnapshot") VALUES ($1,$2,$1,'Synthetic Candidate',$1,'Class 9th',$3)`,[student,id,suffix]);
        if (status === 'CLOSED' || suffix !== 'auto-absent') await upgrade.query(`INSERT INTO "Attendance" (id,"sessionId","studentId",date,status,"markedByUserId",method,"createdAt") VALUES ($1,$2,$1,'2026-10-10',$3,'migration-super',$4,now())`,[student,id,suffix==='auto-absent'?'ABSENT':'PRESENT',suffix==='qr'?'QR_SCAN':'MANUAL']);
      }
    }
    await upgrade.query(`UPDATE "Student" SET "testScore"=87,"overallRank"=3,"rollNumber"='OMR-FIXTURE-QR',"qrImageUrl"='/fixture/qr.svg',"uploadedDocsJson"='{"legacy":"fixture"}',"assignedHallId"='closed',"assignedRoom"='Room',"seatNo"='qr' WHERE id='closed-qr'`);
    await upgrade.query(`INSERT INTO "FeeRecord" (id,"studentId",month,"amountDue","amountPaid",status,"challanNumber","dueDate","createdAt","updatedAt") VALUES ('fee','closed-qr','2026-10',1000,500,'PARTIAL','CHALLAN-FIXTURE','2026-10-15',now(),now())`);
    await upgrade.query(`INSERT INTO "Transaction" (id,type,amount,description,source,"relatedFeeId","createdById","createdByName") VALUES ('ledger','FEE_INCOME',500,'Synthetic fee receipt','FEE','fee','migration-super','Migration Super')`);
    await upgrade.query(`INSERT INTO "StudentDocument" (id,"studentId","documentType",bucket,"objectPath","mimeType","createdAt","updatedAt") VALUES ('doc','closed-qr','BFORM','fixture','fixture/path','image/png',now(),now())`);
    await upgrade.query(`INSERT INTO "StudentDocumentAudit" (id,"documentId","studentId","actorId","actorName",action,"createdAt") VALUES ('doc-audit','doc','closed-qr','migration-super','Migration Super','UPLOADED',now())`);
    const tables = ['Student','ExamHall','AttendanceSession','AttendanceSessionCandidate','Attendance','FeeRecord','Transaction','StudentDocument','StudentDocumentAudit'];
    const rows = async () => { const result: Record<string, any[]> = {}; for (const table of tables) result[table] = (await upgrade.query(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY id`)).rows.map(row => row.row); return result; };
    const before = await rows();
    const fkQuery = `SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype='f' ORDER BY conname`;
    const beforeFK = (await upgrade.query(fkQuery)).rows;
    await check('independent reproduction confirms the superseded commit accepted unsafe OPEN archive and forged audit', async () => {
      const prior = await connect(names[3]);
      await prior.query(execFileSync('git',['show','62d8751817340ebc1fe199cfbcb4e11e09ed70ee:backend/prisma/migrations/'+migration+'/migration.sql'],{cwd:root,encoding:'utf8'}));
      await prior.query(`INSERT INTO "ExamHall" (id,name,"roomNumber","targetClass",capacity,"reportingTime","examDate","createdAt","updatedAt") VALUES ('probe','Probe','Room','Class 9th',20,'08:00','2026-10-10',now(),now())`);
      await prior.query(`INSERT INTO "AttendanceSession" (id,"examHallId","businessDate","openedByUserId","hallNameSnapshot","roomNumberSnapshot","examDateSnapshot","reportingTimeSnapshot") VALUES ('probe','probe','2026-10-10','missing-actor','Probe','Room','2026-10-10','08:00')`);
      await prior.query(`UPDATE "AttendanceSession" SET "attemptNumber"=99,"isCurrent"=false,"archivedAt"=now() WHERE id='probe'`);
      await prior.query(`INSERT INTO "AttendanceResetOperation" (id,"actorId","actorName","idempotencyKey","challengeNonce","requestHash",reason,mode,"businessDate","affectedCandidates",scope,result) VALUES ('forged','missing-actor','Liar','not-a-uuid','not-a-nonce','fake','','FAKE','2026-10-11',-1,'{}','{}')`);
      assert.equal((await prior.query(`SELECT "attemptNumber" FROM "AttendanceSession" WHERE id='probe'`)).rows[0].attemptNumber,99);
      assert.equal((await prior.query(`SELECT count(*)::int AS n FROM "AttendanceResetOperation"`)).rows[0].n,1);
    });
    fs.cpSync(path.join(backend,'prisma/migrations',migration),path.join(oldMigrations,migration),{recursive:true});
    fs.copyFileSync(path.join(backend,'prisma/schema.prisma'),oldSchema);
    await check('populated upgrade converts both statuses to current Attempt 1 preserving every row and key',async()=>{deploy(names[1],oldSchema);const after=await rows();for(const row of after.AttendanceSession as any[]) {assert.equal(row.attemptNumber,1);assert.equal(row.isCurrent,true);assert.equal(row.archivedAt,null);delete row.attemptNumber;delete row.isCurrent;delete row.archivedAt;}assert.deepEqual(after,before);assert.deepEqual((await upgrade.query(fkQuery)).rows,beforeFK);});
    await check('interrupted migration rolls back all DDL and permits safe retry',async()=>{const broken=migrationSql.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;');await assert.rejects(()=>interrupted.query(broken));await interrupted.query('ROLLBACK');assert.equal((await interrupted.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='AttendanceSession' AND column_name='attemptNumber'`)).rows[0].n,0);assert.equal((await interrupted.query(`SELECT to_regclass('"AttendanceResetOperation"') AS t`)).rows[0].t,null);await interrupted.query(migrationSql);assert.equal((await interrupted.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='AttendanceSession' AND column_name='attemptNumber'`)).rows[0].n,1);});
    await check('failed Prisma deploy records its failure; verified rollback and resolve permit a successful retry', async () => {
      const recovering = await connect(names[5]);
      const fixtureMigration = path.join(oldMigrations, migration, 'migration.sql');
      fs.writeFileSync(fixtureMigration, migrationSql.replace(/COMMIT;\s*$/, 'SELECT 1/0; COMMIT;'));
      try {
        assert.throws(() => deploy(names[5], oldSchema), (error: any) => /division by zero|current transaction is aborted/.test(String(error.stdout || '') + String(error.stderr || '')));
        const failure = (await recovering.query('SELECT finished_at,rolled_back_at,logs FROM "_prisma_migrations" WHERE migration_name=$1',[migration])).rows;
        assert.equal(failure.length,1);assert.equal(failure[0].finished_at,null);assert.equal(failure[0].rolled_back_at,null);
        // Prisma may leave logs NULL when the failed transaction disconnects;
        // the CLI error and independently inspected schema establish the failure.
        if(failure[0].logs!==null)assert.match(failure[0].logs,/division by zero/);
        assert.equal((await recovering.query(`SELECT to_regclass('"AttendanceResetOperation"') AS t`)).rows[0].t,null);
        assert.equal((await recovering.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='AttendanceSession' AND column_name='attemptNumber'`)).rows[0].n,0);
        execFileSync(process.execPath,[cli,'migrate','resolve','--rolled-back',migration,'--schema',oldSchema],{cwd:backend,env:{...process.env,NODE_ENV:'test',DATABASE_URL:urlFor(names[5]),DIRECT_URL:urlFor(names[5])},stdio:'pipe'});
      } finally { fs.writeFileSync(fixtureMigration,migrationSql); }
      deploy(names[5],oldSchema);
      const states=(await recovering.query('SELECT finished_at,rolled_back_at FROM "_prisma_migrations" WHERE migration_name=$1',[migration])).rows;
      assert.equal(states.filter(row=>row.finished_at!==null).length,1);assert.equal(states.filter(row=>row.rolled_back_at!==null).length,1);
    });
    const rollbackAttack=async(work:()=>any)=>{await upgrade.query('BEGIN');let rejected=false;try{await work();await upgrade.query('SET CONSTRAINTS ALL IMMEDIATE');}catch{rejected=true;}finally{await upgrade.query('ROLLBACK');}assert(rejected,'unsafe transaction was accepted');};
    await check('direct SQL cannot archive OPEN without audited replacement',()=>rollbackAttack(()=>upgrade.query(`UPDATE "AttendanceSession" SET "isCurrent"=false,"archivedAt"=now() WHERE id='open'`)));
    await check('direct SQL cannot archive CLOSED without audited replacement at immediate validation',()=>rollbackAttack(()=>upgrade.query(`UPDATE "AttendanceSession" SET "isCurrent"=false,"archivedAt"=now() WHERE id='closed'`)));
    await check('direct SQL cannot change current generation in place',()=>rollbackAttack(()=>upgrade.query(`UPDATE "AttendanceSession" SET "attemptNumber"=99 WHERE id='open'`)));
    await check('direct SQL cannot insert arbitrary first generation',()=>rollbackAttack(()=>upgrade.query(`INSERT INTO "AttendanceSession" (id,"examHallId","businessDate","attemptNumber","openedByUserId","hallNameSnapshot","roomNumberSnapshot","examDateSnapshot","reportingTimeSnapshot") VALUES ('jump','open','2026-10-11',99,'migration-super','open','Room','2026-10-11','08:00')`)));
    await check('forged standalone or incomplete audit insertion is rejected',()=>rollbackAttack(()=>upgrade.query(`INSERT INTO "AttendanceResetOperation" (id,"actorId","actorName","idempotencyKey","challengeNonce","requestHash",reason,mode,"businessDate","affectedCandidates",scope,result) VALUES ('forged','migration-super','Liar','not-a-uuid','not-a-nonce','fake','','FAKE','2026-10-11',-1,'{}','{}')`)));
    await check('CLOSED evidence and frozen candidate references reject direct modifications/deletion',async()=>{for(const statement of [`UPDATE "Attendance" SET status='LATE' WHERE "sessionId"='closed'`,`DELETE FROM "AttendanceSessionCandidate" WHERE "sessionId"='closed'`,`UPDATE "AttendanceSession" SET "closedAt"=now() WHERE id='closed'`,`DELETE FROM "Student" WHERE id='closed-qr'`])await assert.rejects(()=>upgrade.query(statement));});
    process.env.DATABASE_URL=urlFor(names[1]);process.env.DIRECT_URL=urlFor(names[1]);
    const {PrismaClient}=await import('@prisma/client');db=new PrismaClient();const {AttendanceResetService}=await import('../src/modules/attendance/attendanceReset.service');const reset=new AttendanceResetService(db);
    await check('Prisma mixed OPEN/CLOSED archival validates deferred constraints and exact evidence preservation',async()=>{const preview=await reset.preview({mode:'SELECTED',businessDate:'2026-10-10',sessionIds:['open','closed']},'migration-super');const result:any=await reset.confirm({challenge:preview.challenge,reason:'Migration rehearsal reset',confirmationText:'RESET ATTENDANCE'},'migration-super',randomUUID());assert.equal(result.attempts.length,2);for(const attempt of result.attempts){const previous=await db.attendanceSession.findUnique({where:{id:attempt.previousSessionId}});assert.equal(previous.isCurrent,false);assert.equal(previous.status,attempt.previousSessionId==='closed'?'CLOSED':'OPEN');const next=await db.attendanceSession.findUnique({where:{id:attempt.newSessionId},include:{attendance:true,candidates:true}});assert.equal(next.status,'OPEN');assert.equal(next.attemptNumber,2);assert.equal(next.attendance.length,0);assert.equal(next.candidates.length,3);}for(const table of tables.filter(t=>!['AttendanceSession','AttendanceSessionCandidate'].includes(t)))assert.deepEqual((await rows())[table],before[table]);});
    await check('duplicate audit of an already reset old attempt is rejected even with fresh identifiers',async()=>{const operation=await db.attendanceResetOperation.findFirst();assert(operation,'valid rehearsal reset required');await rollbackAttack(()=>upgrade.query(`INSERT INTO "AttendanceResetOperation" (id,"actorId","actorName","idempotencyKey","challengeNonce","requestHash",reason,mode,"businessDate","affectedCandidates",scope,result,"completedAt") SELECT $1,"actorId","actorName",$2,$3,"requestHash",reason,mode,"businessDate","affectedCandidates",scope,jsonb_set(result,'{resetReference}',to_jsonb($1::text)),"completedAt" FROM "AttendanceResetOperation" WHERE id=$4`,[randomUUID(),randomUUID(),randomUUID(),operation.id]));});
    await check('archived attempts reject edits and repeated generations preserve the exact old CLOSED metadata',async()=>{for(const table of ['AttendanceSession','AttendanceSessionCandidate','Attendance'])await assert.rejects(()=>upgrade.query(`DELETE FROM "${table}" WHERE ${table==='AttendanceSession'?'id':'"sessionId"'}='closed'`));const previous=(await upgrade.query(`SELECT to_jsonb(t)-ARRAY['attemptNumber','isCurrent','archivedAt'] AS row FROM "AttendanceSession" t WHERE id='closed'`)).rows[0].row;assert.deepEqual(previous,(before.AttendanceSession as any[]).find(row=>row.id==='closed'));const currents=await db.attendanceSession.findMany({where:{isCurrent:true}});const preview=await reset.preview({mode:'CURRENT',businessDate:'2026-10-10',sessionIds:currents.map((row:any)=>row.id)},'migration-super');const result:any=await reset.confirm({challenge:preview.challenge,reason:'Repeated migration rehearsal reset',confirmationText:'RESET ATTENDANCE'},'migration-super',randomUUID());assert(result.attempts.every((row:any)=>row.attemptNumber===3));});
    await check('custom-format backup restores exact synthetic rows, FKs and immutable triggers into a fresh database', async () => {
      const pgBin = process.env.ATTENDANCE_TEST_PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
      const executable = (name: string) => path.join(pgBin, name + (process.platform === 'win32' ? '.exe' : ''));
      assert(fs.existsSync(executable('pg_dump')) && fs.existsSync(executable('pg_restore')), 'Set ATTENDANCE_TEST_PG_BIN to local PostgreSQL backup tools');
      const credentials = { ...process.env, PGPASSWORD: decodeURIComponent(source.password), PGSSLMODE: 'disable' };
      const argumentsFor = (name: string) => ['--host', source.hostname, '--port', source.port || '5432', '--username', decodeURIComponent(source.username), '--dbname', name];
      const backup = path.join(fixture, 'synthetic-attendance.dump');
      execFileSync(executable('pg_dump'), [...argumentsFor(names[1]), '--format=custom', '--file', backup], { env: credentials, stdio: 'pipe' });
      execFileSync(executable('pg_restore'), [...argumentsFor(names[4]), '--exit-on-error', '--no-owner', '--no-privileges', backup], { env: credentials, stdio: 'pipe' });
      const restored = await connect(names[4]);
      for (const table of [...tables, 'AttendanceResetOperation', '_prisma_migrations']) {
        const query = `SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY id`;
        assert.deepEqual((await restored.query(query)).rows, (await upgrade.query(query)).rows, table + ' backup rows');
      }
      assert.deepEqual((await restored.query(fkQuery)).rows, (await upgrade.query(fkQuery)).rows);
      const triggerQuery = `SELECT tgname,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname`;
      assert.deepEqual((await restored.query(triggerQuery)).rows, (await upgrade.query(triggerQuery)).rows);
      await assert.rejects(() => restored.query(`UPDATE "AttendanceSession" SET "hallNameSnapshot"='tampered' WHERE id='closed'`));
      await assert.rejects(() => restored.query(`DELETE FROM "AttendanceResetOperation"`));
      console.log('Backup tools: ' + execFileSync(executable('pg_dump'), ['--version'], { encoding: 'utf8' }).trim());
    });
    console.log(`Attendance reset migration rehearsal: ${passed} passed, ${failed} failed; baseline ${baseline}; real localhost PostgreSQL, Prisma migrate deploy and transactions.`);
    if(failed)process.exitCode=1;
  } finally {
    await db?.$disconnect();for(const client of clients)await client.end();
    for(const name of names){await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',[name]);await admin.query(`DROP DATABASE IF EXISTS "${name}"`);}await admin.end();
    assert.equal(path.dirname(path.resolve(fixture)),path.resolve(os.tmpdir()));assert(path.basename(fixture).startsWith('azm-reset-migration-'));fs.rmSync(fixture,{recursive:true,force:true});
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
