import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';

async function run() {
  const { build } = require(path.resolve(__dirname, '../../node_modules/esbuild'));
  const bundled = await build({
    stdin: { contents: `export { mockApi } from './src/lib/mockApi';`, resolveDir: path.resolve(__dirname, '../..'), loader: 'ts' },
    bundle: true, write: false, format: 'iife', globalName: 'HallApiTest', platform: 'browser',
    define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://hall.test' }) },
    logLevel: 'silent',
  });
  let payload: any;
  let status = 200;
  let json = true;
  let lastUrl = '';
  const storage = new Map<string,string>();
  const context = vm.createContext({
    console, setTimeout, clearTimeout, URLSearchParams, URL, AbortController, Headers, TextEncoder, TextDecoder,
    Blob, Response, Buffer, btoa, atob,
    localStorage: { getItem: (key:string) => storage.get(key) ?? null, setItem: (key:string,value:string) => storage.set(key,value), removeItem: (key:string) => storage.delete(key) },
    window: { location: { origin: 'http://hall.test', hostname: 'hall.test' } },
    fetch: async (url:string) => { lastUrl=url; return new Response(json ? JSON.stringify(payload) : 'not-json', {status,headers:{'Content-Type':json?'application/json':'text/plain'}}); },
  });
  vm.runInContext(bundled.outputFiles[0].text, context);
  const api = (context as any).HallApiTest.mockApi;
  let passed=0;
  const check=async(name:string,fn:()=>Promise<void>)=>{await fn();passed++;console.log('PASS: '+name);};
  const assign=()=>api.batchAssignStudentsToHall('hall',{hallName:'Hall',roomNumber:'Room'},['s1','s2']);
  await check('batch assignment uses actual unwrapped assignedCount',async()=>{payload={success:true,data:{assignedCount:1}};assert.equal(await assign(),1);});
  await check('zero assignedCount stays zero',async()=>{payload={success:true,data:{assignedCount:0}};assert.equal(await assign(),0);});
  await check('malformed counts never synthesize success',async()=>{for(const data of [{},{count:2},{assignedCount:'2'},{assignedCount:-1},{assignedCount:1.5},null]){payload={success:true,data};await assert.rejects(assign,/Invalid batch allocation/);}});
  await check('HTTP failure rejects allocation',async()=>{status=409;payload={success:false,error:{message:'Capacity exceeded'}};await assert.rejects(assign,/Capacity exceeded/);status=200;});
  await check('non-JSON response rejects allocation',async()=>{json=false;await assert.rejects(assign,/Invalid batch allocation/);json=true;});
  await check('truthful empty halls accepted, malformed list rejected',async()=>{payload={success:true,data:[]};assert.equal((await api.getExamHalls()).length,0);for(const data of [{},[{id:'h'}],null]){payload={success:true,data};await assert.rejects(()=>api.getExamHalls(),/Invalid exam halls/);}});
  await check('create and update reject synthetic hall success',async()=>{payload={success:true,data:{}};await assert.rejects(()=>api.createExamHall({name:'Hall'}),/Invalid created hall/);await assert.rejects(()=>api.updateExamHall('h',{name:'Hall'}),/Invalid updated hall/);payload={success:true,data:{id:'real',name:'Hall'}};assert.equal((await api.createExamHall({name:'Hall'})).id,'real');});
  await check('placement sends pagination, class and search filters',async()=>{payload={success:true,data:{candidates:[],pagination:{page:2,limit:25,total:0,totalPages:0}}};await api.getHallCandidates({page:2,limit:25,class:'Class 9th',search:'Name',assignment:'unassigned'});const q=new URL(lastUrl).searchParams;assert.equal(q.get('page'),'2');assert.equal(q.get('class'),'Class 9th');assert.equal(q.get('assignment'),'unassigned');});
  await check('malformed placement and roster reject',async()=>{payload={success:true,data:{}};await assert.rejects(()=>api.getHallCandidates({}),/Invalid candidate placement/);await assert.rejects(()=>api.getExamHall('h'),/Invalid hall roster/);});
  await check('delete and unassign validate response',async()=>{payload={success:true,data:{}};await assert.rejects(()=>api.deleteExamHall('h'),/Invalid hall deletion/);await assert.rejects(()=>api.unassignStudentFromHall('s'),/Invalid unassignment/);payload={success:true};assert.equal(await api.deleteExamHall('h'),true);payload={success:true,data:{id:'s',assignedHallId:null,seatNo:null}};assert.equal(await api.unassignStudentFromHall('s'),true);});
  await check('Test Centers never invent dates or malformed list success',async()=>{payload={success:true,data:{}};await assert.rejects(()=>api.getTestCenters(),/Invalid test centers/);payload={success:true,data:[{id:'c',name:'Center',reportingTime:'',testDate:'',capacity:0,assignedCount:0}]};const center=(await api.getTestCenters())[0];assert.equal(center.testDate,'');assert.equal(center.reportingTime,'');assert.equal(center.capacity,0);assert.equal(center.createdAt,undefined);});
  console.log(`Hall API contract: ${passed} PASS, 0 FAIL.`);
}
run().catch(error=>{console.error(error);process.exitCode=1;});
