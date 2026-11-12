import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';
test('each new OMR migration rolls back completely after an injected final-statement failure and can be retried',async t=>{
  const db=new PGlite();
  try {
    const root=path.join(__dirname,'../prisma/migrations');
    for(const folder of fs.readdirSync(root).sort().filter(name=>name<'20261106170000')){
      const file=path.join(root,folder,'migration.sql');if(fs.existsSync(file))await db.exec(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
    }
    const definitions=[['20261106170000_omr_evaluation','OmrExam'],['20261107090000_omr_worker_leases',null],['20261107100000_omr_legacy_release','OmrLegacyPublication']] as const;
    for(const [folder,table] of definitions)await t.test(folder,async()=>{
      const sql=fs.readFileSync(path.join(root,folder,'migration.sql'),'utf8');
      await assert.rejects(db.exec(sql.replace(/COMMIT;\s*$/,'SELECT 1/0; COMMIT;')),/division by zero/);
      await db.exec('ROLLBACK');
      if(table)assert.equal((await db.query<{name:string|null}>(`SELECT to_regclass('public."${table}"')::text AS name`)).rows[0].name,null);
      else assert.equal((await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name='OmrScanBatch' AND column_name='attempts'`)).rows.length,0);
      await db.exec(sql);
    });
  } finally {await db.close();}
});
