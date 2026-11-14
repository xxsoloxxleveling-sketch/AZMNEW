/** End-to-end HTTP transport test with a disposable in-memory AZM contract server. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createAttendanceApi } from '../api.js';
const TOKEN = 'qr_synthetic-id_1794650000000.' + 'a'.repeat(64);
const session = {id:'synthetic-open',examHallId:'hall-a',isCurrent:true,status:'OPEN',revision:8,attemptNumber:1};
let server;
let port;
let attendance;
let requests;
const user = {id:'invigilator',email:'teacher@example.invalid',name:'Teacher Example',role:'TEACHER',status:'ACTIVE'};
const json = (res,status,data,success=true) => {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(success?{success:true,data}:{success:false,error:{message:data}}));};
function handler(req,res){
  const chunks=[];
  req.on('data',chunk=>chunks.push(chunk));
  req.on('end',()=>{
    const payload=chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};
    const url=new URL(req.url,'http://localhost');
    requests.push({path:url.pathname,method:req.method,body:payload,bearer:req.headers.authorization});
    if(url.pathname==='/api/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:'ok',database:{status:'connected'}}));return;}
    if(url.pathname==='/api/auth/login'){assert.deepEqual(payload,{email:'teacher@example.invalid',password:'synthetic-password'});json(res,200,{accessToken:'a1',refreshToken:'r1',user});return;}
    if(url.pathname==='/api/auth/refresh'){json(res,200,{accessToken:'a2',refreshToken:'r2'});return;}
    if(req.headers.authorization!=='Bearer a1'&&req.headers.authorization!=='Bearer a2'){json(res,401,'Access token required',false);return;}
    if(url.pathname==='/api/auth/me'){json(res,200,{user});return;}
    if(url.pathname==='/api/attendance/sessions'){json(res,200,{sessions:[{...session,stats:{presentCount:attendance?1:0}}],pagination:{page:1,total:1,totalPages:1}});return;}
    if(url.pathname==='/api/attendance/sessions/synthetic-open'){json(res,200,{session,stats:{expectedCount:1,markedCount:attendance?1:0,presentCount:attendance?1:0}});return;}
    if(url.pathname==='/api/attendance/sessions/synthetic-open/candidates'){json(res,200,{candidates:[{studentId:'student-1',fullNameSnapshot:'Synthetic Candidate',status:attendance?'PRESENT':'NOT_MARKED'}],pagination:{total:1,totalPages:1}});return;}
    if(url.pathname==='/api/attendance/scan'&&req.method==='POST'){
      if(payload.revision!==session.revision||payload.sessionId!==session.id)return json(res,409,'Wrong session or revision',false);
      if(payload.qrToken!==TOKEN||payload.status!=='PRESENT')return json(res,400,'Invalid QR token',false);
      const duplicate=Boolean(attendance);
      attendance={id:'mark-1',status:'PRESENT',method:'QR_SCAN'};
      json(res,duplicate?200:201,{attendance,student:{id:'student-1',fullName:'Synthetic Candidate'},alreadyMarked:duplicate});return;
    }
    if(url.pathname.endsWith('/close')){json(res,403,'TEACHER cannot close Hall',false);return;}
    json(res,404,'Not found',false);
  });
}
test.before(async()=>{attendance=null;requests=[];server=createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');port=server.address().port;});
test.after(async()=>{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));});
test('actual HTTP requests reach the exact authenticated AZM attendance contract',async()=>{
  const api=createAttendanceApi({origin:`http://127.0.0.1:${port}`});
  assert.equal((await api.health()).status,'ok');
  await api.login('TEACHER@EXAMPLE.INVALID','synthetic-password');
  assert.equal(api.state.user.role,'TEACHER');
  assert.equal((await api.sessions()).sessions[0].revision,8);
  assert.equal((await api.session(session.id)).session.id,session.id);
  assert.equal((await api.candidates(session.id)).candidates[0].status,'NOT_MARKED');
  const first=await api.scan(session,'https://azmaio.com/attend?token='+encodeURIComponent(TOKEN));
  assert.equal(first.attendance.method,'QR_SCAN');
  assert.equal(first.alreadyMarked,false);
  const second=await api.scan(session,TOKEN);
  assert.equal(second.alreadyMarked,true);
  assert.equal((await api.candidates(session.id)).candidates[0].status,'PRESENT');
  await assert.rejects(()=>api.closeSession(session,false),/Only an administrator/);
  assert.equal(requests.filter(x=>x.path.endsWith('/scan')).length,2);
  assert.ok(requests.filter(x=>x.path.startsWith('/api/attendance/')).every(x=>x.bearer==='Bearer a1'));
  assert.deepEqual(requests.find(x=>x.path==='/api/attendance/scan').body,{sessionId:'synthetic-open',revision:8,qrToken:TOKEN,status:'PRESENT'});
  await api.logout();
  await assert.rejects(()=>api.sessions(),/Please sign in/);
});
