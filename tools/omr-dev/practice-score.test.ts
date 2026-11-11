import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePracticeKey,scorePracticeScan} from '../../apps/omr-mobile/src/practice-score';
import type {ScanDetail,Exam} from '../../src/features/omr/contracts';
const exam={questionCount:100,correctMarks:2,incorrectPenalty:.5} as Exam;
const key=Array.from({length:100},(_,i)=>'ABCD'[i%4]).join('');
test('manual practice key needs exactly 100 options',()=>{
 assert.equal(parsePracticeKey('ABCD'),null);
 assert.equal(parsePracticeKey('ABCD'.repeat(25))?.length,100);
 assert.equal(parsePracticeKey('a,b,c,d '.repeat(25))?.length,100);
 assert.equal(parsePracticeKey('ABCD'.repeat(24)+' XBCD'),null);
});
test('practice score is provisional when missing, multiple or uncertain',()=>{
 const answers=Array.from({length:100},(_,i)=>({question:i+1,detectedAnswer:'ABCD'[i%4],reviewedAnswer:null,evidence:{}}));
 answers[0].detectedAnswer='UNCERTAIN';answers[1].detectedAnswer='MULTIPLE';answers[2].detectedAnswer='BLANK';answers[3].detectedAnswer='A';
 const scan={responses:answers} as ScanDetail;
 const result=scorePracticeScan(scan,exam,parsePracticeKey(key)!);
 assert.deepEqual({correct:result?.correct,incorrect:result?.incorrect,blank:result?.blank,multiple:result?.multiple,uncertain:result?.uncertain,provisional:result?.provisional},{correct:96,incorrect:1,blank:1,multiple:1,uncertain:1,provisional:true});
 assert.equal(result?.rawScore,191.5);
});
test('practice scores never fill missing responses or use invalid grading inputs',()=>{
 const scan={responses:[{question:1,detectedAnswer:'A',reviewedAnswer:null,evidence:{}}]} as ScanDetail;
 const out=scorePracticeScan(scan,exam,parsePracticeKey(key)!);
 assert.equal(out?.missing,99);assert.equal(out?.provisional,true);
 assert.equal(scorePracticeScan(scan,exam,[]),null);
});
