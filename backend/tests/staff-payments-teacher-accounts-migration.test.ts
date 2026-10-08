import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { execFileSync, spawn } from 'node:child_process'; import { Client } from 'pg';
export async function disposableStaffDatabase() {
  if(process.env.NODE_ENV==='production') throw new Error('Production testing prohibited.');
  const root=path.resolve(__dirname,'../..'), backend=path.join(root,'backend'), dir=fs.mkdtempSync(path.join(os.tmpdir(),'azm-staff-disposable-'));
  const bin=process.env.STAFF_TEST_POSTGRES_BIN || 'C:/Program Files/PostgreSQL/18/bin';
  execFileSync(path.join(bin,'initdb.exe'),['-D',path.join(dir,'data'),'-U','postgres','-A','trust','--encoding=UTF8','--no-locale'],{windowsHide:true,stdio:'pipe'});
  const port=await new Promise<number>((resolve,reject)=>{const socket=net.createServer();socket.once('error',reject);socket.listen(Number(process.env.STAFF_TEST_POSTGRES_PORT || 0),'127.0.0.1',()=>{const p=(socket.address() as net.AddressInfo).port;socket.close(()=>resolve(p));});});
  const output=fs.openSync(path.join(dir,'postgres.log'),'a');
  const child=spawn(path.join(bin,'postgres.exe'),['-D',path.join(dir,'data'),'-h','127.0.0.1','-p',String(port)],{windowsHide:true,stdio:['ignore',output,output]});
  const url='postgresql://postgres@127.0.0.1:'+port+'/postgres'; let sql:Client|undefined;
  try {
    for(let n=0;n<100;n++){const c=new Client({connectionString:url,connectionTimeoutMillis:1000});try{await c.connect();sql=c;break;}catch{await c.end().catch(()=>{});await new Promise(r=>setTimeout(r,100));}}
    if(!sql)throw new Error('Disposable PostgreSQL did not start: '+fs.readFileSync(path.join(dir,'postgres.log'),'utf8'));
    for(const name of fs.readdirSync(path.join(backend,'prisma/migrations')).sort()) {
      const sqlFile=path.join(backend,'prisma/migrations',name,'migration.sql');
      if(name!=='20261008120000_staff_payments_teacher_accounts' && fs.existsSync(sqlFile)) await sql.query(fs.readFileSync(sqlFile,'utf8'));
    }
    return {url,sql,dir,close:async()=>{await sql!.end();execFileSync(path.join(bin,'pg_ctl.exe'),['-D',path.join(dir,'data'),'stop','-m','fast','-w'],{windowsHide:true,stdio:'pipe'});fs.closeSync(output);}};
  }catch(error){await sql?.end().catch(()=>{});try{execFileSync(path.join(bin,'pg_ctl.exe'),['-D',path.join(dir,'data'),'stop','-m','fast','-w'],{windowsHide:true,stdio:'pipe'});}catch{child.kill();}fs.closeSync(output);throw error;}
}
export async function applyStaffMigration(sql:Client){
  const migration=fs.readFileSync(path.resolve(__dirname,'../prisma/migrations/20261008120000_staff_payments_teacher_accounts/migration.sql'),'utf8');
  assert(!/\b(UPDATE|DELETE FROM|TRUNCATE|DROP TABLE|INSERT INTO)\b/i.test(migration.replace(/ON DELETE SET NULL|ON DELETE RESTRICT|ON UPDATE CASCADE/g,''))); await sql.query(migration);
}
async function run(){const local=await disposableStaffDatabase();try{
  await local.sql.query(`INSERT INTO "Staff" (id,"fullName",role,cnic,phone,"joinDate",salary,"updatedAt") VALUES ('old-staff','Historical Teacher','Teacher','1234512345671','03001234567','2020-01-01',12000,'2020-01-01');
  INSERT INTO "User" (id,name,email,"passwordHash",role,"updatedAt") VALUES ('old-user','Historical','old@test.invalid','old-hash','ADMIN','2020-01-01');
  INSERT INTO "PayrollRecord" (id,"staffId",month,amount,status,"updatedAt") VALUES ('old-payroll','old-staff','2020-01',12000,'PAID','2020-01-01');
  INSERT INTO "Transaction" (id,type,amount,description,source,"relatedPayrollId") VALUES ('old-transaction','SALARY_EXPENSE',12000,'Historical payment','PAYROLL','old-payroll');`);
  const tables=['Staff','User','Transaction','PayrollRecord'];const before=[];for(const t of tables)before.push(await local.sql.query('SELECT * FROM "'+t+'"'));await applyStaffMigration(local.sql);
  for(let i=0;i<tables.length;i++){const after=(await local.sql.query('SELECT * FROM "'+tables[i]+'"')).rows;for(const row of after){if(tables[i]==='Staff'){assert.equal(row.userId,null);delete row.userId;}if(tables[i]==='Transaction'){assert.equal(row.relatedStaffId,null);delete row.relatedStaffId;}}assert.deepEqual(after,before[i].rows);console.log('PASS: migration preserves historical '+tables[i]+' unchanged');}
  assert.equal((await local.sql.query(`SELECT COUNT(*)::int AS count FROM pg_enum WHERE enumtypid='"TransactionSource"'::regtype AND enumlabel='STAFF_PAYMENT'`)).rows[0].count,1);console.log('PASS: STAFF_PAYMENT enum and nullable legacy links');
}finally{await local.close();}}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
