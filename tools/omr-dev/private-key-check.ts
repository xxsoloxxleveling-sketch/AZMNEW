/** Local-only private key contract verification; no database, approval or publication. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {scoreOmr,type ApprovedKey,type OmrOption} from '../../backend/src/modules/omr/scoring';
import {parseAnswerKey} from '../../src/features/omr/answerKeys';
if(process.env.CI)throw new Error('Private answer keys must never enter CI');
const manifestPath=process.env.OMR_PRIVATE_KEY_MANIFEST;
if(!manifestPath)throw new Error('Set OMR_PRIVATE_KEY_MANIFEST to the private prepared-key manifest');
const input=JSON.parse(await fs.readFile(manifestPath,'utf8'));
assert.equal(input.testingOnly,true);assert.equal(input.keys.length,44);
assert.equal(new Set(input.keys.map((key:any)=>`${key.group}|${key.paperVersion}`)).size,44);
const keys:ApprovedKey[]=[];
for(const [index,key] of input.keys.entries()) {
  assert.ok(/^[A-D]$/.test(key.paperVersion));assert.equal(key.answers.length,100);
  assert.equal(path.basename(key.csv),key.csv);
  const csv=await fs.readFile(path.join(path.dirname(manifestPath),key.csv),'utf8');
  assert.ok(JSON.stringify(parseAnswerKey(csv))===JSON.stringify(key.answers),'CSV and exact PDF page mapping disagree');
  keys.push({id:`private-test-key-${index}`,revision:1,status:'APPROVED',examId:`private-test-exam-${key.group}`,candidateGroup:key.group,paperVersion:key.paperVersion as OmrOption,answers:key.answers});
}
let mismatches=0;
for(const key of keys) {
  const context={examId:key.examId,candidateGroup:key.candidateGroup,paperVersion:key.paperVersion};
  assert.equal(scoreOmr(key.answers,key,{questionCount:100,correctMarks:1,incorrectPenalty:0},context).correct,100);
  for(const other of keys.filter(other=>other.id!==key.id)) {
    assert.throws(()=>scoreOmr(key.answers,other,{questionCount:100,correctMarks:1,incorrectPenalty:0},context));mismatches++;
  }
  for(const wrong of [{...context,examId:'wrong-examination'},{...context,candidateGroup:'wrong-group'},{...context,paperVersion:('ABCD'.split('').find(version=>version!==key.paperVersion)) as OmrOption}])assert.throws(()=>scoreOmr(key.answers,key,{questionCount:100,correctMarks:1,incorrectPenalty:0},wrong));
  assert.equal(scoreOmr(key.answers,{...key,revision:2},{questionCount:100,correctMarks:1,incorrectPenalty:0},context).answerKeyRevision,2);
  assert.equal(key.revision,1);
}
const summary={keys:keys.length,groups:new Set(keys.map(key=>key.candidateGroup)).size,questionEntries:keys.length*100,crossKeyPairingsRejected:mismatches,exactExamGroupVersionRequired:true,revisionPreserved:true,officialKeysApproved:0,officialScoringAllowed:false,recognitionAccuracy:null};
await fs.writeFile('tmp/omr-reference/private-key-validation.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
