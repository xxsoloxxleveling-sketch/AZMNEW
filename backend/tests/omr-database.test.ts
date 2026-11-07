import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertOmrRuntime } from '../src/security/omrRuntimeSafety';
import { PGlite } from '@electric-sql/pglite';

test('OMR additive migration protects synthetic exam evidence under a restricted PostgreSQL role', async t => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE azm_app_dml NOLOGIN;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      GRANT USAGE ON SCHEMA public TO azm_app_dml;
      CREATE TABLE "User"(id text PRIMARY KEY, role text NOT NULL, status text NOT NULL DEFAULT 'ACTIVE');
      CREATE TABLE "Student"(id text PRIMARY KEY);
      INSERT INTO "User" VALUES('synthetic-admin','SUPER_ADMIN','ACTIVE');
      INSERT INTO "Student" VALUES('synthetic-student'),('synthetic-other');`);
    await db.exec(fs.readFileSync(path.join(__dirname,'../prisma/migrations/20261106170000_omr_evaluation/migration.sql'),'utf8').replace(/^\uFEFF/,''));
    for(const folder of ['20261107090000_omr_worker_leases','20261107100000_omr_legacy_release']) await db.exec(fs.readFileSync(path.join(__dirname,'../prisma/migrations',folder,'migration.sql'),'utf8').replace(/^\uFEFF/,''));
    await db.exec(`INSERT INTO "OmrExam"(id,code,title,session,"candidateGroup","examDate","createdBy","updatedAt",status,"releaseAt")
      VALUES('exam','SYNTHETIC','Synthetic examination','2026-V','CLASS-6',CURRENT_TIMESTAMP,'synthetic-admin',CURRENT_TIMESTAMP,'APPROVED',CURRENT_TIMESTAMP-INTERVAL '1 day');`);
    await db.query(`INSERT INTO "OmrAnswerKeyRevision"(id,"examId","candidateGroup","paperVersion",revision,answers,status,"createdBy","approvedBy","approvedAt")
      VALUES('key','exam','CLASS-6','A',1,$1,'APPROVED','synthetic-admin','synthetic-admin',CURRENT_TIMESTAMP)`,[JSON.stringify(Array(100).fill('A'))]);
    await db.query(`INSERT INTO "OmrScan"(id,"examId","studentId","fileHash","originalObjectKey",status,"paperVersion","identityVerified")
      VALUES('scan','exam','synthetic-student',$1,'private/synthetic.png','VERIFIED','A',true)`,['a'.repeat(64)]);
    await db.exec(`INSERT INTO "OmrExamResult"(id,"examId","studentId","sourceScanId","answerKeyId",grade,score,"maximumScore","updatedAt")
      VALUES('result','exam','synthetic-student','scan','key','{}',100,100,CURRENT_TIMESTAMP);
      GRANT SELECT ON "User" TO azm_app_dml;
      SET ROLE azm_app_dml;`);
    await t.test('startup guard accepts least privilege and rejects broader audit access',async()=>{
      const adapter={ $queryRawUnsafe: async <T>(query:string):Promise<T> => (await db.query(query)).rows as T };
      await assertOmrRuntime(adapter);
      await db.exec('RESET ROLE; GRANT UPDATE ON "OmrCorrectionAudit" TO azm_app_dml; SET ROLE azm_app_dml');
      await assert.rejects(()=>assertOmrRuntime(adapter),/unsafe/);
      await db.exec('RESET ROLE; REVOKE UPDATE ON "OmrCorrectionAudit" FROM azm_app_dml; SET ROLE azm_app_dml');
      await assertOmrRuntime(adapter);
    });
    await t.test('deduplication and one result per student/exam are database-enforced',async()=>{
      await assert.rejects(()=>db.query(`INSERT INTO "OmrScan"(id,"examId","fileHash","originalObjectKey") VALUES('duplicate','exam',$1,'private/duplicate')`,['a'.repeat(64)]),/unique/i);
      await assert.rejects(()=>db.exec(`INSERT INTO "OmrExamResult"(id,"examId","studentId","sourceScanId","answerKeyId",grade,score,"maximumScore","updatedAt") VALUES('other-result','exam','synthetic-student','scan','key','{}',99,100,CURRENT_TIMESTAMP)`),/unique/i);
    });
    await t.test('approved keys, raw scan identity and approved exam policies are immutable',async()=>{
      await assert.rejects(()=>db.exec(`UPDATE "OmrAnswerKeyRevision" SET "isSynthetic"=false WHERE id='key'`),/immutable/i);
      await assert.rejects(()=>db.exec(`UPDATE "OmrScan" SET "originalObjectKey"='private/replacement' WHERE id='scan'`),/immutable/i);
      await assert.rejects(()=>db.exec(`UPDATE "OmrExam" SET "correctMarks"=9 WHERE id='exam'`),/immutable/i);
    });
    await t.test('wrong student mapping and synthetic-key publication are rejected',async()=>{
      await assert.rejects(()=>db.exec(`UPDATE "OmrExamResult" SET "studentId"='synthetic-other' WHERE id='result'`),/mismatch/i);
      await assert.rejects(()=>db.exec(`UPDATE "OmrExamResult" SET status='PUBLISHED',"approvedBy"='synthetic-admin',"approvedAt"=CURRENT_TIMESTAMP,"publishedAt"=CURRENT_TIMESTAMP WHERE id='result'`),/gate.*closed/i);
    });
    await t.test('audit history is append-only and runtime cannot truncate, delete or create tables',async()=>{
      await db.exec(`INSERT INTO "OmrCorrectionAudit"(id,"scanId","actorId",previous,next,reason) VALUES('audit','scan','synthetic-admin','{}','{}','Synthetic correction evidence');`);
      for(const query of [`UPDATE "OmrCorrectionAudit" SET reason='tampering'`,`DELETE FROM "OmrCorrectionAudit"`,`TRUNCATE "OmrCorrectionAudit"`,`DELETE FROM "OmrScan"`,`CREATE TABLE omr_unapproved(x int)`]) {
        await assert.rejects(()=>db.exec(query),/permission denied/i);
      }
      await db.exec('RESET ROLE');
      await assert.rejects(()=>db.exec(`DELETE FROM "OmrCorrectionAudit"`),/append-only/i);
      await db.exec('SET ROLE azm_app_dml');
    });
    await t.test('historical release requires active authority, excludes synthetic publication and retains immutable snapshots',async()=>{
      const statement=`INSERT INTO "OmrLegacyPublication"(id,"studentId","actorId",state,"isSynthetic",snapshot,"evidenceReference",reason) VALUES($1,'synthetic-student','synthetic-admin',$2,$3,'{"score":72,"maximumScore":150}','Synthetic archive evidence','Synthetic historical release review')`;
      await assert.rejects(()=>db.query(statement,['legacy-synthetic','PUBLISHED',true]),/Synthetic historical/);
      await db.query(statement,['legacy-withheld','WITHHELD',true]);
      await assert.rejects(()=>db.exec(`UPDATE "OmrLegacyPublication" SET state='PUBLISHED'`),/permission denied/);
      await db.exec('RESET ROLE');
      await assert.rejects(()=>db.exec(`DELETE FROM "OmrLegacyPublication"`),/append-only/);
      await db.exec('SET ROLE azm_app_dml');
    });
    await t.test('failed grading changes roll back associated audit writes',async()=>{
      await assert.rejects(()=>db.transaction(async tx=>{
        await tx.exec(`INSERT INTO "OmrCorrectionAudit"(id,"scanId","actorId",previous,next,reason) VALUES('rollback-audit','scan','synthetic-admin','{}','{}','Synthetic failed correction');`);
        await tx.exec(`UPDATE "OmrExamResult" SET "studentId"='synthetic-other' WHERE id='result'`);
      }),/mismatch/i);
      const count=await db.query<{count:number}>(`SELECT count(*)::int AS count FROM "OmrCorrectionAudit" WHERE id='rollback-audit'`);
      assert.equal(count.rows[0].count,0);
    });
  } finally { await db.close(); }
});
