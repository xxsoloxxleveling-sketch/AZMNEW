import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {ResultsService} from '../src/modules/results/results.service';
const student={id:'synthetic',rollNumber:'SYNTHETIC-1',applicationNo:'SYNTHETIC-APP',fullName:'Synthetic Candidate',fatherName:'Synthetic Guardian',currentClass:'Class 6th',cnicOrBForm:'00000-0000000-0',scholarshipCategory:'GENERAL_MERIT',testScore:72};
function fixture(score:unknown=null,decision:unknown=null){
  let search:unknown;
  const db={student:{findMany:async(args:unknown)=>{search=args;return [student];}},omrExamResult:{findFirst:async(args:any)=>{assert.equal(args.where.status,'PUBLISHED');assert.equal(args.where.key.isSynthetic,false);assert.equal(args.where.scan.identityVerified,true);return score;}},omrLegacyPublication:{findFirst:async(args:any)=>{assert.deepEqual(args.orderBy,[{createdAt:'desc'},{id:'desc'}]);return decision;}}} as unknown as PrismaClient;
  return {service:new ResultsService(db),search:()=>JSON.stringify(search)};
}
test('a legacy score alone cannot publish marks or invented statistics',async()=>{
  const f=fixture();await assert.rejects(f.service.searchCandidateResult('SYNTHETIC-1'),/authorized release review/);assert.ok(!f.search().includes('contains'));
});
test('latest withheld historical decision overrides earlier releases',async()=>{
  await assert.rejects(fixture(null,{state:'WITHHELD',isSynthetic:false,snapshot:{score:72,maximumScore:150}}).service.searchCandidateResult('SYNTHETIC-1'),/No published/);
});
test('explicit historical release preserves actual marks and maximum without fabricated values',async()=>{
  const value=await fixture(null,{state:'PUBLISHED',isSynthetic:false,snapshot:{score:72,maximumScore:150,rank:null}}).service.searchCandidateResult('SYNTHETIC-1');
  assert.equal(value.obtainedScore,72);assert.equal(value.totalMarks,150);assert.equal(value.percentage,48);assert.equal(value.overallRank,null);assert.equal(value.percentileRank,null);assert.deepEqual(value.subjectScores,[]);assert.equal('interviewDate' in value,false);
});
test('synthetic historical decisions remain private',async()=>{
  await assert.rejects(fixture(null,{state:'PUBLISHED',isSynthetic:true,snapshot:{score:72,maximumScore:100}}).service.searchCandidateResult('SYNTHETIC-1'),/No published/);
});
test('dedicated published result is authoritative over stale compatibility marks',async()=>{
  const value=await fixture({score:121,maximumScore:200,rank:3,subjectScores:[],exam:{}}).service.searchCandidateResult('SYNTHETIC-1');assert.equal(value.obtainedScore,121);assert.equal(value.overallRank,3);assert.equal(value.totalMarks,200);
});
