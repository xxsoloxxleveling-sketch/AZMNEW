/** Disposable, loopback-only synthetic environment. Never consumes a supplied database URL. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes,timingSafeEqual } from 'node:crypto';
import {createServer} from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const backendRequire=createRequire(path.join(root,'backend/package.json'));
const namespaced=(module:Record<string,unknown>,name:string):any=>module[name]??(module.default as Record<string,unknown>|undefined)?.[name];
const quote=(value:string)=>'"'+value.replaceAll('"','""')+'"';

export async function startDevelopment(options:{apiPort?:number;workerEnabled?:boolean;privateDirectory?:string;deviceSession?:{id:string;nonce:string}}={}) {
  if(process.env.NODE_ENV==='production') throw new Error('Disposable OMR environment cannot run in production');
  if(options.deviceSession&&(!/^[a-f0-9-]{36}$/.test(options.deviceSession.id)||!/^[a-f0-9]{64}$/.test(options.deviceSession.nonce)))throw new Error('Invalid device acceptance session');
  const db=await PGlite.create();
  let socket:PGLiteSocketServer|undefined,api:ReturnType<typeof import('node:http').createServer>|undefined;
  let timer:ReturnType<typeof setInterval>|undefined,job:Promise<unknown>=Promise.resolve(),prisma:any;
  let ticking=false;
  const stop=async()=>{
    if(timer) clearInterval(timer); await job.catch(()=>{});
    if(api) await new Promise<void>(resolve=>api!.close(()=>resolve()));
    await prisma?.$disconnect(); if(socket) await socket.stop(); await db.close();
  };
  try {
    await db.exec('CREATE ROLE azm_app_dml NOLOGIN; REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO azm_app_dml');
    const migrations=path.join(root,'backend/prisma/migrations'); let applied=0;
    for(const folder of (await fs.readdir(migrations)).sort()) {
      const sql=await fs.readFile(path.join(migrations,folder,'migration.sql'),'utf8').catch(()=>null);
      if(sql!==null) {await db.exec(sql.replace(/^\uFEFF/,''));applied++;}
    }
    await db.exec(await fs.readFile(path.join(root,'backend/ops/postgres/exam-control-capability.sql'),'utf8'));
    const capabilitySecret=randomBytes(48).toString('hex');
    await db.query('INSERT INTO azm_control_private.signing_key(secret) VALUES($1)',[capabilitySecret]);
    const bcrypt=backendRequire('bcryptjs');
    const hash=await bcrypt.hash('Synthetic-Omr-Only-2026!',10);
    for(const [id,email,role] of [['synthetic-super','super@omr.test','SUPER_ADMIN'],['synthetic-admin','admin@omr.test','ADMIN'],['synthetic-teacher','teacher@omr.test','TEACHER']]) {
      await db.query('INSERT INTO "User"(id,name,email,"passwordHash",role,"updatedAt") VALUES($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)',[id,'Synthetic '+role,email,hash,role]);
    }
    await db.exec(`INSERT INTO "Student"(id,"applicationNo","qrToken","rollNumber","fullName","fatherName",gender,"dateOfBirth","cnicOrBForm",address,district,province,"parentMobile","currentClass","schoolName","boardOrUniversity","scholarshipCategory","emergencyContact","emergencyRelation","updatedAt")
      VALUES('synthetic-omr-candidate','SYNTHETIC-APP-0001','synthetic-qr-token','SYNTHETIC-OMR-0001','Synthetic OMR Candidate','Synthetic Guardian','MALE','2013-01-01','SYNTHETIC-NOT-A-REAL-CNIC','Synthetic address','Synthetic district','Synthetic province','00000000000','Class 6th','Synthetic school','Synthetic board','GENERAL_MERIT','00000000000','Guardian',CURRENT_TIMESTAMP);
      INSERT INTO "OmrExam"(id,code,title,session,"candidateGroup","examDate","createdBy","updatedAt",status)
      VALUES('synthetic-omr-exam','SYNTHETIC-OMR-2026','Synthetic OMR development examination','2026-V','CLASS 6TH','2026-11-15','synthetic-super',CURRENT_TIMESTAMP,'APPROVED');
      INSERT INTO "OmrExamPermission"("examId","userId","canScan","canReview","canManage") VALUES
      ('synthetic-omr-exam','synthetic-teacher',true,false,false),('synthetic-omr-exam','synthetic-admin',true,true,true);`);
    await db.query(`INSERT INTO "OmrAnswerKeyRevision"(id,"examId","candidateGroup","paperVersion",revision,answers,status,"isSynthetic","createdBy","approvedBy","approvedAt") VALUES('synthetic-omr-key','synthetic-omr-exam','CLASS 6TH','A',1,$1,'APPROVED',true,'synthetic-super','synthetic-super',CURRENT_TIMESTAMP)`,[JSON.stringify(Array(100).fill('A'))]);
    const tables=await db.query<{relname:string;relrowsecurity:boolean}>(`SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')`);
    for(const table of tables.rows) {
      const audit=['AttendanceResetOperation','AttendanceSessionCancellation','AttendanceSessionReopening','StudentStudyGroupCorrection','OmrCorrectionAudit','OmrPublicationAudit','OmrLegacyPublication'].includes(table.relname);
      const control=['ExamControlOperation','ExamPlacementControl','ExamAttemptSequence','ExamLifecycleEvent'].includes(table.relname);
      const restricted=table.relname.startsWith('Omr')||['Attendance','AttendanceSession','AttendanceSessionCandidate'].includes(table.relname);
      const grant=control?'SELECT':audit?'SELECT,INSERT':restricted?'SELECT,INSERT,UPDATE':'SELECT,INSERT,UPDATE,DELETE';
      await db.exec(`GRANT ${grant} ON public.${quote(table.relname)} TO azm_app_dml`);
      if(table.relrowsecurity) await db.exec(`CREATE POLICY azm_synthetic_development ON public.${quote(table.relname)} FOR ALL TO azm_app_dml USING(true) WITH CHECK(true)`);
    }
    await db.exec('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO azm_app_dml; SET ROLE azm_app_dml');
    const version=await db.query<{version:string}>('SELECT version()');
    socket=new PGLiteSocketServer({db,host:'127.0.0.1',port:0,maxConnections:1,inspect:false,debug:false}); await socket.start();
    // Keep the sole WASM bridge connection for this disposable session. Recycling
    // it while the one-connection socket bridge detaches can reject its replacement.
    const url=`postgresql://postgres@${socket.getServerConn()}/postgres?connection_limit=1&pool_timeout=30&max_idle_connection_lifetime=0&max_connection_lifetime=0`;
    Object.assign(process.env,{NODE_ENV:'development',AZM_DISABLE_MEMORY_FALLBACK:'1',OMR_SYNTHETIC_ENVIRONMENT:'1',DATABASE_URL:url,DIRECT_URL:url,JWT_ACCESS_SECRET:randomBytes(32).toString('hex'),JWT_REFRESH_SECRET:randomBytes(32).toString('hex'),QR_SECRET:randomBytes(32).toString('hex'),EXAM_CONTROL_SIGNING_KEY:capabilitySecret,OMR_PRIVATE_DIR:options.privateDirectory??path.join(root,'tmp/omr-dev/private'),OMR_WORKER_ROOT:path.join(root,'workers/omr')});
    for(const variable of ['R2_BUCKET','R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_ENDPOINT','SUPABASE_SERVICE_ROLE_KEY','OMR_VALIDATION_MANIFEST','OMR_VALIDATION_SIGNING_KEY','OMR_PHYSICAL_REPORT']) process.env[variable]='';
    const venv=path.join(root,'workers/omr/.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
    if(await fs.stat(venv).then(()=>true,()=>false)) process.env.OMR_PYTHON=venv;
    prisma=namespaced(await import(pathToFileURL(path.join(root,'backend/src/lib/prisma.ts')).href),'prisma');
    await prisma.$connect();
    const role=await prisma.$queryRawUnsafe('SELECT current_user');
    if(role[0]?.current_user!=='azm_app_dml') throw new Error('Disposable database did not retain its restricted role');
    const appModule=await import(pathToFileURL(path.join(root,'backend/src/app.ts')).href);
    const app=typeof appModule.default==='function'?appModule.default:appModule.default.default;
    api=createServer((request,response)=>{
      // Local acceptance attestation exists only in this disposable launcher.
      // The random nonce is never included in diagnostics or general logs.
      const supplied=request.headers['x-omr-device-session'];
      const sessionTokenMatches=!!options.deviceSession&&typeof supplied==='string'&&/^[a-f0-9]{64}$/.test(supplied)&&timingSafeEqual(Buffer.from(supplied,'hex'),Buffer.from(options.deviceSession.nonce,'hex'));
      if(options.deviceSession&&request.url==='/__omr-device-session'){
        const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress||'');
        response.setHeader('Cache-Control','no-store');response.setHeader('Content-Type','application/json');
        if(!local||request.method!=='GET'||!sessionTokenMatches){response.writeHead(403);response.end('{"error":"Private device-session token required"}');return;}
        response.end(JSON.stringify({id:options.deviceSession.id,scope:'DISPOSABLE_SYNTHETIC_ONLY',pid:process.pid,officialScoringAllowed:false,publicationAllowed:false}));return;
      }
      // Express routes are case-insensitive by default; protect the same surface.
      if(options.deviceSession&&/^\/api(?:\/|$)/i.test((request.url||'').split('?')[0])){
        if(request.method==='OPTIONS'){
          if(request.headers.origin!=='https://localhost'){response.writeHead(403);response.end();return;}
          response.writeHead(204,{'Access-Control-Allow-Origin':'https://localhost','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,Accept,X-OMR-Device-Session','Vary':'Origin','Cache-Control':'no-store'});response.end();return;
        }
        if(!sessionTokenMatches){response.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end('{"error":"Private device acceptance connection required"}');return;}
      }
      app(request,response);
    }).listen(options.apiPort??5055,'127.0.0.1');await new Promise<void>((resolve,reject)=>{api!.once('listening',resolve);api!.once('error',reject);});
    const queue=namespaced(await import(pathToFileURL(path.join(root,'backend/src/modules/omr/queue.ts')).href),'omrQueue');
    if(options.workerEnabled!==false) {
      timer=setInterval(()=>{if(ticking)return;ticking=true;job=queue.tick().catch(()=>console.error('Synthetic development worker failed; original jobs retained')).finally(()=>{ticking=false;});},1000);
    }
    const address=api.address() as import('node:net').AddressInfo;
    return {url:`http://127.0.0.1:${address.port}`,version:version.rows[0].version,appliedMigrations:applied,tick:()=>queue.tick(),stop};
  } catch(error) {await stop();throw error;}
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const development=await startDevelopment();
  console.log(`Synthetic OMR API: ${development.url}; ${development.appliedMigrations} migrations applied. Database is disposable and loopback-only.`);
  console.log('Fixture accounts and restrictions are documented in tools/omr-dev/README.md. No real records are loaded.');
  let closing=false;
  for(const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>{if(!closing){closing=true;development.stop().then(()=>process.exit(0));}});
}
