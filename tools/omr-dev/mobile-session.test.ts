import test from 'node:test';
import assert from 'node:assert/strict';
import {apiOrigin,createMemorySession} from '../../apps/omr-mobile/src/session';
const reply=(data:unknown,status=200)=>new Response(JSON.stringify({success:status<400,data}),{status});
const loginData={accessToken:'synthetic-access',refreshToken:'synthetic-refresh',user:{id:'synthetic',name:'Staff',email:'staff@omr.test',role:'TEACHER'}};
test('mobile accepts HTTPS and bounded development origins only',()=>{
  assert.equal(apiOrigin('https://example.test'),'https://example.test');
  assert.equal(apiOrigin('http://10.0.2.2:5055'),'http://10.0.2.2:5055');
  for(const value of ['http://example.test','https://user:pass@example.test','https://example.test/path','https://example.test?token=secret','file:///app']) assert.throws(()=>apiOrigin(value));
});
test('mobile refreshes expired access once for concurrent requests and omits persistent browser credentials',async()=>{
  let refreshes=0;
  const session=createMemorySession(()=>assert.fail('unexpected expiry'),async(input,options)=>{
    assert.equal(options?.credentials,'omit');assert.equal(options?.cache,'no-store');
    if(String(input).endsWith('/login'))return reply(loginData);
    if(String(input).endsWith('/refresh')){refreshes++;await new Promise(resolve=>setTimeout(resolve,15));return reply({...loginData,accessToken:'renewed'});}
    return (options?.headers as Record<string,string>)?.Authorization==='Bearer renewed'?reply([]):reply(null,401);
  });
  await session.login('https://example.test','staff','password');
  await Promise.all([session.client.exams(),session.client.exams()]);assert.equal(refreshes,1);
});
test('mobile reports network failure and refresh rejection without retaining a usable session',async()=>{
  let expired=0,offline=false;
  const session=createMemorySession(()=>expired++,async(input)=>{
    if(offline)throw new TypeError('Network unavailable');
    return String(input).endsWith('/login')?reply(loginData):reply(null,401);
  });
  await session.login('https://example.test','staff','password');offline=true;
  await assert.rejects(session.client.exams(),/Network/);offline=false;
  await assert.rejects(session.client.exams(),/expired/);assert.equal(expired,1);
});
test('logout prevents a late refresh from restoring credentials',async()=>{
  let release:()=>void=()=>{},started:()=>void=()=>{};
  const waiting=new Promise<void>(resolve=>started=resolve),hold=new Promise<void>(resolve=>release=resolve);
  const observed:string[]=[];
  const session=createMemorySession(()=>{},async(input,options)=>{
    if(String(input).endsWith('/login'))return reply(loginData);
    if(String(input).endsWith('/refresh')){started();await hold;return reply({...loginData,accessToken:'zombie'});}
    observed.push((options?.headers as Record<string,string>)?.Authorization||'');return reply(null,401);
  });
  await session.login('https://example.test','staff','password');
  const request=session.client.exams();const rejection=assert.rejects(request,/Session ended/);
  await waiting;session.logout();release();await rejection;
  await assert.rejects(session.client.exams(),/expired/);
  assert.ok(!observed.includes('Bearer zombie'));
});
