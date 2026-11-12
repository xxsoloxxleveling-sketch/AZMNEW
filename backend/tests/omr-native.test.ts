import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Client} from 'pg';
import {hsscFixture} from './hssc-fixture';
import {assertOmrRuntime} from '../src/security/omrRuntimeSafety';
test('native PostgreSQL 17 full-history grants and concurrent queue claims',{timeout:180000},async()=>{
  const fixture=await hsscFixture({groupBeforeMigration:true});
  const a=new Client({connectionString:fixture.url}),b=new Client({connectionString:fixture.url});
  try {
    assert.match((await fixture.sql.query('SHOW server_version_num')).rows[0].server_version_num,/^17\d{4}$/);
    await a.connect();await b.connect();
    await assertOmrRuntime({$queryRawUnsafe:async<T>(query:string)=>(await a.query(query)).rows as T});
    await fixture.sql.query(`INSERT INTO "User"(id,name,email,"passwordHash",role,"updatedAt") VALUES('omr-native-admin','Synthetic Staff','synthetic@omr.test','not-a-login-hash','SUPER_ADMIN',CURRENT_TIMESTAMP);
      INSERT INTO "OmrExam"(id,code,title,session,"candidateGroup","examDate","createdBy","updatedAt") VALUES('omr-native-exam','NATIVE-SYNTHETIC','Synthetic examination','SYNTHETIC','CLASS 6TH',CURRENT_TIMESTAMP,'omr-native-admin',CURRENT_TIMESTAMP);
      INSERT INTO "OmrScanBatch"(id,"examId","uploadedBy",source,"originalObjectKey","fileHash") VALUES('omr-native-batch','omr-native-exam','omr-native-admin','WEB','private/synthetic','${'a'.repeat(64)}');`);
    await a.query('BEGIN');await b.query('BEGIN');
    const claim=`SELECT id FROM "OmrScanBatch" WHERE status='QUEUED' ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
    const first=await a.query(claim),second=await b.query(claim);assert.equal(first.rowCount,1);assert.equal(second.rowCount,0);
    await a.query('ROLLBACK');assert.equal((await b.query(claim)).rowCount,1);await b.query('ROLLBACK');
    const insert=`INSERT INTO "OmrScan"(id,"examId","fileHash","originalObjectKey") VALUES($1,'omr-native-exam',$2,'private/synthetic')`;
    const submissions=await Promise.allSettled([a.query(insert,['concurrent-a','b'.repeat(64)]),b.query(insert,['concurrent-b','b'.repeat(64)])]);
    assert.equal(submissions.filter(value=>value.status==='fulfilled').length,1);
    assert.equal((submissions.find(value=>value.status==='rejected') as PromiseRejectedResult).reason.code,'23505');
    await assert.rejects(a.query('TRUNCATE "OmrPublicationAudit"'),/permission denied/);
    // A failed atomic migration rolls its DDL back; migration-tool resolve/retry must follow inspection.
    await assert.rejects(fixture.sql.query('BEGIN; CREATE TABLE omr_atomic_recovery_probe(id int); SELECT 1/0; COMMIT;'),/division by zero/);
    await fixture.sql.query('ROLLBACK');assert.equal((await fixture.sql.query("SELECT to_regclass('public.omr_atomic_recovery_probe') AS relation")).rows[0].relation,null);
    for(const name of ['20261106170000_omr_evaluation','20261107090000_omr_worker_leases','20261107100000_omr_legacy_release']){
      const sql=fs.readFileSync(path.join(__dirname,'../prisma/migrations',name,'migration.sql'),'utf8');assert.match(sql,/^BEGIN;/);assert.match(sql,/COMMIT;\s*$/);
    }
  } finally {await a.end();await b.end();await fixture.close();}
});
