import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAnswerKey} from '../../src/features/omr/answerKeys';
test('answer-key import preserves explicit question numbers and accepts exactly 100 valid options',()=>{
  const csv='Question,Answer\n'+Array.from({length:100},(_,n)=>`${100-n},${'ABCD'[(99-n)%4]}`).join('\n');
  assert.deepEqual(parseAnswerKey(csv),Array.from({length:100},(_,n)=>'ABCD'[n%4]));assert.equal(parseAnswerKey('A '.repeat(100)).length,100);
});
test('answer-key import rejects omissions, duplicates, invalid options and spreadsheet expressions',()=>{
  const valid=Array.from({length:100},(_,n)=>`${n+1},A`);
  for(const value of ['A '.repeat(99),valid.slice(1).join('\n'),[...valid,'1,B'].join('\n'),valid.join('\n').replace('1,A','1,E'),valid.join('\n').replace('1,A','1,=A')])assert.throws(()=>parseAnswerKey(value));
});
