import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttendanceApi, ApiError, isSignedQrShape, extractAttendanceQrToken, sanitizeOrigin, computeSessionMetrics } from '../api.js';

const TOKEN = 'qr_synthetic-123_1794650000000.' + 'a'.repeat(64);
const SESSION = { id:'synthetic-session-1', examHallId:'hall-1', revision:4, isCurrent:true, status:'OPEN', attemptNumber:2 };
const STAFF = { id:'teacher-1', name:'Teacher Example', email:'teacher@example.invalid', role:'TEACHER', status:'ACTIVE' };
const ok = (data, status=200) => ({ok:true,status,json:async()=>({success:true,data})});
const bad = (status, message) => ({ok:false,status,json:async()=>({success:false,error:{message}})});
function clientWith(route) {
  const calls=[];
  const api=createAttendanceApi({origin:'http://localhost:5000',fetchImpl:async(url,init)=>{calls.push({url,init,path:new URL(url).pathname});return route(url,init,calls);}});
  return {api,calls};
}
function loginHandler(url, options) {
  if(url.endsWith('/api/auth/login')) return ok({accessToken:'access-1',refreshToken:'refresh-1',user:STAFF});
  if(url.endsWith('/api/auth/me'))return ok({user:STAFF});
  return bad(404,'Missing test route');
}

test('signed QR shape accepts issued-token format but never unsigned IDs',()=>{
  assert.equal(isSignedQrShape(TOKEN),true);
  for(const token of ['student-id','https://azmaio.com/qr','qr_bad.123','','qr_abc.'+'Z'.repeat(64)])assert.equal(isSignedQrShape(token),false,token);
});
test('actual issued AZM.AIO roll-slip QR link resolves to an opaque signed token',()=>{
  assert.equal(extractAttendanceQrToken(TOKEN), TOKEN);
  assert.equal(extractAttendanceQrToken('https://azmaio.com/attend?token='+encodeURIComponent(TOKEN)),TOKEN);
  assert.equal(extractAttendanceQrToken('https://www.azmaio.com/attend?token='+encodeURIComponent(TOKEN)),TOKEN);
  const forbidden=[
    'https://evil.example/attend?token='+TOKEN,
    'http://azmaio.com/attend?token='+TOKEN,
    'https://azmaio.com/other?token='+TOKEN,
    'https://azmaio.com/attend?token='+TOKEN+'&token='+TOKEN,
    'https://azmaio.com/attend?token='+TOKEN+'&override=true',
    'https://azmaio.com:444/attend?token='+TOKEN,
    'https://azmaio.com/attend?token='+TOKEN+'#unexpected',
    'https://user@azmaio.com/attend?token='+TOKEN,
    'https://azmaio.com.evil.example/attend?token='+TOKEN,
    '', 'raw-student-id', 'https://azmaio.com/attend',
  ];
  for(const item of forbidden)assert.equal(extractAttendanceQrToken(item),null,item);
});
test('origin is HTTPS except loopback development and never accepts secrets/paths',()=>{
  assert.equal(sanitizeOrigin('https://azmaio.com/'),'https://azmaio.com');
  assert.equal(sanitizeOrigin('','http://localhost:8080'),'http://localhost:8080');
  for(const value of ['http://other.example','https://user:pass@example.org','https://example.com/api','https://example.com?debug=1']) assert.throws(()=>sanitizeOrigin(value));
});
test('staff login uses email/password, bearer /me, and keeps tokens in memory',async()=>{
  const {api,calls}=clientWith(loginHandler);
  assert.equal(api.state.signedIn,false);
  const user=await api.login(' Teacher@Example.invalid ','correct-password');
  assert.equal(user.role,'TEACHER');assert.equal(api.state.signedIn,true);
  assert.equal(calls.length,2);
  assert.equal(calls[0].path,'/api/auth/login');
  assert.deepEqual(JSON.parse(calls[0].init.body),{email:'teacher@example.invalid',password:'correct-password'});
  assert.equal(calls[1].path,'/api/auth/me');
  assert.equal(calls[1].init.headers.Authorization,'Bearer access-1');
  assert.equal(calls[0].init.credentials,'omit');
  await api.logout();assert.equal(api.state.signedIn,false);
});
test('forbidden/inactive roles never retain staff login tokens',async()=>{
  const {api}=clientWith(url=>url.endsWith('/auth/login')?ok({accessToken:'a',refreshToken:'r',user:{...STAFF,role:'ACCOUNTANT'}}):ok({user:STAFF}));
  await assert.rejects(()=>api.login('accountant@example.invalid','password'),e=>e.status===403);
  assert.equal(api.state.signedIn,false);
});
test('sessions, roster query and QR mark send the exact AZM API contract',async()=>{
  const {api,calls}=clientWith((url,init)=>{
    if(url.includes('/auth/'))return loginHandler(url,init);
    if(url.endsWith('/api/attendance/scan')) return ok({attendance:{id:'attendance-1',status:'PRESENT',method:'QR_SCAN'},student:{id:'synthetic-student',fullName:'Example Candidate'},message:'success'},201);
    if(url.includes('/attendance/sessions/')&&url.includes('/candidates'))return ok({candidates:[],pagination:{total:0,totalPages:0}});
    if(url.includes('/attendance/sessions?'))return ok({sessions:[SESSION],pagination:{totalPages:1}});
    return bad(404,'Missing');
  });
  await api.login(STAFF.email,'password');
  await api.sessions({page:1,limit:100,status:'OPEN'});
  await api.sessionSummary(SESSION.examHallId);
  await api.candidates(SESSION.id,{page:2,limit:40,search:'Example'});
  const marked=await api.scan(SESSION,'https://azmaio.com/attend?token='+encodeURIComponent(TOKEN));
  assert.equal(marked.attendance.status,'PRESENT');
  const scan=calls.find(x=>x.path==='/api/attendance/scan');
  assert.equal(scan.init.method,'POST');
  assert.deepEqual(JSON.parse(scan.init.body),{sessionId:SESSION.id,revision:4,qrToken:TOKEN,status:'PRESENT'});
  assert.equal(scan.init.headers.Authorization,'Bearer access-1');
  assert.match(calls.find(x=>x.url.includes('examHallId=hall-1')).url,/limit=100/);
  assert.match(calls.find(x=>x.url.includes('/candidates?')).url,/search=Example/);
});
test('QR scan refuses closed, archived and malformed attempts without HTTP write',async()=>{
  const {api,calls}=clientWith(loginHandler);
  await api.login(STAFF.email,'password');
  const before=calls.length;
  for(const variation of [{status:'CLOSED'}, {isCurrent:false},{revision:0}]){
    await assert.rejects(()=>api.scan({...SESSION,...variation},TOKEN),e=>e.status===409);
  }
  await assert.rejects(()=>api.scan(SESSION,'fake-candidate-id'),e=>e.status===400);
  assert.equal(calls.length,before);
});
test('duplicate QR 200 is returned as alreadyMarked, not new success',async()=>{
  const {api}=clientWith(url=>url.includes('/auth/')?loginHandler(url):ok({alreadyMarked:true,student:{fullName:'Example'},attendance:{id:'old'}}));
  await api.login(STAFF.email,'password');
  const duplicate=await api.scan(SESSION,TOKEN);
  assert.equal(duplicate.alreadyMarked,true);
});
test('uncertain network failure never automatically retries a marking POST',async()=>{
  let writes=0;
  const {api}=clientWith(url=>{
    if(url.includes('/auth/'))return loginHandler(url);
    writes++;throw new TypeError('network down');
  });
  await api.login(STAFF.email,'password');
  await assert.rejects(()=>api.scan(SESSION,TOKEN),e=>e.isNetwork===true);
  assert.equal(writes,1);
});
test('expired bearer uses one refresh then retries only 401, preserving strict payload',async()=>{
  let marks=0;
  const {api,calls}=clientWith(url=>{
    if(url.endsWith('/auth/login')||url.endsWith('/auth/me'))return loginHandler(url);
    if(url.endsWith('/auth/refresh'))return ok({accessToken:'access-2',refreshToken:'refresh-2'});
    if(url.endsWith('/attendance/scan')){marks++;return marks===1?bad(401,'expired'):ok({attendance:{id:'new'},student:{id:'x'}});}
    return bad(404,'route');
  });
  await api.login(STAFF.email,'password');await api.scan(SESSION,TOKEN);
  assert.equal(marks,2);
  const marksRequests=calls.filter(x=>x.path.endsWith('/attendance/scan'));
  assert.equal(marksRequests[0].init.headers.Authorization,'Bearer access-1');
  assert.equal(marksRequests[1].init.headers.Authorization,'Bearer access-2');
});
test('refresh failure clears login and stops scanning',async()=>{
  const {api}=clientWith(url=>{
    if(url.endsWith('/auth/login')||url.endsWith('/auth/me'))return loginHandler(url);
    if(url.endsWith('/auth/refresh'))return bad(401,'refresh expired');
    return bad(401,'access expired');
  });
  await api.login(STAFF.email,'password');
  await assert.rejects(()=>api.scan(SESSION,TOKEN),e=>e.status===401);
  assert.equal(api.state.signedIn,false);
});
test('Teacher cannot close; admin must explicitly choose absent behavior',async()=>{
  const {api,calls}=clientWith(loginHandler);await api.login(STAFF.email,'password');
  const before=calls.length;
  await assert.rejects(()=>api.closeSession(SESSION,true),e=>e.status===403);
  assert.equal(calls.length,before);
  const manager={...STAFF,role:'ADMIN'};
  const second=clientWith(url=>{
    if(url.endsWith('/auth/login'))return ok({accessToken:'a',refreshToken:'r',user:manager});
    if(url.endsWith('/auth/me'))return ok({user:manager});
    if(url.endsWith('/close'))return ok({session:{...SESSION,status:'CLOSED'}});
    return bad(404,'route');
  });
  await second.api.login(manager.email,'password');
  await second.api.closeSession(SESSION,false);
  const req=second.calls.find(x=>x.path.endsWith('/close'));
  assert.deepEqual(JSON.parse(req.init.body),{markRemainingAbsent:false});
});
test('manual present uses /sessions/{id}/mark with staff identity and current revision',async()=>{
  const {api,calls}=clientWith(url=>url.includes('/auth/')?loginHandler(url):ok({attendance:{id:'a'},student:{id:'s'}}));
  await api.login(STAFF.email,'password');await api.manualPresent(SESSION,'synthetic-student');
  const mark=calls.find(x=>x.path.endsWith('/mark'));
  assert.deepEqual(JSON.parse(mark.init.body),{revision:4,studentId:'synthetic-student',status:'PRESENT'});
});
test('stats are truthful, including no-session, not imaginary 0% attendance',()=>{
  assert.deepEqual(computeSessionMetrics({stats:{expectedCount:2,presentCount:1,unmarkedCount:1,markedCount:1,completionPercentage:50,qrCount:1}}),{expected:2,marked:1,present:1,absent:0,remaining:1,percent:50,qr:1,manual:0});
});
test('health endpoint reads its unwrapped backend response',async()=>{
  const {api}=clientWith(()=>({ok:true,status:200,json:async()=>({status:'ok',database:{status:'connected'}})}));
  const health=await api.health();assert.equal(health.status,'ok');
});
